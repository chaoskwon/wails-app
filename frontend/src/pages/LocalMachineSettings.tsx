import React, { useState, useEffect } from 'react';
import { Button, Form, Input, Select, Switch, Space, message, Card, Spin, AutoComplete, Row, Col, Alert, Table, Radio } from 'antd';
import { SaveOutlined, ReloadOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../config';
import { Partner, Machine, ApiAccount, Printer, Shipper } from '../types';

const { Option } = Select;
const { TextArea } = Input;

interface LocalMachineSettingsProps {
  onSuccess?: () => void;
  defaultPartnerId?: number | null;
}

const LocalMachineSettings: React.FC<LocalMachineSettingsProps> = ({ onSuccess, defaultPartnerId }) => {
  const [loading, setLoading] = useState(true);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [printers, setPrinters] = useState<string[]>([]); // Keep as string[] based on usage in fetchPrinters
  const [mainPrinterOptions, setMainPrinterOptions] = useState<{ value: string }[]>([]);
  const [auxPrinterOptions, setAuxPrinterOptions] = useState<{ value: string }[]>([]);
  const [systemUUID, setSystemUUID] = useState<string>('');
  const [shippers, setShippers] = useState<Shipper[]>([]);

  const [selectedShipperKeys, setSelectedShipperKeys] = useState<React.Key[]>([]);
  const [shipperMode, setShipperMode] = useState<'all' | 'select'>('all');

  const [form] = Form.useForm();
  const accountId = Form.useWatch('account_id', form);

  const fetchBasicData = async () => {
    try {
      const resPartners = await fetch(`${API_BASE_URL}/partners`);
      if (resPartners.ok) setPartners(await resPartners.json());

      const resAccounts = await fetch(`${API_BASE_URL}/accounts`);
      if (resAccounts.ok) setAccounts(await resAccounts.json());
    } catch (e) { console.error(e); }
  };

  const fetchSystemUUID = async () => {
    try {
      // @ts-ignore
      if (window['go'] && window['go']['main'] && window['go']['main']['App'] && window['go']['main']['App']['GetSystemUUID']) {
        // @ts-ignore
        const uuid = await window['go']['main']['App']['GetSystemUUID']();
        setSystemUUID(uuid);
        return uuid;
      }
    } catch (e) {
      console.error("Failed to get UUID", e);
    }
    return '';
  };

  const fetchPrinters = async () => {
    try {
      // @ts-ignore
      if (window['go'] && window['go']['main'] && window['go']['main']['App'] && window['go']['main']['App']['GetPrinters']) {
        // @ts-ignore
        const printerList = await window['go']['main']['App']['GetPrinters']();
        setPrinters(printerList);
        const options = printerList.map((p: string) => ({ value: p }));
        setMainPrinterOptions(options);
        setAuxPrinterOptions(options);
      }
    } catch (e) {
      console.error("Failed to fetch printers", e);
    }
  };

  const fetchMachineData = async (uuid: string) => {
    if (!uuid) return;
    try {
      const res = await fetch(`${API_BASE_URL}/machines`);
      if (!res.ok) throw new Error('Failed to fetch machines');
      const data: Machine[] = await res.json();
      const found = data.find(m => m.machine_uuid === uuid);

      if (found) {
        setMachine(found);
        form.setFieldsValue({
          ...found,
          is_approved: found.is_active === 'Y',
          use_inspection_bool: found.use_inspection ? found.use_inspection === 'Y' : true
        });
        if (found.shipper_ids && Array.isArray(found.shipper_ids) && found.shipper_ids.length > 0) {
          setShipperMode('select');
          setSelectedShipperKeys(found.shipper_ids);
        } else {
          setShipperMode('all');
          setSelectedShipperKeys([]);
        }
      } else {
        setMachine(null);
        form.resetFields();
        form.setFieldsValue({
          machine_uuid: uuid,
          is_approved: false,
          use_inspection_bool: true,
          partner_id: defaultPartnerId
        });
      }
    } catch (err) {
      message.error('장비 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    await fetchBasicData();
    await fetchPrinters();
    const uuid = await fetchSystemUUID();
    await fetchMachineData(uuid);
  }

  useEffect(() => {
    refreshData();
  }, [defaultPartnerId]);

  const fetchShippers = async (accId: number) => {
    try {
      const response = await fetch(`http://localhost:8080/api/shippers?account_id=${accId}`);
      if (response.ok) {
        const data = await response.json();
        const sortedData = data.sort((a: Shipper, b: Shipper) => {
          const aSelected = selectedShipperKeys.includes(a.shipper_id);
          const bSelected = selectedShipperKeys.includes(b.shipper_id);
          if (aSelected && !bSelected) return -1;
          if (!aSelected && bSelected) return 1;
          return 0;
        });
        setShippers(sortedData);
      }
    } catch (error) {
      console.error('Failed to fetch shippers:', error);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchShippers(accountId);
    } else {
      setShippers([]);
    }
  }, [accountId]);

  const handleSyncShippers = async () => {
    if (!accountId) return;
    try {
      message.loading({ content: '화주 정보를 수집 중입니다...', key: 'syncShippers' });
      const response = await fetch(`${API_BASE_URL}/shippers/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });

      if (response.ok) {
        const result = await response.json();
        message.success({ content: `화주 수집 완료 (${result.count}건)`, key: 'syncShippers' });
        fetchShippers(accountId);
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      message.error({ content: `화주 수집 실패: ${error.message}`, key: 'syncShippers' });
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        machine_uuid: values.machine_uuid,
        machine_name: values.machine_name,
        partner_id: Number(values.partner_id),
        account_id: values.account_id ? Number(values.account_id) : 0,
        waybill_template: values.waybill_template,
        printer_main: values.printer_main,
        printer_aux: values.printer_aux,
        is_active: 'Y',
        use_inspection: values.use_inspection_bool ? 'Y' : 'N',
        shipper_ids: shipperMode === 'all' ? null : selectedShipperKeys,
      };

      // Check account type
      const selectedAccount = accounts.find(a => a.account_id === values.account_id);
      if (selectedAccount && selectedAccount.account_type?.trim() !== 'MULTI') {
        // @ts-ignore
        payload.shipper_ids = null;
      }

      let res;
      if (machine) {
        res = await fetch(`${API_BASE_URL}/machines/${machine.machine_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE_URL}/machines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error('Failed to save machine: ' + errorText);
      }

      message.success('저장되었습니다.');
      refreshData();
      if (onSuccess) onSuccess();

    } catch (err: any) {
      console.error('handleSave Error:', err);
      message.error(err.message || '저장에 실패했습니다.');
    }
  };

  const partnerIdInForm = Form.useWatch('partner_id', form);
  const filteredAccounts = accounts.filter(a => a.partner_id === partnerIdInForm);

  const handlePrinterSearch = (value: string, setOptions: React.Dispatch<React.SetStateAction<{ value: string }[]>>) => {
    const filtered = printers.filter(p => p.toUpperCase().includes(value.toUpperCase())).map(p => ({ value: p }));
    setOptions(filtered);
  };

  const handlePrinterFocus = (setOptions: React.Dispatch<React.SetStateAction<{ value: string }[]>>) => {
    setOptions(printers.map(p => ({ value: p })));
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
  }

  return (
    <Card
      title={!machine ? <Alert message="등록되지 않은 장비입니다. 설정을 저장하여 등록해주세요." type="warning" showIcon style={{ border: 'none', background: 'transparent', padding: 0 }} /> : null}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refreshData}>
            새로고침
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>
            저장
          </Button>
        </Space>
      }>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
      >
        <Row gutter={24}>
          <Col span={12}>
            <Card type="inner" style={{ marginBottom: 16 }}>
              <Form.Item name="machine_uuid" label="System UUID">
                <Input disabled />
              </Form.Item>
              <Form.Item name="partner_id" label="소속 거래처" hidden={!!machine} rules={[{ required: true, message: '거래처를 선택해주세요' }]}>
                <Select placeholder="거래처 선택">
                  {partners.map(p => <Option key={p.partner_id} value={p.partner_id}>{p.partner_name}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="machine_name" label="장비 관리명" rules={[{ required: true, message: '장비 관리명을 입력해주세요' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="waybill_template" label="운송장 템플릿">
                <Input placeholder="예: CJ_Normal.zpl" />
              </Form.Item>
              <Form.Item name="printer_main" label="메인 프린터">
                <AutoComplete
                  options={mainPrinterOptions}
                  onSearch={(val) => handlePrinterSearch(val, setMainPrinterOptions)}
                  onFocus={() => handlePrinterFocus(setMainPrinterOptions)}
                  placeholder="IP 또는 드라이버명"
                />
              </Form.Item>
              <Form.Item name="printer_aux" label="보조 프린터">
                <AutoComplete
                  options={auxPrinterOptions}
                  onSearch={(val) => handlePrinterSearch(val, setAuxPrinterOptions)}
                  onFocus={() => handlePrinterFocus(setAuxPrinterOptions)}
                  placeholder="보조 프린터 선택"
                />
              </Form.Item>
            </Card>
          </Col>
          <Col span={12}>
            <Card type="inner" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="use_inspection_bool" label="상품검수여부" valuePropName="checked">
                    <Switch checkedChildren="사용" unCheckedChildren="미사용" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="account_id" label="API 계정 연동">
                <Select placeholder="API 계정을 선택하세요" allowClear>
                  {filteredAccounts.map(a => <Option key={a.account_id} value={a.account_id}>{a.account_name}</Option>)}
                </Select>
              </Form.Item>

              {(() => {
                const selectedAccount = accounts.find(a => a.account_id === accountId);
                const isMulti = selectedAccount?.account_type ? selectedAccount.account_type.trim() === 'MULTI' : false;

                return accountId && isMulti && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ marginBottom: 8, fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <span>화주 선택</span>
                        <Button
                          icon={<SyncOutlined />}
                          size="small"
                          onClick={handleSyncShippers}
                        >
                          수집
                        </Button>
                      </Space>
                      <Radio.Group
                        value={shipperMode}
                        onChange={(e) => {
                          const mode = e.target.value;
                          setShipperMode(mode);
                          if (mode === 'all') {
                            setSelectedShipperKeys([]);
                          }
                        }}
                        size="small"
                      >
                        <Radio.Button value="all">전체</Radio.Button>
                        <Radio.Button value="select">선택</Radio.Button>
                      </Radio.Group>
                    </div>
                    <Table
                      dataSource={shippers}
                      rowKey="shipper_id"
                      size="small"
                      pagination={{ pageSize: 5 }}
                      rowSelection={{
                        selectedRowKeys: selectedShipperKeys,
                        onChange: (newSelectedKeys) => setSelectedShipperKeys(newSelectedKeys),
                        getCheckboxProps: () => ({ disabled: shipperMode === 'all' }),
                      }}
                      columns={[
                        { title: '화주코드', dataIndex: 'shipper_code', key: 'shipper_code' },
                        { title: '화주명', dataIndex: 'shipper_name', key: 'shipper_name' },
                      ]}
                    />
                  </div>
                );
              })()}
            </Card>
          </Col>
        </Row>


      </Form>
    </Card>
  );
};

export default LocalMachineSettings;
