import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Alert, message } from 'antd';
import { PlusOutlined, EditOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../config';
import { Partner, ApiAccount, Shipper, Wbs } from '../types';

const { Option } = Select;

const ShipperManager = () => {
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [wbsList, setWbsList] = useState<Wbs[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editingShipper, setEditingShipper] = useState<Shipper | null>(null);

  const fetchBasicData = async () => {
    try {
      const [pRes, aRes, wRes] = await Promise.all([
        fetch(`${API_BASE_URL}/partners`),
        fetch(`${API_BASE_URL}/accounts`),
        fetch(`${API_BASE_URL}/wbs`)
      ]);
      if (pRes.ok) setPartners(await pRes.json());
      if (aRes.ok) setAccounts(await aRes.json());
      if (wRes.ok) setWbsList(await wRes.json());
    } catch (e) { console.error(e); }
  };

  const fetchShippers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/shippers`);
      if (!res.ok) throw new Error('Failed to fetch shippers');
      setShippers(await res.json());
    } catch (err) {
      message.error('화주 목록을 불러오는데 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchBasicData();
    fetchShippers();
  }, []);

  const handlePartnerChange = (val: number) => {
    setSelectedPartnerId(val);
    setSelectedAccountId(null);
  };

  const availableAccounts = accounts.filter(acc => acc.partner_id === selectedPartnerId);
  const filteredShippers = shippers.filter(s => s.account_id === selectedAccountId);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        partner_id: Number(values.partner_id),
        account_id: Number(values.account_id)
      };

      // Since we don't have Create/Update/Delete API for shippers yet (only Read was requested),
      // I will add a placeholder or if the user implied full CRUD, I should have implemented it.
      // The user said "화주(shipper)를 조회하는 api 를 추가해줘 조회만 있으면 돼" (Add API to query shippers, only query is needed).
      // But for the frontend to work fully, we usually need create/update.
      // However, strictly following "only query is needed", I cannot implement save.
      // BUT, the frontend has "Add" and "Edit" buttons. If I don't implement save, they won't work.
      // I'll assume for now I should just log it or maybe the user will ask for it next.
      // Wait, the user asked "wails-app에서 화주관리 탭에서 필터들을 api 와 연계해줘" (Connect filters in ShipperManager tab in wails-app with API).
      // So the priority is the filters (Read).
      // I will implement the read part. For save, I will leave it as mock or show a message "Not implemented".
      // Actually, I'll just log it for now to avoid breaking the app if they try to save.

      // message.info('화주 저장 API는 아직 구현되지 않았습니다.');
      // setIsModalOpen(false);

      // Re-reading: "화주(shipper)를 조회하는 api 를 추가해줘 조회만 있으면 돼" was the PREVIOUS request.
      // This request is "wails-app에서 화주관리 탭에서 필터들을 api 와 연계해줘".
      // So connecting filters (which implies reading partners/accounts/shippers) is the goal.
      // I will implement the read logic fully.

      console.log('Saving shipper (not implemented yet):', payload);
      message.warning('저장 기능은 아직 서버에 구현되지 않았습니다.');
      setIsModalOpen(false);

    } catch (err) {
      console.error('handleOk Error:', err);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'shipper_id', width: 50 },
    { title: '화주명', dataIndex: 'shipper_name' },
    { title: '화주 코드', dataIndex: 'shipper_code' },
    {
      title: '관리', key: 'action', width: 80,
      render: (_: any, r: any) => (
        <Button icon={<EditOutlined />} size="small" onClick={() => {
          setEditingShipper(r);
          form.resetFields();
          form.setFieldsValue(r);
          setIsModalOpen(true);
        }} />
      )
    }
  ];

  const handleAdd = () => {
    if (!selectedAccountId) return;
    setEditingShipper(null);
    form.resetFields();
    form.setFieldsValue({
      partner_id: selectedPartnerId,
      account_id: selectedAccountId
    });
    setIsModalOpen(true);
  };

  const handleFetchFromServer = async () => {
    if (!selectedAccountId) return;

    message.loading({ content: '서버에서 화주 목록을 가져오는 중...', key: 'syncShippers' });
    try {
      const res = await fetch(`${API_BASE_URL}/shippers/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account_id: selectedAccountId }),
      });

      if (res.ok) {
        const data = await res.json();
        message.success({ content: `화주 목록 동기화 완료 (${data.count}건)`, key: 'syncShippers' });
        fetchShippers(); // Refresh list
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to sync');
      }

    } catch (e: any) {
      console.error(e);
      message.error({ content: `화주 목록 가져오기 실패: ${e.message}`, key: 'syncShippers' });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, padding: 10, backgroundColor: '#f5f5f5', borderRadius: 5, border: '1px solid #d9d9d9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <span style={{ fontWeight: 'bold' }}>필터:</span>
          <Select
            style={{ width: 180 }}
            placeholder="1. 거래처 선택"
            onChange={handlePartnerChange}
            value={selectedPartnerId}
          >
            {partners.map(p => <Option key={p.partner_id} value={p.partner_id}>{p.partner_name}</Option>)}
          </Select>
          <Select
            style={{ width: 250 }}
            placeholder="2. API 계정 선택"
            onChange={setSelectedAccountId}
            value={selectedAccountId}
            disabled={!selectedPartnerId}
          >
            {availableAccounts.map(acc => {
              const wbsName = wbsList.find(w => w.wbs_id === acc.wbs_id)?.wbs_name;
              return <Option key={acc.account_id} value={acc.account_id}>{`[${wbsName || 'Unknown'}] ${acc.account_name}`}</Option>;
            })}
          </Select>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchBasicData(); fetchShippers(); }}>새로고침</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleFetchFromServer} disabled={!selectedAccountId}>서버에서 받기</Button>
        </Space>
      </div>

      {selectedAccountId ? (
        <Table dataSource={filteredShippers} columns={columns} rowKey="shipper_id" size="small" bordered />
      ) : (
        <Alert message="상단에서 거래처와 API 계정을 모두 선택해주세요." type="info" showIcon />
      )}

      <Modal
        title={editingShipper ? "화주 수정" : "화주 추가"}
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
          <Form.Item name="partner_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="account_id" hidden>
            <Input />
          </Form.Item>

          <Form.Item label="연동 정보">
            <Input value={`${partners.find(p => p.partner_id === selectedPartnerId)?.partner_name} / ${accounts.find(a => a.account_id === selectedAccountId)?.account_name}`} disabled />
          </Form.Item>

          <Form.Item name="shipper_name" label="화주명" rules={[{ required: true, message: '화주명을 입력해주세요' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="shipper_code" label="화주 코드 (WBS)" rules={[{ required: true, message: '화주 코드를 입력해주세요' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ShipperManager;
