package main

import (
	"fmt"
	"net"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

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
		cmdWmic := exec.Command("wmic", "printer", "get", "name,portname", "/format:csv")
		outWmic, errWmic := cmdWmic.Output()
		if errWmic == nil {
			lines := strings.Split(string(outWmic), "\n")
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
					ip := ""
					if strings.Contains(port, ".") {
						if strings.Count(port, ".") >= 3 {
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
		cmd := exec.Command("lpstat", "-v")
		output, err := cmd.Output()
		if err == nil {
			lines := strings.Split(string(output), "\n")
			for _, line := range lines {
				if strings.HasPrefix(line, "device for ") {
					parts := strings.SplitN(line, ": ", 2)
					if len(parts) == 2 {
						namePart := parts[0] // "device for Name"
						uriStr := parts[1]   // "socket://..."
						name := strings.TrimPrefix(namePart, "device for ")

						ip := resolveURI(uriStr)
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
	if strings.Contains(uriStr, "://") {
		u, err := url.Parse(uriStr)
		if err == nil {
			host := u.Hostname()
			if net.ParseIP(host) != nil {
				return host
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

// PrintZPL sends ZPL data to a network printer using a persistent connection
func (a *App) PrintZPL(printerIP string, zplData string) string {
	a.printLock.Lock()
	defer a.printLock.Unlock()

	// Helper to log and return error
	retErr := func(msg string) string {
		go a.sendErrorLog("PRINTER", msg) // Send async to avoid blocking
		return msg
	}

	if printerIP == "" {
		return retErr("Error: Printer IP is empty")
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

	if a.printerConn == nil {
		if err := connect(); err != nil {
			return retErr(fmt.Sprintf("Error connecting to printer: %v", err))
		}
	}

	if err := a.printerConn.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
		a.printerConn.Close()
		a.printerConn = nil
		return retErr(fmt.Sprintf("Error setting deadline: %v", err))
	}

	_, err := a.printerConn.Write([]byte(zplData))
	if err != nil {
		fmt.Println("Write failed, reconnecting...", err)
		if err := connect(); err != nil {
			return retErr(fmt.Sprintf("Error reconnecting: %v", err))
		}
		if err := a.printerConn.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
			a.printerConn.Close()
			a.printerConn = nil
			return retErr(fmt.Sprintf("Error setting deadline retry: %v", err))
		}
		_, err = a.printerConn.Write([]byte(zplData))
		if err != nil {
			a.printerConn.Close()
			a.printerConn = nil
			return retErr(fmt.Sprintf("Error sending ZPL after retry: %v", err))
		}
	}

	return "Success"
}

// // PrintInvoice writes the provided HTML/Image content to a temp file, converts to PDF using Chrome, and prints it
// func (a *App) PrintInvoice(printerName string, htmlContent string) (string, error) {
// 	if htmlContent == "" {
// 		return "", fmt.Errorf("empty invoice content")
// 	}

// 	// 1. Write HTML to Temp File
// 	tmpHtmlFile, err := ioutil.TempFile("", "invoice-*.html")
// 	if err != nil {
// 		return "", fmt.Errorf("failed to create temp html file: %w", err)
// 	}
// 	htmlPath := tmpHtmlFile.Name()
// 	defer os.Remove(htmlPath) // Cleanup HTML

// 	if _, err := tmpHtmlFile.WriteString(htmlContent); err != nil {
// 		return "", fmt.Errorf("failed to write to temp file: %w", err)
// 	}
// 	tmpHtmlFile.Close()

// 	// 2. Convert to PDF using Chrome Headless
// 	pdfPath := htmlPath + ".pdf"
// 	// defer os.Remove(pdfPath) // Cleanup PDF after print

// 	var chromePath string
// 	if runtime.GOOS == "windows" {
// 		// Common Windows paths
// 		paths := []string{
// 			os.Getenv("ProgramFiles") + "\\Google\\Chrome\\Application\\chrome.exe",
// 			os.Getenv("ProgramFiles(x86)") + "\\Google\\Chrome\\Application\\chrome.exe",
// 			os.Getenv("LocalAppData") + "\\Google\\Chrome\\Application\\chrome.exe",
// 		}
// 		for _, p := range paths {
// 			if _, err := os.Stat(p); err == nil {
// 				chromePath = p
// 				break
// 			}
// 		}
// 		if chromePath == "" {
// 			return "", fmt.Errorf("Google Chrome not found. Please install Chrome.")
// 		}
// 	} else if runtime.GOOS == "darwin" {
// 		chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
// 		if _, err := os.Stat(chromePath); os.IsNotExist(err) {
// 			return "", fmt.Errorf("Google Chrome not found at %s", chromePath)
// 		}
// 	} else {
// 		// Linux fallback (assume in path)
// 		chromePath = "google-chrome"
// 	}

// 	// Chrome Command
// 	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
// 	defer cancel()

// 	cmdConvert := exec.CommandContext(ctx, chromePath, "--headless", "--disable-gpu", fmt.Sprintf("--print-to-pdf=%s", pdfPath), htmlPath)
// 	out, err := cmdConvert.CombinedOutput()
// 	if err != nil {
// 		return "", fmt.Errorf("failed to convert HTML to PDF: %s : %w", string(out), err)
// 	}

// 	// 3. Print PDF
// 	if runtime.GOOS == "windows" {
// 		psCmd := fmt.Sprintf("Start-Process -FilePath '%s' -Verb PrintTo -ArgumentList '%s' -Wait", pdfPath, printerName)
// 		cmdPrint := exec.Command("powershell", "-Command", psCmd)
// 		outPrint, err := cmdPrint.CombinedOutput()
// 		if err != nil {
// 			return "", fmt.Errorf("print command failed (Windows): %s : %w", string(outPrint), err)
// 		}
// 	} else {
// 		// Unix/Mac: use lp
// 		cmdPrint := exec.Command("lp", "-d", printerName, pdfPath)
// 		outPrint, err := cmdPrint.CombinedOutput()
// 		if err != nil {
// 			return "", fmt.Errorf("print command failed: %s : %w", string(outPrint), err)
// 		}
// 	}

// 	return "Success", nil
// }
