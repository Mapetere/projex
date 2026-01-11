/**
 * Design Analyzer - Detects portfolio design patterns and extracts styles
 * Supports: HTML/CSS, Markdown (Jekyll/Hugo), React/Vue
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

export type PortfolioType = 'html' | 'react' | 'vue' | 'nextjs' | 'gatsby' | 'jekyll' | 'hugo' | 'markdown' | 'unknown';

export interface ColorPalette {
    primary: string[];
    secondary: string[];
    background: string[];
    text: string[];
    accent: string[];
}

export interface TypographyInfo {
    fonts: string[];
    headingFont: string | null;
    bodyFont: string | null;
}

export interface CardTemplate {
    html: string;
    selector: string;
    classes: string[];
}

export interface PortfolioAnalysis {
    type: PortfolioType;
    projectsFile: string | null;          // File containing project list
    projectSelector: string | null;       // CSS selector for project cards
    cardTemplate: CardTemplate | null;    // Detected card HTML structure
    cssVariables: Record<string, string>; // Extracted CSS custom properties
    colors: ColorPalette;
    typography: TypographyInfo;
    hasGrid: boolean;
    gridColumns: number;
}

export class DesignAnalyzer {
    private portfolioPath: string;

    constructor(portfolioPath: string) {
        this.portfolioPath = portfolioPath;
    }

    /**
     * Analyze the portfolio and extract design patterns
     */
    async analyze(): Promise<PortfolioAnalysis> {
        const type = this.detectPortfolioType();

        const analysis: PortfolioAnalysis = {
            type,
            projectsFile: null,
            projectSelector: null,
            cardTemplate: null,
            cssVariables: {},
            colors: { primary: [], secondary: [], background: [], text: [], accent: [] },
            typography: { fonts: [], headingFont: null, bodyFont: null },
            hasGrid: false,
            gridColumns: 3,
        };

        switch (type) {
            case 'html':
                await this.analyzeHTML(analysis);
                break;
            case 'react':
            case 'nextjs':
            case 'gatsby':
                await this.analyzeReact(analysis);
                break;
            case 'jekyll':
            case 'hugo':
            case 'markdown':
                await this.analyzeMarkdown(analysis);
                break;
            default:
                console.log('Unknown portfolio type, using defaults');
        }

        return analysis;
    }

    /**
     * Detect the type of portfolio based on project files
     */
    private detectPortfolioType(): PortfolioType {
        // Check for package.json
        const pkgPath = join(this.portfolioPath, 'package.json');
        if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (deps['next']) return 'nextjs';
            if (deps['gatsby']) return 'gatsby';
            if (deps['vue'] || deps['nuxt']) return 'vue';
            if (deps['react']) return 'react';
        }

        // Check for Jekyll
        if (existsSync(join(this.portfolioPath, '_config.yml'))) {
            return 'jekyll';
        }

        // Check for Hugo
        if (existsSync(join(this.portfolioPath, 'config.toml')) ||
            existsSync(join(this.portfolioPath, 'hugo.toml'))) {
            return 'hugo';
        }

        // Check for index.html
        if (existsSync(join(this.portfolioPath, 'index.html'))) {
            return 'html';
        }

        // Check for markdown files
        const files = readdirSync(this.portfolioPath);
        if (files.some(f => f.endsWith('.md'))) {
            return 'markdown';
        }

        return 'unknown';
    }

    /**
     * Analyze plain HTML/CSS portfolio
     */
    private async analyzeHTML(analysis: PortfolioAnalysis): Promise<void> {
        const indexPath = join(this.portfolioPath, 'index.html');
        if (!existsSync(indexPath)) return;

        const html = readFileSync(indexPath, 'utf-8');

        // Find projects section
        analysis.projectsFile = 'index.html';

        // Detect project card selectors
        const selectorPatterns = [
            '.project', '.project-card', '.portfolio-item', '.work-item',
            '[class*="project"]', '[class*="portfolio"]', '.card',
        ];

        for (const selector of selectorPatterns) {
            const regex = new RegExp(`class=["'][^"']*${selector.replace('.', '')}[^"']*["']`, 'i');
            if (regex.test(html)) {
                analysis.projectSelector = selector;
                break;
            }
        }

        // Extract card template
        analysis.cardTemplate = this.extractCardFromHTML(html, analysis.projectSelector);

        // Find and analyze CSS
        await this.analyzeCSS(analysis);
    }

    /**
     * Analyze React-based portfolio
     */
    private async analyzeReact(analysis: PortfolioAnalysis): Promise<void> {
        // Look for components that might contain projects
        const componentDirs = ['src/components', 'components', 'src/pages', 'pages', 'app'];

        for (const dir of componentDirs) {
            const fullPath = join(this.portfolioPath, dir);
            if (!existsSync(fullPath)) continue;

            const files = this.findFiles(fullPath, ['.tsx', '.jsx', '.js']);

            for (const file of files) {
                const content = readFileSync(file, 'utf-8');

                // Look for project-related components
                if (/project|portfolio|work/i.test(content)) {
                    analysis.projectsFile = file.replace(this.portfolioPath, '');

                    // Extract JSX card pattern
                    const cardMatch = content.match(/<(?:div|article)[^>]*className=["'][^"']*(?:project|card|portfolio)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article)>/i);
                    if (cardMatch) {
                        analysis.cardTemplate = {
                            html: cardMatch[0],
                            selector: '.project-card',
                            classes: this.extractClasses(cardMatch[0]),
                        };
                    }
                    break;
                }
            }
        }

        await this.analyzeCSS(analysis);
    }

    /**
     * Analyze Jekyll/Hugo/Markdown portfolio
     */
    private async analyzeMarkdown(analysis: PortfolioAnalysis): Promise<void> {
        // Look for projects in _data, data, or content directories
        const dataDirs = ['_data', 'data', '_projects', 'content/projects', 'projects'];

        for (const dir of dataDirs) {
            const fullPath = join(this.portfolioPath, dir);
            if (existsSync(fullPath)) {
                const files = this.findFiles(fullPath, ['.yml', '.yaml', '.json', '.md']);
                if (files.length > 0) {
                    analysis.projectsFile = dir;
                    break;
                }
            }
        }

        // Look for includes/layouts with project cards
        const layoutDirs = ['_includes', '_layouts', 'layouts', 'partials'];

        for (const dir of layoutDirs) {
            const fullPath = join(this.portfolioPath, dir);
            if (!existsSync(fullPath)) continue;

            const files = this.findFiles(fullPath, ['.html', '.liquid', '.njk']);

            for (const file of files) {
                const content = readFileSync(file, 'utf-8');
                if (/project|portfolio/i.test(basename(file))) {
                    analysis.cardTemplate = {
                        html: content,
                        selector: '.project',
                        classes: this.extractClasses(content),
                    };
                    break;
                }
            }
        }

        await this.analyzeCSS(analysis);
    }

    /**
     * Analyze CSS files to extract design tokens
     */
    private async analyzeCSS(analysis: PortfolioAnalysis): Promise<void> {
        const cssFiles = this.findFiles(this.portfolioPath, ['.css', '.scss', '.sass']);

        for (const file of cssFiles) {
            const css = readFileSync(file, 'utf-8');

            // Extract CSS custom properties
            const varMatches = css.matchAll(/--([a-zA-Z0-9-]+):\s*([^;]+);/g);
            for (const match of varMatches) {
                analysis.cssVariables[`--${match[1]}`] = match[2].trim();
            }

            // Extract colors
            const colorMatches = css.matchAll(/#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|hsl\([^)]+\)/g);
            const colors = new Set<string>();
            for (const match of colorMatches) {
                colors.add(match[0]);
            }

            // Categorize colors (simplified)
            const colorArray = Array.from(colors).slice(0, 20);
            analysis.colors.primary = colorArray.slice(0, 3);
            analysis.colors.background = colorArray.slice(3, 6);
            analysis.colors.text = colorArray.slice(6, 9);

            // Extract fonts
            const fontMatches = css.matchAll(/font-family:\s*(['"]?)([^;'"]+)\1/g);
            for (const match of fontMatches) {
                const fonts = match[2].split(',').map(f => f.trim().replace(/["']/g, ''));
                analysis.typography.fonts.push(...fonts);
            }

            // Detect grid
            if (/display:\s*grid/.test(css)) {
                analysis.hasGrid = true;
                const colMatch = css.match(/grid-template-columns:\s*repeat\((\d+)/);
                if (colMatch) {
                    analysis.gridColumns = parseInt(colMatch[1]);
                }
            }
        }

        // Dedupe fonts
        analysis.typography.fonts = [...new Set(analysis.typography.fonts)];
        if (analysis.typography.fonts.length > 0) {
            analysis.typography.headingFont = analysis.typography.fonts[0];
            analysis.typography.bodyFont = analysis.typography.fonts[1] || analysis.typography.fonts[0];
        }
    }

    /**
     * Extract card template from HTML
     */
    private extractCardFromHTML(html: string, selector: string | null): CardTemplate | null {
        if (!selector) return null;

        const className = selector.replace('.', '');
        const regex = new RegExp(`<(?:div|article|section)[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?<\\/(?:div|article|section)>`, 'i');
        const match = html.match(regex);

        if (match) {
            return {
                html: match[0],
                selector,
                classes: this.extractClasses(match[0]),
            };
        }

        return null;
    }

    /**
     * Extract class names from HTML
     */
    private extractClasses(html: string): string[] {
        const matches = html.matchAll(/class=["']([^"']+)["']/g);
        const classes = new Set<string>();

        for (const match of matches) {
            match[1].split(/\s+/).forEach(c => classes.add(c));
        }

        return Array.from(classes);
    }

    /**
     * Find files with specific extensions recursively
     */
    private findFiles(dir: string, extensions: string[], maxDepth = 3): string[] {
        const files: string[] = [];

        const walk = (currentDir: string, depth: number) => {
            if (depth > maxDepth) return;
            if (!existsSync(currentDir)) return;

            try {
                const entries = readdirSync(currentDir);

                for (const entry of entries) {
                    if (entry.startsWith('.') || entry === 'node_modules') continue;

                    const fullPath = join(currentDir, entry);
                    const stat = statSync(fullPath);

                    if (stat.isDirectory()) {
                        walk(fullPath, depth + 1);
                    } else if (extensions.includes(extname(entry))) {
                        files.push(fullPath);
                    }
                }
            } catch (e) {
                // Skip unreadable directories
            }
        };

        walk(dir, 0);
        return files;
    }
}
