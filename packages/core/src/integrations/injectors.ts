/**
 * Portfolio Injectors - Insert generated project cards into portfolio files
 * Supports: HTML, Markdown, React/JSX
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import type { PortfolioAnalysis } from './analyzer.js';
import type { GeneratedCard } from './template-generator.js';

export interface InjectionResult {
    success: boolean;
    file: string;
    message: string;
    backup?: string;
}

export interface InjectorOptions {
    autoCommit: boolean;
    autoPush: boolean;
    commitMessage?: string;
    createBackup: boolean;
}

/**
 * Base class for portfolio injectors
 */
abstract class BaseInjector {
    protected portfolioPath: string;
    protected analysis: PortfolioAnalysis;
    protected options: InjectorOptions;

    constructor(portfolioPath: string, analysis: PortfolioAnalysis, options: InjectorOptions) {
        this.portfolioPath = portfolioPath;
        this.analysis = analysis;
        this.options = options;
    }

    abstract inject(card: GeneratedCard, projectId: string): Promise<InjectionResult>;

    protected backup(filePath: string): string | undefined {
        if (!this.options.createBackup) return undefined;

        const backupPath = `${filePath}.backup.${Date.now()}`;
        const content = readFileSync(filePath, 'utf-8');
        writeFileSync(backupPath, content);
        return backupPath;
    }

    protected gitCommit(files: string[], message: string): void {
        if (!this.options.autoCommit) return;

        try {
            for (const file of files) {
                execSync(`git add "${file}"`, { cwd: this.portfolioPath });
            }
            execSync(`git commit -m "${message}"`, { cwd: this.portfolioPath });
            console.log(`[Injector] Committed: ${message}`);

            // Auto-push if enabled
            if (this.options.autoPush) {
                execSync('git push', { cwd: this.portfolioPath });
                console.log('[Injector] Pushed to remote');
            }
        } catch (error) {
            console.error('[Injector] Git operation failed:', error);
        }
    }
}

/**
 * HTML Portfolio Injector
 */
export class HTMLInjector extends BaseInjector {
    async inject(card: GeneratedCard, projectId: string): Promise<InjectionResult> {
        const targetFile = this.findTargetFile();

        if (!targetFile) {
            return {
                success: false,
                file: '',
                message: 'Could not find projects section in HTML files',
            };
        }

        const filePath = join(this.portfolioPath, targetFile);
        const backup = this.backup(filePath);

        try {
            let content = readFileSync(filePath, 'utf-8');

            // Check if this project is already injected
            if (content.includes(`projex:${projectId}`)) {
                return {
                    success: false,
                    file: targetFile,
                    message: `Project ${projectId} is already in the portfolio`,
                    backup,
                };
            }

            // Find the best insertion point
            const insertionPoint = this.findInsertionPoint(content);

            if (!insertionPoint) {
                return {
                    success: false,
                    file: targetFile,
                    message: 'Could not find a suitable insertion point in the HTML',
                };
            }

            // Create the wrapped card HTML
            const wrappedCard = this.wrapCard(card.html, projectId, insertionPoint.indent);

            // Insert the card at the found position
            content =
                content.slice(0, insertionPoint.position) +
                wrappedCard +
                content.slice(insertionPoint.position);

            writeFileSync(filePath, content);

            const commitMsg = this.options.commitMessage || `feat: add project ${projectId}`;
            this.gitCommit([filePath], commitMsg);

            return {
                success: true,
                file: filePath,
                message: 'Project card injected successfully',
                backup,
            };
        } catch (error) {
            return {
                success: false,
                file: targetFile,
                message: `Injection failed: ${error}`,
                backup,
            };
        }
    }

    private findTargetFile(): string | null {
        const candidates = ['index.html', 'projects.html', 'portfolio.html', 'work.html'];

        for (const file of candidates) {
            const filePath = join(this.portfolioPath, file);
            if (existsSync(filePath)) {
                const content = readFileSync(filePath, 'utf-8');
                if (/project|portfolio|work/i.test(content)) {
                    return file;
                }
            }
        }

        return candidates.find(f => existsSync(join(this.portfolioPath, f))) || null;
    }

