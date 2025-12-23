package main

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"github.com/blang/semver"
	"github.com/rhysd/go-github-selfupdate/selfupdate"
)

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
		fmt.Println("1")
		a.sendErrorLog("SYSTEM", fmt.Sprintf("error checking for updates: %v", err))
		return "", fmt.Errorf("error checking for updates")
	}
	if !found {
		fmt.Println("2")
		a.sendErrorLog("SYSTEM", "No updates found")
		return "No updates found", nil
	}

	currentVersion, err := semver.Parse(Version)
	if err != nil {
		fmt.Println("3")
		a.sendErrorLog("SYSTEM", fmt.Sprintf("invalid current version: %v", err))
		return "", fmt.Errorf("invalid current version")
	}

	if latest.Version.GT(currentVersion) {
		// Update found
		// On Windows, the running executable is renamed and the new one is placed.
		exe, err := os.Executable()
		if err != nil {
			a.sendErrorLog("SYSTEM", fmt.Sprintf("could not locate executable path: %v", err))
			return "", fmt.Errorf("could not locate executable path")
		}

		if err := selfupdate.UpdateTo(latest.AssetURL, exe); err != nil {
			a.sendErrorLog("SYSTEM", fmt.Sprintf("error occurred during update: %v", err))
			return "", fmt.Errorf("error occurred during update")
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
			a.sendErrorLog("SYSTEM", fmt.Sprintf("failed to get UUID (mac): %v", err))
			return ""
		}
		return strings.TrimSpace(string(out))
	} else if runtime.GOOS == "windows" {
		// wmic csproduct get UUID
		out, err := exec.Command("wmic", "csproduct", "get", "UUID").Output()
		if err != nil {
			a.sendErrorLog("SYSTEM", fmt.Sprintf("failed to get UUID (win): %v", err))
			return ""
		}
		// Output format:
		// UUID
		// XXXXXXXX-XXXX-...
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if trimmed != "" && trimmed != "UUID" {
				return trimmed
			}
		}
		a.sendErrorLog("SYSTEM", "Failed to get UUID (win)")
		return ""
	} else {
		a.sendErrorLog("SYSTEM", "Unsupported OS: "+runtime.GOOS)
		return "UNKNOWN-UUID"
	}
}
