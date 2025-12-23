import React from 'react';
import LocalMachineSettings from './pages/LocalMachineSettings';

interface SettingsPageProps {
  autoOpenMachine?: boolean;
  onMachineAdded?: () => void;
  partnerId?: number | null;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onMachineAdded, partnerId }) => {
  return (
    <div className="content-area" style={{ overflow: 'auto', padding: '20px' }}>
      <LocalMachineSettings onSuccess={onMachineAdded} defaultPartnerId={partnerId} />
    </div>
  );
};

export default SettingsPage;