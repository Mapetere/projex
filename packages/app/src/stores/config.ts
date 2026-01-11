import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppConfig {
    github: {
        token: string;
        username: string;
        pollingIntervalMinutes: number;
    };
    portfolio: {
        path: string;
        autoCommit: boolean;
    };
}

interface ConfigStore {
    config: AppConfig | null;
    setConfig: (config: AppConfig) => void;
    clearConfig: () => void;
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set) => ({
            config: null,
            setConfig: (config) => set({ config }),
            clearConfig: () => set({ config: null }),
        }),
        {
            name: 'projex-config',
        }
    )
);
