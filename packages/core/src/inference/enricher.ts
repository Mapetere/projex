/**
 * Enricher - Rules 2 & 3: Tech stack inference and purpose extraction
 * Prioritizes accuracy over simplicity as requested.
 */

import type {
    SignalEvent,
    RepoEnrichedEvent,
    TechStackItem,
    Project,
} from '../events/types.js';
import type { ProjectStore } from '../storage/project-store.js';
import { EventBus } from '../events/event-bus.js';

// Framework detection patterns for package files
const FRAMEWORK_PATTERNS: Record<string, { name: string; category: TechStackItem['category'] }> = {
    // JavaScript/TypeScript
    'react': { name: 'React', category: 'framework' },
    'react-dom': { name: 'React', category: 'framework' },
    'next': { name: 'Next.js', category: 'framework' },
    'vue': { name: 'Vue.js', category: 'framework' },
    'nuxt': { name: 'Nuxt.js', category: 'framework' },
    '@angular/core': { name: 'Angular', category: 'framework' },
    'svelte': { name: 'Svelte', category: 'framework' },
    'express': { name: 'Express', category: 'framework' },
    'fastify': { name: 'Fastify', category: 'framework' },
    'nestjs': { name: 'NestJS', category: 'framework' },
    '@nestjs/core': { name: 'NestJS', category: 'framework' },
    'koa': { name: 'Koa', category: 'framework' },
    'hono': { name: 'Hono', category: 'framework' },
    'electron': { name: 'Electron', category: 'framework' },
    'tauri': { name: 'Tauri', category: 'framework' },

    // Databases / ORMs
    'prisma': { name: 'Prisma', category: 'library' },
    '@prisma/client': { name: 'Prisma', category: 'library' },
    'drizzle-orm': { name: 'Drizzle', category: 'library' },
    'typeorm': { name: 'TypeORM', category: 'library' },
    'mongoose': { name: 'Mongoose', category: 'library' },
    'sequelize': { name: 'Sequelize', category: 'library' },

    // Testing
    'jest': { name: 'Jest', category: 'tool' },
    'vitest': { name: 'Vitest', category: 'tool' },
    'mocha': { name: 'Mocha', category: 'tool' },
    'playwright': { name: 'Playwright', category: 'tool' },
    'cypress': { name: 'Cypress', category: 'tool' },

    // Build tools
    'vite': { name: 'Vite', category: 'tool' },
    'webpack': { name: 'Webpack', category: 'tool' },
    'esbuild': { name: 'esbuild', category: 'tool' },
    'rollup': { name: 'Rollup', category: 'tool' },

    // Python
    'django': { name: 'Django', category: 'framework' },
    'flask': { name: 'Flask', category: 'framework' },
    'fastapi': { name: 'FastAPI', category: 'framework' },
    'pytorch': { name: 'PyTorch', category: 'library' },
    'torch': { name: 'PyTorch', category: 'library' },
    'tensorflow': { name: 'TensorFlow', category: 'library' },
    'pandas': { name: 'Pandas', category: 'library' },
    'numpy': { name: 'NumPy', category: 'library' },
    'scikit-learn': { name: 'Scikit-learn', category: 'library' },

    // Rust
    'actix-web': { name: 'Actix Web', category: 'framework' },
    'axum': { name: 'Axum', category: 'framework' },
    'tokio': { name: 'Tokio', category: 'library' },
    'serde': { name: 'Serde', category: 'library' },

    // Go
    'gin': { name: 'Gin', category: 'framework' },
    'fiber': { name: 'Fiber', category: 'framework' },
    'echo': { name: 'Echo', category: 'framework' },
};

// Language name normalization
const LANGUAGE_NAMES: Record<string, string> = {
    'TypeScript': 'TypeScript',
    'JavaScript': 'JavaScript',
    'Python': 'Python',
    'Rust': 'Rust',
    'Go': 'Go',
    'Java': 'Java',
    'Kotlin': 'Kotlin',
    'Swift': 'Swift',
    'C#': 'C#',
    'C++': 'C++',
    'C': 'C',
    'Ruby': 'Ruby',
    'PHP': 'PHP',
    'Dart': 'Dart',
    'Elixir': 'Elixir',
    'Scala': 'Scala',
    'Shell': 'Shell',
    'HTML': 'HTML',
    'CSS': 'CSS',
    'SCSS': 'SCSS',
    'Dockerfile': 'Docker',
};

