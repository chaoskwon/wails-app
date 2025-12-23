import React, { useState, useEffect, createContext } from 'react';
import './App.css';
import logo from './assets/images/logo_white.jpeg';
import { Tabs, message, Tag, Space, Modal, List, Button } from 'antd';
import { EventsOn } from "../wailsjs/runtime/runtime";
import SinglePack from './SinglePack';
import MultiPack from './MultiPack';
import History from './History';
import SettingsPage from './SettingsPage';
import { API_BASE_URL } from './config';
import { ApiAccount } from './types';
import AdminSettingsPage from './AdminSettingsPage';
import { Quit } from '../wailsjs/runtime/runtime';
import { fetchWithAuth } from './utils/api';

// Create Context for Global Defaults
export const AppContext = createContext<{
  partnerId: number | null;
  accountId: number | null;
  printerMain: string;
  printerMainIP: string;
  printerAux: string;
  printerAuxIP: string;
  templateId: string;
  machineId: number | null;
  shipper_ids: number[] | null;
  accountType: string;
  isOnline: boolean;
  setIsOnline: (status: boolean) => void;
}>({
  partnerId: null,
  accountId: null,
  printerMain: '',
  printerMainIP: '',
  printerAux: '',
  printerAuxIP: '',
  templateId: '',
  machineId: null,
  shipper_ids: null,
  accountType: '',
  isOnline: false,
  setIsOnline: () => { },
});

