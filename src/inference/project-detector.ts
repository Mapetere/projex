/**
 * Project Detector - Rule 1: Creates draft projects from repo events
 */

import type {
    SignalEvent,
    RepoCreatedEvent,
    RepoPushedEvent,
    Project,
    ProjectStatus,
} from '../events/types.js';
import type { ProjectStore } from '../storage/project-store.js';
import { EventBus } from '../events/event-bus.js';

export class ProjectDetector {
    constructor(
        private store: ProjectStore,
        private eventBus: EventBus
    ) {
        // Subscribe to relevant events
        this.eventBus.subscribe(['repo.created', 'repo.pushed'], (event) =>
            this.handleEvent(event)
        );
    }

    private async handleEvent(event: SignalEvent): Promise<void> {
        if (event.eventType === 'repo.created') {
            await this.handleRepoCreated(event as RepoCreatedEvent);
        } else if (event.eventType === 'repo.pushed') {
            await this.handleRepoPushed(event as RepoPushedEvent);
        }
    }

    private async handleRepoCreated(event: RepoCreatedEvent): Promise<void> {
        const existingProject = this.store.getProject(event.repo.id);

        if (existingProject) {
            console.log(`[ProjectDetector] Project already exists: ${event.repo.id}`);
            return;
        }

        console.log(`[ProjectDetector] Creating new project: ${event.repo.id}`);

        const project = this.createDraftProject(event);
        this.store.saveProject(project);
    }

    private async handleRepoPushed(event: RepoPushedEvent): Promise<void> {
        const existingProject = this.store.getProject(event.repo.id);

        if (existingProject) {
            // Update last activity date
            existingProject.lastActivityDate = event.timestamp;
            existingProject.updatedAt = new Date();

            // If it was marked as likely completed, reactivate it
            if (existingProject.status === 'LIKELY_COMPLETED') {
                existingProject.status = 'ACTIVE';
                console.log(`[ProjectDetector] Reactivated project: ${event.repo.id}`);
            }

            this.store.saveProject(existingProject);
        } else {
            // Unknown repo with push activity - create project
            console.log(`[ProjectDetector] Creating project from push: ${event.repo.id}`);
            const project = this.createProjectFromPush(event);
            this.store.saveProject(project);
        }
    }

    private createDraftProject(event: RepoCreatedEvent): Project {
        const now = new Date();

        return {
            id: event.repo.id,
            name: event.repo.name,
            displayName: this.humanizeName(event.repo.name),
            owner: event.repo.owner,
            url: event.repo.url,

            status: 'ACTIVE' as ProjectStatus,
            isPrivate: event.payload.isPrivate,

            purpose: event.payload.description,
            techStack: [],
            topics: event.payload.topics,

            startDate: event.timestamp,
            lastActivityDate: event.timestamp,
            completionDate: null,

            confidence: {
                purpose: event.payload.description ? 0.3 : 0,
                techStack: 0,
                completion: 0,
            },

            rawData: {
                description: event.payload.description,
                readme: null,
                languages: {},
                packageFiles: [],
            },

            portfolioStatus: 'NONE',
            portfolioDraft: null,

            createdAt: now,
            updatedAt: now,
        };
    }

    private createProjectFromPush(event: RepoPushedEvent): Project {
        const now = new Date();

        return {
            id: event.repo.id,
            name: event.repo.name,
            displayName: this.humanizeName(event.repo.name),
            owner: event.repo.owner,
            url: event.repo.url,

            status: 'ACTIVE' as ProjectStatus,
            isPrivate: false,

            purpose: null,
            techStack: [],
            topics: [],

            startDate: event.timestamp,
            lastActivityDate: event.timestamp,
            completionDate: null,

            confidence: {
                purpose: 0,
                techStack: 0,
                completion: 0,
            },

            rawData: {
                description: null,
                readme: null,
                languages: {},
                packageFiles: [],
            },

            portfolioStatus: 'NONE',
            portfolioDraft: null,

            createdAt: now,
            updatedAt: now,
        };
    }

    private humanizeName(name: string): string {
        // Convert kebab-case or snake_case to Title Case
        return name
            .replace(/[-_]/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
}
