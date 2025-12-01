export interface Partner {
  partner_id: number;
  partner_name: string;
  partner_auth_key: string;
  template_id: string;
  is_active: boolean;
}

export interface Wbs {
  wbs_id: number;
  wbs_name: string;
  description: string;
}

export interface ApiAccount {
  account_id: number;
  partner_id: number;
  wbs_id: number;
  account_name: string;
  api_url: string;
  domain_key: string;
  mapping_config: string;
}

export interface Shipper {
  shipper_id: number;
  partner_id: number;
  account_id: number;
  shipper_code: string;
  shipper_name: string;
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
  supply_code?: string;
  device_desc?: string;
  partner_key?: string;
  domain_key?: string;
  waybill_front?: string;
  waybill_len?: string;
  role?: string;
}
