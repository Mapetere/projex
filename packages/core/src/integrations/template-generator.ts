/**
 * Template Generator - Creates project cards matching the detected portfolio style
 */

import type { Project, PortfolioDraft } from '../events/types.js';
import type { PortfolioAnalysis, CardTemplate } from './analyzer.js';

export interface GeneratedCard {
    html: string;
    markdown: string;
    react: string;
}

export class TemplateGenerator {
    private analysis: PortfolioAnalysis;

    constructor(analysis: PortfolioAnalysis) {
        this.analysis = analysis;
    }

    /**
     * Generate a project card in all formats
     */
    generate(project: Project): GeneratedCard {
        const draft = project.portfolioDraft;
        if (!draft) {
            throw new Error(`Project ${project.id} has no portfolio draft`);
        }

        return {
            html: this.generateHTML(project, draft),
            markdown: this.generateMarkdown(project, draft),
            react: this.generateReact(project, draft),
        };
    }

    /**
     * Generate HTML card matching detected template
     */
    private generateHTML(project: Project, draft: PortfolioDraft): string {
        const { cardTemplate } = this.analysis;

        // If we have a detected template, clone and fill it
        if (cardTemplate) {
            return this.fillTemplate(cardTemplate, project, draft);
        }

        // Otherwise use a styled default
        return this.generateDefaultHTML(project, draft);
    }

    /**
     * Fill detected template with project data
     */
    private fillTemplate(template: CardTemplate, project: Project, draft: PortfolioDraft): string {
        let html = template.html;

        // Common placeholder patterns
        const replacements: Record<string, string> = {
            // Title patterns
            '{{title}}': draft.title,
            '{{name}}': draft.title,
            '{{project.title}}': draft.title,
            '{{project.name}}': draft.title,

            // Description patterns
            '{{description}}': draft.description,
            '{{summary}}': draft.tagline,
            '{{project.description}}': draft.description,

            // URL patterns
            '{{url}}': draft.githubUrl,
            '{{link}}': draft.githubUrl,
            '{{github}}': draft.githubUrl,
            '{{project.url}}': draft.githubUrl,

            // Tech stack
            '{{tech}}': draft.techStack.join(', '),
            '{{technologies}}': draft.techStack.join(', '),
            '{{stack}}': draft.techStack.join(', '),
        };

        // Apply replacements
        for (const [pattern, value] of Object.entries(replacements)) {
            html = html.replace(new RegExp(this.escapeRegex(pattern), 'gi'), value);
        }

        // Handle tech stack lists
        if (html.includes('{{#each tech}}') || html.includes('{{#tech}}')) {
            const techListHTML = draft.techStack
                .map(tech => `<span class="tech-tag">${tech}</span>`)
                .join('\n');
            html = html.replace(/\{\{#each tech\}\}[\s\S]*?\{\{\/each\}\}/gi, techListHTML);
            html = html.replace(/\{\{#tech\}\}[\s\S]*?\{\{\/tech\}\}/gi, techListHTML);
        }

        return html;
    }

    /**
     * Generate default HTML card with detected styles
     */
    private generateDefaultHTML(project: Project, draft: PortfolioDraft): string {
        const { colors, typography, cssVariables } = this.analysis;

        // Build inline styles from detected palette
        const primaryColor = cssVariables['--primary'] || colors.primary[0] || '#0ea5e9';
        const bgColor = cssVariables['--bg-card'] || colors.background[0] || '#1e293b';
        const textColor = cssVariables['--text'] || colors.text[0] || '#f8fafc';
        const font = typography.bodyFont || 'system-ui, sans-serif';

        const techBadges = draft.techStack
            .map(tech => `<span style="display: inline-block; padding: 4px 12px; background: ${primaryColor}22; color: ${primaryColor}; border-radius: 9999px; font-size: 12px; margin: 4px;">${tech}</span>`)
            .join('\n        ');

        return `<article class="project-card" style="background: ${bgColor}; border-radius: 12px; padding: 24px; font-family: ${font}; color: ${textColor};">
  <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">${draft.title}</h3>
  <p style="margin: 0 0 16px 0; color: ${textColor}99; font-size: 14px;">${draft.tagline}</p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;">${draft.description}</p>
  <div style="margin-bottom: 16px;">
    ${techBadges}
  </div>
  <a href="${draft.githubUrl}" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; color: ${primaryColor}; text-decoration: none; font-weight: 500;">
    View on GitHub →
  </a>
</article>`;
    }

    /**
     * Generate Markdown card
     */
    private generateMarkdown(project: Project, draft: PortfolioDraft): string {
        const techList = draft.techStack.map(t => `\`${t}\``).join(' · ');
        const highlights = draft.highlights.length > 0
            ? '\n\n**Highlights:**\n' + draft.highlights.map(h => `- ${h}`).join('\n')
            : '';

        return `### ${draft.title}

${draft.tagline}

${draft.description}

**Tech Stack:** ${techList}
${highlights}

[View on GitHub](${draft.githubUrl})

---`;
    }

    /**
     * Generate React/JSX component
     */
    private generateReact(project: Project, draft: PortfolioDraft): string {
        const techArray = JSON.stringify(draft.techStack);

        return `<ProjectCard
  title="${this.escapeJSX(draft.title)}"
  tagline="${this.escapeJSX(draft.tagline)}"
  description="${this.escapeJSX(draft.description)}"
  techStack={${techArray}}
  githubUrl="${draft.githubUrl}"
  ${draft.liveUrl ? `liveUrl="${draft.liveUrl}"` : ''}
/>`;
    }

    /**
     * Generate a generic ProjectCard component definition
     */
    generateProjectCardComponent(): string {
        const { colors, typography, cssVariables } = this.analysis;
        const primaryColor = cssVariables['--primary'] || colors.primary[0] || '#0ea5e9';

        return `interface ProjectCardProps {
  title: string;
  tagline: string;
  description: string;
  techStack: string[];
  githubUrl: string;
  liveUrl?: string;
}

export function ProjectCard({ title, tagline, description, techStack, githubUrl, liveUrl }: ProjectCardProps) {
  return (
    <article className="project-card bg-surface-800 rounded-xl p-6 hover:bg-surface-700 transition-colors">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-surface-400 text-sm mb-4">{tagline}</p>
      <p className="text-surface-200 mb-4">{description}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {techStack.map((tech) => (
          <span key={tech} className="px-3 py-1 text-xs rounded-full bg-primary-500/20 text-primary-400">
            {tech}
          </span>
        ))}
      </div>
      <div className="flex gap-4">
        <a href={githubUrl} target="_blank" rel="noopener" className="text-primary-400 hover:underline">
          GitHub →
        </a>
        {liveUrl && (
          <a href={liveUrl} target="_blank" rel="noopener" className="text-primary-400 hover:underline">
            Live Demo →
          </a>
        )}
      </div>
    </article>
  );
}`;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private escapeJSX(str: string): string {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n');
    }
}
