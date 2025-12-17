package main

import (
	"bufio"
	"context"
	"fmt"
	"io/ioutil"
	"net"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/blang/semver"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rhysd/go-github-selfupdate/selfupdate"
)

var Version = "1.0.0"

// App struct
type App struct {
	ctx         context.Context
	printerConn net.Conn
	printLock   sync.Mutex

	// WebSocket
	wsConn      *websocket.Conn
	wsLock      sync.Mutex
	wsRequests  map[string]chan ScanResponseData
	wsReqLock   sync.Mutex
	isConnected bool
	activeWSURL string
}

// WSMessage structure (same as backend)
type WSMessage struct {
	Type      string      `json:"type"`
	RequestID string      `json:"request_id"`
	Data      interface{} `json:"data"`
}

// ScanResponseData structure (same as backend)
type ScanResponseData struct {
	Success     bool   `json:"success"`
	Message     string `json:"message"`
	OrderNo     string `json:"order_no"`
	ProductName string `json:"product_name"`
	WaybillNo   string `json:"waybill_no"`
	InvoiceURL  string `json:"invoice_url"`
	ZPLString   string `json:"zpl_string"`
	WorkFlag    string `json:"work_flag"`
	Status      string `json:"status"`
	Hold        string `json:"hold"`
	OrderCS     string `json:"order_cs"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		wsRequests: make(map[string]chan ScanResponseData),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// GetVersion returns the application version
func (a *App) GetVersion() string {
	return Version
}

// CheckForUpdates checks for updates and applies them if available
func (a *App) CheckForUpdates() (string, error) {
	// TODO: Configure the repository slug correctly
	slug := "chaos/AutoPackingSystem"

	latest, found, err := selfupdate.DetectLatest(slug)
	if err != nil {
		return "", fmt.Errorf("error checking for updates: %w", err)
	}
	if !found {
		return "No updates found", nil
	}

	currentVersion, err := semver.Parse(Version)
	if err != nil {
		return "", fmt.Errorf("invalid current version: %w", err)
	}

	if latest.Version.GT(currentVersion) {
		// Update found
		// Note: This performs a binary replacement.
		// If using an installer, you might want to download the installer asset and run it instead.
		// For now, we use binary replacement as it is supported by the library.

		// On Windows, the running executable is renamed and the new one is placed.
		exe, err := os.Executable()
		if err != nil {
			return "", fmt.Errorf("could not locate executable path: %w", err)
		}

		if err := selfupdate.UpdateTo(latest.AssetURL, exe); err != nil {
			return "", fmt.Errorf("error occurred during update: %w", err)
		}

		return fmt.Sprintf("Updated to version %s. Please restart the application.", latest.Version), nil
	}

	return "App is up to date", nil
}

// GetSystemUUID returns the system UUID
func (a *App) GetSystemUUID() string {
	if runtime.GOOS == "darwin" {
		out, err := exec.Command("bash", "-c", "ioreg -d2 -c IOPlatformExpertDevice | awk -F\\\" '/IOPlatformUUID/{print $(NF-1)}'").Output()
		if err != nil {
			return ""
		}
		return strings.TrimSpace(string(out))
	}
	return "UNKNOWN-UUID"
}

// PrintZPL sends ZPL data to a network printer using a persistent connection
func (a *App) PrintZPL(printerIP string, zplData string) string {
	a.printLock.Lock()
	defer a.printLock.Unlock()

	if printerIP == "" {
		return "Error: Printer IP is empty"
	}

	target := printerIP
	if !strings.Contains(target, ":") {
		target = target + ":9100"
	}

	connect := func() error {
		if a.printerConn != nil {
			a.printerConn.Close()
		}
		conn, err := net.DialTimeout("tcp", target, 2*time.Second)
		if err != nil {
			return err
		}
		a.printerConn = conn
		return nil
	}

	// Try to use existing connection
	if a.printerConn == nil {
		if err := connect(); err != nil {
			return fmt.Sprintf("Error connecting to printer: %v", err)
		}
	}

	// Set write deadline
	if err := a.printerConn.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
		a.printerConn.Close()
		a.printerConn = nil
		return fmt.Sprintf("Error setting deadline: %v", err)
	}

	// Send ZPL
	_, err := a.printerConn.Write([]byte(zplData))
	if err != nil {
		// Retry once
		fmt.Println("Write failed, reconnecting...", err)
		if err := connect(); err != nil {
			return fmt.Sprintf("Error reconnecting: %v", err)
		}
		if err := a.printerConn.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
			a.printerConn.Close()
			a.printerConn = nil
			return fmt.Sprintf("Error setting deadline retry: %v", err)
		}
		_, err = a.printerConn.Write([]byte(zplData))
		if err != nil {
			a.printerConn.Close()
			a.printerConn = nil
			return fmt.Sprintf("Error sending ZPL after retry: %v", err)
		}
	}

	return "Success"
}

// PrinterInfo holds printer name and IP
type PrinterInfo struct {
	Name string `json:"name"`
	IP   string `json:"ip"`
}

// GetPrinters returns a list of available printers with their IPs
func (a *App) GetPrinters() []PrinterInfo {
	var printers []PrinterInfo

	if runtime.GOOS == "windows" {
		// Windows: wmic printer get name, portname /format:csv
		// This is more reliable for simple parsing than PowerShell JSON which varies by version
		cmdWmic := exec.Command("wmic", "printer", "get", "name,portname", "/format:csv")
		outWmic, errWmic := cmdWmic.Output()
		if errWmic == nil {
			lines := strings.Split(string(outWmic), "\n")
			// CSV format: Node, Name, PortName
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}
				parts := strings.Split(line, ",")
				if len(parts) >= 3 {
					// parts[0] is Node (computer name)
					name := parts[1]
					port := parts[2]
					if name == "Name" {
						continue
					} // Header

					// Try to extract IP from port
					// Common formats: "192.168.1.10", "IP_192.168.1.10", "WSD-..."
					ip := ""
					if strings.Contains(port, ".") {
						// Simple heuristic: if it looks like an IP
						// Regex would be better but simple check:
						if strings.Count(port, ".") >= 3 {
							// Clean up "IP_" prefix if exists
							cleanPort := strings.TrimPrefix(port, "IP_")
							ip = cleanPort
						}
					}
					printers = append(printers, PrinterInfo{Name: name, IP: ip})
				}
			}
		}
	} else {
		// macOS/Linux: lpstat -v
		// Output: device for <printer>: <uri>
		// device for Kyocera: socket://192.168.0.201:9100
		cmd := exec.Command("lpstat", "-v")
		output, err := cmd.Output()
		if err == nil {
			lines := strings.Split(string(output), "\n")
			for _, line := range lines {
				// Parse: device for [name]: [uri]
				if strings.HasPrefix(line, "device for ") {
					parts := strings.SplitN(line, ": ", 2)
					if len(parts) == 2 {
						namePart := parts[0] // "device for Name"
						uriStr := parts[1]   // "socket://..."
						name := strings.TrimPrefix(namePart, "device for ")

						// Extract IP from URI
						ip := resolveURI(uriStr)
						// Only include if IP resolves
						if ip != "" {
							printers = append(printers, PrinterInfo{Name: name, IP: ip})
						}
					}
				}
			}
		}
	}

	return printers
}

// resolveURI attempts to extract a valid IP from a printer URI
func resolveURI(uriStr string) string {
	// 1. Simple parsing for socket:// or ipp:// using standard URL parsing
	// clean generic uri
	if strings.Contains(uriStr, "://") {
		u, err := url.Parse(uriStr)
		if err == nil {
			host := u.Hostname()
			// If host is an IP, return it
			if net.ParseIP(host) != nil {
				return host
			}
			// If host is not IP, it might be a hostname or service name
			// Logic to resolve Bonjour/mDNS addresses
			// Example: HP%20OfficeJet...._ipps._tcp.local.
			// The URL parser might have decoded or kept it.
			// u.Hostname() usually decodes %20 to space if strictly parsed?
			// Actually u.Host for "scheme://host/path"

			// Check if it looks like mDNS
			if strings.Contains(host, ".local") || strings.Contains(host, "_tcp") {
				resolvedIP := resolveMDNS(host)
				if resolvedIP != "" {
					return resolvedIP
				}
			}

			// Try standard lookup (for hostname.local)
			ips, err := net.LookupIP(host)
			if err == nil && len(ips) > 0 {
				return ips[0].String()
			}

			return host // Return hostname if resolution fails
		}
	}
	return ""
}

// resolveMDNS attempts to resolve complex Bonjour strings found in URIs using dns-sd
func resolveMDNS(hostStr string) string {
	// Expected format: "Instance Name._service._tcp.local."
	// Or just "hostname.local"

	// 1. Unescape if needed (though url.Parse might have done it)
	decoded, err := url.QueryUnescape(hostStr)
	if err == nil {
		hostStr = decoded
	}

	// Regex to split Instance and ServiceType
	// E.g. "HP OfficeJet... ._ipps._tcp.local."
	// Regex pattern: ^(.*)\.(_[a-zA-Z0-9]+)\.(_[a-zA-Z0-9]+)\.(local\.?)$
	re := regexp.MustCompile(`^(.*)\.(_[a-zA-Z0-9]+)\.(_[a-zA-Z0-9]+)\.(local\.?)$`)
	matches := re.FindStringSubmatch(hostStr)

	if len(matches) == 5 {
		rawInstanceName := matches[1]
		serviceType := matches[2]
		protocol := matches[3]
		fullType := serviceType + "." + protocol

		// Decode the instance name (e.g., %20 -> space)
		instanceName, err := url.QueryUnescape(rawInstanceName)
		if err != nil {
			instanceName = rawInstanceName
		}

		fmt.Printf("Attempting to resolve mDNS: Instance='%s', Type='%s'\n", instanceName, fullType)

		// Use explicit context for timeout
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		cmd := exec.CommandContext(ctx, "dns-sd", "-L", instanceName, fullType, "local")

		stdout, err := cmd.StdoutPipe()
		if err != nil {
			fmt.Printf("Error creating stdout pipe: %v\n", err)
			return ""
		}

		if err := cmd.Start(); err != nil {
			fmt.Printf("Error starting dns-sd: %v\n", err)
			return ""
		}

		// Use scanner to read output line by line
		scanner := bufio.NewScanner(stdout)
		resolvedIP := ""

		go func() {
			// Ensure command is killed if we finish early or context cancels
			<-ctx.Done()
			if cmd.Process != nil {
				cmd.Process.Kill()
			}
		}()

		for scanner.Scan() {
			line := scanner.Text()
			// fmt.Printf("dns-sd line: %s\n", line)
			if idx := strings.Index(line, "can be reached at"); idx != -1 {
				remainder := line[idx+len("can be reached at"):]
				parts := strings.Fields(remainder)
				if len(parts) > 0 {
					targetHost := parts[0]
					if cIdx := strings.Index(targetHost, ":"); cIdx != -1 {
						targetHost = targetHost[:cIdx]
					}

					// Resolve the target host (e.g. printer.local.)
					ips, errLookup := net.LookupIP(targetHost)
					if errLookup == nil && len(ips) > 0 {
						fmt.Printf("Resolved IP for %s: %s\n", instanceName, ips[0].String())
						resolvedIP = ips[0].String()
						cancel() // Stop command immediately
						break
					} else {
						fmt.Printf("LookupIP failed for %s: %v\n", targetHost, errLookup)
					}
				}
			}
		}

		if resolvedIP != "" {
			return resolvedIP
		}

		// Wait for command to finish (or kill)
		cmd.Wait()
	} else {
		// Simple .local hostname?
		ips, err := net.LookupIP(hostStr)
		if err == nil && len(ips) > 0 {
			return ips[0].String()
		}
	}
	return ""
}

// WebSocket Implementation

// Ping is a heartbeat check
func (a *App) Ping() string {
	return "Pong"
}

func (a *App) ConnectWebSocket(url string) string {
	a.wsLock.Lock()
	defer a.wsLock.Unlock()

	if a.wsConn != nil {
		a.wsConn.Close()
	}

	fmt.Println("BRIDGE: Attempting to connect to WS URL:", url)
	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		fmt.Println("BRIDGE: Connection failed:", err)
		a.isConnected = false
		return fmt.Sprintf("Error connecting: %v", err)
	}

	a.wsConn = c
	a.isConnected = true
	a.activeWSURL = url
	fmt.Println("BRIDGE: Connection successful!")

	// Start reading loop
	go a.readLoop(c)

	return "Connected"
}

func (a *App) readLoop(conn *websocket.Conn) {
	defer func() {
		a.wsLock.Lock()
		// Only clear state if we are the current connection
		if a.wsConn == conn {
			fmt.Println("BRIDGE: Closing current connection and clearing state")
			a.wsConn.Close()
			a.wsConn = nil
			a.isConnected = false
		} else {
			fmt.Println("BRIDGE: readLoop finished for OLD connection (ignored state reset)")
			conn.Close() // Ensure old connection cleans up
		}
		a.wsLock.Unlock()
	}()

	for {
		var msg WSMessage
		// We use the 'conn' passed to us, which is immutable for this goroutine

		err := conn.ReadJSON(&msg)
		if err != nil {
			fmt.Println("read error:", err)
			break
		}

		// Handle Scan Result
		if msg.Type == "SCAN_RESULT" {
			dataMap, ok := msg.Data.(map[string]interface{})
			if ok {
				// Helper to safely get string
				getString := func(m map[string]interface{}, key string) string {
					if val, ok := m[key]; ok {
						if str, ok := val.(string); ok {
							return str
						}
					}
					return ""
				}

				// Convert map to ScanResponseData
				resp := ScanResponseData{
					Success:     dataMap["success"].(bool),
					Message:     getString(dataMap, "message"),
					OrderNo:     getString(dataMap, "order_no"),
					ProductName: getString(dataMap, "product_name"),
					WaybillNo:   getString(dataMap, "waybill_no"),
					InvoiceURL:  getString(dataMap, "invoice_url"),
					ZPLString:   getString(dataMap, "zpl_string"),
					WorkFlag:    getString(dataMap, "work_flag"),
					Status:      getString(dataMap, "status"),
					Hold:        getString(dataMap, "hold"),
					OrderCS:     getString(dataMap, "order_cs"),
				}

				a.wsReqLock.Lock()
				if ch, exists := a.wsRequests[msg.RequestID]; exists {
					ch <- resp
					delete(a.wsRequests, msg.RequestID)
				}
				a.wsReqLock.Unlock()
			}
		}
	}
}

func (a *App) ScanBarcodeWS(orderNo, startDate, endDate, shipperCode, waybillNo, productCode string, machineID int, accountID int, templateId string) (*ScanResponseData, error) {
	if !a.isConnected {
		fmt.Println("BRIDGE: ScanBarcodeWS called but NOT CONNECTED")
		// Auto-reconnect attempt
		if a.activeWSURL != "" {
			fmt.Println("BRIDGE: Auto-reconnecting to", a.activeWSURL)
			res := a.ConnectWebSocket(a.activeWSURL)
			if res != "Connected" {
				return nil, fmt.Errorf("not connected to server (reconnect failed: %s)", res)
			}
		} else {
			return nil, fmt.Errorf("not connected to server (no active URL)")
		}
	}
	fmt.Println("BRIDGE: ScanBarcodeWS sending request...")

	reqID := uuid.New().String()
	ch := make(chan ScanResponseData, 1)

	a.wsReqLock.Lock()
	a.wsRequests[reqID] = ch
	a.wsReqLock.Unlock()

	reqData := map[string]interface{}{
		"order_no":    orderNo,
		"start_date":  startDate,
		"end_date":    endDate,
		"shipper_cd":  shipperCode,
		"waybill_no":  waybillNo,
		"product_cd":  productCode,
		"machine_id":  machineID,
		"account_id":  accountID,
		"template_id": templateId,
	}

	msg := WSMessage{
		Type:      "SCAN",
		RequestID: reqID,
		Data:      reqData,
	}

	a.wsLock.Lock()
	if a.wsConn == nil {
		a.wsLock.Unlock()
		return nil, fmt.Errorf("connection lost")
	}
	err := a.wsConn.WriteJSON(msg)
	a.wsLock.Unlock()

	if err != nil {
		return nil, err
	}

	select {
	case res := <-ch:
		return &res, nil
	case <-time.After(5 * time.Second): // Timeout
		a.wsReqLock.Lock()
		delete(a.wsRequests, reqID)
		a.wsReqLock.Unlock()
		return nil, fmt.Errorf("request timed out")
	}

}

// PrintInvoice writes the provided HTML/Image content to a temp file, converts to PDF using Chrome, and prints it
func (a *App) PrintInvoice(printerName string, htmlContent string) (string, error) {
	if htmlContent == "" {
		return "", fmt.Errorf("empty invoice content")
	}

	// 1. Write HTML to Temp File
	tmpHtmlFile, err := ioutil.TempFile("", "invoice-*.html")
	if err != nil {
		return "", fmt.Errorf("failed to create temp html file: %w", err)
	}
	htmlPath := tmpHtmlFile.Name()
	defer os.Remove(htmlPath) // Cleanup HTML

	if _, err := tmpHtmlFile.WriteString(htmlContent); err != nil {
		return "", fmt.Errorf("failed to write to temp file: %w", err)
	}
	tmpHtmlFile.Close()

	// 2. Convert to PDF using Chrome Headless
	pdfPath := htmlPath + ".pdf"
	// defer os.Remove(pdfPath) // Cleanup PDF after print

	var chromePath string
	if runtime.GOOS == "windows" {
		// Common Windows paths
		paths := []string{
			os.Getenv("ProgramFiles") + "\\Google\\Chrome\\Application\\chrome.exe",
			os.Getenv("ProgramFiles(x86)") + "\\Google\\Chrome\\Application\\chrome.exe",
			os.Getenv("LocalAppData") + "\\Google\\Chrome\\Application\\chrome.exe",
		}
		for _, p := range paths {
			if _, err := os.Stat(p); err == nil {
				chromePath = p
				break
			}
		}
		if chromePath == "" {
			return "", fmt.Errorf("Google Chrome not found. Please install Chrome.")
		}
	} else if runtime.GOOS == "darwin" {
		chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
		if _, err := os.Stat(chromePath); os.IsNotExist(err) {
			return "", fmt.Errorf("Google Chrome not found at %s", chromePath)
		}
	} else {
		// Linux fallback (assume in path)
		chromePath = "google-chrome"
	}

	// Chrome Command
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	cmdConvert := exec.CommandContext(ctx, chromePath, "--headless", "--disable-gpu", fmt.Sprintf("--print-to-pdf=%s", pdfPath), htmlPath)
	out, err := cmdConvert.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to convert HTML to PDF: %s : %w", string(out), err)
	}

	// 3. Print PDF
	if runtime.GOOS == "windows" {
		// Windows: use PowerShell Start-Process with PrintTo verb
		// Syntax: Start-Process -FilePath "path/to/pdf" -Verb PrintTo -ArgumentList "PrinterName"
		// Note: PrintTo works well with Acrobat Reader or other PDF handlers. Edge sometimes struggles.
		// If "PrintTo" is generic, it should try to print to specific printer.
		// We use -PassThru to wait? No, Start-Process returns process. -Wait waits for it.

		// Powershell command construction
		psCmd := fmt.Sprintf("Start-Process -FilePath '%s' -Verb PrintTo -ArgumentList '%s' -Wait", pdfPath, printerName)
		cmdPrint := exec.Command("powershell", "-Command", psCmd)
		// Hide window?
		// cmdPrint.SysProcAttr = &syscall.SysProcAttr{HideWindow: true} // Requires syscall import, keep simple for now

		outPrint, err := cmdPrint.CombinedOutput()
		if err != nil {
			return "", fmt.Errorf("print command failed (Windows): %s : %w", string(outPrint), err)
		}
	} else {
		// Unix/Mac: use lp
		cmdPrint := exec.Command("lp", "-d", printerName, pdfPath)
		outPrint, err := cmdPrint.CombinedOutput()
		if err != nil {
			return "", fmt.Errorf("print command failed: %s : %w", string(outPrint), err)
		}
	}

	return "Success", nil
}
