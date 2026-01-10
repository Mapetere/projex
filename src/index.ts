/**
 * Nodal Asteroid - Portfolio Inference System
 * 
 * CLI entry point for running the portfolio inference engine.
 */

import { EventBus, getEventBus } from './events/event-bus.js';
import { GitHubPoller } from './ingestion/github-poller.js';
import { ProjectStore } from './storage/project-store.js';
import { ProjectDetector } from './inference/project-detector.js';
import { Enricher } from './inference/enricher.js';
import { LifecycleTracker } from './inference/lifecycle-tracker.js';
import { PortfolioGenerator } from './inference/portfolio-generator.js';
import type { Config, Project } from './events/types.js';

// Load config from environment or defaults
function loadConfig(): Config {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        console.error('Error: GITHUB_TOKEN environment variable is required');
        process.exit(1);
    }

    const username = process.env.GITHUB_USERNAME;
    if (!username) {
        console.error('Error: GITHUB_USERNAME environment variable is required');
        process.exit(1);
    }

    return {
        github: {
            token,
            username,
            pollingIntervalMinutes: parseInt(process.env.POLLING_INTERVAL_MINUTES ?? '60', 10),
        },
        inference: {
            completionThresholdDays: parseInt(process.env.COMPLETION_THRESHOLD_DAYS ?? '90', 10),
            minCommitsForCompletion: parseInt(process.env.MIN_COMMITS_FOR_COMPLETION ?? '10', 10),
        },
        storage: {
            dataDir: process.env.DATA_DIR ?? './data',
        },
    };
}

class NodalAsteroid {
    private config: Config;
    private eventBus: EventBus;
    private store: ProjectStore;
    private poller: GitHubPoller;
    private detector: ProjectDetector;
    private enricher: Enricher;
    private lifecycleTracker: LifecycleTracker;
    private portfolioGenerator: PortfolioGenerator;

    constructor() {
        this.config = loadConfig();
        this.eventBus = getEventBus();
        this.store = new ProjectStore(this.config);

        // Initialize components
        this.poller = new GitHubPoller(this.config, this.eventBus);
        this.detector = new ProjectDetector(this.store, this.eventBus);
        this.enricher = new Enricher(this.store, this.eventBus);
        this.lifecycleTracker = new LifecycleTracker(this.store, this.eventBus, this.config);
        this.portfolioGenerator = new PortfolioGenerator(this.store);

        console.log('Nodal Asteroid initialized');
        console.log(`  GitHub user: ${this.config.github.username}`);
        console.log(`  Polling interval: ${this.config.github.pollingIntervalMinutes} minutes`);
        console.log(`  Completion threshold: ${this.config.inference.completionThresholdDays} days`);
    }

    /**
     * Run a single poll cycle (useful for testing)
     */
    async poll(): Promise<void> {
        console.log('\n--- Starting poll cycle ---');

        // Fetch and process signals
        await this.poller.poll();

        // Check for completed projects
        const completed = this.lifecycleTracker.checkForCompletedProjects();
        if (completed.length > 0) {
            console.log(`Found ${completed.length} newly completed projects`);
        }

        // Generate portfolio drafts
        const drafts = this.portfolioGenerator.generatePendingDrafts();
        if (drafts.length > 0) {
            console.log(`Generated ${drafts.length} portfolio drafts`);
        }

        console.log('--- Poll cycle complete ---\n');
    }

    /**
     * Start continuous polling
     */
    start(): void {
        console.log('Starting continuous polling...');
        this.poller.start();

        // Set up periodic lifecycle checks
        setInterval(() => {
            this.lifecycleTracker.checkForCompletedProjects();
            this.portfolioGenerator.generatePendingDrafts();
        }, this.config.github.pollingIntervalMinutes * 60 * 1000);
    }

    /**
     * Stop polling
     */
    stop(): void {
        this.poller.stop();
        console.log('Polling stopped');
    }

