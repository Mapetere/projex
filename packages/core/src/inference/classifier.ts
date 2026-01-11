/**
 * RepoClassifier - Intelligently classifies repositories to distinguish
 * real projects from notes, forks, experiments, and other non-portfolio items.
 */

import type { Project } from '../events/types.js';

export type RepoClassification =
    | 'PROJECT'           // Real, portfolio-worthy project
    | 'NOTES'             // Course notes, lectures, study materials
    | 'FORK'              // Forked from another user
    | 'EXPERIMENT'        // Quick experiment, tutorial follow-along
    | 'CONFIG'            // Dotfiles, config repos
    | 'TEMPLATE'          // Template/boilerplate repos
    | 'ARCHIVED_JUNK'     // Old abandoned experiments
    | 'UNKNOWN';          // Can't determine

export interface ClassificationResult {
    classification: RepoClassification;
    confidence: number;      // 0-1 confidence score
    reasons: string[];       // Human-readable reasons
    isPortfolioWorthy: boolean;
}

// Patterns that indicate notes/educational content
const NOTES_PATTERNS = {
    filenames: [
        /notes?\.md$/i,
        /lecture[s_]?\d*/i,
        /week[s_]?\d+/i,
        /chapter[s_]?\d+/i,
        /assignment[s_]?\d*/i,
        /homework[s_]?\d*/i,
        /lab[s_]?\d+/i,
        /exercise[s_]?\d*/i,
        /quiz[zs_]?\d*/i,
        /exam[s_]?\d*/i,
        /tutorial[s_]?\d*/i,
        /lesson[s_]?\d*/i,
    ],
    folders: [
        /^week\d+$/i,
        /^chapter\d+$/i,
        /^module\d+$/i,
        /^unit\d+$/i,
        /^day\d+$/i,
        /^session\d+$/i,
        /^lectures?$/i,
        /^notes?$/i,
        /^assignments?$/i,
    ],
    readmeKeywords: [
        'course', 'class', 'lecture', 'notes', 'assignment', 'homework',
        'university', 'college', 'school', 'student', 'professor', 'instructor',
        'syllabus', 'curriculum', 'learning', 'study', 'exam', 'quiz',
        'certificate', 'certification', 'udemy', 'coursera', 'edx', 'pluralsight',
        'tutorial series', 'follow along', 'code along',
    ],
};

// Patterns that indicate config/dotfiles
const CONFIG_PATTERNS = {
    repoNames: [
        /^\.?dotfiles?$/i,
        /^\.?config$/i,
        /^\.?vimrc$/i,
        /^\.?emacs$/i,
        /^\.?bashrc$/i,
        /^\.?zshrc$/i,
        /^home-?config$/i,
    ],
    filenames: [
        /^\.[a-z]+rc$/i,
        /^\.gitconfig$/i,
        /^\.vimrc$/i,
    ],
};

// Patterns that indicate templates/boilerplates
const TEMPLATE_PATTERNS = {
    repoNames: [
        /template$/i,
        /boilerplate$/i,
        /starter$/i,
        /scaffold$/i,
        /skeleton$/i,
        /seed$/i,
    ],
    readmeKeywords: [
        'template', 'boilerplate', 'starter kit', 'scaffold',
        'use this template', 'click "use this template"',
    ],
};

// Patterns that indicate experiments/throwaway code
const EXPERIMENT_PATTERNS = {
    repoNames: [
        /^test[-_]?/i,
        /[-_]test$/i,
        /^experiment/i,
        /^try[-_]/i,
        /^demo[-_]/i,
        /^hello[-_]?world/i,
        /^learning[-_]/i,
        /^practice[-_]/i,
        /^scratch/i,
        /^playground/i,
        /^sandbox/i,
    ],
    lowCommitThreshold: 5,         // Less than 5 commits
    lowFileThreshold: 3,           // Less than 3 files
    shortLifespanDays: 7,          // Created and abandoned within a week
};

// Positive signals for real projects
const PROJECT_SIGNALS = {
    hasPackageJson: 10,
    hasRequirementsTxt: 8,
    hasDockerfile: 10,
    hasCIConfig: 12,               // .github/workflows, .travis.yml, etc.
    hasTests: 10,
    hasLicense: 5,
    hasContributing: 8,
    hasChangelog: 8,
    multipleContributors: 15,
    hasReleases: 15,
    hasManyCommits: 10,            // 20+ commits
    hasGoodReadme: 10,             // README > 500 chars with sections
    deploymentEvidence: 12,        // Vercel, Netlify, Heroku configs
};

