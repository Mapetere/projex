/**
 * Lifecycle Tracker - Rule 4: Project completion detection
 * Detects when projects become inactive or are explicitly archived.
 */

import type {
    SignalEvent,
    RepoArchivedEvent,
    Project,
    Config,
} from '../events/types.js';
import type { ProjectStore } from '../storage/project-store.js';
import { EventBus } from '../events/event-bus.js';

export class LifecycleTracker {
    private completionThresholdDays: number;
    private minCommitsForCompletion: number;

    constructor(
        private store: ProjectStore,
        private eventBus: EventBus,
        config: Config
    ) {
        this.completionThresholdDays = config.inference.completionThresholdDays;
        this.minCommitsForCompletion = config.inference.minCommitsForCompletion;

        // Subscribe to archived events
        this.eventBus.subscribe(['repo.archived'], (event) =>
            this.handleArchived(event as RepoArchivedEvent)
        );
    }

    /**
     * Handle explicit archive events - high confidence completion
     */
    private async handleArchived(event: RepoArchivedEvent): Promise<void> {
        const project = this.store.getProject(event.repo.id);

        if (!project) {
            console.log(`[LifecycleTracker] Project not found for archive: ${event.repo.id}`);
            return;
        }

        console.log(`[LifecycleTracker] Project archived: ${event.repo.id}`);

        project.status = 'ARCHIVED';
        project.completionDate = event.payload.archivedAt;
        project.confidence.completion = 1.0; // Explicit archive = certain
        project.updatedAt = new Date();

        this.store.saveProject(project);
    }

    /**
     * Check all projects for inactivity-based completion
     * Should be called periodically (e.g., after each poll)
     */
    checkForCompletedProjects(): Project[] {
        const now = new Date();
        const thresholdMs = this.completionThresholdDays * 24 * 60 * 60 * 1000;
        const completedProjects: Project[] = [];

        for (const project of this.store.getAllProjects()) {
            // Skip already completed/archived/ignored projects
            if (project.status !== 'ACTIVE') continue;

            const daysSinceActivity = (now.getTime() - project.lastActivityDate.getTime()) / (24 * 60 * 60 * 1000);

            // Check completion criteria
            if (daysSinceActivity >= this.completionThresholdDays) {
                const hasSubstantialContent = this.hasSubstantialContent(project);

                if (hasSubstantialContent) {
                    console.log(`[LifecycleTracker] Marking as likely completed (${daysSinceActivity.toFixed(0)} days inactive): ${project.id}`);

                    project.status = 'LIKELY_COMPLETED';
                    project.completionDate = project.lastActivityDate;
                    project.confidence.completion = this.calculateCompletionConfidence(project, daysSinceActivity);
                    project.updatedAt = now;

                    this.store.saveProject(project);
                    completedProjects.push(project);
                }
            }
        }

        return completedProjects;
    }

    /**
     * Check if project has enough content to be considered a real project
     */
    private hasSubstantialContent(project: Project): boolean {
        // Must have a README
        if (!project.rawData.readme) return false;

        // Must have detected tech stack (indicates code exists)
        if (project.techStack.length === 0) return false;

        // Must have some languages detected
        const languageCount = Object.keys(project.rawData.languages).length;
        if (languageCount === 0) return false;

        return true;
    }

    /**
     * Calculate confidence in completion status
     */
    private calculateCompletionConfidence(project: Project, daysSinceActivity: number): number {
        let confidence = 0.5; // Base confidence for inactivity threshold

        // More days = more confident it's complete
        if (daysSinceActivity > 180) confidence += 0.2;
        else if (daysSinceActivity > 120) confidence += 0.1;

        // Has README = more likely a finished project
        if (project.rawData.readme) confidence += 0.1;

        // Has description = intentionally created
        if (project.rawData.description) confidence += 0.05;

        // Has substantial code (multiple languages or large files)
        const totalBytes = Object.values(project.rawData.languages).reduce((a, b) => a + b, 0);
        if (totalBytes > 10000) confidence += 0.1;

        // Has topics = organized project
        if (project.topics.length > 0) confidence += 0.05;

        return Math.min(confidence, 0.95); // Cap at 0.95 for inactivity detection
    }

    /**
     * Manually mark a project as completed
     */
    markAsCompleted(projectId: string): boolean {
        const project = this.store.getProject(projectId);
        if (!project) return false;

        project.status = 'COMPLETED';
        project.completionDate = new Date();
        project.confidence.completion = 1.0;
        project.updatedAt = new Date();

        this.store.saveProject(project);
        return true;
    }

    /**
     * Manually mark a project to be ignored (not a portfolio candidate)
     */
    ignoreProject(projectId: string): boolean {
        const project = this.store.getProject(projectId);
        if (!project) return false;

        project.status = 'IGNORED';
        project.portfolioStatus = 'REJECTED';
        project.updatedAt = new Date();

        this.store.saveProject(project);
        return true;
    }
}
