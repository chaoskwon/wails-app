import React, { useEffect, useState } from 'react';
import { Tabs, Card } from 'antd';
import PartnerManager from './pages/PartnerManager';
import WbsManager from './pages/WbsManager';
import AccountManager from './pages/AccountManager';
import ShipperManager from './pages/ShipperManager';
import MachineManager from './pages/MachineManager';

interface SettingsPageProps {
  autoOpenMachine?: boolean;
  onMachineAdded?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ autoOpenMachine, onMachineAdded }) => {
  const [activeKey, setActiveKey] = useState('1');

  useEffect(() => {
    if (autoOpenMachine) {
      setActiveKey('5');
    }
  }, [autoOpenMachine]);

  const items = [
    { key: '1', label: '거래처 관리', children: <PartnerManager /> },
    { key: '2', label: 'WBS 마스터', children: <WbsManager /> },
    { key: '3', label: 'API 계정', children: <AccountManager /> },
    { key: '4', label: '화주 관리', children: <ShipperManager /> },
    { key: '5', label: '포장기 설정', children: <MachineManager autoOpen={autoOpenMachine} onSuccess={onMachineAdded} /> },
  ];

  return (
    <div className="content-area" style={{ overflow: 'auto' }}>
      <Card title="시스템 마스터 데이터 설정" bordered={false}>
        <Tabs activeKey={activeKey} onChange={setActiveKey} items={items} type="card" />
      </Card>
    </div>
  );
};

export default SettingsPage;