export class Enricher {
    constructor(
        private store: ProjectStore,
        private eventBus: EventBus
    ) {
        this.eventBus.subscribe(['repo.enriched'], (event) =>
            this.handleEnriched(event as RepoEnrichedEvent)
        );
    }

    private async handleEnriched(event: RepoEnrichedEvent): Promise<void> {
        const project = this.store.getProject(event.repo.id);

        if (!project) {
            console.log(`[Enricher] Project not found: ${event.repo.id}`);
            return;
        }

        console.log(`[Enricher] Enriching project: ${event.repo.id}`);

        // Store raw data
        project.rawData.languages = event.payload.languages;
        project.rawData.readme = event.payload.readme;
        project.rawData.packageFiles = event.payload.packageFiles;

        // Rule 2: Tech stack inference
        project.techStack = this.inferTechStack(event);
        project.confidence.techStack = this.calculateTechStackConfidence(project.techStack);

        // Rule 3: Purpose extraction
        const { purpose, confidence } = this.extractPurpose(event, project);
        project.purpose = purpose;
        project.confidence.purpose = confidence;

        project.updatedAt = new Date();
        this.store.saveProject(project);

        console.log(`[Enricher] Updated ${event.repo.id}: ${project.techStack.length} tech items, purpose confidence: ${confidence.toFixed(2)}`);
    }

    private inferTechStack(event: RepoEnrichedEvent): TechStackItem[] {
        const techStack: TechStackItem[] = [];
        const seen = new Set<string>();

        // 1. Languages from GitHub API (high confidence)
        const totalBytes = Object.values(event.payload.languages).reduce((a, b) => a + b, 0);
        for (const [lang, bytes] of Object.entries(event.payload.languages)) {
            const normalizedName = LANGUAGE_NAMES[lang] ?? lang;
            if (!seen.has(normalizedName.toLowerCase())) {
                const percentage = totalBytes > 0 ? bytes / totalBytes : 0;
                // Only include languages that are >5% of codebase
                if (percentage > 0.05) {
                    techStack.push({
                        name: normalizedName,
                        category: 'language',
                        confidence: Math.min(0.9, 0.5 + percentage),
                        source: 'languages_api',
                    });
                    seen.add(normalizedName.toLowerCase());
                }
            }
        }

        // 2. Frameworks/libraries from package files (high accuracy)
        for (const pkgFile of event.payload.packageFiles) {
            const allDeps = [...pkgFile.dependencies, ...pkgFile.devDependencies];
            for (const dep of allDeps) {
                const pattern = FRAMEWORK_PATTERNS[dep.toLowerCase()];
                if (pattern && !seen.has(pattern.name.toLowerCase())) {
                    techStack.push({
                        name: pattern.name,
                        category: pattern.category,
                        confidence: 0.95, // High confidence from explicit dependency
                        source: 'package_file',
                    });
                    seen.add(pattern.name.toLowerCase());
                }
            }
        }

        // 3. README mentions (lower confidence)
        if (event.payload.readme) {
            const readmePatterns = this.extractTechFromReadme(event.payload.readme);
            for (const item of readmePatterns) {
                if (!seen.has(item.name.toLowerCase())) {
                    techStack.push({
                        ...item,
                        confidence: 0.6, // Lower confidence from mentions
                        source: 'readme',
                    });
                    seen.add(item.name.toLowerCase());
                }
            }
        }

        // Sort by confidence
        return techStack.sort((a, b) => b.confidence - a.confidence);
    }

