// Type declarations for Chrome Extension APIs when available in webapp context
// These APIs are only available when the extension is installed and externally_connectable is configured

interface ChromeRuntime {
  sendMessage(
    extensionId: string,
    message: any,
    responseCallback?: (response: any) => void
  ): void;
  lastError?: {
    message: string;
  };
}

interface Chrome {
  runtime?: ChromeRuntime;
}

declare const chrome: Chrome | undefined;

