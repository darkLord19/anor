import styles from './ExtensionInstallModal.module.css';

interface ExtensionInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExtensionInstallModal({ isOpen, onClose }: ExtensionInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className={styles.title}>Install Dotor Extension</h2>
        
        <div className={styles.content}>
          <p>To search LinkedIn and WhatsApp, you need to install the Dotor browser extension.</p>
          
          <ol className={styles.steps}>
            <li>Download the extension zip file</li>
            <li>Unzip the file</li>
            <li>Open Chrome/Edge and go to <code>chrome://extensions</code></li>
            <li>Enable "Developer mode" in the top right</li>
            <li>Click "Load unpacked" and select the unzipped folder</li>
          </ol>
          
          <a 
            href="/extension-latest.zip" 
            className={styles.downloadButton}
            download
          >
            Download Extension
          </a>
        </div>
      </div>
    </div>
  );
}
