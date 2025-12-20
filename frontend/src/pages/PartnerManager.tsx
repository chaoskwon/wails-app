import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Switch, Space, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../config';
import { Partner } from '../types';
import { fetchWithAuth } from '../utils/api';

const PartnerManager = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const fetchPartners = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/partners`);
      if (!res.ok) throw new Error('Failed to fetch partners');
      const data = await res.json();
      // Convert 'Y'/'N' to boolean
      const formatted = data.map((p: any) => ({ ...p, is_active: p.is_active === 'Y' }));
      setPartners(formatted);
    } catch (err) {
      message.error('거래처 목록을 불러오는데 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  // useEffect removed. Form control moved to handlers.

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = { ...values, is_active: values.is_active ? 'Y' : 'N' };

      let res;
      if (editingPartner) {
        res = await fetchWithAuth(`${API_BASE_URL}/partners/${editingPartner.partner_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetchWithAuth(`${API_BASE_URL}/partners`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', errorText);
        throw new Error('Failed to save partner: ' + errorText);
      }

      message.success('저장되었습니다.');
      setIsModalOpen(false);
      fetchPartners();
    } catch (err) {
      console.error('handleOk Error:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/partners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      message.success('삭제되었습니다.');
      fetchPartners();
    } catch (err) {
      message.error('삭제에 실패했습니다.');
    }
  };

  const columns = [
    { title: '거래처명', dataIndex: 'partner_name', key: 'partner_name' },
    { title: '사용여부', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => v ? <Tag color="green">사용</Tag> : <Tag color="red">중지</Tag> },
    {
      title: '관리', key: 'action', width: 80,
      render: (_: any, r: Partner) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => {
            setEditingPartner(r);
            form.resetFields();
            form.setFieldsValue(r);
            setIsModalOpen(true);
          }} />
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchPartners}>새로고침</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditingPartner(null);
            form.resetFields();
            form.setFieldsValue({ is_active: true });
            setIsModalOpen(true);
          }}>거래처 추가</Button>
        </Space>
      </div>
      <Table dataSource={partners} columns={columns} rowKey="partner_id" size="small" bordered />
      <Modal
        title={editingPartner ? "거래처 수정" : "거래처 추가"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleOk}
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item name="partner_name" label="거래처명" rules={[{ required: true, message: '거래처명을 입력해주세요' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="is_active" label="사용여부" valuePropName="checked">
            <Switch checkedChildren="Y" unCheckedChildren="N" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PartnerManager;
