package localdb

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() error {
	appDir := "db"
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return err
	}
	dbPath := filepath.Join(appDir, "local.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}

	createTableSQL := `
	CREATE TABLE IF NOT EXISTS customer_order (
		order_id INTEGER PRIMARY KEY,
		partner_id INTEGER,
		account_id INTEGER,
		mall_cd TEXT,
		order_no TEXT,
		order_no1 TEXT,
		order_no2 TEXT,
		order_ymd TEXT,
		kind TEXT,
		send_name TEXT,
		recv_name TEXT,
		recv_cell TEXT,
		recv_addr TEXT,
		product_cd TEXT,
		product_name TEXT,
		order_qty INTEGER,
		product_option TEXT,
		order_date TEXT,
		collect_date TEXT,
		barcode TEXT,
		work_date TEXT,
		waybill_no TEXT,
		wave_no TEXT,
		print_count INTEGER,
		work_flag TEXT,
		cancel_flag TEXT,
		shipper_code TEXT,
		shipper_name TEXT,
		machine_id INTEGER
	);
	`
	if _, err := db.Exec(createTableSQL); err != nil {
		return err
	}

	DB = db
	return nil
}

// SaveOrders inserts or replaces orders into the local database
func SaveOrders(orders []map[string]interface{}) error {
	if DB == nil {
		return fmt.Errorf("local db not initialized")
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}

	stmt, err := tx.Prepare(`
	INSERT OR REPLACE INTO customer_order (
		order_id, partner_id, account_id, mall_cd, order_no, order_no1, order_no2, order_ymd, kind,
		send_name, recv_name, recv_cell, recv_addr, product_cd, product_name, order_qty,
		product_option, order_date, collect_date, barcode, work_date, waybill_no, wave_no,
		print_count, work_flag, cancel_flag, shipper_code, shipper_name, machine_id
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, o := range orders {
		// Helper to safely get value or default
		get := func(key string) interface{} {
			if v, ok := o[key]; ok {
				return v
			}
			return ""
		}
		getInt := func(key string) int {
			if v, ok := o[key]; ok {
				switch val := v.(type) {
				case int:
					return val
				case float64:
					return int(val)
				}
			}
			return 0
		}

		_, err = stmt.Exec(
			getInt("order_id"), getInt("partner_id"), getInt("account_id"), get("mall_cd"), get("order_no"), get("order_no1"), get("order_no2"), get("order_ymd"), get("kind"),
			get("send_name"), get("recv_name"), get("recv_cell"), get("recv_addr"), get("product_cd"), get("product_name"), getInt("order_qty"),
			get("product_option"), get("order_date"), get("collect_date"), get("barcode"), get("work_date"), get("waybill_no"), get("wave_no"),
			getInt("print_count"), get("work_flag"), get("cancel_flag"), get("shipper_code"), get("shipper_name"), getInt("machine_id"),
		)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

// GetOrders retrieves all orders from the local database
func GetOrders() ([]map[string]interface{}, error) {
	if DB == nil {
		return nil, fmt.Errorf("local db not initialized")
	}

	rows, err := DB.Query("SELECT * FROM customer_order ORDER BY order_id DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []map[string]interface{}
	cols, _ := rows.Columns()

	for rows.Next() {
		// Create a slice of interface{} to hold values for each column
		columns := make([]interface{}, len(cols))
		columnPointers := make([]interface{}, len(cols))
		for i := range columns {
			columnPointers[i] = &columns[i]
		}

		// Scan the result into the column pointers
		if err := rows.Scan(columnPointers...); err != nil {
			return nil, err
		}

		// Create a map and iterate over column names and values
		m := make(map[string]interface{})
		for i, colName := range cols {
			val := columns[i]
			b, ok := val.([]byte)
			if ok {
				m[colName] = string(b)
			} else {
				m[colName] = val
			}
		}
		result = append(result, m)
	}
	return result, nil
}
