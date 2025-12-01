import React, { useContext, useEffect } from 'react';
import { Button, DatePicker, Table, Input, Row, Col, Typography, Tag } from 'antd';
import dayjs from 'dayjs';
import { AppContext } from './App';

const { Title, Text } = Typography;

const MultiPack: React.FC = () => {
  const { partnerId, accountId, printerMain, printerAux, templateId } = useContext(AppContext);

  // Debug log to verify context
  useEffect(() => {
    console.log('MultiPack Context:', { partnerId, accountId, printerMain, printerAux, templateId });
  }, [partnerId, accountId, printerMain, printerAux, templateId]);
  // Columns matching SpeedBaggerLegacy
  const columns = [
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

  const data = [
    {
      key: 1,
      status: '대기',
      csStatus: '정상',
      scanTime: '2025-11-07 10:00:00',
      packType: '합포',
      waybillNo: '592148879681',
      productCode: '8800315072080',
      productName: '마일드 골지 아기 타이즈',
      optionName: '브라운-0-12m(S)',
      qty: 1,
      orderNo: 'ORD20251107-1',
      orderDate: '2025-11-07',
      seller: '쿠팡',
      orderDate2: '2025-11-07',
      receiver: '홍길동',
      deviceName: 'SpeedBagger-01',
      printCount: 0
    },
    {
      key: 2,
      status: '대기',
      csStatus: '정상',
      scanTime: '2025-11-07 10:00:00',
      packType: '합포',
      waybillNo: '592148879681',
      productCode: '8800315072059',
      productName: '마일드 골지 아기 타이즈',
      optionName: '차콜-0-12m(S)',
      qty: 1,
      orderNo: 'ORD20251107-1',
      orderDate: '2025-11-07',
      seller: '쿠팡',
      orderDate2: '2025-11-07',
      receiver: '홍길동',
      deviceName: 'SpeedBagger-01',
      printCount: 0
    },
  ];

  return (
    <div className="content-area">
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Text strong>발주일자</Text>
          <DatePicker.RangePicker defaultValue={[dayjs(), dayjs()]} />
        </div>
        <Button type="primary" style={{ backgroundColor: '#004d40' }}>배송처리</Button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <Title level={4} style={{ display: 'inline-block', marginRight: 20 }}>배송 상품 검수 내역입니다.</Title>
        <Text strong style={{ color: 'blue', fontSize: 16 }}>작업모드 : 상품검수</Text>
      </div>

      <Row gutter={16} style={{ flex: 1, overflow: 'hidden' }}>
        <Col span={14} style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Table
            dataSource={data}
            columns={columns}
            pagination={false}
            bordered
            size="small"
            scroll={{ x: 'max-content', y: 'calc(100vh - 250px)' }}
          />
        </Col>

        <Col span={10} style={{ height: '100%' }}>
          <div className="scan-panel" style={{ overflowY: 'auto' }}>
            <div>
              <div style={{ display: 'flex', gap: 5 }}>
                <Input size="large" defaultValue="592148879681" style={{ flex: 1 }} />
                <Button size="large" type="primary" style={{ backgroundColor: 'green' }}>Clear</Button>
              </div>
              <div className="big-text" style={{ marginTop: 20 }}>592148879681</div>

              <div style={{ display: 'flex', gap: 30, margin: '20px 0' }}>
                <div className="big-text">총주문 : 2</div>
                <div className="big-text">총실적 : 0</div>
              </div>

              <div style={{ marginTop: 20 }}>
                <Text strong>수령인 *</Text>
                <div style={{ marginTop: 10, fontSize: 16 }}>서울시 도봉구 노해로 ***, **</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <Button size="large" block style={{ backgroundColor: '#004d40', color: 'white' }}>보조프린트</Button>
              <Button size="large" block type="primary" danger>재발행</Button>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default MultiPack;