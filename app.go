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
