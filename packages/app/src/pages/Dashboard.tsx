import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '../stores/config';

export default function Dashboard() {
    const navigate = useNavigate();
    const { config } = useConfigStore();

    // Mock data for UI preview
    const projects = [
        {
            id: 'github:user/project-1',
            name: 'Project One',
            status: 'ACTIVE',
            techStack: ['React', 'TypeScript', 'Tailwind'],
            portfolioStatus: 'NONE',
        },
        {
            id: 'github:user/project-2',
            name: 'Project Two',
            status: 'LIKELY_COMPLETED',
            techStack: ['Next.js', 'Prisma', 'PostgreSQL'],
            portfolioStatus: 'PENDING_REVIEW',
        },
        {
            id: 'github:user/project-3',
            name: 'Project Three',
            status: 'COMPLETED',
            techStack: ['Python', 'FastAPI', 'Docker'],
            portfolioStatus: 'APPROVED',
        },
    ];

    const statusColors = {
        ACTIVE: 'bg-blue-500',
        LIKELY_COMPLETED: 'bg-yellow-500',
        COMPLETED: 'bg-green-500',
        ARCHIVED: 'bg-gray-500',
    };

    const portfolioStatusLabels = {
        NONE: { color: 'text-surface-400', label: 'Not generated' },
        PENDING_REVIEW: { color: 'text-yellow-400', label: 'Pending review' },
        APPROVED: { color: 'text-green-400', label: 'Approved' },
        REJECTED: { color: 'text-red-400', label: 'Rejected' },
    };

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold gradient-text">Projex Dashboard</h1>
                    <p className="text-surface-400 text-sm">
                        Monitoring {config?.github?.username || 'user'}'s projects
                    </p>
                </div>
                <div className="flex gap-4">
                    <button className="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg font-medium btn-glow">
                        Sync Now
                    </button>
                    <button
                        onClick={() => navigate('/settings')}
                        className="px-4 py-2 border border-surface-600 hover:bg-surface-800 rounded-lg font-medium"
                    >
                        Settings
                    </button>
                </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Projects', value: 12 },
                    { label: 'Active', value: 5 },
                    { label: 'Likely Complete', value: 4 },
                    { label: 'Portfolio Entries', value: 3 },
                ].map((stat) => (
                    <div key={stat.label} className="glass rounded-xl p-4">
                        <p className="text-3xl font-bold gradient-text">{stat.value}</p>
                        <p className="text-surface-400 text-sm">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Projects List */}
            <div className="glass rounded-xl overflow-hidden">
                <div className="p-4 border-b border-surface-700">
                    <h2 className="font-semibold">Detected Projects</h2>
                </div>
                <div className="divide-y divide-surface-800">
                    {projects.map((project) => (
                        <div key={project.id} className="p-4 hover:bg-surface-800/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div
                                        className={`w-3 h-3 rounded-full ${statusColors[project.status as keyof typeof statusColors]}`}
                                    />
                                    <div>
                                        <h3 className="font-medium">{project.name}</h3>
                                        <p className="text-sm text-surface-400">{project.id}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-2">
                                        {project.techStack.map((tech) => (
                                            <span
                                                key={tech}
                                                className="px-2 py-1 text-xs bg-surface-800 rounded-full text-surface-300"
                                            >
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                    <span
                                        className={`text-sm ${portfolioStatusLabels[project.portfolioStatus as keyof typeof portfolioStatusLabels]?.color
                                            }`}
                                    >
                                        {portfolioStatusLabels[project.portfolioStatus as keyof typeof portfolioStatusLabels]?.label}
                                    </span>
                                    {project.portfolioStatus === 'PENDING_REVIEW' && (
                                        <button className="px-3 py-1 text-sm bg-primary-600 hover:bg-primary-500 rounded-lg">
                                            Review
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
