/**
 * Portfolio Generator - Rule 5: Creates portfolio drafts from completed projects
 */

import type {
    Project,
    PortfolioDraft,
    TechStackItem,
} from '../events/types.js';
import type { ProjectStore } from '../storage/project-store.js';

export class PortfolioGenerator {
    constructor(private store: ProjectStore) { }

    /**
     * Generate portfolio drafts for all completed projects that don't have one
     */
    generatePendingDrafts(): PortfolioDraft[] {
        const generated: PortfolioDraft[] = [];

        for (const project of this.store.getAllProjects()) {
            if (this.shouldGenerateDraft(project)) {
                const draft = this.generateDraft(project);
                project.portfolioDraft = draft;
                project.portfolioStatus = 'PENDING_REVIEW';
                project.updatedAt = new Date();
                this.store.saveProject(project);
                generated.push(draft);

                console.log(`[PortfolioGenerator] Generated draft for: ${project.id}`);
            }
        }

        return generated;
    }

    /**
     * Generate a single portfolio draft for a project
     */
    generateDraft(project: Project): PortfolioDraft {
        return {
            title: project.displayName,
            tagline: this.generateTagline(project),
            description: this.generateDescription(project),
            techStack: this.formatTechStack(project.techStack),
            timelineStart: project.startDate,
            timelineEnd: project.completionDate,
            highlights: this.extractHighlights(project),
            githubUrl: project.url,
            liveUrl: null,

            userEdits: {},
            approved: false,
            approvedAt: null,
        };
    }

    /**
     * Regenerate draft for a specific project
     */
    regenerateDraft(projectId: string): PortfolioDraft | null {
        const project = this.store.getProject(projectId);
        if (!project) return null;

        const draft = this.generateDraft(project);
        project.portfolioDraft = draft;
        project.portfolioStatus = 'PENDING_REVIEW';
        project.updatedAt = new Date();
        this.store.saveProject(project);

        return draft;
    }

    /**
     * Apply user edits to a draft
     */
    applyUserEdits(projectId: string, edits: Partial<PortfolioDraft>): boolean {
        const project = this.store.getProject(projectId);
        if (!project?.portfolioDraft) return false;

        project.portfolioDraft.userEdits = {
            ...project.portfolioDraft.userEdits,
            ...edits,
        };
        project.updatedAt = new Date();
        this.store.saveProject(project);

        return true;
    }

    /**
     * Approve a portfolio draft
     */
    approveDraft(projectId: string): boolean {
        const project = this.store.getProject(projectId);
        if (!project?.portfolioDraft) return false;

        project.portfolioDraft.approved = true;
        project.portfolioDraft.approvedAt = new Date();
        project.portfolioStatus = 'APPROVED';
        project.updatedAt = new Date();
        this.store.saveProject(project);

        return true;
    }

    /**
     * Reject a portfolio draft
     */
    rejectDraft(projectId: string): boolean {
        const project = this.store.getProject(projectId);
        if (!project) return false;

        project.portfolioStatus = 'REJECTED';
        project.updatedAt = new Date();
        this.store.saveProject(project);

        return true;
    }

    /**
     * Get the final portfolio entry (with user edits applied)
     */
    getFinalPortfolioEntry(projectId: string): PortfolioDraft | null {
        const project = this.store.getProject(projectId);
        if (!project?.portfolioDraft) return null;

        // Merge user edits on top of generated draft
        return {
            ...project.portfolioDraft,
            ...project.portfolioDraft.userEdits,
            userEdits: project.portfolioDraft.userEdits,
            approved: project.portfolioDraft.approved,
            approvedAt: project.portfolioDraft.approvedAt,
        };
    }

    private shouldGenerateDraft(project: Project): boolean {
        // Generate for completed/likely completed projects without a draft
        if (!['COMPLETED', 'LIKELY_COMPLETED'].includes(project.status)) return false;
        if (project.portfolioStatus !== 'NONE') return false;
        if (project.portfolioDraft) return false;

        // Skip private repos by default
        if (project.isPrivate) return false;

        // Must have some content
        if (!project.purpose && project.techStack.length === 0) return false;

        return true;
    }

