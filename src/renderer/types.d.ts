export interface ElectronAPI {
    sendMessage: (message: string) => void;
    onMessage: (callback: (message: string) => void) => void;
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