export class RepoClassifier {
    /**
     * Classify a project based on all available signals
     */
    classify(project: Project): ClassificationResult {
        const scores: Record<RepoClassification, number> = {
            PROJECT: 0,
            NOTES: 0,
            FORK: 0,
            EXPERIMENT: 0,
            CONFIG: 0,
            TEMPLATE: 0,
            ARCHIVED_JUNK: 0,
            UNKNOWN: 0,
        };

        const reasons: string[] = [];

        // Check if it's a fork
        if ((project.rawData as any)?.isFork) {
            scores.FORK += 100;
            reasons.push('Repository is a fork');
        }

        // Check repo name patterns
        this.checkRepoNamePatterns(project, scores, reasons);

        // Analyze file structure
        this.analyzeFileStructure(project, scores, reasons);

        // Analyze README content
        this.analyzeReadme(project, scores, reasons);

        // Check commit patterns
        this.analyzeCommitPatterns(project, scores, reasons);

        // Check for project quality signals
        this.checkProjectSignals(project, scores, reasons);

        // Determine classification
        const classification = this.determineClassification(scores);
        const confidence = this.calculateConfidence(scores, classification);
        const isPortfolioWorthy = this.isPortfolioWorthy(classification, confidence, project);

        return {
            classification,
            confidence,
            reasons,
            isPortfolioWorthy,
        };
    }

    private checkRepoNamePatterns(
        project: Project,
        scores: Record<RepoClassification, number>,
        reasons: string[]
    ): void {
        const repoName = project.displayName.toLowerCase();

        // Check config patterns
        for (const pattern of CONFIG_PATTERNS.repoNames) {
            if (pattern.test(repoName)) {
                scores.CONFIG += 50;
                reasons.push(`Repo name matches config pattern: ${repoName}`);
                break;
            }
        }

        // Check template patterns
        for (const pattern of TEMPLATE_PATTERNS.repoNames) {
            if (pattern.test(repoName)) {
                scores.TEMPLATE += 40;
                reasons.push(`Repo name suggests template: ${repoName}`);
                break;
            }
        }

        // Check experiment patterns
        for (const pattern of EXPERIMENT_PATTERNS.repoNames) {
            if (pattern.test(repoName)) {
                scores.EXPERIMENT += 30;
                reasons.push(`Repo name suggests experiment: ${repoName}`);
                break;
            }
        }
    }

