export interface Partner {
  partner_id: number;
  partner_name: string;
  is_active: boolean;
}

export interface Wbs {
  wbs_id: number;
  wbs_name: string;
  wbs_desc: string;
  is_active: string;
}

export interface ApiAccount {
  account_id: number;
  partner_id: number;
  wbs_id: number;
  account_name: string;
  api_url: string;
  partner_key: string;
  domain_key: string;
  account_type: string;
  is_active: string;
}

export interface Shipper {
  shipper_id: number;
  partner_id: number;
  account_id: number;
  shipper_code: string;
  shipper_name: string;
}

export interface Printer {
  name: string;
  is_default: boolean;
}

export interface Machine {
  machine_id: number;
  partner_id: number;
  account_id?: number;
  machine_uuid: string;
  machine_name: string;
  printer_main: string;
  printer_aux: string;
  is_approved: boolean;
  api_url?: string;
  machine_desc?: string;
  role?: string;
  use_inspection?: string;
  shipper_ids?: number[];
  waybill_template?: string;
  is_active?: string;
}

export interface CustomerOrder {
  order_id: number;
  partner_id: number;
  account_id: number;
  mall_cd: string;
  order_no: string;
  order_no1?: string;
  order_no2?: string;
  order_ymd: string;
  kind: string;
  shipper_code?: string;
  shipper_name?: string;
  send_name: string;
  recv_name: string;
  recv_cell: string;
  recv_addr: string;
  product_cd: string;
  product_name: string;
  order_qty: number;
  product_option: string;
  order_date: string;
  barcode: string;
  work_date: string;
  waybill_no: string;
  wave_no: string;
  print_count: number;
  work_flag: string;
  cancel_flag: string;
}

export interface PackingHistory {
  history_id: number;
  order_id: number;
  machine_id: number;
  work_type: string;
  scan_value: string;
  waybill_no: string;
  result_status: string;
  created_at: string;
}