    /**
     * List all projects
     */
    listProjects(): void {
        const projects = this.store.getAllProjects();

        if (projects.length === 0) {
            console.log('No projects found. Run a poll first.');
            return;
        }

        console.log(`\nFound ${projects.length} projects:\n`);

        for (const project of projects) {
            const status = this.formatStatus(project.status);
            const tech = project.techStack.slice(0, 3).map(t => t.name).join(', ') || 'unknown';
            console.log(`  ${status} ${project.displayName}`);
            console.log(`     ID: ${project.id}`);
            console.log(`     Tech: ${tech}`);
            console.log(`     Portfolio: ${project.portfolioStatus}`);
            console.log('');
        }
    }

    /**
     * List pending portfolio drafts
     */
    listDrafts(): void {
        const projects = this.store.getProjectsNeedingReview();

        if (projects.length === 0) {
            console.log('No portfolio drafts pending review.');
            return;
        }

        console.log(`\n${projects.length} drafts pending review:\n`);

        for (const project of projects) {
            const draft = project.portfolioDraft;
            if (!draft) continue;

            console.log(`  ${draft.title}`);
            console.log(`    Tagline: ${draft.tagline}`);
            console.log(`    Tech: ${draft.techStack.join(', ')}`);
            console.log(`    Description: ${draft.description.slice(0, 100)}...`);
            console.log(`    ID: ${project.id}`);
            console.log('');
        }
    }

    /**
     * Approve a portfolio draft
     */
    approve(projectId: string): void {
        if (this.portfolioGenerator.approveDraft(projectId)) {
            console.log(`Approved: ${projectId}`);
        } else {
            console.log(`Failed to approve: ${projectId} (not found or no draft)`);
        }
    }

    /**
     * Export approved portfolios as JSON
     */
    exportPortfolios(): void {
        const approved = this.store.getApprovedPortfolios();

        const entries = approved.map(p => {
            const draft = this.portfolioGenerator.getFinalPortfolioEntry(p.id);
            return draft;
        }).filter(Boolean);

        console.log(JSON.stringify(entries, null, 2));
    }

    private formatStatus(status: Project['status']): string {
        const icons: Record<Project['status'], string> = {
            'ACTIVE': '🔵',
            'LIKELY_COMPLETED': '🟡',
            'COMPLETED': '🟢',
            'ARCHIVED': '📦',
            'IGNORED': '⚫',
        };
        return icons[status] ?? '❓';
    }
}

// CLI Commands
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] ?? 'help';

    if (command === 'help') {
        console.log(`
Nodal Asteroid - Portfolio Inference System

Commands:
  poll          Run a single poll cycle
  start         Start continuous polling
  list          List all detected projects
  drafts        List portfolio drafts pending review
  approve <id>  Approve a portfolio draft
  export        Export approved portfolios as JSON
  help          Show this help message

Environment variables:
  GITHUB_TOKEN           (required) GitHub personal access token
  GITHUB_USERNAME        (required) Your GitHub username
  POLLING_INTERVAL_MINUTES  Polling interval (default: 60)
  COMPLETION_THRESHOLD_DAYS Days of inactivity for completion (default: 90)
  DATA_DIR               Data storage directory (default: ./data)
`);
        return;
    }

    const app = new NodalAsteroid();

    switch (command) {
        case 'poll':
            await app.poll();
            break;
        case 'start':
            app.start();
            // Keep running
            process.on('SIGINT', () => {
                app.stop();
                process.exit(0);
            });
            break;
        case 'list':
            app.listProjects();
            break;
        case 'drafts':
            app.listDrafts();
            break;
        case 'approve':
            if (!args[1]) {
                console.error('Usage: approve <project-id>');
                process.exit(1);
            }
            app.approve(args[1]);
            break;
        case 'export':
            app.exportPortfolios();
            break;
        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }
}

main().catch(console.error);
