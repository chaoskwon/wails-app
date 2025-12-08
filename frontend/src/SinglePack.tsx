import React, { useState, useEffect, useContext } from 'react';
import { Button, DatePicker, Table, Input, Row, Col, Typography, message, Select, Tag } from 'antd';
import { CloudDownloadOutlined, CloudUploadOutlined, SearchOutlined, WifiOutlined, DisconnectOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE_URL } from './config';
import { AppContext } from './App';
import { playErrorSound, playSuccessSound } from './utils/sound';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const SinglePack: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs(), dayjs()]);
  const [isOnline, setIsOnline] = useState(false);

  const [shippers, setShippers] = useState<any[]>([]);
  const [selectedShipper, setSelectedShipper] = useState<string>('');

  const { partnerId, accountId, printerMain, printerAux, templateId, machineId, shipper_ids, accountType } = useContext(AppContext);

  // Debug log
  useEffect(() => {
    console.log('SinglePack Context:', { partnerId, accountId, printerMain, printerAux, templateId, shipper_ids });
  }, [partnerId, accountId, printerMain, printerAux, templateId, shipper_ids]);

  // Connect WebSocket
  useEffect(() => {
    const wsUrl = API_BASE_URL.replace("http", "ws") + "/ws";
    // @ts-ignore
    window['go']['main']['App']['ConnectWebSocket'](wsUrl).then((res: string) => {
      if (res === "Connected") {
        setIsOnline(true);
        message.success("서버에 연결되었습니다.");
      } else {
        setIsOnline(false);
        message.error("서버 연결 실패: " + res);
      }
    });

    // Optional: connection check loop, but Go handles keepalive
  }, []);

  const fetchShippers = async () => {
    if (!accountId) return;
    if (!shipper_ids || shipper_ids.length === 0) {
      setShippers([]);
      setSelectedShipper('');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/shippers`);
      if (res.ok) {
        const allShippers: any[] = await res.json();
        let filtered = allShippers.filter(s => s.account_id === accountId);
        filtered = filtered.filter(s => shipper_ids.includes(s.shipper_id));
        setShippers(filtered);
        setSelectedShipper('');
      }
    } catch (e) {
      console.error("Failed to fetch shippers", e);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchShippers();
    }
  }, [accountId, shipper_ids]);

  const fetchOrders = async () => {
    if (!partnerId || !accountId) return;

    setLoading(true);
    try {
      const start = dateRange[0].format('YYYYMMDD');
      const end = dateRange[1].format('YYYYMMDD');

      let url = `${API_BASE_URL}/orders/single?partner_id=${partnerId}&account_id=${accountId}&start_date=${start}&end_date=${end}&alloc_machine_id=${machineId || 0}`;
      if (selectedShipper) {
        url += `&shipper_code=${selectedShipper}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch orders");
      }
      const data = await res.json();

      if (!data) {
        setOrders([]);
        return;
      }

      const mappedData = data.map((item: any, index: number) => ({
        key: item.order_id || index,
        status: item.result_status || '대기',
        csStatus: item.cancel_flag === 'Y' ? '취소' : '정상',
        scanTime: item.scan_date,
        packType: item.kind === '1' ? '단포' : '합포',
        waybillNo: item.waybill_no,
        productCode: item.product_cd,
        productName: item.product_name,
        optionName: item.option1,
        qty: item.order_qty,
        orderNo: item.order_no,
        orderDate: item.order_ymd,
        seller: item.mall_name || item.mall_cd,
        orderDate2: item.collect_date,
        receiver: item.recv_name,
        address: item.recv_addr,
        shipperName: item.shipper_name,
        deviceName: item.device_name,
        printCount: item.print_count,
      }));
      setOrders(mappedData);
    } catch (err) {
      console.error(err);
      message.error('주문 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (partnerId && accountId) {
      fetchOrders();
    }
  }, [dateRange, partnerId, accountId, selectedShipper]);

  const columns = [
    { title: '상태', dataIndex: 'status', key: 'status', width: 60 },
    { title: 'CS상태', dataIndex: 'csStatus', key: 'csStatus', width: 80 },
    ...(accountType === 'MULTI' ? [{ title: '화주', dataIndex: 'shipperName', key: 'shipperName', width: 120 }] : []),
    { title: '발주일자', dataIndex: 'orderDate2', key: 'orderDate2', width: 100 },
    { title: '상품코드', dataIndex: 'productCode', key: 'productCode', width: 120 },
    { title: '상품명', dataIndex: 'productName', key: 'productName', width: 200, ellipsis: true },
    { title: '옵션명', dataIndex: 'optionName', key: 'optionName', width: 200, ellipsis: true },
    { title: '수령인', dataIndex: 'receiver', key: 'receiver', width: 100 },
    { title: '운송장번호', dataIndex: 'waybillNo', key: 'waybillNo', width: 150 },
    { title: '주소', dataIndex: 'address', key: 'address', width: 150, ellipsis: true },
    { title: '수량', dataIndex: 'qty', key: 'qty', width: 60 },
    { title: '스캔일시', dataIndex: 'scanTime', key: 'scanTime', width: 160 },
    { title: '포장구분', dataIndex: 'packType', key: 'packType', width: 80 },
    { title: '주문번호', dataIndex: 'orderNo', key: 'orderNo', width: 120 },
    { title: '주문일자', dataIndex: 'orderDate', key: 'orderDate', width: 100 },
    { title: '판매처', dataIndex: 'seller', key: 'seller', width: 100 },
    { title: '장비명', dataIndex: 'deviceName', key: 'deviceName', width: 100 },
    { title: '출력횟수', dataIndex: 'printCount', key: 'printCount', width: 80 },
  ];

  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'success' | 'error';
    message?: string;
    waybillNo?: string;
    productName?: string;
  }>({ status: 'idle' });

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const productCode = e.currentTarget.value;
      if (!productCode) return;

      if (!partnerId || !accountId) {
        message.warning('API 계정이 선택되지 않았습니다.');
        playErrorSound();
        return;
      }

      const inputElement = e.currentTarget;

      try {
        // WebSocket Scan
        // @ts-ignore
        const result = await window['go']['main']['App']['ScanBarcodeWS'](
          productCode,
          machineId || 0,
          "ONE"
        );

        console.log("Scan Result:", result);

        if (result.success) {
          setScanResult({
            status: 'success',
            waybillNo: result.waybill_no,
            productName: result.product_name
          });

          // Print ZPL if exists
          if (result.zpl_string && printerMain) {
            try {
              // @ts-ignore
              const printRes = await window['go']['main']['App']['PrintZPL'](printerMain, result.zpl_string);
              if (printRes !== "Success") {
                message.error(`프린터 출력 실패: ${printRes}`);
                playErrorSound();
              } else {
                message.success("운송장 출력 완료");
                playSuccessSound();
              }
            } catch (pe) {
              console.error("Print Error:", pe);
              message.error("프린터 통신 오류");
              playErrorSound();
            }
          } else {
            playSuccessSound();
          }
        } else {
          throw new Error(result.message);
        }

      } catch (err: any) {
        console.error("Scan Failed:", err);
        setScanResult({
          status: 'error',
          message: err.message || 'Scan Failed'
        });
        message.error(err.message || "스캔 실패");
        playErrorSound();
      } finally {
        if (inputElement) {
          inputElement.value = '';
        }
      }
    }
  };


  return (
    <div className="content-area">
      {/* 상단 액션 바 */}
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Text strong>발주일자</Text>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
          />
          {accountType === 'MULTI' && (
            <Select
              allowClear
              placeholder="화주 선택"
              style={{ width: 150 }}
              value={selectedShipper}
              onChange={(value) => setSelectedShipper(value)}
            >
              <Option value="">화주전체</Option>
              {shippers.map(s => (
                <Option key={s.shipper_id} value={s.shipper_code}>{s.shipper_name}</Option>
              ))}
            </Select>
          )}
          <Button
            type="primary"
            ghost
            icon={<SearchOutlined />}
            style={{ color: '#1E4496', borderColor: '#1E4496' }}
            onClick={fetchOrders}
          >
            조회
          </Button>
          {isOnline ? (
            <Tag icon={<WifiOutlined />} color="success">Online</Tag>
          ) : (
            <Tag icon={<DisconnectOutlined />} color="error">Offline</Tag>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Removed Sync Button as it is real-time now */}
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            style={{ backgroundColor: '#1E4496' }}
            disabled
          >
            배송처리
          </Button>
        </div>
      </div>

      <Row gutter={16} style={{ flex: 1, overflow: 'hidden' }}>
        {/* 좌측 그리드 */}
        <Col span={16} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
            <Text strong>작업할 내역입니다. (건수: {orders.length})</Text>
          </div>
          <Table
            dataSource={orders}
            columns={columns}
            pagination={false}
            scroll={{ y: 'calc(100vh - 250px)' }}
            size="small"
            bordered
            loading={loading}
          />
        </Col>

        {/* 우측 스캔 패널 */}
        <Col span={8} style={{ height: '100%' }}>
          <div className="scan-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1 }}>
              <Text type="secondary" style={{ fontSize: '16px' }}>Scan Product</Text>
              <Input
                size="large"
                placeholder="바코드 스캔"
                autoFocus
                style={{ marginBottom: 20, marginTop: 10 }}
                onKeyDown={handleScan}
              />

              {/* Status Box */}
              <div style={{
                border: scanResult.status === 'success' ? '2px solid #00ff00' : (scanResult.status === 'error' ? '2px solid #ff0000' : '1px solid #d9d9d9'),
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: scanResult.status === 'success' ? 'rgba(0,255,0,0.1)' : (scanResult.status === 'error' ? 'rgba(255,0,0,0.1)' : '#fafafa'),
                marginBottom: '20px'
              }}>
                {scanResult.status === 'success' && (
                  <Title level={1} style={{ color: '#00ff00', margin: 0 }}>OK</Title>
                )}
                {scanResult.status === 'error' && (
                  <Title level={1} style={{ color: '#ff0000', margin: 0 }}>ERROR</Title>
                )}
                {scanResult.status === 'idle' && (
                  <Title level={1} style={{ color: '#ccc', margin: 0 }}>READY</Title>
                )}
              </div>

              <div className="big-text">Waybill No:</div>
              <div className="big-text" style={{ color: '#333', fontSize: '24px', fontWeight: 'bold' }}>
                {scanResult.waybillNo || '-'}
              </div>

              <div className="big-text" style={{ marginTop: '20px' }}>Product Name:</div>
              <Title level={3} style={{ marginTop: 5 }}>
                {scanResult.productName || '-'}
              </Title>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <Button size="large" block style={{ backgroundColor: '#004d40', color: 'white' }}>보조프린트</Button>
              <Button size="large" block type="primary" danger>재발행</Button>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default SinglePack;