import { useState } from 'react';
import styles from './DataSources.module.css';
import { ExtensionInstallModal } from './ExtensionInstallModal';

interface DataSourcesProps {
  flags: {
    enableGmail: boolean;
    enableLinkedIn: boolean;
    enableWhatsApp: boolean;
  };
  onChange: (flags: {
    enableGmail: boolean;
    enableLinkedIn: boolean;
    enableWhatsApp: boolean;
  }) => void;
  extensionConnected: boolean;
}

export function DataSources({ flags, onChange, extensionConnected }: DataSourcesProps) {
  const [showInstallModal, setShowInstallModal] = useState(false);

  const handleToggle = (source: 'enableGmail' | 'enableLinkedIn' | 'enableWhatsApp') => {
    // If trying to enable an extension source and extension is not connected
    if ((source === 'enableLinkedIn' || source === 'enableWhatsApp') && !flags[source]) {
      if (!extensionConnected) {
        setShowInstallModal(true);
        return;
      }
    }
    
    onChange({
      ...flags,
      [source]: !flags[source]
    });
  };

  return (
    <>
      <div className={styles.container}>
        <h3 className={styles.title}>Enable Data Sources</h3>
        <div className={styles.sources}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={flags.enableGmail}
              onChange={() => handleToggle('enableGmail')}
              className={styles.checkbox}
            />
            Gmail & Calendar
          </label>
          
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={flags.enableLinkedIn}
              onChange={() => handleToggle('enableLinkedIn')}
              className={styles.checkbox}
            />
            LinkedIn
          </label>
          
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={flags.enableWhatsApp}
              onChange={() => handleToggle('enableWhatsApp')}
              className={styles.checkbox}
            />
            WhatsApp
          </label>
        </div>
      </div>
      
      <ExtensionInstallModal 
        isOpen={showInstallModal} 
        onClose={() => setShowInstallModal(false)} 
      />
    </>
  );
}
