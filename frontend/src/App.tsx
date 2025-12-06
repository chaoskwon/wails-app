import { useState, useEffect, createContext } from 'react';
import './App.css';
import logo from './assets/images/logo_white.jpeg';
import { Tabs, message, Tag, Space, Modal, List, Button } from 'antd';
import SinglePack from './SinglePack';
import MultiPack from './MultiPack';
import History from './History';
import InspectionPage from './InspectionPage';
import SettingsPage from './SettingsPage';
import { API_BASE_URL } from './config';
import { ApiAccount } from './types';
import AdminSettingsPage from './AdminSettingsPage';
import { Quit } from '../wailsjs/runtime/runtime';

// Create Context for Global Defaults
export const AppContext = createContext<{
  partnerId: number | null;
  accountId: number | null;
  printerMain: string;
  printerAux: string;
  templateId: string;
  machineId: number | null;
  shipper_ids: number[] | null;
  accountType: string;
}>({
  partnerId: null,
  accountId: null,
  printerMain: '',
  printerAux: '',
  templateId: '',
  machineId: null,
  shipper_ids: null,
  accountType: ''
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

  // Account Selection Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<ApiAccount[]>([]);
  const [currentMachine, setCurrentMachine] = useState<any>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  const handleQuit = () => {
    Quit();
  };

  useEffect(() => {
    checkRegistration();
    checkForUpdates();
    checkRegistration();
    checkForUpdates();
    fetchVersion();
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

      const res = await fetch(`${API_BASE_URL}/machines`);
      if (res.ok) {
        const machines: any[] = await res.json();
        const machine = machines.find(m => m.machine_uuid === uuid);

        if (machine) {
          if (machine.is_active !== 'Y') {
            setIsApprovalModalOpen(true);
            return;
          }
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
      console.error("Failed to check registration", e);
    }
  };

  const handleStartupAccountCheck = async (machine: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/accounts`);
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

        // 2. Fallback: Auto-select if only one, or show modal
        if (partnerAccounts.length === 1) {
          // Only one account: Auto-select
          const account = partnerAccounts[0];
          if (machine.account_id !== account.account_id) {
            // Update DB if different
            await updateMachineAccount(machine, account);
          } else {
            // Just set state
            setDefaultAccountId(account.account_id);
            setAccountName(account.account_name);
            setCurrentAccountType(account.account_type);
            message.success(`API 계정 '${account.account_name}'이(가) 자동 선택되었습니다.`);
          }
        } else if (partnerAccounts.length > 1) {
          // Multiple accounts: Show Modal (Every time at startup)
          setAvailableAccounts(partnerAccounts);
          setIsAccountModalOpen(true);

          // If already set, we can show it as current, but we still force selection/confirmation
          if (machine.account_id) {
            const current = partnerAccounts.find(a => a.account_id === machine.account_id);
            if (current) {
              setAccountName(current.account_name);
              setCurrentAccountType(current.account_type);
            }
            setDefaultAccountId(machine.account_id);
          }
        } else {
          // No accounts
          message.warning('해당 거래처에 등록된 API 계정이 없습니다.');
        }
      }
    } catch (e) {
      console.error("Failed to check startup accounts", e);
    }
  };

  const updateMachineAccount = async (machine: any, account: ApiAccount) => {
    try {
      const payload = {
        ...machine,
        account_id: account.account_id,
      };

      const res = await fetch(`${API_BASE_URL}/machines/${machine.machine_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setDefaultAccountId(account.account_id);
        setAccountName(account.account_name);
        setCurrentAccountType(account.account_type);
        message.success(`API 계정이 '${account.account_name}'(으)로 자동 설정되었습니다.`);
        // Update current machine state to reflect change
        setCurrentMachine(payload);
      }
    } catch (e) {
      console.error("Failed to auto-update machine account", e);
    }
  };

  const fetchPartnerName = async (partnerId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/partners/${partnerId}`);
      if (res.ok) {
        const partner = await res.json();
        setPartnerName(partner.partner_name);
      }
    } catch (e) {
      console.error("Failed to fetch partner", e);
    }
  };

  const fetchAccountName = async (accountId: number) => {
    // This might be redundant if handleStartupAccountCheck handles it, 
    // but useful if we skip startup check logic (e.g. machine update).
    // Keeping it for safety or other calls.
    try {
      const res = await fetch(`${API_BASE_URL}/accounts`);
      if (res.ok) {
        const accounts: any[] = await res.json();
        const account = accounts.find(a => a.account_id === accountId);
        if (account) {
          setAccountName(account.account_name);
        }
      }
    } catch (e) {
      console.error("Failed to fetch account", e);
    }
  };

  const handleAccountSelect = async (account: ApiAccount) => {
    if (!currentMachine) return;
    await updateMachineAccount(currentMachine, account);
    setIsAccountModalOpen(false);
  };

  const handleMachineAdded = () => {
    setActiveTab('1'); // Go to Single Pack
    setAutoOpenMachine(false); // Reset auto open flag
    checkRegistration(); // Refresh info
  };

  // 하단 통계 수치 (더미)
  const stats = {
    todayWork: 0,
    count: 1,
    unshipped: 1,
    shipped: 0
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
      printerAux: currentMachine?.printer_aux || '',
      templateId: currentMachine?.waybill_template || '',
      machineId: currentMachine?.machine_id || null,
      shipper_ids: currentMachine?.shipper_ids || null,
      accountType: currentAccountType,
    }}>
      <div className="container">
        {/* 메인 탭 네비게이션 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 10px', backgroundColor: '#f0f2f5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, backgroundColor: 'black', padding: '10px', borderRadius: '8px' }}>
            <img src={logo} alt="logo" style={{ height: '40px', borderRadius: '4px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {partnerName && <Tag color="#1E4496" style={{ fontSize: '20px', fontWeight: 'bold', padding: '6px 15px', borderRadius: '8px' }}>{partnerName}</Tag>}
              {accountName && <Tag color="#1E4496" style={{ fontSize: '20px', fontWeight: 'bold', padding: '6px 15px', borderRadius: '8px' }}>{accountName}</Tag>}
              {machineName && <Tag color="#1E4496" style={{ fontSize: '20px', fontWeight: 'bold', padding: '6px 15px', borderRadius: '8px' }}>{machineName}</Tag>}
              <Button type="default" onClick={() => setIsAdminModalOpen(true)} style={{ display: currentMachine?.role === '*' ? 'block' : 'none', backgroundColor: '#F26D24', color: 'white', border: 'none' }}>어드민설정</Button>
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
          <span>오늘 작업량: {stats.todayWork}</span>
          <span>작업건수: {stats.count}</span>
          <span>미배송처리: {stats.unshipped}</span>
          <span>배송처리: {stats.shipped}</span>
          {appVersion && <span style={{ marginLeft: 'auto' }}>v{appVersion}</span>}
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

        <Modal
          title="API 계정 선택"
          // ...
          open={isAccountModalOpen}
          footer={null}
          closable={false} // Force selection
          maskClosable={false}
        >
          <p>이 장비에 연결할 API 계정을 선택해주세요.</p>
          <List
            dataSource={availableAccounts}
            renderItem={(item) => (
              <List.Item>
                <Button block onClick={() => handleAccountSelect(item)}>
                  {item.account_name} ({item.api_url})
                </Button>
              </List.Item>
            )}
          />
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