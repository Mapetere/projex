import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/api/dialog';
import { useConfigStore } from '../stores/config';

export default function Settings() {
    const navigate = useNavigate();
    const { config, setConfig } = useConfigStore();

    const handleSelectFolder = async () => {
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Select portfolio folder',
        });
        if (selected && typeof selected === 'string' && config) {
            setConfig({
                ...config,
                portfolio: { ...config.portfolio, path: selected },
            });
        }
    };

    return (
        <div className="min-h-screen p-8">
            <header className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="p-2 hover:bg-surface-800 rounded-lg"
                >
                    ← Back
                </button>
                <h1 className="text-2xl font-bold">Settings</h1>
            </header>

            <div className="max-w-2xl space-y-8">
                {/* GitHub Section */}
                <section className="glass rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">GitHub</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Username</label>
                            <input
                                type="text"
                                value={config?.github?.username || ''}
                                onChange={(e) =>
                                    config && setConfig({
                                        ...config,
                                        github: { ...config.github, username: e.target.value },
                                    })
                                }
                                className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-lg focus:border-primary-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Personal Access Token</label>
                            <input
                                type="password"
                                value={config?.github?.token || ''}
                                onChange={(e) =>
                                    config && setConfig({
                                        ...config,
                                        github: { ...config.github, token: e.target.value },
                                    })
                                }
                                className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-lg focus:border-primary-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Polling Interval (minutes)</label>
                            <input
                                type="number"
                                min="5"
                                max="1440"
                                value={config?.github?.pollingIntervalMinutes || 60}
                                onChange={(e) =>
                                    config && setConfig({
                                        ...config,
                                        github: { ...config.github, pollingIntervalMinutes: parseInt(e.target.value) },
                                    })
                                }
                                className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-lg focus:border-primary-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </section>

                {/* Portfolio Section */}
                <section className="glass rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Portfolio</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Portfolio Path</label>
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    value={config?.portfolio?.path || ''}
                                    readOnly
                                    className="flex-1 px-4 py-3 bg-surface-800 border border-surface-700 rounded-lg"
                                />
                                <button
                                    onClick={handleSelectFolder}
                                    className="px-4 py-3 border border-surface-600 hover:bg-surface-800 rounded-lg"
                                >
                                    Browse
                                </button>
                            </div>
                        </div>
                        <label className="flex items-center gap-4 p-4 bg-surface-800 rounded-lg cursor-pointer hover:bg-surface-700">
                            <input
                                type="checkbox"
                                checked={config?.portfolio?.autoCommit || false}
                                onChange={(e) =>
                                    config && setConfig({
                                        ...config,
                                        portfolio: { ...config.portfolio, autoCommit: e.target.checked },
                                    })
                                }
                                className="w-5 h-5 rounded border-surface-600 text-primary-500"
                            />
                            <div>
                                <p className="font-medium">Auto-commit changes</p>
                                <p className="text-sm text-surface-400">Automatically commit new entries</p>
                            </div>
                        </label>
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="glass rounded-xl p-6 border border-red-900/50">
                    <h2 className="text-lg font-semibold mb-4 text-red-400">Danger Zone</h2>
                    <div className="space-y-4">
                        <button className="px-4 py-2 border border-red-600 text-red-400 hover:bg-red-900/20 rounded-lg">
                            Reset Configuration
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