    private extractTechFromReadme(readme: string): Array<{ name: string; category: TechStackItem['category'] }> {
        const items: Array<{ name: string; category: TechStackItem['category'] }> = [];
        const lowerReadme = readme.toLowerCase();

        // Common patterns in READMEs
        const patterns = [
            { regex: /built with\s+(\w+)/gi, category: 'framework' as const },
            { regex: /powered by\s+(\w+)/gi, category: 'platform' as const },
            { regex: /uses?\s+(\w+)\s+for/gi, category: 'library' as const },
            { regex: /deployed (?:on|to)\s+(\w+)/gi, category: 'platform' as const },
        ];

        for (const { regex, category } of patterns) {
            let match;
            while ((match = regex.exec(readme)) !== null) {
                const name = match[1];
                // Check if it's a known tech
                if (FRAMEWORK_PATTERNS[name.toLowerCase()] || LANGUAGE_NAMES[name]) {
                    items.push({ name, category });
                }
            }
        }

        // Platform detection from common phrases
        const platformPatterns: Array<{ pattern: RegExp; name: string }> = [
            { pattern: /vercel/i, name: 'Vercel' },
            { pattern: /netlify/i, name: 'Netlify' },
            { pattern: /heroku/i, name: 'Heroku' },
            { pattern: /aws|amazon web services/i, name: 'AWS' },
            { pattern: /google cloud|gcp/i, name: 'Google Cloud' },
            { pattern: /azure/i, name: 'Azure' },
            { pattern: /docker/i, name: 'Docker' },
            { pattern: /kubernetes|k8s/i, name: 'Kubernetes' },
        ];

        for (const { pattern, name } of platformPatterns) {
            if (pattern.test(lowerReadme)) {
                items.push({ name, category: 'platform' });
            }
        }

        return items;
    }

    private calculateTechStackConfidence(techStack: TechStackItem[]): number {
        if (techStack.length === 0) return 0;

        // Average confidence weighted by source reliability
        let totalWeight = 0;
        let weightedSum = 0;

        for (const item of techStack) {
            const weight = item.source === 'package_file' ? 2 : item.source === 'languages_api' ? 1.5 : 1;
            totalWeight += weight;
            weightedSum += item.confidence * weight;
        }

        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    private extractPurpose(event: RepoEnrichedEvent, project: Project): { purpose: string; confidence: number } {
        // Priority 1: Extract from README first sentence/paragraph
        if (event.payload.readme) {
            const extracted = this.extractPurposeFromReadme(event.payload.readme);
            if (extracted) {
                return { purpose: extracted, confidence: 0.85 };
            }
        }

        // Priority 2: Use description
        if (project.rawData.description) {
            return { purpose: project.rawData.description, confidence: 0.6 };
        }

        // Priority 3: Generate from name and tech stack
        if (project.techStack.length > 0) {
            const frameworks = project.techStack
                .filter(t => t.category === 'framework')
                .map(t => t.name);

            if (frameworks.length > 0) {
                return {
                    purpose: `A ${frameworks[0]} project`,
                    confidence: 0.3,
                };
            }
        }

        return { purpose: 'Purpose not detected', confidence: 0 };
    }

    private extractPurposeFromReadme(readme: string): string | null {
        // Skip common header patterns
        const lines = readme.split('\n');
        let inHeader = true;
        let firstParagraph = '';

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip badges, headers, and empty lines at start
            if (inHeader) {
                if (
                    trimmed.startsWith('#') ||
                    trimmed.startsWith('!') ||
                    trimmed.startsWith('[') ||
                    trimmed.startsWith('<!--') ||
                    trimmed === '' ||
                    /^\*\*[^*]+\*\*$/.test(trimmed) // Bold-only lines
                ) {
                    continue;
                }
                inHeader = false;
            }

            if (trimmed === '') {
                if (firstParagraph) break;
                continue;
            }

            firstParagraph += (firstParagraph ? ' ' : '') + trimmed;
        }

        if (!firstParagraph) return null;

        // Clean up and truncate
        const cleaned = firstParagraph
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
            .replace(/`[^`]+`/g, match => match.slice(1, -1)) // Remove code backticks
            .trim();

        // Take first 2-3 sentences
        const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
        const purpose = sentences.slice(0, 2).join(' ').trim();

        // Limit length
        if (purpose.length > 300) {
            return purpose.slice(0, 297) + '...';
        }

        return purpose || null;
    }
}
