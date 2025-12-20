import React, { useState, useEffect, useContext } from 'react';
import { Button, DatePicker, Table, Input, Row, Col, Typography, message, Select, Tag, Modal, InputRef, Switch, Radio } from 'antd';
import { CloudDownloadOutlined, CloudUploadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE_URL } from './config';
import { AppContext } from './App';
import { playErrorSound, playSuccessSound } from './utils/sound';
import { fetchWithAuth } from './utils/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const SinglePack: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('day'), dayjs().endOf('day')]);
  const inputRef = React.useRef<InputRef>(null);

  const [messageModal, setMessageModal] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({ visible: false, message: '', type: 'error' });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (messageModal.visible) {
        setMessageModal({ ...messageModal, visible: false });
        // Try to focus back to input
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 50);
      }
    };

    if (messageModal.visible) {
      // Delay adding the listener to avoid immediate closing by scanner "Enter" or "LF"
      timeoutId = setTimeout(() => {
        window.addEventListener('keydown', handleKeyDown);
      }, 300);
    }
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [messageModal.visible]);

  const showMessageModal = (msg: string, type: 'success' | 'error') => {
    setMessageModal({ visible: true, message: msg, type: type });
    if (type === 'error') {
      playErrorSound();
    } else {
      playSuccessSound();
    }
  };

  const showError = (msg: string) => {
    playErrorSound();
    showMessageModal(msg, 'error');
  };

  const [shippers, setShippers] = useState<any[]>([]);
  const [selectedShipper, setSelectedShipper] = useState<string>('');

  const { partnerId, accountId, printerMain, printerMainIP, printerAux, printerAuxIP, templateId, machineId, shipper_ids, accountType, setIsOnline } = useContext(AppContext);

  const getStatusText = (flag: string) => {
    switch (flag) {
      case '0': return '대기';
      case '1': return '출력'; // Printed
      case '2': return '보류'; // Hold
      case '3': return '배송'; // Delivered
      case '4': return '취소'; // Canceled
      default: return '대기';
    }
  };

  // Debug log
  useEffect(() => {
    console.log('SinglePack Context:', { partnerId, accountId, printerMain, printerMainIP, printerAux, printerAuxIP, templateId, shipper_ids });
  }, [partnerId, accountId, printerMain, printerMainIP, printerAux, printerAuxIP, templateId, shipper_ids]);

  const fetchShippers = async () => {
    if (!accountId) return;
    if (!shipper_ids || shipper_ids.length === 0) {
      setShippers([]);
      setSelectedShipper('');
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/shippers`);
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

    setSearchLoading(true);
    try {
      const start = dateRange[0].format('YYYY-MM-DD HH:mm') + ":00";
      const end = dateRange[1].format('YYYY-MM-DD HH:mm') + ":59";

      let url = `${API_BASE_URL}/orders/single?partner_id=${partnerId}&account_id=${accountId}&start_date=${start}&end_date=${end}`;
      if (selectedShipper) {
        url += `&shipper_code=${selectedShipper}`;
      }

      const res = await fetchWithAuth(url);
      if (!res.ok) {
        throw new Error("Failed to fetch orders");
      }
      const data = await res.json();

      if (!data) {
        setOrders([]);
        return;
      }

      const mappedData = data.map((item: any, index: number) => ({
        key: index,
        status: getStatusText(item.work_flag),
        originalStatus: item.work_flag, // Keep for filtering logic
        csStatus: item.cancel_flag === 'Y' ? '취소' : '정상',
        scanTime: item.scan_date,
        packType: item.kind === '1' ? '단포' : '합포',
        waybillNo: item.waybill_no,
        productCode: item.product_cd,
        productName: item.product_name,
        productOption: item.product_option || item.option1,
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
        workFlag: item.work_flag, // Store raw flag
      }));
      setOrders(mappedData);
    } catch (err) {
      console.error(err);
      message.error('주문 목록을 불러오는데 실패했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'success' | 'error';
    orderId?: bigint;
    message?: string;
    waybillNo?: string;
    productCode?: string;
    productName?: string;
    invoiceUrl?: string;
    zplString?: string; // Added ZPL string support
  }>({ status: 'idle' });

  const handleReprint = async (targetPrinterName: string) => {
    if (!scanResult.waybillNo || scanResult.orderId === undefined) {
      message.warning('재발행할 운송장 정보가 없습니다.');
      return;
    }

    if (!targetPrinterName) {
      message.warning("프린터가 설정되지 않았습니다.");
      return;
    }

    // Determine target IP based on targetPrinterName
    let targetIP = "";
    if (targetPrinterName === printerMain) {
      targetIP = printerMainIP;
    } else if (targetPrinterName === printerAux) {
      targetIP = printerAuxIP;
    } else {
      message.warning("프린터 ip가 설정되지 않았습니다.");
      return;
    }
    console.log("1------")
    console.log("targetIP", targetIP)
    console.log("scanResult.zplString", scanResult.zplString)
    try {
      // Method 1: Try PrintZPL if IP is available (Fetch fresh ZPL)
      if (targetIP) {
        console.log("2-----------------------ZPL Print Start (fetching fresh ZPL)");
        try {
          // @ts-ignore
          const reprintRes = await window['go']['main']['App']['GetReprintZPL'](scanResult.orderId, scanResult.waybillNo);
          if (reprintRes && reprintRes.zpl_string) {
            // @ts-ignore
            const resZPL = await window['go']['main']['App']['PrintZPL'](targetIP, reprintRes.zpl_string);
            if (resZPL === "Success") {
              message.success("ZPL 운송장 재출력 완료");
              return;
            } else {
              console.error("ZPL Print Failed:", resZPL);
              message.error("재발행 중 오류가 발생했습니다.");
            }
          } else {
            console.warn("No ZPL string returned from server");
            message.error("재발행 중 오류가 발생했습니다.");
          }
        } catch (e) {
          console.error("Failed to fetch fresh ZPL:", e);
          message.error("재발행 중 오류가 발생했습니다.");
        }
      }
    } catch (err) {
      console.error(err);
      message.error("재발행 중 오류가 발생했습니다.");
    }
  };

  const fetchCompletedOrders = async () => {
    if (!partnerId || !accountId) return;

    try {
      // Default to today
      const today = dayjs().format('YYYYMMDD');
      let url = `${API_BASE_URL}/orders/completed?partner_id=${partnerId}&account_id=${accountId}&date=${today}`;
      if (machineId) {
        url += `&machine_id=${machineId}`;
      }

      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        const mappedData = data.map((item: any, index: number) => ({
          key: `comp_${index}`,
          id: item.id,
          status: getStatusText(item.work_flag),
          waybillNo: item.waybill_no,
          productCode: item.product_cd,
          productName: item.product_name,
          scanTime: item.scan_date,
        }));
        setCompletedOrders(mappedData);
      }
    } catch (e) {
      console.error("Failed to fetch completed orders", e);
    }
  };

  useEffect(() => {
    if (partnerId && accountId) {
      fetchOrders();
      fetchCompletedOrders();
    }
  }, [dateRange, partnerId, accountId, selectedShipper]);

  // Fetch completed orders when machineId changes or regularly if needed? 
  // For now stick to the main dependency array or add machineId
  useEffect(() => {
    if (partnerId && accountId) {
      fetchCompletedOrders();
    }
  }, [machineId]);

  const columns = [
    { title: '상태', dataIndex: 'status', key: 'status', width: 60 },
    { title: 'CS상태', dataIndex: 'csStatus', key: 'csStatus', width: 80 },
    ...(accountType === 'MULTI' ? [{ title: '화주', dataIndex: 'shipperName', key: 'shipperName', width: 120 }] : []),
    { title: '발주일자', dataIndex: 'orderDate2', key: 'orderDate2', width: 100 },
    { title: '상품코드', dataIndex: 'productCode', key: 'productCode', width: 120 },
    {
      title: '상품명',
      dataIndex: 'productName',
      key: 'productName',
      width: 250,
      ellipsis: true,
      render: (text: string, record: any) => (
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {text} <br />
          <span style={{ color: '#888', fontSize: '13px' }}>{record.productOption}</span>
        </div>
      )
    },

    { title: '운송장번호', dataIndex: 'waybillNo', key: 'waybillNo', width: 150 },
    { title: '수령인', dataIndex: 'receiver', key: 'receiver', width: 100 },
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

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') {
      return;
    }

    const inputElement = e.currentTarget;

    const productCodeInput = inputElement && inputElement.value;
    if (!productCodeInput) return;
    if (!partnerId || !accountId) {
      showError('API 계정을 선택해주세요.');
      return;
    }

    // 1. 스캔한 상품코드가 화면 조회내역에 있는지 체크한다.
    const matchingOrders = orders.filter(o => o.productCode === productCodeInput);
    if (matchingOrders.length === 0) {
      showError('작업할 상품이 없습니다.');
      return;
    }

    // 2. '대기' 상태인지 체크한다.
    const pendingOrder = matchingOrders.find(o => o.status === '대기');
    if (!pendingOrder) {
      const firstMatch = matchingOrders[0];
      showError(`이미 ${firstMatch.status} 되었습니다.`);
      return;
    }

    try {
      const targetIP = printerMainIP;
      const orderId = pendingOrder.orderId;
      const targetWaybillNo = pendingOrder.waybillNo;
      const startDate = dateRange[0].format('YYYY-MM-DD HH:mm') + ":00";
      const endDate = dateRange[1].format('YYYY-MM-DD HH:mm') + ":59";
      const shipperCode = selectedShipper || '';

      console.log("Scan Start:", startDate);
      console.log("Scan End:", endDate);
      console.log("Shipper Code:", shipperCode);
      console.log("Waybill No:", targetWaybillNo);
      console.log("Product Code:", productCodeInput);
      console.log("Machine ID:", machineId || 0);

      const result = await (window as any)['go']['main']['App']['ScanBarcodeWS'](
        targetWaybillNo,
        startDate,
        endDate,
        shipperCode,
        productCodeInput,
        orderId,
        machineId || 0,
        accountId || 0,
        templateId || '',
      );

      console.log("Scan Result:", result);

      if (result.success) {
        setScanResult({
          status: 'success',
          orderId: result.order_id,
          waybillNo: result.waybill_no,
          zplString: result.zpl_string    // Store ZPL string
        });

        // Print ZPL if exists and IP is available
        if (result.zpl_string && targetIP) {
          // ZPL Print Priority
          try {
            // @ts-ignore
            const printRes = await window['go']['main']['App']['PrintZPL'](targetIP, result.zpl_string);
            if (printRes !== "Success") {
              console.error("ZPL Print Failed inside Scan:", printRes);
              // Fallback to HTML if needed or just error?
              // User prefers ZPL. If ZPL fails, we can try HTML or show error.
              // As per request, we just show error properly.
              showError(`ZPL 출력 실패: ${printRes}`);
              playErrorSound();
            } else {
              message.success("ZPL 출력 완료");
              playSuccessSound();
            }
          } catch (e) {
            console.error("PrintZPL Error", e);
            showError("프린터 통신 오류");
            playErrorSound();
          }
        } else if (printerMain) {
          if (!result.zpl_string && printerMain) {
            // Try HTML fallback immediately?
            // Fetch HTML
            if (result.invoice_url) {
              try {
                const res = await fetchWithAuth(result.invoice_url);
                if (res.ok) {
                  const html = await res.text();
                  // @ts-ignore
                  await window['go']['main']['App']['PrintInvoice'](printerMain, html);
                }
              } catch (e) {
                showError(`HTML 출력 실패: ${e}`);
                playErrorSound();
              }
            }
            playSuccessSound();
          } else {
            playSuccessSound();
          }
        } else {
          playSuccessSound();
        }
        // setProductCodeInput(""); // Clear input
        fetchOrders(); // Refresh list
        fetchCompletedOrders(); // Refresh completed list

      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      console.error("Scan Failed:", err);
      const errMsg = err.message || 'Scan Failed';

      if (errMsg.includes("not connected")) {
        setIsOnline(false);
      }

      setScanResult({
        status: 'error',
        message: errMsg
      });
      showError(errMsg);
    } finally {
      if (inputElement) {
        inputElement.select();
      }
    }
  };

  const handleSync = async () => {
    if (!accountId) {
      message.warning('API 계정을 선택해주세요.');
      return;
    }

    try {
      setSyncLoading(true);
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      const res = await fetchWithAuth(`${API_BASE_URL}/orders/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        showMessageModal(`주문 수집 완료 (건수: ${result.count})`, 'success');
        fetchOrders(); // Refresh list
      } else {
        const err = await res.json();
        showMessageModal(`주문 수집 실패: ${err.error}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showMessageModal('주문 수집 중 오류가 발생했습니다.', 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleShippingProcess = async () => {
    if (!accountId || !machineId) {
      // machineId might be 0, wait, user said machine_id parameter.
      // If machineId is not set in context, we probably can't proceed or should warn?
      // Assuming machineId is available from context.
      if (!machineId) {
        message.warning('장비 설정이 필요합니다.');
        return;
      }
      if (!accountId) {
        message.warning('API 계정을 선택해주세요.');
        return;
      }
    }

    try {
      setShippingLoading(true);
      const res = await fetchWithAuth(`${API_BASE_URL}/orders/shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
          machine_id: machineId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          showMessageModal(`배송처리 완료 (건수: ${result.count})`, 'success');
          fetchOrders();
          fetchCompletedOrders();
        } else {
          showMessageModal(`배송처리 실패: ${result.error || 'Unknown error'}`, 'error');
        }
      } else {
        const err = await res.json();
        showMessageModal(`배송처리 실패: ${err.error}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showMessageModal('배송처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setShippingLoading(false);
    }
  };

  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

  const handleRowClick = (record: any) => {
    setSelectedRowKey(record.key);
    setScanResult({
      status: 'success', // Or 'idle' to keep it neutral, but user asked to show it in the top box which usually implies 'success' look or just data display.
      // Keeping 'success' to make it green OK or just reusing the display logic.
      // Actually, if we just want to show info, maybe 'idle' is better but the user might want to see it prominent.
      // scanResult controls the big box.
      orderId: record.id,
      waybillNo: record.waybillNo,
      productCode: record.productCode,
      productName: record.productName,
    });
  };

  const handleSearch = async () => {
    await Promise.all([fetchOrders(), fetchCompletedOrders()]);
  };

  return (
    <div className="content-area">
      {/* 상단 액션 바 */}
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Text strong>발주일자</Text>
          <RangePicker
            showTime={{ format: 'HH:mm' }}
            format="YYYY-MM-DD HH:mm"
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
            onClick={handleSearch}
            loading={searchLoading}
          >
            조회
          </Button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            style={{ backgroundColor: '#1E4496', color: '#fff' }}
            onClick={handleSync}
            loading={syncLoading}
          >
            주문수집
          </Button>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            style={{ backgroundColor: '#1E4496', color: '#fff' }}
            onClick={handleShippingProcess}
            loading={shippingLoading}
          >
            배송처리
          </Button>
        </div>
      </div>

      <Row gutter={16} style={{ flex: 1, overflow: 'hidden' }}>
        {/* 좌측 그리드 */}
        <Col span={15} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>작업할 내역입니다. (건수: {orders.length})</Text>
            <div style={{ display: 'flex', gap: '15px', fontSize: '13px', fontWeight: 'bold' }}>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span>오늘작업량: </span>
                <span style={{ color: '#1890ff', marginLeft: '5px' }}>
                  {orders ? orders.length : 0}
                </span>
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span>작업건수: </span>
                <span style={{ color: '#1890ff', marginLeft: '5px' }}>
                  {completedOrders ? completedOrders.length : 0}
                </span>
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span>미배송처리: </span>
                <span style={{ color: '#ff4d4f', marginLeft: '5px' }}>
                  {completedOrders ? completedOrders.filter(o => o.status === '출력').length : 0}
                </span>
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span>배송처리: </span>
                <span style={{ color: '#52c41a', marginLeft: '5px' }}>
                  {completedOrders ? completedOrders.filter(o => o.status === '배송').length : 0}
                </span>
              </div>
            </div>
          </div>
          <Table
            dataSource={orders} // Show all orders
            columns={columns}
            pagination={false}
            scroll={{ y: 'calc(100vh - 250px)' }}
            size="small"
            bordered
            loading={searchLoading}
            onRow={(record) => {
              if (record.workFlag !== '0') {
                return {
                  style: {
                    backgroundColor: '#1E4496',
                    color: 'white',
                  }
                };
              }
              return {};
            }}
          />
        </Col>

        {/* 우측 스캔 패널 */}
        <Col span={9} style={{ height: '100%' }}>
          {/* <Text type="secondary" style={{ fontSize: '16px' }}>바코드 스캔</Text> */}

          <Input
            ref={inputRef}
            size="large"
            placeholder="바코드 스캔"
            autoFocus
            style={{ marginBottom: 20, marginTop: 10 }}
            onKeyDown={handleScan}
          />
          <div className="scan-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1 }}>
              {/* Status Box */}
              <div style={{
                border: scanResult.status === 'success' ? '2px solid #00ff00' : (scanResult.status === 'error' ? '2px solid #ff0000' : '1px solid #d9d9d9'),
                borderRadius: '8px',
                padding: '5px',
                textAlign: 'center',
                backgroundColor: scanResult.status === 'success' ? 'rgba(0,255,0,0.1)' : (scanResult.status === 'error' ? 'rgba(255,0,0,0.1)' : '#fafafa'),
                marginBottom: '5px'
              }}>
                {scanResult.status === 'success' && (
                  <Title level={3} style={{ color: '#00ff00', margin: 0 }}>OK</Title>
                )}
                {scanResult.status === 'error' && (
                  <Title level={3} style={{ color: '#ff0000', margin: 0 }}>ERROR</Title>
                )}
                {scanResult.status === 'idle' && (
                  <Title level={3} style={{ color: '#ccc', margin: 0 }}>READY</Title>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginTop: '0px' }}>
                <div className="big-text" style={{ marginRight: '10px', fontSize: '20px' }}>운송장:</div>
                <div className="big-text" style={{ color: '#333', fontSize: '20px', fontWeight: 'bold' }}>
                  {scanResult.waybillNo || ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                <div className="big-text" style={{ marginRight: '10px', fontSize: '20px' }}>상품명:</div>
                <div className="big-text" style={{ color: '#333', fontSize: '20px', fontWeight: 'bold' }}>
                  {scanResult.productCode || ''}&nbsp;({scanResult.productName || ''})
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '20px', marginBottom: '5px', gap: '10px' }}>
              <Button size="large" block style={{ backgroundColor: '#004d40', color: 'white', width: 300 }} onClick={() => handleReprint(printerAux)}>보조프린터</Button>
              <Button size="large" block type="primary" style={{ width: 300 }} danger onClick={() => handleReprint(printerMain)}>재발행</Button>
            </div>

            {/* Hidden iframe for printing */}
            <iframe id="print-frame" style={{ position: 'absolute', width: 0, height: 0, border: 0 }} />

            {/* Add Scanned List Table Here */}
            <div style={{ flex: 1, marginTop: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* <Text strong>작업 완료 내역 (금일)</Text> */}
              <Table
                dataSource={completedOrders} // Fetched from API
                columns={[
                  { title: '상태', dataIndex: 'status', width: 60 },
                  // { title: '오더id', dataIndex: 'id', width: 120 },
                  { title: '운송장번호', dataIndex: 'waybillNo', width: 120 },
                  { title: '상품코드', dataIndex: 'productCode', width: 80 },
                  { title: '상품명', dataIndex: 'productName', width: 150, ellipsis: true },
                  { title: '스캔시간', dataIndex: 'scanTime', width: 100 },
                ]}
                pagination={false}
                scroll={{ y: 270 }} // Fixed height for small table
                size="small"
                bordered
                rowKey="key"
                onRow={(record) => {
                  return {
                    onClick: () => handleRowClick(record),
                    style: {
                      // Removed inline background/color to use CSS classes
                      cursor: 'pointer'
                    }
                  };
                }}
                rowClassName={(record) => record.key === selectedRowKey ? 'selected-row' : ''}
              />
            </div>
          </div>
        </Col>
      </Row>
      <Modal
        open={messageModal.visible}
        visible={messageModal.visible} // For Antd v4 compatibility
        footer={null}
        closable={false}
        centered
        width={500}
        styles={{ body: { textAlign: 'center', paddingLeft: '30px', paddingRight: '30px', paddingTop: '15px', paddingBottom: '20px' } }}
      >
        <Title level={2} style={{ color: messageModal.type === 'error' ? '#ff4d4f' : '#52c41a', marginBottom: 0 }}>
          {messageModal.message}
        </Title>
      </Modal>
    </div>
  );
};

export default SinglePack;