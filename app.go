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
	"github.com/rhysd/go-github-selfupdate/selfupdate"
)

const Version = "0.1.0"

// App struct
type App struct {
	ctx         context.Context
	printerConn net.Conn
	printLock   sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
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
