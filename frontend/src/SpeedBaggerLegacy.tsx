import React, { useState } from 'react';
import {
  Tabs,
  Table,
  DatePicker,
  Input,
  Select,
  Radio,
  Button,
  Form,
  Card,
  Row,
  Col,
  Typography,
  Space,
  message
} from 'antd';
import { SearchOutlined, ReloadOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Mock Data for History Grid
const initialHistoryData = [
  {
    key: '1',
    status: 'OK',
    csStatus: 'Normal',
    scanTime: '2023-10-27 10:30:00',
    packType: 'Single',
    waybillNo: '1234567890',
    productCode: 'P001',
    productName: 'Sample Product 1',
    optionName: 'Red / L',
    qty: 1,
    orderNo: 'ORD001',
    orderDate: '2023-10-26',
    seller: 'Coupang',
    orderDate2: '2023-10-26',
    receiver: 'John Doe',
    deviceName: 'Device A',
    printCount: 1,
  },
  // Add more mock data as needed
];

// Columns for History Grid
const historyColumns = [
  { title: '상태', dataIndex: 'status', key: 'status', width: 60 },
  { title: 'CS상태', dataIndex: 'csStatus', key: 'csStatus', width: 80 },
  { title: '스캔일시', dataIndex: 'scanTime', key: 'scanTime', width: 160 },
  { title: '포장구분', dataIndex: 'packType', key: 'packType', width: 80 },
  { title: '운송장번호', dataIndex: 'waybillNo', key: 'waybillNo', width: 150 },
  { title: '상품코드', dataIndex: 'productCode', key: 'productCode', width: 120 },
  { title: '상품명', dataIndex: 'productName', key: 'productName', width: 200, ellipsis: true },
  { title: '옵션명', dataIndex: 'optionName', key: 'optionName', width: 200, ellipsis: true },
  { title: '수량', dataIndex: 'qty', key: 'qty', width: 60 },
  { title: '주문번호', dataIndex: 'orderNo', key: 'orderNo', width: 120 },
  { title: '주문일자', dataIndex: 'orderDate', key: 'orderDate', width: 100 },
  { title: '판매처', dataIndex: 'seller', key: 'seller', width: 100 },
  { title: '발주일자', dataIndex: 'orderDate2', key: 'orderDate2', width: 100 },
  { title: '수령인', dataIndex: 'receiver', key: 'receiver', width: 100 },
  { title: '장비명', dataIndex: 'deviceName', key: 'deviceName', width: 100 },
  { title: '출력횟수', dataIndex: 'printCount', key: 'printCount', width: 80 },
];

const SpeedBaggerLegacy: React.FC = () => {
  const [activeTab, setActiveTab] = useState('history');
  const [historyData, setHistoryData] = useState(initialHistoryData);

  // Stats State
  const [stats, setStats] = useState({
    todayTotal: 150,
    workCount: 120,
    unshipped: 30,
    shipped: 120,
    message: '시스템이 정상 작동 중입니다.'
  });

  // History Tab Handlers
  const handleSearch = () => {
    message.success('조회되었습니다.');
    // Implement search logic here
  };

  const handleShippingProcess = () => {
    message.info('배송처리 로직 실행');
  };

  const handleDataCleanup = () => {
    message.warning('자료정리 로직 실행');
  };

  // Device Config Handlers
  const handleDeviceUpdate = (values: any) => {
    console.log('Device Config Updated:', values);
    message.success('장비설정이 업데이트 되었습니다.');
  };

  // System Config Handlers
  const handleSystemUpdate = (values: any) => {
    console.log('System Config Updated:', values);
    message.success('시스템설정이 업데이트 되었습니다.');
  };

  // --- Components for Tabs ---

  const HistoryTabContent = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top Filter Panel */}
      <Card style={{ marginBottom: 10 }} bodyStyle={{ padding: '12px 24px' }}>
        <Form layout="inline" style={{ marginBottom: 10 }}>
          <Form.Item label="작업구분">
            <Radio.Group defaultValue="all">
              <Radio value="all">전체</Radio>
              <Radio value="waiting">대기</Radio>
              <Radio value="printing">출력</Radio>
              <Radio value="aux">보조</Radio>
              <Radio value="completed">완료</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>

        <Row gutter={[16, 16]} align="middle">
          <Col span={20}>
            <Form layout="inline">
              <Form.Item label="운송장번호">
                <Input placeholder="운송장번호 입력" style={{ width: 180 }} />
              </Form.Item>
              <Form.Item label="상품코드">
                <Input placeholder="상품코드 입력" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item label="장비명">
                <Select defaultValue="device1" style={{ width: 150 }}>
                  <Select.Option value="device1">Device A</Select.Option>
                  <Select.Option value="device2">Device B</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="기간">
                <RangePicker defaultValue={[dayjs().subtract(1, 'month'), dayjs()]} />
              </Form.Item>
            </Form>
          </Col>
          <Col span={4} style={{ textAlign: 'right' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" icon={<SearchOutlined />} block onClick={handleSearch} size="large" style={{ backgroundColor: 'mediumblue' }}>
                조 회
              </Button>
            </Space>
          </Col>
        </Row>
        <Row style={{ marginTop: 10 }} justify="end" gutter={8}>
          <Col>
            <Button type="primary" style={{ backgroundColor: '#004040' }} size="large" onClick={handleShippingProcess}>
              배송처리
            </Button>
          </Col>
          <Col>
            <Button type="primary" style={{ backgroundColor: '#004040' }} size="large" onClick={handleDataCleanup}>
              자료정리
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Table
          columns={historyColumns}
          dataSource={historyData}
          pagination={{ pageSize: 50 }}
          scroll={{ y: 500, x: 1800 }}
          size="small"
          bordered
        />
      </div>
    </div>
  );

  const DeviceConfigTab = () => (
    <Card title="장비설정" style={{ height: '100%' }}>
      <Form layout="vertical" onFinish={handleDeviceUpdate} initialValues={{
        macAddr: '00:1A:2B:3C:4D:5E',
        deviceName: 'SpeedBagger-01',
        printer1: 'Printer A',
        printer2: 'Printer B',
        inspection: 'Yes',
        cert: 'Yes',
        log: 'Yes'
      }}>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item label="MAC 주소" name="macAddr">
              <Input readOnly style={{ backgroundColor: '#f0f0f0' }} />
            </Form.Item>
            <Form.Item label="장비명" name="deviceName">
              <Input />
            </Form.Item>
            <Form.Item label="메인프린터" name="printer1">
              <Select>
                <Select.Option value="Printer A">Printer A</Select.Option>
                <Select.Option value="Printer B">Printer B</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="서브프린터" name="printer2">
              <Select>
                <Select.Option value="Printer A">Printer A</Select.Option>
                <Select.Option value="Printer B">Printer B</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="합포스캔상품검수" name="inspection">
              <Select>
                <Select.Option value="Yes">Yes</Select.Option>
                <Select.Option value="No">No</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="인증여부" name="cert">
              <Select>
                <Select.Option value="Yes">Yes</Select.Option>
                <Select.Option value="No">No</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Log" name="log">
              <Select>
                <Select.Option value="Yes">Yes</Select.Option>
                <Select.Option value="No">No</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item style={{ marginTop: 40 }}>
              <Button type="primary" htmlType="submit" block size="large" style={{ backgroundColor: 'mediumblue' }}>
                UPDATE
              </Button>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );

  const ErrorLogTab = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 10 }}>
        <Button type="primary" icon={<SearchOutlined />} style={{ backgroundColor: 'mediumblue' }} size="large">
          조 회
        </Button>
      </div>
      <Table
        columns={[
          { title: '발생일시', dataIndex: 'time', key: 'time' },
          { title: '유형', dataIndex: 'type', key: 'type' },
          { title: '메시지', dataIndex: 'msg', key: 'msg' },
          { title: '주문번호', dataIndex: 'orderNo', key: 'orderNo' },
        ]}
        dataSource={[]}
        bordered
        scroll={{ y: 600 }}
      />
    </div>
  );

  const SystemConfigTab = () => (
    <Card title="시스템설정" style={{ height: '100%' }}>
      <Form layout="horizontal" labelCol={{ span: 4 }} wrapperCol={{ span: 14 }} onFinish={handleSystemUpdate} initialValues={{
        collectionPeriod: '1개월',
        dataSource: 'EZ_Admin',
        url: 'https://api.example.com',
        partnerKey: 'PARTNER_KEY_123',
        domainKey: 'DOMAIN_KEY_456',
        subDomain: 'sub.example.com',
        supplyCode: 'SUPPLY_001',
        deviceSpecific: 'Yes'
      }}>
        <Form.Item label="수집기간" name="collectionPeriod">
          <Select style={{ width: 200 }}>
            <Select.Option value="1일">1일</Select.Option>
            <Select.Option value="1주일">1주일</Select.Option>
            <Select.Option value="1개월">1개월</Select.Option>
            <Select.Option value="3개월">3개월</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="데이터원청" name="dataSource">
          <Select style={{ width: 300 }}>
            <Select.Option value="EZ_Admin">EZ_Admin</Select.Option>
            <Select.Option value="EZ_WMS">EZ_WMS</Select.Option>
            <Select.Option value="ONE_FMS">ONE_FMS</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="장비별설정" name="deviceSpecific">
          <Select style={{ width: 100 }}>
            <Select.Option value="Yes">Yes</Select.Option>
            <Select.Option value="No">No</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="Url" name="url">
          <Input />
        </Form.Item>
        <Form.Item label="Partner Key" name="partnerKey">
          <Input />
        </Form.Item>
        <Form.Item label="Domain Key" name="domainKey">
          <Input />
        </Form.Item>
        <Form.Item label="Sub Domain" name="subDomain">
          <Input />
        </Form.Item>
        <Form.Item label="Supply Code" name="supplyCode">
          <Input />
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 4, span: 14 }}>
          <Button type="primary" htmlType="submit" size="large" style={{ backgroundColor: 'mediumblue', width: 200 }}>
            UPDATE
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );

  const ConfigTabContent = () => (
    <Tabs
      defaultActiveKey="device"
      type="card"
      items={[
        { key: 'device', label: '장비설정', children: <DeviceConfigTab /> },
        { key: 'error', label: '에러사항조회', children: <ErrorLogTab /> },
        { key: 'system', label: '시스템설정', children: <SystemConfigTab /> },
      ]}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      {/* Main Tabs */}
      <div style={{ flex: 1, padding: '10px', overflow: 'auto' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          size="large"
          items={[
            { key: 'history', label: '내 역', children: <HistoryTabContent /> },
            { key: 'config', label: '설 정', children: <ConfigTabContent /> },
          ]}
        />
      </div>

      {/* Footer Status Bar (Mimicking panel2) */}
      <div style={{
        height: '60px',
        backgroundColor: '#f0f2f5',
        borderTop: '1px solid #d9d9d9',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: 'black'
      }}>
        <Text strong style={{ fontSize: 18, color: 'blue' }}>{stats.message}</Text>
        <Space size="large">
          <Space>
            <Text>오늘 총 작업량:</Text>
            <Input readOnly value={stats.todayTotal} style={{ width: 80, textAlign: 'right', backgroundColor: '#e6e6e6' }} />
          </Space>
          <Space>
            <Text>작업건수:</Text>
            <Input readOnly value={stats.workCount} style={{ width: 80, textAlign: 'right', backgroundColor: '#e6e6e6' }} />
          </Space>
          <Space>
            <Text>미배송처리:</Text>
            <Input readOnly value={stats.unshipped} style={{ width: 80, textAlign: 'right', backgroundColor: '#e6e6e6' }} />
          </Space>
          <Space>
            <Text>배송처리:</Text>
            <Input readOnly value={stats.shipped} style={{ width: 80, textAlign: 'right', backgroundColor: '#e6e6e6' }} />
          </Space>
        </Space>
      </div>
    </div>
  );
};

export default SpeedBaggerLegacy;