    private findInsertionPoint(content: string): { position: number; indent: string } | null {
        // Strategy 1: Find projects-grid and insert before its closing div
        const gridPatterns = [
            /(<div[^>]*class="[^"]*projects-grid[^"]*"[^>]*>)/gi,
            /(<div[^>]*class="[^"]*project-cards[^"]*"[^>]*>)/gi,
            /(<div[^>]*class="[^"]*projects-container[^"]*"[^>]*>)/gi,
        ];

        for (const pattern of gridPatterns) {
            const match = pattern.exec(content);
            if (match && match.index !== undefined) {
                // Find the closing </div> for this grid
                const startPos = match.index + match[0].length;
                const closingPos = this.findMatchingClosingTag(content, startPos, 'div');
                if (closingPos > 0) {
                    const indent = this.detectIndent(content, match.index);
                    return { position: closingPos, indent: indent + '    ' };
                }
            }
        }

        // Strategy 2: Find the projects section and insert before closing </section>
        const sectionPattern = /<section[^>]*id="projects"[^>]*>/gi;
        const sectionMatch = sectionPattern.exec(content);
        if (sectionMatch && sectionMatch.index !== undefined) {
            const startPos = sectionMatch.index + sectionMatch[0].length;
            const closingPos = this.findMatchingClosingTag(content, startPos, 'section');
            if (closingPos > 0) {
                const indent = this.detectIndent(content, sectionMatch.index);
                return { position: closingPos, indent: indent + '        ' };
            }
        }

        // Strategy 3: Find any element with "project" in class and insert after last project-card
        const cardPattern = /<div[^>]*class="[^"]*project-card[^"]*"[^>]*>/gi;
        let lastCardMatch: RegExpExecArray | null = null;
        let match;
        while ((match = cardPattern.exec(content)) !== null) {
            lastCardMatch = match;
        }

        if (lastCardMatch && lastCardMatch.index !== undefined) {
            // Find the closing </div> for this card
            const startPos = lastCardMatch.index + lastCardMatch[0].length;
            const closingPos = this.findMatchingClosingTag(content, startPos, 'div');
            if (closingPos > 0) {
                const afterClosing = closingPos + '</div>'.length;
                const indent = this.detectIndent(content, lastCardMatch.index);
                return { position: afterClosing, indent };
            }
        }

        // Strategy 4: Find <!-- More Projects --> or similar comment
        const commentPattern = /<!--\s*(?:More Projects|Projects Grid|Project Cards)\s*-->/gi;
        const commentMatch = commentPattern.exec(content);
        if (commentMatch && commentMatch.index !== undefined) {
            const indent = this.detectIndent(content, commentMatch.index);
            return { position: commentMatch.index + commentMatch[0].length, indent };
        }

        return null;
    }

    private findMatchingClosingTag(content: string, startPos: number, tagName: string): number {
        let depth = 1;
        let pos = startPos;
        // Match opening tags - we filter out self-closing tags in the loop below
        const openPattern = new RegExp(`<${tagName}[^>]*>`, 'gi');
        const closePattern = new RegExp(`</${tagName}>`, 'gi');

        while (depth > 0 && pos < content.length) {
            openPattern.lastIndex = pos;
            closePattern.lastIndex = pos;

            const openMatch = openPattern.exec(content);
            const closeMatch = closePattern.exec(content);

            if (!closeMatch) {
                return -1; // No closing tag found
            }

            const openPos = openMatch ? openMatch.index : Infinity;
            const closePos = closeMatch.index;

            if (openPos < closePos) {
                // Check if this is a self-closing tag (e.g., <div /> or <div/>)
                const matchedTag = openMatch![0];
                if (!matchedTag.includes('/>')) {
                    depth++;
                }
                pos = openPos + matchedTag.length;
            } else {
                depth--;
                if (depth === 0) {
                    return closePos;
                }
                pos = closePos + closeMatch[0].length;
            }
        }

        return -1;
    }

    private wrapCard(cardHtml: string, projectId: string, indent: string): string {
        const lines = cardHtml.split('\n');
        const indentedCard = lines
            .map((line, i) => i === 0 ? indent + line : indent + line)
            .join('\n');

        return `\n${indent}<!-- projex:${projectId} -->\n${indentedCard}\n${indent}<!-- /projex:${projectId} -->\n`;
    }

    private detectIndent(content: string, position: number): string {
        // Find the start of the line
        let lineStart = position;
        while (lineStart > 0 && content[lineStart - 1] !== '\n') {
            lineStart--;
        }

        // Get the whitespace at the start of this line
        const match = content.slice(lineStart, position).match(/^(\s*)/);
        return match ? match[1] : '            ';
    }
}


/**
 * Markdown Portfolio Injector
 */
