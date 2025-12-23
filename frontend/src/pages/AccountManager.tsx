import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Row, Col, message, Tag, Switch, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../config';
import { ApiAccount, Partner, Wbs } from '../types';
import { fetchWithAuth } from '../utils/api';

const { Option } = Select;
const { TextArea } = Input;

const AccountManager = () => {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [wbsList, setWbsList] = useState<Wbs[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editingAccount, setEditingAccount] = useState<ApiAccount | null>(null);

  const fetchBasicData = async () => {
    try {
      const [pRes, wRes] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL}/partners`),
        fetchWithAuth(`${API_BASE_URL}/wbs`)
      ]);
      if (pRes.ok) setPartners(await pRes.json());
      if (wRes.ok) setWbsList(await wRes.json());
    } catch (e) { console.error(e); }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/accounts`);
      if (!res.ok) throw new Error('Failed to fetch accounts');
      setAccounts(await res.json());
    } catch (err) {
      message.error('계정 목록을 불러오는데 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchBasicData();
    fetchAccounts();
  }, []);

  const filteredData = accounts.filter(acc => acc.partner_id === selectedPartnerId);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // Ensure partner_id is integer
      values.partner_id = parseInt(values.partner_id);

      let res;
      if (editingAccount) {
        res = await fetchWithAuth(`${API_BASE_URL}/accounts/${editingAccount.account_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
      } else {
        res = await fetchWithAuth(`${API_BASE_URL}/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', errorText);
        throw new Error('Failed to save account: ' + errorText);
      }

      message.success('저장되었습니다.');
      setIsModalOpen(false);
      fetchAccounts();
    } catch (err) {
      console.error('handleOk Error:', err);
      // message.error('저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      message.success('삭제되었습니다.');
      fetchAccounts();
    } catch (err) {
      message.error('삭제에 실패했습니다.');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'account_id', width: 50 },
    { title: '계정명', dataIndex: 'account_name', width: 150, render: (t: string) => <span style={{ fontWeight: 'bold' }}>{t}</span> },
    { title: 'WBS', dataIndex: 'wbs_id', render: (id: number) => wbsList.find(w => w.wbs_id === id)?.wbs_name },
    { title: '계정 타입', dataIndex: 'account_type', render: (v: string) => v === 'ONE' ? '화주' : 'WMS(3PL)' },
    { title: '운송장 템플릿', dataIndex: 'waybill_template' },
    { title: '사용', dataIndex: 'is_active', render: (v: string) => v === 'Y' ? <Tag color="blue">사용</Tag> : <Tag color="red">미사용</Tag> },
    {
      title: '관리', key: 'action', width: 80,
      render: (_: any, r: any) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => {
            setEditingAccount(r);
            form.resetFields();
            form.setFieldsValue(r); // is_active is string 'Y'/'N'
            setIsModalOpen(true);
          }} />
        </Space>
      )
    }
  ];

  const handleAdd = () => {
    if (!selectedPartnerId) {
      message.warning('상단에서 거래처를 먼저 선택해주세요.');
      return;
    }
    setEditingAccount(null);
    form.resetFields();
    form.setFieldsValue({ partner_id: selectedPartnerId, is_active: 'Y' }); // Default new accounts to active
    setIsModalOpen(true);
  };

  return (
    <div>
      <div style={{ marginBottom: 16, padding: 10, backgroundColor: '#f5f5f5', borderRadius: 5, border: '1px solid #d9d9d9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <span style={{ fontWeight: 'bold' }}>거래처 선택 (필수):</span>
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
          <Button icon={<ReloadOutlined />} onClick={fetchAccounts}>새로고침</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!selectedPartnerId}>계정 추가</Button>
        </Space>
      </div>

      {selectedPartnerId ? (
        <Table dataSource={filteredData} columns={columns} rowKey="account_id" size="small" bordered scroll={{ x: 'max-content' }} />
      ) : (
        <Alert message="거래처를 선택하면 API 계정 목록이 표시됩니다." type="info" showIcon />
      )}

      <Modal
        title={editingAccount ? "API 계정 수정" : "API 계정 추가"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleOk}
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changed, all) => console.log('Form Change:', changed, all)}
        >
          <Form.Item name="partner_id" label="거래처" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="소속 거래처">
            <Input value={partners.find(p => p.partner_id === selectedPartnerId)?.partner_name} disabled />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="wbs_id" label="WBS 시스템" rules={[{ required: true, message: 'WBS 시스템을 선택해주세요' }]}>
                <Select placeholder="WBS 선택">
                  {wbsList.map(w => <Option key={w.wbs_id} value={w.wbs_id}>{w.wbs_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="account_name" label="계정명(식별용)" rules={[{ required: true, message: '계정 이름을 입력해주세요' }]}>
                <Input placeholder="예: 본사 사방넷" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="waybill_template" label="운송장 템플릿">
                <Input placeholder="예: 12" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="account_type" label="계정 타입" rules={[{ required: true }]}>
            <Select>
              <Option value="ONE">화주</Option>
              <Option value="MULTI">WMS(3PL)</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="is_active"
            label="사용 여부"
            valuePropName="checked"
            initialValue="Y"
            getValueProps={(value) => ({ checked: value === 'Y' })}
            getValueFromEvent={(checked) => checked ? 'Y' : 'N'}
          >
            <Switch checkedChildren="사용" unCheckedChildren="미사용" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AccountManager;
