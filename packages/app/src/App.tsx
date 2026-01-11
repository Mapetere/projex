import { Routes, Route } from 'react-router-dom';
import SetupWizard from './pages/SetupWizard';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

export default function App() {
    return (
        <div className="min-h-screen bg-surface-950">
            <Routes>
                <Route path="/" element={<SetupWizard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
            </Routes>
        </div>
    );
}