export class MarkdownInjector extends BaseInjector {
    async inject(card: GeneratedCard, projectId: string): Promise<InjectionResult> {
        const targetFile = this.findTargetFile();

        if (!targetFile) {
            return {
                success: false,
                file: '',
                message: 'Could not find projects section in Markdown files',
            };
        }

        const filePath = join(this.portfolioPath, targetFile);
        const backup = this.backup(filePath);

        try {
            let content = readFileSync(filePath, 'utf-8');

            // Find the projects section (## Projects, ## Work, etc.)
            const sectionMatch = content.match(/^(##?\s*(?:Projects|Portfolio|Work|My Work)[^\n]*)/mi);

            if (sectionMatch && sectionMatch.index !== undefined) {
                // Find the next section or end of file
                const sectionStart = sectionMatch.index + sectionMatch[0].length;
                const nextSection = content.slice(sectionStart).search(/\n##?\s+[A-Z]/);
                const insertPos = nextSection === -1
                    ? content.length
                    : sectionStart + nextSection;

                // Insert the card
                const markedCard = `\n<!-- projex:${projectId} -->\n${card.markdown}\n<!-- /projex:${projectId} -->\n`;
                content = content.slice(0, insertPos) + markedCard + content.slice(insertPos);
            } else {
                // Append to end
                content += `\n\n## Projects\n\n<!-- projex:${projectId} -->\n${card.markdown}\n<!-- /projex:${projectId} -->\n`;
            }

            writeFileSync(filePath, content);

            const commitMsg = this.options.commitMessage || `feat: add project ${projectId}`;
            this.gitCommit([filePath], commitMsg);

            return {
                success: true,
                file: targetFile,
                message: 'Project card injected successfully',
                backup,
            };
        } catch (error) {
            return {
                success: false,
                file: targetFile,
                message: `Injection failed: ${error}`,
                backup,
            };
        }
    }

    private findTargetFile(): string | null {
        const candidates = [
            'README.md',
            'index.md',
            'projects.md',
            'portfolio.md',
            '_pages/projects.md',
            'content/projects.md',
        ];

        for (const file of candidates) {
            const filePath = join(this.portfolioPath, file);
            if (existsSync(filePath)) {
                return file;
            }
        }

        return null;
    }
}

/**
 * React/JSX Portfolio Injector
 */
export class ReactInjector extends BaseInjector {
    async inject(card: GeneratedCard, projectId: string): Promise<InjectionResult> {
        // For React, we update a data file rather than injecting JSX directly
        const dataFile = this.findOrCreateDataFile();
        const filePath = join(this.portfolioPath, dataFile);
        const backup = existsSync(filePath) ? this.backup(filePath) : undefined;

        try {
            let projects: any[] = [];

            if (existsSync(filePath)) {
                const content = readFileSync(filePath, 'utf-8');
                // Parse existing projects
                const match = content.match(/export\s+(?:const|let)\s+projects\s*=\s*(\[[\s\S]*?\]);/);
                if (match) {
                    try {
                        // Simple JSON-like parsing (won't work for complex expressions)
                        projects = JSON.parse(match[1].replace(/'/g, '"'));
                    } catch {
                        projects = [];
                    }
                }
            }

            // Add new project
            const newProject = {
                id: projectId,
                ...this.parseCardToObject(card),
            };

            // Check if already exists
            const existingIndex = projects.findIndex((p: any) => p.id === projectId);
            if (existingIndex >= 0) {
                projects[existingIndex] = newProject;
            } else {
                projects.push(newProject);
            }

            // Write data file
            const content = `// Auto-generated by Projex
export const projects = ${JSON.stringify(projects, null, 2)};
`;

            writeFileSync(filePath, content);

            const commitMsg = this.options.commitMessage || `feat: add project ${projectId}`;
            this.gitCommit([filePath], commitMsg);

            return {
                success: true,
                file: dataFile,
                message: 'Project data updated successfully',
                backup,
            };
        } catch (error) {
            return {
                success: false,
                file: dataFile,
                message: `Injection failed: ${error}`,
                backup,
            };
        }
    }

    private findOrCreateDataFile(): string {
        const candidates = [
            'src/data/projects.ts',
            'src/data/projects.js',
            'data/projects.ts',
            'data/projects.js',
            'src/lib/projects.ts',
            'lib/projects.ts',
        ];

        for (const file of candidates) {
            if (existsSync(join(this.portfolioPath, file))) {
                return file;
            }
        }

        // Create new data file
        const newFile = 'src/data/projects.ts';
        const dir = dirname(join(this.portfolioPath, newFile));
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        return newFile;
    }

    private parseCardToObject(card: GeneratedCard): Record<string, any> {
        // Extract props from JSX string
        const props: Record<string, any> = {};

        const patterns = [
            { key: 'title', pattern: /title="([^"]+)"/ },
            { key: 'tagline', pattern: /tagline="([^"]+)"/ },
            { key: 'description', pattern: /description="([^"]+)"/ },
            { key: 'githubUrl', pattern: /githubUrl="([^"]+)"/ },
            { key: 'liveUrl', pattern: /liveUrl="([^"]+)"/ },
        ];

        for (const { key, pattern } of patterns) {
            const match = card.react.match(pattern);
            if (match) {
                props[key] = match[1];
            }
        }

        // Extract techStack array
        const techMatch = card.react.match(/techStack=\{(\[[^\]]+\])\}/);
        if (techMatch) {
            try {
                props.techStack = JSON.parse(techMatch[1]);
            } catch {
                props.techStack = [];
            }
        }

        return props;
    }
}

/**
 * Factory function to create the appropriate injector
 */
export function createInjector(
    portfolioPath: string,
    analysis: PortfolioAnalysis,
    options: InjectorOptions
): BaseInjector {
    switch (analysis.type) {
        case 'react':
        case 'nextjs':
        case 'gatsby':
            return new ReactInjector(portfolioPath, analysis, options);
        case 'jekyll':
        case 'hugo':
        case 'markdown':
            return new MarkdownInjector(portfolioPath, analysis, options);
        case 'html':
        default:
            return new HTMLInjector(portfolioPath, analysis, options);
    }
}
