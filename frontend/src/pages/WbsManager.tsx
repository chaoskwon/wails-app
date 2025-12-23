import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Switch, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../config';
import { Wbs } from '../types';
import { fetchWithAuth } from '../utils/api';

const WbsManager = () => {
  const [wbsList, setWbsList] = useState<Wbs[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingWbs, setEditingWbs] = useState<Wbs | null>(null);

  const fetchWbs = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/wbs`);
      if (!res.ok) throw new Error('Failed to fetch WBS');
      const data = await res.json();
      setWbsList(data);
    } catch (err) {
      message.error('WBS 목록을 불러오는데 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchWbs();
  }, []);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();

      let res;
      if (editingWbs) {
        res = await fetchWithAuth(`${API_BASE_URL}/wbs/${editingWbs.wbs_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
      } else {
        res = await fetchWithAuth(`${API_BASE_URL}/wbs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', errorText);
        throw new Error('Failed to save WBS: ' + errorText);
      }

      message.success('저장되었습니다.');
      setIsModalOpen(false);
      fetchWbs();
    } catch (err) {
      console.error('handleOk Error:', err);
      // message.error('저장에 실패했습니다.'); // Let the user see the console for details or we can show alert
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'wbs_id', width: 50 },
    { title: 'WBS 명칭', dataIndex: 'wbs_name', width: 150 },
    { title: '설명', dataIndex: 'wbs_desc' },
    {
      title: '사용', dataIndex: 'is_active', width: 80,
      render: (val: string) => (
        <Tag color={val === 'Y' ? 'green' : 'red'}>
          {val === 'Y' ? '사용' : '미사용'}
        </Tag>
      )
    },
    {
      title: '관리', key: 'action', width: 80,
      render: (_: any, r: any) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => {
            setEditingWbs(r);
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
          <Button icon={<ReloadOutlined />} onClick={fetchWbs}>새로고침</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditingWbs(null);
            form.resetFields();
            setIsModalOpen(true);
          }}>WBS 추가</Button>
        </Space>
      </div>
      <Table dataSource={wbsList} columns={columns} rowKey="wbs_id" size="small" bordered />
      <Modal
        title={editingWbs ? "WBS 수정" : "WBS 추가"}
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
          <Form.Item name="wbs_name" label="WBS 명칭" rules={[{ required: true, message: 'WBS 명칭을 입력해주세요' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="wbs_desc" label="설명">
            <Input />
          </Form.Item>
          <Form.Item
            name="is_active"
            label="사용여부"
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

export default WbsManager;
