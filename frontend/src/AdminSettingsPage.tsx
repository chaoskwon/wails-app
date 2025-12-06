import React from 'react';
import { Tabs } from 'antd';
import PartnerManager from './pages/PartnerManager';
import WbsManager from './pages/WbsManager';
import AccountManager from './pages/AccountManager';
import MachineManager from './pages/MachineManager';

const AdminSettingsPage: React.FC = () => {
  const items = [
    {
      key: '1',
      label: '거래처 관리',
      children: <PartnerManager />,
    },
    {
      key: '2',
      label: 'WMS 마스터',
      children: <WbsManager />,
    },
    {
      key: '3',
      label: 'API 계정',
      children: <AccountManager />,
    },
    {
      key: '4',
      label: '포장기 설정',
      children: <MachineManager />,
    },
  ];

  return (
    <div style={{ height: '100%', padding: '10px' }}>
      <Tabs defaultActiveKey="1" items={items} type="card" />
    </div>
  );
};

export default AdminSettingsPage;
