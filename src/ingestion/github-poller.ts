/**
 * GitHub Poller - periodically fetches repos and emits change events.
 * Uses Normalizer to detect changes and EventBus to publish events.
 */

import { GitHubClient } from './github-client.js';
import { Normalizer } from './normalizer.js';
import { EventBus } from '../events/event-bus.js';
import type { Config, SignalEvent } from '../events/types.js';

export class GitHubPoller {
    private client: GitHubClient;
    private normalizer: Normalizer;
    private eventBus: EventBus;
    private config: Config;
    private pollInterval: NodeJS.Timeout | null = null;
    private isPolling = false;

    constructor(config: Config, eventBus: EventBus) {
        this.config = config;
        this.client = new GitHubClient(config.github.token, config.github.username);
        this.normalizer = new Normalizer();
        this.eventBus = eventBus;
    }

    /**
     * Start periodic polling
     */
    start(): void {
        if (this.pollInterval) {
            console.log('[GitHubPoller] Already running');
            return;
        }

        const intervalMs = this.config.github.pollingIntervalMinutes * 60 * 1000;
        console.log(`[GitHubPoller] Starting with ${this.config.github.pollingIntervalMinutes}min interval`);

        // Run immediately on start
        this.poll();

        // Then set up interval
        this.pollInterval = setInterval(() => this.poll(), intervalMs);
    }

    /**
     * Stop polling
     */
    stop(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
            console.log('[GitHubPoller] Stopped');
        }
    }

    /**
     * Manual poll trigger (useful for testing)
     */
    async poll(): Promise<SignalEvent[]> {
        if (this.isPolling) {
            console.log('[GitHubPoller] Poll already in progress, skipping');
            return [];
        }

        this.isPolling = true;
        const allEvents: SignalEvent[] = [];

        try {
            console.log('[GitHubPoller] Fetching repositories...');
            const repos = await this.client.listUserRepos();
            console.log(`[GitHubPoller] Found ${repos.length} repositories`);

            // Detect changes
            const changeEvents = this.normalizer.detectChanges(repos);
            console.log(`[GitHubPoller] Detected ${changeEvents.length} change events`);

            // Publish events
            for (const event of changeEvents) {
                await this.eventBus.publish(event);
                allEvents.push(event);
            }

            // Enrichment for new repos (repo.created events)
            const newRepoEvents = changeEvents.filter(e => e.eventType === 'repo.created');
            for (const event of newRepoEvents) {
                const repo = repos.find(r => `github:${r.fullName}` === event.repo.id);
                if (repo) {
                    await this.enrichRepo(repo, allEvents);
                }
            }

        } catch (error) {
            console.error('[GitHubPoller] Error during poll:', error);
        } finally {
            this.isPolling = false;
        }

        return allEvents;
    }

    /**
     * Enrich a specific repo with detailed data
     */
    private async enrichRepo(
        repo: Awaited<ReturnType<GitHubClient['listUserRepos']>>[0],
        allEvents: SignalEvent[]
    ): Promise<void> {
        try {
            console.log(`[GitHubPoller] Enriching ${repo.fullName}...`);
            const enrichmentData = await this.client.getEnrichmentData(repo.owner, repo.name);
            const enrichmentEvent = this.normalizer.createEnrichmentEvent(repo, enrichmentData);
            await this.eventBus.publish(enrichmentEvent);
            allEvents.push(enrichmentEvent);
        } catch (error) {
            console.error(`[GitHubPoller] Error enriching ${repo.fullName}:`, error);
        }
    }

    /**
     * Force enrichment for a specific repo by ID
     */
    async enrichRepoById(repoId: string): Promise<void> {
        // Parse "github:owner/repo" format
        const match = repoId.match(/^github:(.+)\/(.+)$/);
        if (!match) {
            throw new Error(`Invalid repo ID format: ${repoId}`);
        }

        const [, owner, name] = match;
        const repo = await this.client.getRepo(owner, name);
        const enrichmentData = await this.client.getEnrichmentData(owner, name);
        const enrichmentEvent = this.normalizer.createEnrichmentEvent(repo, enrichmentData);
        await this.eventBus.publish(enrichmentEvent);
    }

    /**
     * Get normalizer for snapshot persistence
     */
    getNormalizer(): Normalizer {
        return this.normalizer;
    }
}
