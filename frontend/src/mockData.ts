import { Partner, Wbs, ApiAccount, Shipper, Machine } from './types';

export const mockPartners: Partner[] = [
  { partner_id: 1, partner_name: '트랜쇼우', is_active: true },
  { partner_id: 2, partner_name: 'CJ 대한통운', is_active: true },
];

export const mockWbs: Wbs[] = [
  { wbs_id: 1, wbs_name: '이지어드민', wbs_desc: 'ERP', is_active: 'Y' },
  { wbs_id: 2, wbs_name: '트랜쇼우', wbs_desc: 'Mall', is_active: 'Y' },
];

export const mockApiAccounts: ApiAccount[] = [
  { account_id: 1, partner_id: 1, wbs_id: 1, account_name: '트랜쇼우-이지어드민', api_url: 'https://api.sabang.net', partner_key: 'PARTNER_KEY_01', domain_key: 'SB_KEY_01', account_type: 'ONE', is_active: 'Y' },
  { account_id: 2, partner_id: 1, wbs_id: 2, account_name: '트랜쇼우-트랜쇼우', api_url: 'https://api.cafe24.com', partner_key: 'PARTNER_KEY_02', domain_key: 'C24_KEY_01', account_type: 'ONE', is_active: 'Y' },
  { account_id: 3, partner_id: 2, wbs_id: 1, account_name: '사방넷-물류팀', api_url: 'https://api.sabang.net', partner_key: 'PARTNER_KEY_03', domain_key: 'SB_KEY_02', account_type: 'MULTI', is_active: 'Y' },
];

export const mockShippers: Shipper[] = [
  { shipper_id: 1, partner_id: 1, account_id: 1, shipper_code: 'NIKE_KR', shipper_name: '나이키 코리아' },
  { shipper_id: 2, partner_id: 1, account_id: 2, shipper_code: 'ADIDAS_KR', shipper_name: '아디다스 코리아' },
];

export const mockMachines: Machine[] = [
  { machine_id: 1, partner_id: 1, machine_uuid: 'UUID-001', machine_name: '1센터-포장1호기', printer_main: '192.168.0.10', printer_aux: '', is_approved: true },
  { machine_id: 2, partner_id: 2, machine_uuid: 'UUID-002', machine_name: '2센터-포장1호기', printer_main: '192.168.1.20', printer_aux: '', is_approved: false },
];
