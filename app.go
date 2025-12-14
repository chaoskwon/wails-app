package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
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

// GetPrinters returns a list of available printers
func (a *App) GetPrinters() []string {
	var printers []string

	if runtime.GOOS == "windows" {
		// Windows: wmic printer get name
		cmd := exec.Command("wmic", "printer", "get", "name")
		output, err := cmd.Output()
		if err == nil {
			lines := strings.Split(string(output), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line != "" && line != "Name" {
					printers = append(printers, line)
				}
			}
		}
	} else {
		// macOS/Linux: lpstat -p | awk '{print $2}'
		// Output format: printer <name> is idle. enabled since ...
		cmd := exec.Command("lpstat", "-p")
		output, err := cmd.Output()
		if err == nil {
			lines := strings.Split(string(output), "\n")
			for _, line := range lines {
				parts := strings.Fields(line)
				if len(parts) >= 2 && parts[0] == "printer" {
					printers = append(printers, parts[1])
				}
			}
		}
	}

	return printers
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

func (a *App) ScanBarcodeWS(orderNo, startDate, endDate, shipperCode, waybillNo, productCode string, machineID int) (*ScanResponseData, error) {
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
		"order_no":   orderNo,
		"start_date": startDate,
		"end_date":   endDate,
		"shipper_cd": shipperCode,
		"waybill_no": waybillNo,
		"product_cd": productCode,
		"machine_id": machineID,
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
