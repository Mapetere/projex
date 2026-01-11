import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/api/dialog';
import { useConfigStore } from '../stores/config';

type Step = 'welcome' | 'github' | 'portfolio' | 'options' | 'complete';

export default function SetupWizard() {
    const navigate = useNavigate();
    const { setConfig } = useConfigStore();
    const [step, setStep] = useState<Step>('welcome');
    const [githubToken, setGithubToken] = useState('');
    const [githubUsername, setGithubUsername] = useState('');
    const [portfolioPath, setPortfolioPath] = useState('');
    const [autoCommit, setAutoCommit] = useState(false);

    const selectFolder = async () => {
        const selected = await open({
            directory: true,
            multiple: false,
            title: 'Select your portfolio folder',
        });
        if (selected && typeof selected === 'string') {
            setPortfolioPath(selected);
        }
    };

    const completeSetup = () => {
        setConfig({
            github: {
                token: githubToken,
                username: githubUsername,
                pollingIntervalMinutes: 60,
            },
            portfolio: {
                path: portfolioPath,
                autoCommit,
            },
        });
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="glass rounded-2xl p-8 w-full max-w-xl">
                {/* Progress indicator */}
                <div className="flex gap-2 mb-8">
                    {['welcome', 'github', 'portfolio', 'options', 'complete'].map((s, i) => (
                        <div
                            key={s}
                            className={`h-1 flex-1 rounded-full transition-colors ${['welcome', 'github', 'portfolio', 'options', 'complete'].indexOf(step) >= i
                                    ? 'bg-primary-500'
                                    : 'bg-surface-700'
                                }`}
                        />
                    ))}
                </div>

                {/* Step: Welcome */}
                {step === 'welcome' && (
                    <div className="text-center">
                        <div className="text-6xl mb-4">🚀</div>
                        <h1 className="text-3xl font-bold gradient-text mb-4">Welcome to Projex</h1>
                        <p className="text-surface-200 mb-8">
                            Automatically detect your GitHub projects and generate portfolio entries.
                        </p>
                        <button
                            onClick={() => setStep('github')}
                            className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-500 rounded-lg font-medium btn-glow"
                        >
                            Get Started
                        </button>
                    </div>
                )}

                {/* Step: GitHub */}
                {step === 'github' && (
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Connect GitHub</h2>
                        <p className="text-surface-300 mb-6">
                            We'll use this to scan your repositories and detect projects.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">GitHub Username</label>
                                <input
                                    type="text"
                                    value={githubUsername}
                                    onChange={(e) => setGithubUsername(e.target.value)}
                                    placeholder="octocat"
                                    className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-lg focus:border-primary-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Personal Access Token</label>
                                <input
                                    type="password"
                                    value={githubToken}
                                    onChange={(e) => setGithubToken(e.target.value)}
                                    placeholder="ghp_xxxxxxxxxxxx"
                                    className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-lg focus:border-primary-500 focus:outline-none"
                                />
                                <p className="text-sm text-surface-400 mt-2">
                                    <a
                                        href="https://github.com/settings/tokens"
                                        target="_blank"
                                        rel="noopener"
                                        className="text-primary-400 hover:underline"
                                    >
                                        Create a token
                                    </a>{' '}
                                    with <code className="bg-surface-800 px-1 rounded">repo</code> scope.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => setStep('welcome')}
                                className="flex-1 py-3 px-6 border border-surface-600 hover:bg-surface-800 rounded-lg font-medium"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setStep('portfolio')}
                                disabled={!githubUsername || !githubToken}
                                className="flex-1 py-3 px-6 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium btn-glow"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Portfolio */}
                {step === 'portfolio' && (
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Select Portfolio</h2>
                        <p className="text-surface-300 mb-6">
                            Point to your existing portfolio folder. We'll detect its design and match new project cards.
                        </p>

                        <div
                            onClick={selectFolder}
                            className="border-2 border-dashed border-surface-600 hover:border-primary-500 rounded-xl p-8 text-center cursor-pointer transition-colors"
                        >
                            {portfolioPath ? (
                                <div>
                                    <div className="text-3xl mb-2">📁</div>
                                    <p className="text-primary-400 font-medium break-all">{portfolioPath}</p>
                                    <p className="text-sm text-surface-400 mt-2">Click to change</p>
                                </div>
                            ) : (
                                <div>
                                    <div className="text-3xl mb-2">📂</div>
                                    <p className="text-surface-300">Click to select folder</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => setStep('github')}
                                className="flex-1 py-3 px-6 border border-surface-600 hover:bg-surface-800 rounded-lg font-medium"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setStep('options')}
                                disabled={!portfolioPath}
                                className="flex-1 py-3 px-6 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium btn-glow"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Options */}
                {step === 'options' && (
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Preferences</h2>
                        <p className="text-surface-300 mb-6">Configure how Projex handles updates.</p>

                        <div className="space-y-4">
                            <label className="flex items-center gap-4 p-4 bg-surface-800 rounded-lg cursor-pointer hover:bg-surface-700">
                                <input
                                    type="checkbox"
                                    checked={autoCommit}
                                    onChange={(e) => setAutoCommit(e.target.checked)}
                                    className="w-5 h-5 rounded border-surface-600 text-primary-500 focus:ring-primary-500"
                                />
                                <div>
                                    <p className="font-medium">Auto-commit changes</p>
                                    <p className="text-sm text-surface-400">
                                        Automatically commit new project cards to git
                                    </p>
                                </div>
                            </label>

                            {!autoCommit && (
                                <div className="p-4 bg-surface-800/50 rounded-lg border border-surface-700">
                                    <p className="text-sm text-surface-300">
                                        📝 <strong>Review mode:</strong> New projects will be added to your portfolio files, but you'll need to review and commit them manually.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => setStep('portfolio')}
                                className="flex-1 py-3 px-6 border border-surface-600 hover:bg-surface-800 rounded-lg font-medium"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setStep('complete')}
                                className="flex-1 py-3 px-6 bg-primary-600 hover:bg-primary-500 rounded-lg font-medium btn-glow"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Complete */}
                {step === 'complete' && (
                    <div className="text-center">
                        <div className="text-6xl mb-4">✨</div>
                        <h1 className="text-3xl font-bold gradient-text mb-4">All Set!</h1>
                        <p className="text-surface-200 mb-8">
                            Projex will run in the background and automatically update your portfolio when you complete projects.
                        </p>

                        <div className="bg-surface-800 rounded-lg p-4 text-left mb-8">
                            <div className="text-sm space-y-2">
                                <p><span className="text-surface-400">GitHub:</span> {githubUsername}</p>
                                <p><span className="text-surface-400">Portfolio:</span> {portfolioPath}</p>
                                <p><span className="text-surface-400">Mode:</span> {autoCommit ? 'Auto-commit' : 'Review'}</p>
                            </div>
                        </div>

                        <button
                            onClick={completeSetup}
                            className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-500 rounded-lg font-medium btn-glow"
                        >
                            Start Projex
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
