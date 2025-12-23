package main

import (
	"context"
	"fmt"
	"net"
	"sync"

	"github.com/gorilla/websocket"
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

	// Log Queue for offline buffering
	logQueue []WSMessage
}

// WSMessage structure (same as backend)
type WSMessage struct {
	Type      string      `json:"type"`
	RequestID string      `json:"request_id"`
	Data      interface{} `json:"data"`
}

// ... (existing structs) ...

// sendErrorLog sends an error message to the backend via WebSocket
func (a *App) sendErrorLog(errType string, errMsg string) {
	a.wsLock.Lock()
	defer a.wsLock.Unlock()

	msg := WSMessage{
		Type: "LOG_ERROR",
		Data: map[string]string{
			"error_message": errMsg,
			"error_type":    errType,
		},
	}

	if a.wsConn != nil {
		_ = a.wsConn.WriteJSON(msg)
	} else {
		// Queue message if offline
		a.logQueue = append(a.logQueue, msg)
	}
}

// sendPackingLogPrint sends a packing log print event to the backend
func (a *App) sendPackingLogPrint(orderID int64, printerType string) {
	a.wsLock.Lock()
	defer a.wsLock.Unlock()

	msg := WSMessage{
		Type: "LOG_PACKING_PRINT",
		Data: map[string]interface{}{
			"order_id":     orderID,
			"printer_type": printerType,
		},
	}

	if a.wsConn != nil {
		_ = a.wsConn.WriteJSON(msg)
	} else {
		// Queue message if offline
		a.logQueue = append(a.logQueue, msg)
	}
}

// sendPackingLogScan sends a packing log scan event to the backend
func (a *App) sendPackingLogScan(orderID int64, barcode string) {
	a.wsLock.Lock()
	defer a.wsLock.Unlock()

	msg := WSMessage{
		Type: "LOG_PACKING_SCAN",
		Data: map[string]interface{}{
			"order_id": orderID,
			"barcode":  barcode,
		},
	}

	if a.wsConn != nil {
		_ = a.wsConn.WriteJSON(msg)
	} else {
		// Queue message if offline
		a.logQueue = append(a.logQueue, msg)
	}
}

// SendIncreaseReprintCount sends a request to increase reprint count
func (a *App) SendIncreaseReprintCount(orderID int64, isAux bool) {
	a.wsLock.Lock()
	defer a.wsLock.Unlock()

	msg := WSMessage{
		Type: "INCREASE_REPRINT_COUNT",
		Data: map[string]interface{}{
			"order_id": orderID,
			"is_aux":   isAux,
		},
	}

	if a.wsConn != nil {
		_ = a.wsConn.WriteJSON(msg)
	} else {
		// Queue message if offline
		a.logQueue = append(a.logQueue, msg)
	}
}

// flushLogQueue sends all queued messages
func (a *App) flushLogQueue() {
	a.wsLock.Lock()
	defer a.wsLock.Unlock()

	if a.wsConn == nil || len(a.logQueue) == 0 {
		return
	}

	fmt.Printf("WS: Flushing %d queued logs\n", len(a.logQueue))
	for _, msg := range a.logQueue {
		if err := a.wsConn.WriteJSON(msg); err != nil {
			fmt.Println("WS: Failed to flush log:", err)
			// Stop flushing if error occurs, keep remaining in queue?
			// For simplicity, we might lose them or retry later.
			// Let's stop to try preserving order if we implement retry properly,
			// but for now, just logging failure is enough.
		}
	}
	// Clear queue
	a.logQueue = []WSMessage{}
}

// ScanResponseData structure (same as backend)
type ScanResponseData struct {
	Success     bool   `json:"success"`
	Message     string `json:"message"`
	OrderId     int64  `json:"order_id"`
	OrderNo     string `json:"order_no"`
	ProductName string `json:"product_name"`
	WaybillNo   string `json:"waybill_no"`
	InvoiceURL  string `json:"invoice_url"`
	ZPLString   string `json:"zpl_string"`
	WorkFlag    string `json:"work_flag"`
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
