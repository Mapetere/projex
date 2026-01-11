/**
 * Normalizer transforms raw GitHub data into normalized SignalEvents.
 * Compares current state with previous state to detect changes.
 */

import { randomUUID } from 'crypto';
import type {
    SignalEvent,
    RepoCreatedEvent,
    RepoPushedEvent,
    RepoTopicsChangedEvent,
    RepoDescriptionChangedEvent,
    RepoArchivedEvent,
    RepoEnrichedEvent,
    RepoIdentifier,
} from '../events/types.js';
import type { GitHubRepoData, GitHubEnrichmentData } from './github-client.js';

export interface RepoSnapshot {
    id: string;
    description: string | null;
    topics: string[];
    isArchived: boolean;
    pushedAt: Date | null;
    updatedAt: Date;
}

export class Normalizer {
    private previousSnapshots: Map<string, RepoSnapshot> = new Map();

    /**
     * Compare current repo data with previous snapshot and emit change events
     */
    detectChanges(repos: GitHubRepoData[]): SignalEvent[] {
        const events: SignalEvent[] = [];
        const currentRepoIds = new Set<string>();

        for (const repo of repos) {
            const repoId = `github:${repo.fullName}`;
            currentRepoIds.add(repoId);

            const repoIdentifier: RepoIdentifier = {
                id: repoId,
                name: repo.name,
                url: repo.url,
                owner: repo.owner,
            };

            const previous = this.previousSnapshots.get(repoId);

            if (!previous) {
                // New repo detected
                events.push(this.createRepoCreatedEvent(repo, repoIdentifier));
            } else {
                // Check for changes
                if (this.hasPushActivity(repo, previous)) {
                    events.push(this.createRepoPushedEvent(repo, repoIdentifier));
                }

                if (this.topicsChanged(repo, previous)) {
                    events.push(this.createTopicsChangedEvent(repo, previous, repoIdentifier));
                }

                if (repo.description !== previous.description) {
                    events.push(this.createDescriptionChangedEvent(repo, previous, repoIdentifier));
                }

                if (repo.isArchived && !previous.isArchived) {
                    events.push(this.createArchivedEvent(repo, repoIdentifier));
                }
            }

            // Update snapshot
            this.previousSnapshots.set(repoId, {
                id: repoId,
                description: repo.description,
                topics: [...repo.topics],
                isArchived: repo.isArchived,
                pushedAt: repo.pushedAt,
                updatedAt: repo.updatedAt,
            });
        }

        return events;
    }

    /**
     * Create enrichment event from enrichment data
     */
    createEnrichmentEvent(
        repo: GitHubRepoData,
        enrichment: GitHubEnrichmentData
    ): RepoEnrichedEvent {
        return {
            eventId: randomUUID(),
            eventType: 'repo.enriched',
            timestamp: new Date(),
            source: 'github',
            repo: {
                id: `github:${repo.fullName}`,
                name: repo.name,
                url: repo.url,
                owner: repo.owner,
            },
            payload: {
                languages: enrichment.languages,
                readme: enrichment.readme,
                packageFiles: enrichment.packageFiles,
                defaultBranch: repo.defaultBranch,
                starCount: repo.starCount,
                forkCount: repo.forkCount,
            },
        };
    }

    /**
     * Load previous snapshots (for persistence across restarts)
     */
    loadSnapshots(snapshots: RepoSnapshot[]): void {
        this.previousSnapshots.clear();
        for (const snapshot of snapshots) {
            this.previousSnapshots.set(snapshot.id, snapshot);
        }
    }

    /**
     * Export current snapshots for persistence
     */
    exportSnapshots(): RepoSnapshot[] {
        return Array.from(this.previousSnapshots.values());
    }

    private hasPushActivity(current: GitHubRepoData, previous: RepoSnapshot): boolean {
        if (!current.pushedAt || !previous.pushedAt) return false;
        return current.pushedAt.getTime() > previous.pushedAt.getTime();
    }

    private topicsChanged(current: GitHubRepoData, previous: RepoSnapshot): boolean {
        if (current.topics.length !== previous.topics.length) return true;
        const sortedCurrent = [...current.topics].sort();
        const sortedPrevious = [...previous.topics].sort();
        return sortedCurrent.some((topic, i) => topic !== sortedPrevious[i]);
    }

    private createRepoCreatedEvent(
        repo: GitHubRepoData,
        repoIdentifier: RepoIdentifier
    ): RepoCreatedEvent {
        return {
            eventId: randomUUID(),
            eventType: 'repo.created',
            timestamp: repo.createdAt,
            source: 'github',
            repo: repoIdentifier,
            payload: {
                description: repo.description,
                topics: repo.topics,
                isPrivate: repo.isPrivate,
            },
        };
    }

    private createRepoPushedEvent(
        repo: GitHubRepoData,
        repoIdentifier: RepoIdentifier
    ): RepoPushedEvent {
        return {
            eventId: randomUUID(),
            eventType: 'repo.pushed',
            timestamp: repo.pushedAt ?? new Date(),
            source: 'github',
            repo: repoIdentifier,
            payload: {
                commitCount: 1, // Approximate, would need commit API for exact count
                branch: repo.defaultBranch,
            },
        };
    }

    private createTopicsChangedEvent(
        repo: GitHubRepoData,
        previous: RepoSnapshot,
        repoIdentifier: RepoIdentifier
    ): RepoTopicsChangedEvent {
        return {
            eventId: randomUUID(),
            eventType: 'repo.topics_changed',
            timestamp: new Date(),
            source: 'github',
            repo: repoIdentifier,
            payload: {
                topics: repo.topics,
                previousTopics: previous.topics,
            },
        };
    }

    private createDescriptionChangedEvent(
        repo: GitHubRepoData,
        previous: RepoSnapshot,
        repoIdentifier: RepoIdentifier
    ): RepoDescriptionChangedEvent {
        return {
            eventId: randomUUID(),
            eventType: 'repo.description_changed',
            timestamp: new Date(),
            source: 'github',
            repo: repoIdentifier,
            payload: {
                description: repo.description,
                previousDescription: previous.description,
            },
        };
    }

    private createArchivedEvent(
        repo: GitHubRepoData,
        repoIdentifier: RepoIdentifier
    ): RepoArchivedEvent {
        return {
            eventId: randomUUID(),
            eventType: 'repo.archived',
            timestamp: new Date(),
            source: 'github',
            repo: repoIdentifier,
            payload: {
                archivedAt: new Date(),
            },
        };
    }
}
