import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Space, Tag, Row, Col, Alert, Tabs, message, Tooltip, AutoComplete } from 'antd';
import { PlusOutlined, SettingOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../config';
import { Partner, Machine, ApiAccount, Shipper } from '../types';
import { fetchWithAuth } from '../utils/api';

const { Option } = Select;
const { TextArea } = Input;

interface MachineManagerProps {
  autoOpen?: boolean;
  onSuccess?: () => void;
  defaultPartnerId?: number | null;
}

const MachineManager: React.FC<MachineManagerProps> = ({ autoOpen, onSuccess, defaultPartnerId }) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [printers, setPrinters] = useState<string[]>([]);
  const [mainPrinterOptions, setMainPrinterOptions] = useState<{ value: string }[]>([]);
  const [auxPrinterOptions, setAuxPrinterOptions] = useState<{ value: string }[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [systemUUID, setSystemUUID] = useState<string>('');
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [activeTab, setActiveTab] = useState('1');

  const accountId = Form.useWatch('account_id', form);

  const fetchShippers = async (accId: number) => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/shippers?account_id=${accId}`);
      if (response.ok) {
        const data = await response.json();
        setShippers(data);
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
      const response = await fetchWithAuth(`${API_BASE_URL}/shippers/sync`, {
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

  const fetchBasicData = async () => {
    try {
      const resPartners = await fetchWithAuth(`${API_BASE_URL}/partners`);
      if (resPartners.ok) setPartners(await resPartners.json());

      const resAccounts = await fetchWithAuth(`${API_BASE_URL}/accounts`);
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

  const fetchMachines = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/machines`);
      if (!res.ok) throw new Error('Failed to fetch machines');
      const data = await res.json();
      console.log('data:', data);
      const formatted = data.map((m: any) => ({
        ...m,
        is_approved: m.is_active === 'Y',
        use_inspection_bool: m.use_inspection === 'Y'
      }));
      setMachines(formatted);
    } catch (err) {
      message.error('장비 목록을 불러오는데 실패했습니다.');
    }
  };

  const refreshAll = async () => {
    await fetchBasicData();
    await fetchMachines();
    await fetchPrinters();
  };

  useEffect(() => {
    refreshAll();
    fetchSystemUUID().then((uuid) => {
      if (autoOpen && uuid) {
        setEditingMachine(null);
        form.resetFields();
        form.setFieldsValue({
          machine_uuid: uuid,
          is_approved: true,
          use_inspection_bool: true,
          partner_id: defaultPartnerId // Pre-fill partner if available
        });
        setIsModalOpen(true);
      }
    });

    if (defaultPartnerId) {
      setSelectedPartnerId(defaultPartnerId);
    }
  }, [autoOpen, defaultPartnerId]);

  const filteredMachines = machines.filter(m => m.partner_id === selectedPartnerId);
  const isRegistered = machines.some(m => m.machine_uuid === systemUUID);

  const handleOk = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true); // true returns all values including those in unvisited tabs
      console.log("DEBUG handleOk values:", values);
      const payload = {
        ...values,
        is_active: values.is_approved ? 'Y' : 'N',
        use_inspection: values.use_inspection_bool ? 'Y' : 'N',
        partner_id: Number(values.partner_id),
        account_id: values.account_id ? Number(values.account_id) : 0,
      };

      // Check account type and set shipper_ids to null if not 'MULTI'
      const selectedAccount = accounts.find(a => a.account_id === values.account_id);
      if (selectedAccount && selectedAccount.account_type !== 'MULTI') {
        // @ts-ignore
        payload.shipper_ids = null;
      }

      console.log("DEBUG handleOk payload:", payload);

      let res;
      if (editingMachine) {
        res = await fetchWithAuth(`${API_BASE_URL}/machines/${editingMachine.machine_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetchWithAuth(`${API_BASE_URL}/machines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', errorText);
        throw new Error('Failed to save machine: ' + errorText);
      }

      message.success('저장되었습니다.');
      setIsModalOpen(false);
      refreshAll();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('handleOk Error:', err);
    }
  };

  const columns = [
    { title: '장비명', dataIndex: 'machine_name', width: 150 },
    { title: 'UUID', dataIndex: 'machine_uuid', ellipsis: true },
    { title: '메인 프린터', dataIndex: 'printer_main' },
    { title: '사용', dataIndex: 'is_active', width: 70, render: (v: string) => v === 'Y' ? <Tag color="blue">사용</Tag> : <Tag color="red">미사용</Tag> },
    {
      title: '관리', key: 'action', width: 80,
      render: (_: any, r: any) => (
        <Button icon={<SettingOutlined />} size="small" onClick={() => {
          fetchBasicData(); // Refresh data to get latest account types
          setEditingMachine(r);
          form.resetFields();
          form.setFieldsValue({
            ...r,
            is_approved: r.is_active === 'Y',
            use_inspection_bool: r.use_inspection === 'Y'
          });
          setIsModalOpen(true);
          setActiveTab('1');
        }} />
      )
    }
  ];

  const handleAdd = async () => {
    if (!selectedPartnerId) return;
    await fetchBasicData(); // Refresh data/accounts
    setEditingMachine(null);
    form.resetFields();

    form.setFieldsValue({
      partner_id: selectedPartnerId,
      machine_uuid: systemUUID,
      is_approved: true,
      use_inspection_bool: true
    });
    setIsModalOpen(true);
    setActiveTab('1');
  }

  // Filter accounts based on selected partner in form
  const partnerIdInForm = Form.useWatch('partner_id', form);
  const filteredAccounts = accounts.filter(a => a.partner_id === partnerIdInForm);

  const handlePrinterSearch = (value: string, setOptions: React.Dispatch<React.SetStateAction<{ value: string }[]>>) => {
    const filtered = printers.filter(p => p.toUpperCase().includes(value.toUpperCase())).map(p => ({ value: p }));
    setOptions(filtered);
  };

  const handlePrinterFocus = (setOptions: React.Dispatch<React.SetStateAction<{ value: string }[]>>) => {
    setOptions(printers.map(p => ({ value: p })));
  };

  return (
    <div>
      <div style={{ marginBottom: 16, padding: 10, backgroundColor: '#f5f5f5', borderRadius: 5, border: '1px solid #d9d9d9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <span style={{ fontWeight: 'bold' }}>거래처 선택:</span>
          <Select
            style={{ width: 200 }}
            placeholder="거래처를 선택하세요"
            onChange={setSelectedPartnerId}
            value={selectedPartnerId}
            disabled={!!defaultPartnerId}
          >
            {partners.map(p => <Option key={p.partner_id} value={p.partner_id}>{p.partner_name}</Option>)}
          </Select>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refreshAll}>새로고침</Button>
          <Tooltip title={isRegistered ? "이미 등록된 장비입니다." : ""}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!selectedPartnerId || isRegistered}>장비 추가</Button>
          </Tooltip>
        </Space>
      </div>

      {selectedPartnerId ? (
        <Table dataSource={filteredMachines} columns={columns} rowKey="machine_id" size="small" bordered />
      ) : (
        <Alert message="장비를 관리할 거래처를 선택해주세요." type="warning" showIcon />
      )}

      <Modal
        title={editingMachine ? "포장기 상세 설정" : "포장기 추가"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleOk}
        width={700}
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changed, all) => console.log('Form Change:', changed, all)}
        >
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            {
              key: '1', label: '기본 정보', children: (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="partner_id" label="소속 거래처" rules={[{ required: true, message: '거래처를 선택해주세요' }]}>
                      <Select disabled={!!selectedPartnerId && (!autoOpen || !!defaultPartnerId)} placeholder="거래처 선택">
                        {partners.map(p => <Option key={p.partner_id} value={p.partner_id}>{p.partner_name}</Option>)}
                      </Select>
                    </Form.Item>
                    <Form.Item name="machine_name" label="장비 관리명" rules={[{ required: true, message: '장비 관리명을 입력해주세요' }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item name="use_inspection_bool" label="상품검수여부" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item name="is_approved" label="사용 여부" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="machine_uuid" label="System UUID">
                      <Input disabled placeholder="자동 생성됨" />
                    </Form.Item>
                    <Form.Item name="waybill_template" label="운송장 템플릿">
                      <Input placeholder="예: CJ_Normal.zpl" />
                    </Form.Item>
                    <Form.Item name="machine_desc" label="장비 설명">
                      <TextArea rows={2} />
                    </Form.Item>
                  </Col>
                </Row>
              )
            },
            {
              key: '2', label: '하드웨어/프린터', children: (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="printer_main" label="메인 프린터">
                      <AutoComplete
                        options={mainPrinterOptions}
                        onSearch={(val) => handlePrinterSearch(val, setMainPrinterOptions)}
                        onFocus={() => handlePrinterFocus(setMainPrinterOptions)}
                        placeholder="IP 또는 드라이버명"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="printer_aux" label="보조 프린터">
                      <AutoComplete
                        options={auxPrinterOptions}
                        onSearch={(val) => handlePrinterSearch(val, setAuxPrinterOptions)}
                        onFocus={() => handlePrinterFocus(setAuxPrinterOptions)}
                        placeholder="보조 프린터 선택"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              )
            },
            {
              key: '3', label: 'API/연동', children: (
                <>
                  <Form.Item name="account_id" label="API 계정 연동">
                    <Select placeholder="API 계정을 선택하세요">
                      {filteredAccounts.map(a => <Option key={a.account_id} value={a.account_id}>{a.account_name}</Option>)}
                    </Select>
                  </Form.Item>
                  {(() => {
                    const selectedAccount = accounts.find(a => a.account_id === accountId);
                    const isMulti = selectedAccount?.account_type?.trim() === 'MULTI';
                    // console.log('DEBUG: accountId', accountId);
                    // console.log('DEBUG: all accounts', accounts);
                    // console.log('DEBUG: selectedAccount', selectedAccount);
                    // console.log('DEBUG: selectedAccount?.account_type', selectedAccount?.account_type);

                    return accountId && isMulti && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ marginBottom: 8, fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>화주 정보 ({selectedAccount?.account_type})</span>
                          <Button
                            icon={<SyncOutlined />}
                            size="small"
                            onClick={handleSyncShippers}
                          >
                            수집
                          </Button>
                        </div>
                        <Table
                          dataSource={shippers}
                          rowKey="shipper_id"
                          size="small"
                          pagination={{ pageSize: 5 }}
                          columns={[
                            { title: '화주코드', dataIndex: 'shipper_code', key: 'shipper_code' },
                            { title: '화주명', dataIndex: 'shipper_name', key: 'shipper_name' },
                          ]}
                        />
                      </div>
                    );
                  })()}
                </>
              )
            }
          ]} />
        </Form>
      </Modal>
    </div>
  );
};

export default MachineManager;
