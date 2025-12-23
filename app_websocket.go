package main

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// ConnectWebSocket connects to the WebSocket server
func (a *App) ConnectWebSocket(url string) string {
	a.wsLock.Lock()
	defer a.wsLock.Unlock()

	if a.wsConn != nil {
		a.wsConn.Close()
	}

	fmt.Println("WS: Attempting to connect to WS URL:", url)
	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		fmt.Println("WS: Connection failed:", err)
		a.isConnected = false
		return fmt.Sprintf("Error connecting: %v", err)
	}

	a.wsConn = c
	a.isConnected = true
	a.activeWSURL = url
	fmt.Println("WS: Connection successful!")

	// Start reading loop
	go a.readLoop(c)

	return "Connected"
}

// readLoop handles incoming WebSocket messages
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

		// Handle Scan Result or Reprint Result
		if msg.Type == "SCAN_RESULT" || msg.Type == "REPRINT_RESULT" {
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
					OrderId:     int64(dataMap["order_id"].(float64)), // Correctly casting logic for JSON Unmarshal might be needed, using simplistic for now assuming numeric
				}
				// Fix JSON number unmarshalling behavior which often defaults to float64
				if oidVal, ok := dataMap["order_id"]; ok {
					if oidFloat, ok := oidVal.(float64); ok {
						resp.OrderId = int64(oidFloat)
					}
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

// sendWSRequest is a helper to send WebSocket requests and wait for response
func (a *App) sendWSRequest(msgType string, data map[string]interface{}) (*ScanResponseData, error) {
	if !a.isConnected {
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

	reqID := uuid.New().String()
	ch := make(chan ScanResponseData, 1)

	a.wsReqLock.Lock()
	a.wsRequests[reqID] = ch
	a.wsReqLock.Unlock()

	msg := WSMessage{
		Type:      msgType,
		RequestID: reqID,
		Data:      data,
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

// ScanBarcodeWS sends a scan request to the WebSocket server
func (a *App) ScanBarcodeWS(waybillNo, startDate, endDate, shipperCode, productCode string, orderId int64, machineID int, accountID int, templateId string) (*ScanResponseData, error) {
	reqData := map[string]interface{}{
		"waybill_no":  waybillNo,
		"start_date":  startDate,
		"end_date":    endDate,
		"shipper_cd":  shipperCode,
		"product_cd":  productCode,
		"order_id":    orderId,
		"machine_id":  machineID,
		"account_id":  accountID,
		"template_id": templateId,
	}

	return a.sendWSRequest("SCAN", reqData)
}

// GetReprintZPL sends a reprint request to the WebSocket server
func (a *App) GetReprintZPL(orderID int64, waybillNo string) (*ScanResponseData, error) {
	if orderID == 0 {
		return nil, fmt.Errorf("order ID is required")
	}

	if waybillNo == "" {
		return nil, fmt.Errorf("waybill number is required")
	}

	reqData := map[string]interface{}{
		"order_id":   orderID,
		"waybill_no": waybillNo,
	}

	return a.sendWSRequest("REPRINT", reqData)
}

// Ping is a heartbeat check
func (a *App) Ping() string {
	return "Pong"
}