    private generateTagline(project: Project): string {
        const frameworks = project.techStack
            .filter(t => t.category === 'framework')
            .slice(0, 2)
            .map(t => t.name);

        const languages = project.techStack
            .filter(t => t.category === 'language')
            .slice(0, 2)
            .map(t => t.name);

        if (frameworks.length > 0) {
            return `Built with ${frameworks.join(' and ')}`;
        }

        if (languages.length > 0) {
            return `${languages.join('/')} project`;
        }

        return 'Software project';
    }

    private generateDescription(project: Project): string {
        if (project.purpose && project.purpose !== 'Purpose not detected') {
            return project.purpose;
        }

        // Generate from available info
        const parts: string[] = [];

        if (project.topics.length > 0) {
            parts.push(`A project focused on ${project.topics.slice(0, 3).join(', ')}.`);
        }

        const frameworks = project.techStack
            .filter(t => t.category === 'framework')
            .map(t => t.name);

        if (frameworks.length > 0) {
            parts.push(`Built using ${frameworks.join(', ')}.`);
        }

        return parts.join(' ') || `${project.displayName} project.`;
    }

    private formatTechStack(techStack: TechStackItem[]): string[] {
        // Group by category and take top items
        const byCategory = new Map<string, TechStackItem[]>();

        for (const item of techStack) {
            const existing = byCategory.get(item.category) ?? [];
            existing.push(item);
            byCategory.set(item.category, existing);
        }

        const result: string[] = [];

        // Languages first
        const languages = byCategory.get('language') ?? [];
        result.push(...languages.slice(0, 3).map(l => l.name));

        // Then frameworks
        const frameworks = byCategory.get('framework') ?? [];
        result.push(...frameworks.slice(0, 3).map(f => f.name));

        // Then key libraries
        const libraries = byCategory.get('library') ?? [];
        result.push(...libraries.slice(0, 2).map(l => l.name));

        // Platforms
        const platforms = byCategory.get('platform') ?? [];
        result.push(...platforms.slice(0, 2).map(p => p.name));

        return result;
    }

    private extractHighlights(project: Project): string[] {
        const highlights: string[] = [];

        // Extract from README if available
        if (project.rawData.readme) {
            const features = this.extractFeaturesFromReadme(project.rawData.readme);
            highlights.push(...features.slice(0, 5));
        }

        // Add tech-based highlights if no features found
        if (highlights.length === 0) {
            const frameworks = project.techStack
                .filter(t => t.category === 'framework')
                .map(t => t.name);

            if (frameworks.length > 0) {
                highlights.push(`Built with ${frameworks[0]}`);
            }

            const platforms = project.techStack
                .filter(t => t.category === 'platform')
                .map(t => t.name);

            if (platforms.includes('Docker')) {
                highlights.push('Containerized with Docker');
            }
        }

        return highlights;
    }

    private extractFeaturesFromReadme(readme: string): string[] {
        const features: string[] = [];

        // Look for Features/Highlights section
        const featureMatch = readme.match(/##?\s*(Features|Highlights|Key Features)[^\n]*\n([\s\S]*?)(?=\n##|\n$|$)/i);

        if (featureMatch) {
            const section = featureMatch[2];
            // Extract bullet points
            const bullets = section.match(/^[\s]*[-*]\s+(.+)$/gm);

            if (bullets) {
                for (const bullet of bullets.slice(0, 5)) {
                    const text = bullet.replace(/^[\s]*[-*]\s+/, '').trim();
                    // Clean up markdown formatting
                    const cleaned = text
                        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                        .replace(/`([^`]+)`/g, '$1')
                        .replace(/\*\*([^*]+)\*\*/g, '$1');

                    if (cleaned.length > 10 && cleaned.length < 100) {
                        features.push(cleaned);
                    }
                }
            }
        }

        return features;
    }
}