    private analyzeFileStructure(
        project: Project,
        scores: Record<RepoClassification, number>,
        reasons: string[]
    ): void {
        const files = (project.rawData as any)?.files || [];
        const fileNames = files.map((f: string) => f.toLowerCase());

        // Check for notes patterns in file names
        let notesFileCount = 0;
        for (const filename of fileNames) {
            for (const pattern of NOTES_PATTERNS.filenames) {
                if (pattern.test(filename)) {
                    notesFileCount++;
                    break;
                }
            }
            for (const pattern of NOTES_PATTERNS.folders) {
                if (pattern.test(filename)) {
                    notesFileCount++;
                    break;
                }
            }
        }

        if (notesFileCount >= 3) {
            scores.NOTES += 40;
            reasons.push(`Found ${notesFileCount} files matching notes/lecture patterns`);
        }

        // Check for code files
        const codeExtensions = ['.js', '.ts', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.rb', '.php'];
        const docExtensions = ['.md', '.txt', '.pdf', '.docx', '.pptx'];

        let codeFiles = 0;
        let docFiles = 0;

        for (const filename of fileNames) {
            if (codeExtensions.some(ext => filename.endsWith(ext))) {
                codeFiles++;
            }
            if (docExtensions.some(ext => filename.endsWith(ext))) {
                docFiles++;
            }
        }

        // If mostly docs, likely notes
        if (docFiles > 0 && codeFiles === 0) {
            scores.NOTES += 30;
            reasons.push('Repository contains only documentation files');
        } else if (docFiles > codeFiles * 2) {
            scores.NOTES += 20;
            reasons.push('Documentation files outnumber code files');
        }

        // Project signals from files
        if (fileNames.includes('package.json')) {
            scores.PROJECT += PROJECT_SIGNALS.hasPackageJson;
            reasons.push('Has package.json');
        }
        if (fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml')) {
            scores.PROJECT += PROJECT_SIGNALS.hasRequirementsTxt;
            reasons.push('Has Python dependencies file');
        }
        if (fileNames.some(f => f.includes('dockerfile'))) {
            scores.PROJECT += PROJECT_SIGNALS.hasDockerfile;
            reasons.push('Has Dockerfile');
        }
        if (fileNames.some(f => f.includes('.github/workflows') || f.includes('.travis') || f.includes('circle'))) {
            scores.PROJECT += PROJECT_SIGNALS.hasCIConfig;
            reasons.push('Has CI/CD configuration');
        }
        if (fileNames.some(f => f.includes('test') || f.includes('spec'))) {
            scores.PROJECT += PROJECT_SIGNALS.hasTests;
            reasons.push('Has test files');
        }
        if (fileNames.includes('license') || fileNames.includes('license.md')) {
            scores.PROJECT += PROJECT_SIGNALS.hasLicense;
            reasons.push('Has license file');
        }
        if (fileNames.some(f => f.includes('vercel') || f.includes('netlify') || f.includes('heroku'))) {
            scores.PROJECT += PROJECT_SIGNALS.deploymentEvidence;
            reasons.push('Has deployment configuration');
        }
    }

    private analyzeReadme(
        project: Project,
        scores: Record<RepoClassification, number>,
        reasons: string[]
    ): void {
        const readme = (project.rawData?.readme || '').toLowerCase();

        if (!readme || readme.length < 50) {
            scores.EXPERIMENT += 10;
            reasons.push('Missing or minimal README');
            return;
        }

        // Check for notes keywords
        let notesKeywordCount = 0;
        for (const keyword of NOTES_PATTERNS.readmeKeywords) {
            if (readme.includes(keyword.toLowerCase())) {
                notesKeywordCount++;
            }
        }

        if (notesKeywordCount >= 3) {
            scores.NOTES += 35;
            reasons.push(`README contains ${notesKeywordCount} education-related keywords`);
        }

        // Check for template keywords
        for (const keyword of TEMPLATE_PATTERNS.readmeKeywords) {
            if (readme.includes(keyword.toLowerCase())) {
                scores.TEMPLATE += 20;
                reasons.push(`README suggests this is a template`);
                break;
            }
        }

        // Good README signals a real project
        if (readme.length > 500) {
            const hasInstallSection = readme.includes('install') || readme.includes('getting started');
            const hasUsageSection = readme.includes('usage') || readme.includes('how to use');
            const hasFeatures = readme.includes('features') || readme.includes('what it does');

            if (hasInstallSection || hasUsageSection || hasFeatures) {
                scores.PROJECT += PROJECT_SIGNALS.hasGoodReadme;
                reasons.push('README has proper documentation sections');
            }
        }
    }

    private analyzeCommitPatterns(
        project: Project,
        scores: Record<RepoClassification, number>,
        reasons: string[]
    ): void {
        const commitCount = (project.rawData as any)?.commitCount || 0;
        const createdAt = new Date((project as any).detectedAt || Date.now());
        const lastActivity = new Date(project.lastActivityDate || Date.now());
        const lifespanDays = (lastActivity.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

        // Low commits suggest experiment
        if (commitCount < EXPERIMENT_PATTERNS.lowCommitThreshold) {
            scores.EXPERIMENT += 20;
            reasons.push(`Only ${commitCount} commits`);
        } else if (commitCount >= 20) {
            scores.PROJECT += PROJECT_SIGNALS.hasManyCommits;
            reasons.push(`Has ${commitCount} commits`);
        }

        // Short lifespan with few commits suggests abandoned experiment
        if (lifespanDays < EXPERIMENT_PATTERNS.shortLifespanDays && commitCount < 10) {
            scores.EXPERIMENT += 15;
            reasons.push('Short-lived repository with few commits');
        }

        // Old and inactive with few commits
        const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceActivity > 365 && commitCount < 10) {
            scores.ARCHIVED_JUNK += 25;
            reasons.push('Abandoned over a year ago with minimal activity');
        }
    }

    private checkProjectSignals(
        project: Project,
        scores: Record<RepoClassification, number>,
        reasons: string[]
    ): void {
        // Check for multiple technologies (real projects often have several)
        if (project.techStack.length >= 3) {
            scores.PROJECT += 15;
            reasons.push(`Uses ${project.techStack.length} technologies`);
        }

        // Check for purpose inference
        const purpose = (project as any).inferredPurpose || project.rawData?.description || '';
        if (purpose && purpose.length > 50) {
            scores.PROJECT += 10;
            reasons.push('Has clear inferred purpose');
        }
    }

    private determineClassification(scores: Record<RepoClassification, number>): RepoClassification {
        let maxScore = 0;
        let classification: RepoClassification = 'UNKNOWN';

        for (const [type, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                classification = type as RepoClassification;
            }
        }

        // If scores are too low, mark as unknown
        if (maxScore < 15) {
            return 'UNKNOWN';
        }

        return classification;
    }

    private calculateConfidence(
        scores: Record<RepoClassification, number>,
        classification: RepoClassification
    ): number {
        const winningScore = scores[classification];
        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

        if (totalScore === 0) return 0;

        return Math.min(winningScore / totalScore, 1);
    }

    private isPortfolioWorthy(
        classification: RepoClassification,
        confidence: number,
        project: Project
    ): boolean {
        // Only PROJECT classification is portfolio-worthy
        if (classification !== 'PROJECT') {
            return false;
        }

        // Need reasonable confidence
        if (confidence < 0.3) {
            return false;
        }

        // Should have some tech stack detected
        if (project.techStack.length === 0) {
            return false;
        }

        return true;
    }
}
