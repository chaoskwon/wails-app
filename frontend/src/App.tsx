import { useState, useEffect, createContext } from 'react';
import './App.css';
import { Tabs, message, Tag, Space, Modal, List, Button } from 'antd';
import SinglePack from './SinglePack';
import MultiPack from './MultiPack';
import History from './History';
import InspectionPage from './InspectionPage';
import SettingsPage from './SettingsPage';
import SpeedBaggerLegacy from './SpeedBaggerLegacy';
import { API_BASE_URL } from './config';
import { ApiAccount } from './types';

// Create Context for Global Defaults
export const AppContext = createContext<{
  partnerId: number | null;
  accountId: number | null;
  printerMain: string;
  printerAux: string;
  templateId: string;
  machineId: number | null;
}>({
  partnerId: null,
  accountId: null,
  printerMain: '',
  printerAux: '',
  templateId: '',
  machineId: null
});

function App() {
  const [activeTab, setActiveTab] = useState('1');
  const [autoOpenMachine, setAutoOpenMachine] = useState(false);
  const [machineName, setMachineName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [accountName, setAccountName] = useState('');

  // Default IDs for API calls
  const [defaultPartnerId, setDefaultPartnerId] = useState<number | null>(null);
  const [defaultAccountId, setDefaultAccountId] = useState<number | null>(null);

  // Account Selection Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<ApiAccount[]>([]);
  const [currentMachine, setCurrentMachine] = useState<any>(null);

  useEffect(() => {
    checkRegistration();
    checkForUpdates();
  }, []);

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
            message.success(`API 계정 '${account.account_name}'이(가) 자동 선택되었습니다.`);
          }
        } else if (partnerAccounts.length > 1) {
          // Multiple accounts: Show Modal (Every time at startup)
          setAvailableAccounts(partnerAccounts);
          setIsAccountModalOpen(true);

          // If already set, we can show it as current, but we still force selection/confirmation
          if (machine.account_id) {
            const current = partnerAccounts.find(a => a.account_id === machine.account_id);
            if (current) setAccountName(current.account_name);
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
    { key: '4', label: '검 수 (New)', children: <InspectionPage /> },
    { key: '5', label: '설 정', children: <SettingsPage autoOpenMachine={autoOpenMachine} onMachineAdded={handleMachineAdded} /> },
    { key: '6', label: 'SpeedBagger (Legacy)', children: <SpeedBaggerLegacy /> },];

  return (
    <AppContext.Provider value={{
      partnerId: defaultPartnerId,
      accountId: defaultAccountId,
      printerMain: currentMachine?.printer_main || '',
      printerAux: currentMachine?.printer_aux || '',
      templateId: currentMachine?.template_id || '',
      machineId: currentMachine?.machine_id || null
    }}>
      <div className="container">
        {/* 메인 탭 네비게이션 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 10px', backgroundColor: '#f0f2f5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Space>
              {partnerName && <Tag color="blue">거래처: {partnerName}</Tag>}
              {accountName && <Tag color="purple">API계정: {accountName}</Tag>}
              {machineName && <Tag color="green">장비: {machineName}</Tag>}
            </Space>
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
        </div>

        {/* Account Selection Modal */}
        <Modal
          title="API 계정 선택"
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
      </div>
    </AppContext.Provider>
  );
}

export default App;