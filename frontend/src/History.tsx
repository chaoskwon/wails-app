import React from 'react';
import { Button, DatePicker, Table, Input, Radio, Form, Select } from 'antd';
import dayjs from 'dayjs';

const History: React.FC = () => {
  const [form] = Form.useForm();

  // Columns matching SpeedBaggerLegacy
  const columns = [
    { title: '상태', dataIndex: 'status', key: 'status', width: 60, render: (text: string) => <span style={{ color: text === '출력' ? 'blue' : 'black' }}>{text}</span> },
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

  const data = Array.from({ length: 15 }).map((_, i) => ({
    key: i,
    status: i === 0 ? '출력' : '대기',
    csStatus: '정상',
    scanTime: i === 0 ? '2025-11-21 09:46:08' : '',
    packType: '단포',
    waybillNo: `59214887${8874 + i}`,
    productCode: '2110119000049',
    productName: '카이 기모 아기 레깅스',
    optionName: 'Free',
    qty: 1,
    orderNo: `ORD20251107-${i}`,
    orderDate: '2025-11-07',
    seller: '쿠팡',
    orderDate2: '2025-11-07',
    receiver: '홍길동',
    deviceName: 'SpeedBagger-01',
    printCount: 0,
  }));

  return (
    <div className="content-area">
      <div style={{ border: '1px solid #ccc', padding: 15, marginBottom: 10, backgroundColor: '#f9f9f9' }}>
        <Form form={form} layout="inline" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Input addonBefore="운송장번호" size="small" style={{ width: 250 }} />
            <Input addonBefore="상품코드" size="small" style={{ width: 250 }} />
            <Select placeholder="장비명" size="small" style={{ width: 250 }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: 10 }}>작업구분</span>
              <Radio.Group defaultValue="all" size="small">
                <Radio value="all">전체</Radio>
                <Radio value="wait">대기</Radio>
                <Radio value="print">출력</Radio>
                <Radio value="sub">보조</Radio>
                <Radio value="done">완료</Radio>
              </Radio.Group>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>발주일자</span>
              <DatePicker.RangePicker size="small" defaultValue={[dayjs(), dayjs()]} />
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <Button type="primary" style={{ backgroundColor: 'blue', width: 100 }}>조회</Button>
              <Button type="primary" style={{ backgroundColor: '#004d40', width: 100 }}>배송처리</Button>
            </div>
            <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
              <span>자동배송처리</span>
              <Select defaultValue="No" size="small" style={{ width: 60 }} />
              <Button type="primary" style={{ backgroundColor: '#004d40', width: 100 }}>자료정리</Button>
            </div>
          </div>
        </Form>
      </div>

      <Table
        dataSource={data}
        columns={columns}
        pagination={false}
        scroll={{ x: 'max-content', y: 'calc(100vh - 300px)' }}
        size="small"
        bordered
      />
    </div>
  );
};

export default History;