/**
 * Project Store - JSON file-based storage for projects
 * Simple MVP storage that can be swapped for a database later.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { Project, Config } from '../events/types.js';

export class ProjectStore {
    private projects: Map<string, Project> = new Map();
    private filePath: string;

    constructor(config: Config) {
        this.filePath = join(config.storage.dataDir, 'projects.json');
        this.ensureDataDir();
        this.load();
    }

    private ensureDataDir(): void {
        const dir = dirname(this.filePath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }

    private load(): void {
        if (!existsSync(this.filePath)) {
            this.projects = new Map();
            return;
        }

        try {
            const data = readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(data) as SerializedProject[];

            for (const item of parsed) {
                this.projects.set(item.id, this.deserialize(item));
            }

            console.log(`[ProjectStore] Loaded ${this.projects.size} projects`);
        } catch (error) {
            console.error('[ProjectStore] Error loading projects:', error);
            this.projects = new Map();
        }
    }

    save(): void {
        try {
            const serialized = Array.from(this.projects.values()).map(p => this.serialize(p));
            writeFileSync(this.filePath, JSON.stringify(serialized, null, 2));
        } catch (error) {
            console.error('[ProjectStore] Error saving projects:', error);
        }
    }

    getProject(id: string): Project | undefined {
        return this.projects.get(id);
    }

    saveProject(project: Project): void {
        this.projects.set(project.id, project);
        this.save(); // Auto-save on each update
    }

    deleteProject(id: string): boolean {
        const deleted = this.projects.delete(id);
        if (deleted) this.save();
        return deleted;
    }

    getAllProjects(): Project[] {
        return Array.from(this.projects.values());
    }

    getProjectsByStatus(status: Project['status']): Project[] {
        return this.getAllProjects().filter(p => p.status === status);
    }

    getProjectsNeedingReview(): Project[] {
        return this.getAllProjects().filter(p => p.portfolioStatus === 'PENDING_REVIEW');
    }

    getApprovedPortfolios(): Project[] {
        return this.getAllProjects().filter(p => p.portfolioStatus === 'APPROVED');
    }

    // Serialization helpers for dates
    private serialize(project: Project): SerializedProject {
        return {
            ...project,
            startDate: project.startDate.toISOString(),
            lastActivityDate: project.lastActivityDate.toISOString(),
            completionDate: project.completionDate?.toISOString() ?? null,
            createdAt: project.createdAt.toISOString(),
            updatedAt: project.updatedAt.toISOString(),
            portfolioDraft: project.portfolioDraft ? {
                ...project.portfolioDraft,
                timelineStart: project.portfolioDraft.timelineStart.toISOString(),
                timelineEnd: project.portfolioDraft.timelineEnd?.toISOString() ?? null,
                approvedAt: project.portfolioDraft.approvedAt?.toISOString() ?? null,
            } : null,
        };
    }

    private deserialize(data: SerializedProject): Project {
        return {
            ...data,
            startDate: new Date(data.startDate),
            lastActivityDate: new Date(data.lastActivityDate),
            completionDate: data.completionDate ? new Date(data.completionDate) : null,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            portfolioDraft: data.portfolioDraft ? {
                ...data.portfolioDraft,
                timelineStart: new Date(data.portfolioDraft.timelineStart),
                timelineEnd: data.portfolioDraft.timelineEnd ? new Date(data.portfolioDraft.timelineEnd) : null,
                approvedAt: data.portfolioDraft.approvedAt ? new Date(data.portfolioDraft.approvedAt) : null,
            } : null,
        };
    }
}

// Serialized types (dates as strings)
interface SerializedProject extends Omit<Project, 'startDate' | 'lastActivityDate' | 'completionDate' | 'createdAt' | 'updatedAt' | 'portfolioDraft'> {
    startDate: string;
    lastActivityDate: string;
    completionDate: string | null;
    createdAt: string;
    updatedAt: string;
    portfolioDraft: SerializedPortfolioDraft | null;
}

interface SerializedPortfolioDraft {
    title: string;
    tagline: string;
    description: string;
    techStack: string[];
    timelineStart: string;
    timelineEnd: string | null;
    highlights: string[];
    githubUrl: string;
    liveUrl: string | null;
    userEdits: Record<string, unknown>;
    approved: boolean;
    approvedAt: string | null;
}
