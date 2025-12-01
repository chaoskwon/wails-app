import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Space, Tag, Row, Col, Alert, Tabs, message, Tooltip } from 'antd';
import { PlusOutlined, SettingOutlined, ReloadOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../config';
import { Partner, Machine, ApiAccount } from '../types';

const { Option } = Select;
const { TextArea } = Input;

interface MachineManagerProps {
  autoOpen?: boolean;
  onSuccess?: () => void;
}

const MachineManager: React.FC<MachineManagerProps> = ({ autoOpen, onSuccess }) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [systemUUID, setSystemUUID] = useState<string>('');

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

  const fetchMachines = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/machines`);
      if (!res.ok) throw new Error('Failed to fetch machines');
      const data = await res.json();
      const formatted = data.map((m: any) => ({
        ...m,
        is_approved: m.is_active === 'Y'
      }));
      setMachines(formatted);
    } catch (err) {
      message.error('장비 목록을 불러오는데 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchBasicData();
    fetchMachines();
    fetchSystemUUID().then((uuid) => {
      if (autoOpen && uuid) {
        setEditingMachine(null);
        form.resetFields();
        form.setFieldsValue({
          machine_uuid: uuid,
          is_approved: true
        });
        setIsModalOpen(true);
      }
    });
  }, [autoOpen]);

  const filteredMachines = machines.filter(m => m.partner_id === selectedPartnerId);
  const isRegistered = machines.some(m => m.machine_uuid === systemUUID);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        is_active: values.is_approved ? 'Y' : 'N',
        partner_id: Number(values.partner_id),
        account_id: values.account_id ? Number(values.account_id) : 0,
        waybill_len: values.waybill_len ? Number(values.waybill_len) : 0
      };

      let res;
      if (editingMachine) {
        res = await fetch(`${API_BASE_URL}/machines/${editingMachine.machine_id}`, {
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
        console.error('API Error:', errorText);
        throw new Error('Failed to save machine: ' + errorText);
      }

      message.success('저장되었습니다.');
      setIsModalOpen(false);
      fetchMachines();

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
    { title: '승인', dataIndex: 'is_active', width: 70, render: (v: string) => v === 'Y' ? <Tag color="blue">승인</Tag> : <Tag>미승인</Tag> },
    {
      title: '관리', key: 'action', width: 80,
      render: (_: any, r: any) => (
        <Button icon={<SettingOutlined />} size="small" onClick={() => {
          setEditingMachine(r);
          form.resetFields();
          form.setFieldsValue({
            ...r,
            is_approved: r.is_active === 'Y'
          });
          setIsModalOpen(true)
        }} />
      )
    }
  ];

  const handleAdd = async () => {
    if (!selectedPartnerId) return;
    setEditingMachine(null);
    form.resetFields();

    form.setFieldsValue({
      partner_id: selectedPartnerId,
      machine_uuid: systemUUID,
      is_approved: true
    });
    setIsModalOpen(true);
  }

  // Filter accounts based on selected partner in form
  const partnerIdInForm = Form.useWatch('partner_id', form);
  const filteredAccounts = accounts.filter(a => a.partner_id === partnerIdInForm);

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
          >
            {partners.map(p => <Option key={p.partner_id} value={p.partner_id}>{p.partner_name}</Option>)}
          </Select>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchMachines}>새로고침</Button>
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
          <Tabs defaultActiveKey="1" items={[
            {
              key: '1', label: '기본 정보', children: (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="partner_id" label="소속 거래처" rules={[{ required: true, message: '거래처를 선택해주세요' }]}>
                      <Select disabled={!!selectedPartnerId && !autoOpen} placeholder="거래처 선택">
                        {partners.map(p => <Option key={p.partner_id} value={p.partner_id}>{p.partner_name}</Option>)}
                      </Select>
                    </Form.Item>
                    <Form.Item name="machine_name" label="장비 관리명" rules={[{ required: true, message: '장비 관리명을 입력해주세요' }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item name="is_approved" label="승인 여부" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="machine_uuid" label="System UUID">
                      <Input disabled placeholder="자동 생성됨" />
                    </Form.Item>
                    <Form.Item name="device_desc" label="장비 설명">
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
                      <Input placeholder="IP 또는 드라이버명" />
                    </Form.Item>
                    <Form.Item name="waybill_front" label="운송장 구분">
                      <Select>
                        <Option value="cp">CP(일반)</Option>
                        <Option value="kr">KR(등기)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="printer_aux" label="보조 프린터">
                      <Input />
                    </Form.Item>
                    <Form.Item name="waybill_len" label="운송장 길이">
                      <Input suffix="mm" />
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
                      <Option value={0}>연동 안함</Option>
                      {filteredAccounts.map(a => <Option key={a.account_id} value={a.account_id}>{a.account_name}</Option>)}
                    </Select>
                  </Form.Item>
                  {/* Deprecated fields but keeping them if needed or hiding them? 
                      The user wants to use account_id. 
                      Let's keep them for now but maybe they are not needed if account is selected.
                      Actually, let's keep them as overrides or just hide them.
                      For now, I'll leave them as is, but the Account ID is the primary link.
                  */}
                  <Form.Item name="api_url" label="API URL (Override)">
                    <Input placeholder="계정 설정 사용 시 비워두세요" />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="partner_key" label="파트너키 (Override)">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="domain_key" label="도메인키 (Override)">
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="supply_code" label="공급처 코드">
                    <Input />
                  </Form.Item>
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
