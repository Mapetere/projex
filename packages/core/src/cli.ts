#!/usr/bin/env node
/**
 * Projex CLI - Interactive portfolio inference tool
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

import { EventBus, getEventBus } from './events/event-bus.js';
import { GitHubPoller } from './ingestion/github-poller.js';
import { ProjectStore } from './storage/project-store.js';
import { ChangeHistory } from './storage/history.js';
import { ProjectDetector } from './inference/project-detector.js';
import { Enricher } from './inference/enricher.js';
import { LifecycleTracker } from './inference/lifecycle-tracker.js';
import { PortfolioGenerator } from './inference/portfolio-generator.js';
import { RepoClassifier } from './inference/classifier.js';
import { DesignAnalyzer } from './integrations/analyzer.js';
import { TemplateGenerator } from './integrations/template-generator.js';
import { createInjector } from './integrations/injectors.js';
import type { Config, Project } from './events/types.js';

const CONFIG_DIR = join(homedir(), '.projex');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const program = new Command();

program
    .name('projex')
    .description('Automatically infer projects from GitHub and generate portfolio entries')
    .version('0.5.0');

// ============================================================================
// Setup command
// ============================================================================
program
    .command('setup')
    .description('Interactive setup wizard')
    .action(async () => {
        console.log(chalk.cyan.bold('\n🚀 Projex Setup\n'));

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'username',
                message: 'GitHub username:',
                validate: (input: string) => input.length > 0 || 'Username is required',
            },
            {
                type: 'password',
                name: 'token',
                message: 'GitHub personal access token:',
                validate: (input: string) => input.startsWith('ghp_') || input.startsWith('github_pat_') || 'Token should start with ghp_ or github_pat_',
            },
            {
                type: 'input',
                name: 'portfolioPath',
                message: 'Path to your portfolio folder:',
                validate: (input: string) => existsSync(input) || 'Path does not exist',
            },
            {
                type: 'confirm',
                name: 'autoCommit',
                message: 'Auto-commit changes to git?',
                default: false,
            },
            {
                type: 'confirm',
                name: 'autoPush',
                message: 'Auto-push to GitHub after commit?',
                default: false,
                when: (answers: any) => answers.autoCommit,
            },
            {
                type: 'number',
                name: 'pollingInterval',
                message: 'Polling interval (minutes):',
                default: 60,
            },
        ]);

        const config: Config = {
            github: {
                token: answers.token,
                username: answers.username,
                pollingIntervalMinutes: answers.pollingInterval,
            },
            inference: {
                completionThresholdDays: 90,
                minCommitsForCompletion: 10,
            },
            storage: {
                dataDir: CONFIG_DIR,
            },
        };

        // Save config
        if (!existsSync(CONFIG_DIR)) {
            mkdirSync(CONFIG_DIR, { recursive: true });
        }

        const configWithPortfolio = {
            ...config,
            portfolio: {
                path: answers.portfolioPath,
                autoCommit: answers.autoCommit,
                autoPush: answers.autoPush || false,
            },
        };

        writeFileSync(CONFIG_FILE, JSON.stringify(configWithPortfolio, null, 2));

        console.log(chalk.green('\n✅ Configuration saved to ~/.projex/config.json'));
        console.log(chalk.dim('Run `projex scan` to detect your projects.\n'));
    });

// ============================================================================
// Scan command
// ============================================================================
program
    .command('scan')
    .description('Scan GitHub for projects')
    .action(async () => {
        const config = loadConfig();
        if (!config) return;

        const spinner = ora('Connecting to GitHub...').start();

        try {
            const { store, poller, lifecycleTracker, portfolioGenerator } = initializeEngine(config);

            spinner.text = 'Fetching repositories...';
            const events = await poller.poll();

            spinner.text = 'Checking for completed projects...';
            const completed = lifecycleTracker.checkForCompletedProjects();

            spinner.text = 'Generating portfolio drafts...';
            const drafts = portfolioGenerator.generatePendingDrafts();

            spinner.succeed('Scan complete!');

            const projects = store.getAllProjects();
            console.log(chalk.dim(`\nFound ${projects.length} projects:\n`));

            for (const project of projects) {
                const statusIcon = getStatusIcon(project.status);
                const tech = project.techStack.slice(0, 3).map(t => t.name).join(', ');
                console.log(`  ${statusIcon} ${chalk.bold(project.displayName)}`);
                console.log(chalk.dim(`     ${project.id}`));
                if (tech) console.log(chalk.cyan(`     ${tech}`));
                console.log('');
            }

            if (drafts.length > 0) {
                console.log(chalk.yellow(`\n📝 ${drafts.length} new portfolio drafts ready for review.`));
                console.log(chalk.dim('Run `projex drafts` to see them.\n'));
            }
        } catch (error) {
            spinner.fail('Scan failed');
            console.error(chalk.red(error));
        }
    });

// ============================================================================
// Drafts command
// ============================================================================
program
    .command('drafts')
    .description('List pending portfolio drafts')
    .action(async () => {
        const config = loadConfig();
        if (!config) return;

        const store = new ProjectStore(config);
        const projects = store.getProjectsNeedingReview();

        if (projects.length === 0) {
            console.log(chalk.dim('\nNo drafts pending review.'));
            console.log(chalk.dim('Run `projex scan` to detect projects.\n'));
            return;
        }

        console.log(chalk.cyan.bold(`\n📝 ${projects.length} Drafts Pending Review\n`));

        for (const project of projects) {
            const draft = project.portfolioDraft;
            if (!draft) continue;

            console.log(chalk.bold(draft.title));
            console.log(chalk.dim(`  ${draft.tagline}`));
            console.log(`  ${draft.description.slice(0, 100)}...`);
            console.log(chalk.cyan(`  Tech: ${draft.techStack.join(', ')}`));
            console.log(chalk.dim(`  ID: ${project.id}\n`));
        }

        console.log(chalk.dim('Use `projex approve <id>` to approve a draft.\n'));
    });

// ============================================================================
// Approve command (with optional interactive mode)
// ============================================================================
program
    .command('approve [projectId]')
    .description('Approve portfolio drafts (interactive if no ID given)')
    .option('-a, --all', 'Approve all pending drafts')
    .action(async (projectId: string | undefined, options: { all?: boolean }) => {
        const config = loadConfig();
        if (!config) return;

        const store = new ProjectStore(config);
        const portfolioPath = (config as any).portfolio?.path;

        if (!portfolioPath) {
            console.log(chalk.red('No portfolio path configured. Run `projex setup` first.'));
            return;
        }

        // Interactive mode if no project ID given
        if (!projectId && !options.all) {
            const drafts = store.getProjectsNeedingReview();

            if (drafts.length === 0) {
                console.log(chalk.dim('\nNo drafts pending review.\n'));
                return;
            }

            const { selected } = await inquirer.prompt([
                {
                    type: 'checkbox',
                    name: 'selected',
                    message: 'Select projects to approve:',
                    choices: drafts.map(p => ({
                        name: `${p.displayName} (${p.techStack.slice(0, 3).map((t: any) => t.name).join(', ')})`,
                        value: p.id,
                        checked: false,
                    })),
                },
            ]);

            if (selected.length === 0) {
                console.log(chalk.dim('\nNo projects selected.\n'));
                return;
            }

            for (const id of selected) {
                await approveProject(id, config, store, portfolioPath);
            }
            return;
        }

        // Approve all mode
        if (options.all) {
            const drafts = store.getProjectsNeedingReview();
            console.log(chalk.cyan(`\nApproving ${drafts.length} drafts...\n`));

            for (const draft of drafts) {
                await approveProject(draft.id, config, store, portfolioPath);
            }
            return;
        }

        // Single project mode
        await approveProject(projectId!, config, store, portfolioPath);
    });

async function approveProject(projectId: string, config: Config, store: ProjectStore, portfolioPath: string) {
    const spinner = ora(`Approving ${projectId}...`).start();
    const history = new ChangeHistory();

    try {
        const project = store.getProject(projectId);

        if (!project) {
            spinner.fail(`Project not found: ${projectId}`);
            return;
        }

        if (!project.portfolioDraft) {
            spinner.fail(`No draft for: ${projectId}`);
            return;
        }

        // Analyze portfolio
        spinner.text = 'Analyzing portfolio...';
        const analyzer = new DesignAnalyzer(portfolioPath);
        const analysis = await analyzer.analyze();

        // Generate card
        spinner.text = 'Generating card...';
        const generator = new TemplateGenerator(analysis);
        const card = generator.generate(project);

        // Inject into portfolio
        spinner.text = 'Injecting...';
        const injector = createInjector(portfolioPath, analysis, {
            autoCommit: (config as any).portfolio?.autoCommit ?? false,
            autoPush: (config as any).portfolio?.autoPush ?? false,
            createBackup: true,
        });

        // Read file content before injection for history
        const targetFile = analysis.projectsFile || join(portfolioPath, 'index.html');
        let contentBefore = '';
        if (existsSync(targetFile)) {
            contentBefore = readFileSync(targetFile, 'utf-8');
        }

        const result = await injector.inject(card, projectId);

        if (result.success) {
            // Read file content after injection
            const contentAfter = existsSync(result.file!) ? readFileSync(result.file!, 'utf-8') : '';

            // Record the change in history
            history.recordChange({
                projectId,
                projectName: project.displayName,
                action: 'ADD',
                file: result.file!,
                contentBefore,
                contentAfter,
                backupPath: result.backup,
            });

            const portfolioGenerator = new PortfolioGenerator(store);
            portfolioGenerator.approveDraft(projectId);
            spinner.succeed(`✓ ${project.displayName}`);
        } else {
            spinner.fail(`✗ ${project.displayName}: ${result.message}`);
        }
    } catch (error) {
        spinner.fail(`✗ ${projectId}: ${error}`);
    }
}


// ============================================================================
// List command
// ============================================================================
program
    .command('list')
    .description('List all detected projects')
    .action(async () => {
        const config = loadConfig();
        if (!config) return;

        const store = new ProjectStore(config);
        const projects = store.getAllProjects();

        if (projects.length === 0) {
            console.log(chalk.dim('\nNo projects found. Run `projex scan` first.\n'));
            return;
        }

        console.log(chalk.cyan.bold(`\n📦 ${projects.length} Projects\n`));

        const grouped = {
            ACTIVE: projects.filter(p => p.status === 'ACTIVE'),
            LIKELY_COMPLETED: projects.filter(p => p.status === 'LIKELY_COMPLETED'),
            COMPLETED: projects.filter(p => p.status === 'COMPLETED'),
            ARCHIVED: projects.filter(p => p.status === 'ARCHIVED'),
        };

        for (const [status, group] of Object.entries(grouped)) {
            if (group.length === 0) continue;
            console.log(chalk.bold(`${getStatusIcon(status)} ${status} (${group.length})`));
            for (const p of group) {
                console.log(chalk.dim(`  - ${p.displayName}`));
            }
            console.log('');
        }
    });

// ============================================================================
// Export command
// ============================================================================
program
    .command('export')
    .description('Export approved portfolios as JSON')
    .option('-o, --output <file>', 'Output file', 'portfolios.json')
    .action(async (options) => {
        const config = loadConfig();
        if (!config) return;

        const store = new ProjectStore(config);
        const portfolioGenerator = new PortfolioGenerator(store);
        const approved = store.getApprovedPortfolios();

        const entries = approved
            .map(p => portfolioGenerator.getFinalPortfolioEntry(p.id))
            .filter(Boolean);

        writeFileSync(options.output, JSON.stringify(entries, null, 2));
        console.log(chalk.green(`\n✅ Exported ${entries.length} entries to ${options.output}\n`));
    });

// ============================================================================
// Helpers
// ============================================================================
function loadConfig(): Config | null {
    if (!existsSync(CONFIG_FILE)) {
        console.log(chalk.yellow('\n⚠️  Not configured. Run `projex setup` first.\n'));
        return null;
    }

    try {
        const content = readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error(chalk.red('Failed to load config:'), error);
        return null;
    }
}

function initializeEngine(config: Config) {
    const eventBus = getEventBus();
    const store = new ProjectStore(config);
    const poller = new GitHubPoller(config, eventBus);
    const detector = new ProjectDetector(store, eventBus);
    const enricher = new Enricher(store, eventBus);
    const lifecycleTracker = new LifecycleTracker(store, eventBus, config);
    const portfolioGenerator = new PortfolioGenerator(store);

    return { store, poller, detector, enricher, lifecycleTracker, portfolioGenerator };
}

function getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
        ACTIVE: '🔵',
        LIKELY_COMPLETED: '🟡',
        COMPLETED: '🟢',
        ARCHIVED: '📦',
        IGNORED: '⚫',
    };
    return icons[status] || '❓';
}

function getClassificationIcon(classification: string): string {
    const icons: Record<string, string> = {
        PROJECT: '✅',
        NOTES: '📚',
        FORK: '🍴',
        EXPERIMENT: '🧪',
        CONFIG: '⚙️',
        TEMPLATE: '📋',
        ARCHIVED_JUNK: '🗑️',
        UNKNOWN: '❓',
    };
    return icons[classification] || '❓';
}

// ============================================================================
// Classify command
// ============================================================================
program
    .command('classify')
    .description('Classify all projects (project, notes, fork, experiment, etc.)')
    .action(async () => {
        const config = loadConfig();
        if (!config) return;

        const store = new ProjectStore(config);
        const classifier = new RepoClassifier();
        const projects = store.getAllProjects();

        console.log(chalk.cyan.bold(`\n🔍 Classifying ${projects.length} repositories...\n`));

        const groups: Record<string, typeof projects> = {};

        for (const project of projects) {
            const result = classifier.classify(project);
            if (!groups[result.classification]) {
                groups[result.classification] = [];
            }
            groups[result.classification].push(project);
        }

        for (const [classification, group] of Object.entries(groups)) {
            const icon = getClassificationIcon(classification);
            console.log(chalk.bold(`${icon} ${classification} (${group.length})`));
            for (const p of group) {
                const worthy = classifier.classify(p).isPortfolioWorthy;
                const suffix = worthy ? chalk.green(' ← portfolio worthy') : '';
                console.log(chalk.dim(`  - ${p.displayName}${suffix}`));
            }
            console.log('');
        }

        const portfolioWorthy = projects.filter(p => classifier.classify(p).isPortfolioWorthy);
        console.log(chalk.green(`\n✨ ${portfolioWorthy.length} projects are portfolio-worthy.\n`));
    });

// ============================================================================
// History command
// ============================================================================
program
    .command('history')
    .description('View recent portfolio changes')
    .option('-n, --count <number>', 'Number of changes to show', '10')
    .action(async (options) => {
        const history = new ChangeHistory();
        const changes = history.getRecentChanges(parseInt(options.count));

        if (changes.length === 0) {
            console.log(chalk.dim('\nNo changes recorded yet.\n'));
            return;
        }

        console.log(chalk.cyan.bold(`\n📜 Recent Changes (${changes.length})\n`));

        for (const change of changes) {
            const icon = change.action === 'ADD' ? chalk.green('+') : chalk.red('-');
            const date = new Date(change.timestamp).toLocaleDateString();
            console.log(`${icon} ${chalk.bold(change.projectName)}`);
            console.log(chalk.dim(`    ${date} • ${change.file}`));
            console.log(chalk.dim(`    ID: ${change.id}\n`));
        }

        console.log(chalk.dim('Use `projex undo` to revert the last change.\n'));
    });

// ============================================================================
// Undo command
// ============================================================================
program
    .command('undo')
    .description('Undo the last portfolio change')
    .option('-i, --id <changeId>', 'Undo a specific change by ID')
    .action(async (options) => {
        const history = new ChangeHistory();

        const spinner = ora('Undoing change...').start();

        let result;
        if (options.id) {
            result = history.undoChange(options.id);
        } else {
            result = history.undoLast();
        }

        if (result.success) {
            spinner.succeed(result.message);
        } else {
            spinner.fail(result.message);
        }
    });

program.parse();