function App() {
  const [activeTab, setActiveTab] = useState('1');
  const [autoOpenMachine, setAutoOpenMachine] = useState(false);
  const [machineName, setMachineName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [appVersion, setAppVersion] = useState('');

  // Default IDs for API calls
  const [defaultPartnerId, setDefaultPartnerId] = useState<number | null>(null);
  const [defaultAccountId, setDefaultAccountId] = useState<number | null>(null);
  const [currentAccountType, setCurrentAccountType] = useState<string>('');
  const [currentMachine, setCurrentMachine] = useState<any>(null);

  // Connection State
  const [isOnline, setIsOnline] = useState(false);

  // Modal State
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  const handleQuit = () => {
    Quit();
  };

  useEffect(() => {
    fetchVersion();
    checkForUpdates();
    checkRegistration();
  }, []);

  // Connect WebSocket with Auto-Reconnect
  const isOnlineRef = React.useRef(false);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    const wsUrl = API_BASE_URL.replace("http", "ws") + "/ws";

    const connect = () => {
      if (isOnlineRef.current) return;

      const uuid = localStorage.getItem('AUTH_MACHINE_UUID');
      const machineId = localStorage.getItem('AUTH_MACHINE_ID');
      let finalWsUrl = wsUrl;

      if (uuid && machineId) {
        finalWsUrl += `?machine_uuid=${uuid}&machine_id=${machineId}`;
      }

      // @ts-ignore
      window['go']['main']['App']['ConnectWebSocket'](finalWsUrl).then((res: string) => {
        if (res === "Connected") {
          setIsOnline(true);
          isOnlineRef.current = true;
        } else {
          setIsOnline(false);
          isOnlineRef.current = false;
          console.log("WS Connect Failed:", res);
        }
      }).catch((err: any) => {
        console.error("WS Connect Error:", err);
        setIsOnline(false);
        isOnlineRef.current = false;
      });
    };

    connect();

    // Listen for disconnect event from Backend (Server-side close)
    EventsOn("ws:disconnect", () => {
      console.log("Received ws:disconnect event!");
      setIsOnline(false);
      isOnlineRef.current = false;
    });

    const interval = setInterval(() => {
      if (!isOnlineRef.current) {
        console.log("Auto-reconnecting WS...");
        connect();
      }
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchVersion = async () => {
    try {
      // @ts-ignore
      if (window['go'] && window['go']['main'] && window['go']['main']['App'] && window['go']['main']['App']['GetVersion']) {
        // @ts-ignore
        const version = await window['go']['main']['App']['GetVersion']();
        setAppVersion(version);
      }
    } catch (e) {
      console.error("Failed to fetch version", e);
      Modal.error({
        title: '버전 정보 로드 실패',
        content: `버전 정보를 가져오는 중 오류가 발생했습니다.\n${e}`,
      });
    }
  };

  const checkForUpdates = async () => {
    try {
      // @ts-ignore
      if (window['go'] && window['go']['main'] && window['go']['main']['App'] && window['go']['main']['App']['CheckForUpdates']) {
        // @ts-ignore
        const result = await window['go']['main']['App']['CheckForUpdates']();
        if (result && result !== "App is up to date" && result !== "No updates found") {
          message.info(result);
        }
      }
    } catch (e) {
      console.error("Update check failed", e);
      Modal.error({
        title: '업데이트 확인 실패',
        content: `업데이트 확인 중 오류가 발생했습니다.\n${e}`,
      });
    }
  };

  const checkRegistration = async () => {
    try {
      let uuid = '';
      // @ts-ignore
      if (window['go'] && window['go']['main'] && window['go']['main']['App'] && window['go']['main']['App']['GetSystemUUID']) {
        // @ts-ignore
        uuid = await window['go']['main']['App']['GetSystemUUID']();
      }

      if (!uuid) return;

      const res = await fetchWithAuth(`${API_BASE_URL}/machines`);
      if (res.ok) {
        const machines: any[] = await res.json();
        const machine = machines.find(m => m.machine_uuid === uuid);

        if (machine) {
          if (machine.is_active !== 'Y') {
            setIsApprovalModalOpen(true);
            return;
          }

          // Save credential for API calls
          localStorage.setItem('AUTH_MACHINE_UUID', machine.machine_uuid);
          localStorage.setItem('AUTH_MACHINE_ID', machine.machine_id.toString());

          setCurrentMachine(machine);
          setMachineName(machine.machine_name);
          setDefaultPartnerId(machine.partner_id);

          // Fetch Partner Name
          if (machine.partner_id) {
            fetchPartnerName(machine.partner_id);
            // Check accounts for auto-selection or modal
            handleStartupAccountCheck(machine);
          }
        } else {
          message.warning('장비가 등록되지 않았습니다. 설정을 완료해주세요.');
          setActiveTab('5'); // Go to Settings
          setAutoOpenMachine(true);
        }
      }
    } catch (e) {
      Modal.error({
        title: '장비 등록 확인 실패',
        content: `장비 등록 확인 중 오류가 발생했습니다.\n${e}`,
        onOk: () => Quit(),
      });
    }
  };

  const handleStartupAccountCheck = async (machine: any) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/accounts`);
      if (res.ok) {
        const accounts: ApiAccount[] = await res.json();
        const partnerAccounts = accounts.filter(a => a.partner_id === machine.partner_id);

        // 1. Check if machine already has a valid account_id set
        if (machine.account_id) {
          const configuredAccount = partnerAccounts.find(a => a.account_id === machine.account_id);
          if (configuredAccount) {
            setDefaultAccountId(configuredAccount.account_id);
            setAccountName(configuredAccount.account_name);
            setCurrentAccountType(configuredAccount.account_type);
            // message.success(`API 계정 '${configuredAccount.account_name}'이(가) 설정되었습니다.`);
            return; // Skip modal
          }
        }
        // 2. Fallback: Go to Settings
        message.warning('API 계정이 설정되지 않았습니다. 설정 페이지로 이동합니다.');
        setActiveTab('5');
      }
    } catch (e) {
      Modal.error({
        title: 'API 계정 확인 실패',
        content: `API 계정 확인 중 오류가 발생했습니다.\n${e}`,
        onOk: () => Quit(),
      });
    }
  };

  const fetchPartnerName = async (partnerId: number) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/partners/${partnerId}`);
      if (res.ok) {
        const partner = await res.json();
        setPartnerName(partner.partner_name);
      }
    } catch (e) {
      Modal.error({
        title: '파트너 정보 확인 실패',
        content: `파트너 정보 확인 중 오류가 발생했습니다.\n${e}`,
        onOk: () => Quit(),
      });
    }
  };

  const handleMachineAdded = () => {
    setActiveTab('1'); // Go to Single Pack
    setAutoOpenMachine(false); // Reset auto open flag
    checkRegistration(); // Refresh info
  };

  const items = [
    { key: '1', label: '단 포', children: <SinglePack /> },
    { key: '2', label: '합 포', children: <MultiPack /> },
    { key: '3', label: '내 역', children: <History /> },
    { key: '5', label: '설 정', children: <SettingsPage autoOpenMachine={autoOpenMachine} onMachineAdded={handleMachineAdded} partnerId={defaultPartnerId} /> },
  ];

  return (
    <AppContext.Provider value={{
      partnerId: defaultPartnerId,
      accountId: defaultAccountId,
      printerMain: currentMachine?.printer_main || '',
      printerMainIP: currentMachine?.printer_main_ip || '',
      printerAux: currentMachine?.printer_aux || '',
      printerAuxIP: currentMachine?.printer_aux_ip || '',
      templateId: currentMachine?.waybill_template || '',
      machineId: currentMachine?.machine_id || null,
      shipper_ids: currentMachine?.shipper_ids || null,
      accountType: currentAccountType,
      isOnline: isOnline,
      setIsOnline: setIsOnline,
    }}>
      <div className="container">
        {/* 메인 탭 네비게이션 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 10px', backgroundColor: '#f0f2f5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, backgroundColor: '#1E4496', padding: '10px', borderRadius: '8px' }}>
            <img src={logo} alt="logo" style={{ height: '40px', borderRadius: '4px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {partnerName && <Tag color="#1E4496" style={{ fontSize: '20px', fontWeight: 'bold', padding: '6px 15px', borderRadius: '8px' }}>{partnerName}</Tag>}
              {accountName && <Tag color="#1E4496" style={{ fontSize: '20px', fontWeight: 'bold', padding: '6px 15px', borderRadius: '8px' }}>{accountName}</Tag>}
              {machineName && <Tag color="#1E4496" style={{ fontSize: '20px', fontWeight: 'bold', padding: '6px 15px', borderRadius: '8px' }}>{machineName}</Tag>}
              <Button type="default" onClick={() => setIsAdminModalOpen(true)} style={{ display: currentMachine?.role === '*' ? 'block' : 'none', backgroundColor: '#F26D24', color: '#fff', border: 'none' }}>어드민설정</Button>
            </div>
          </div>
          <Tabs
            activeKey={activeTab}
            items={items}
            onChange={setActiveTab}
            type="card"
            style={{ marginTop: 5, flex: 1, display: 'flex', flexDirection: 'column' }}
            tabBarStyle={{ marginBottom: 0 }}
          />
        </div>

        {/* 탭 내용 영역 (CSS에서 flex: 1 처리됨) */}
        {/* Tabs 컴포넌트 내부에서 렌더링되므로 별도 처리 불필요 */}

        {/* 하단 상태바 */}
        <div className="footer-bar">
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {appVersion && <span>v{appVersion}</span>}
          </div>
        </div>

        <Modal
          title="승인 필요"
          open={isApprovalModalOpen}
          footer={[
            <Button key="ok" type="primary" onClick={handleQuit}>
              확인
            </Button>
          ]}
          closable={false}
          maskClosable={false}
          centered
        >
          <p>포장기 프로그램 사용을 위해서는 승인이 필요합니다</p>
        </Modal>

        {/* Admin Settings Modal */}
        <Modal
          title="어드민 설정"
          open={isAdminModalOpen}
          onCancel={() => setIsAdminModalOpen(false)}
          footer={null}
          width={1000}
          destroyOnClose
        >
          <AdminSettingsPage />
        </Modal>
      </div>
    </AppContext.Provider>
  );
}

export default App;