/**
 * GitHub API client wrapper using Octokit.
 * Provides typed access to repository data and events.
 */

import { Octokit } from '@octokit/rest';
import type { PackageFileInfo } from '../events/types.js';

export interface GitHubRepoData {
    id: number;
    name: string;
    fullName: string;
    owner: string;
    url: string;
    description: string | null;
    topics: string[];
    isPrivate: boolean;
    isArchived: boolean;
    defaultBranch: string;
    createdAt: Date;
    updatedAt: Date;
    pushedAt: Date | null;
    starCount: number;
    forkCount: number;
}

export interface GitHubEnrichmentData {
    languages: Record<string, number>;
    readme: string | null;
    packageFiles: PackageFileInfo[];
}

export class GitHubClient {
    private octokit: Octokit;
    private username: string;

    constructor(token: string, username: string) {
        this.octokit = new Octokit({ auth: token });
        this.username = username;
    }

    /**
     * Fetch all repositories for the configured user
     */
    async listUserRepos(): Promise<GitHubRepoData[]> {
        const repos: GitHubRepoData[] = [];

        // Paginate through all repos
        for await (const response of this.octokit.paginate.iterator(
            this.octokit.repos.listForAuthenticatedUser,
            { per_page: 100, sort: 'updated' }
        )) {
            for (const repo of response.data) {
                repos.push({
                    id: repo.id,
                    name: repo.name,
                    fullName: repo.full_name,
                    owner: repo.owner?.login ?? this.username,
                    url: repo.html_url,
                    description: repo.description,
                    topics: repo.topics ?? [],
                    isPrivate: repo.private,
                    isArchived: repo.archived ?? false,
                    defaultBranch: repo.default_branch,
                    createdAt: new Date(repo.created_at!),
                    updatedAt: new Date(repo.updated_at!),
                    pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
                    starCount: repo.stargazers_count ?? 0,
                    forkCount: repo.forks_count ?? 0,
                });
            }
        }

        return repos;
    }

    /**
     * Get detailed repo info including topics
     */
    async getRepo(owner: string, repo: string): Promise<GitHubRepoData> {
        const { data } = await this.octokit.repos.get({ owner, repo });

        return {
            id: data.id,
            name: data.name,
            fullName: data.full_name,
            owner: data.owner.login,
            url: data.html_url,
            description: data.description,
            topics: data.topics ?? [],
            isPrivate: data.private,
            isArchived: data.archived,
            defaultBranch: data.default_branch,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
            pushedAt: data.pushed_at ? new Date(data.pushed_at) : null,
            starCount: data.stargazers_count ?? 0,
            forkCount: data.forks_count ?? 0,
        };
    }

    /**
     * Fetch enrichment data: languages, readme, package files
     */
    async getEnrichmentData(owner: string, repo: string): Promise<GitHubEnrichmentData> {
        const [languages, readme, packageFiles] = await Promise.all([
            this.getLanguages(owner, repo),
            this.getReadme(owner, repo),
            this.getPackageFiles(owner, repo),
        ]);

        return { languages, readme, packageFiles };
    }

    private async getLanguages(owner: string, repo: string): Promise<Record<string, number>> {
        try {
            const { data } = await this.octokit.repos.listLanguages({ owner, repo });
            return data;
        } catch {
            return {};
        }
    }

    private async getReadme(owner: string, repo: string): Promise<string | null> {
        try {
            const { data } = await this.octokit.repos.getReadme({ owner, repo });
            // Decode base64 content
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            return content;
        } catch {
            return null;
        }
    }

    private async getPackageFiles(owner: string, repo: string): Promise<PackageFileInfo[]> {
        const packageFiles: PackageFileInfo[] = [];

        // Check for common package files
        const filesToCheck = [
            { path: 'package.json', type: 'npm' as const },
            { path: 'Cargo.toml', type: 'cargo' as const },
            { path: 'requirements.txt', type: 'pip' as const },
            { path: 'pyproject.toml', type: 'pip' as const },
            { path: 'go.mod', type: 'go' as const },
            { path: 'Gemfile', type: 'gem' as const },
            { path: 'composer.json', type: 'composer' as const },
        ];

        for (const file of filesToCheck) {
            try {
                const { data } = await this.octokit.repos.getContent({
                    owner,
                    repo,
                    path: file.path,
                });

                if ('content' in data) {
                    const content = Buffer.from(data.content, 'base64').toString('utf-8');
                    const parsed = this.parsePackageFile(file.type, content);
                    if (parsed) {
                        packageFiles.push({
                            type: file.type,
                            filename: file.path,
                            dependencies: parsed.dependencies,
                            devDependencies: parsed.devDependencies,
                        });
                    }
                }
            } catch {
                // File doesn't exist, skip
            }
        }

        return packageFiles;
    }

    private parsePackageFile(type: PackageFileInfo['type'], content: string): { dependencies: string[]; devDependencies: string[] } | null {
        try {
            switch (type) {
                case 'npm': {
                    const pkg = JSON.parse(content);
                    return {
                        dependencies: Object.keys(pkg.dependencies ?? {}),
                        devDependencies: Object.keys(pkg.devDependencies ?? {}),
                    };
                }
                case 'pip': {
                    // Simple requirements.txt parsing
                    const deps = content
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line && !line.startsWith('#'))
                        .map(line => line.split(/[=<>!]/)[0].trim());
                    return { dependencies: deps, devDependencies: [] };
                }
                case 'cargo': {
                    // Basic Cargo.toml parsing (extract dependency names)
                    const depMatches = content.match(/^\[dependencies\][\s\S]*?(?=\n\[|$)/m);
                    const deps: string[] = [];
                    if (depMatches) {
                        const lines = depMatches[0].split('\n');
                        for (const line of lines) {
                            const match = line.match(/^(\w[\w-]*)\s*=/);
                            if (match) deps.push(match[1]);
                        }
                    }
                    return { dependencies: deps, devDependencies: [] };
                }
                case 'go': {
                    // Extract require statements from go.mod
                    const deps: string[] = [];
                    const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/);
                    if (requireBlock) {
                        const lines = requireBlock[1].split('\n');
                        for (const line of lines) {
                            const match = line.trim().match(/^([^\s]+)\s+/);
                            if (match) deps.push(match[1]);
                        }
                    }
                    return { dependencies: deps, devDependencies: [] };
                }
                default:
                    return { dependencies: [], devDependencies: [] };
            }
        } catch {
            return null;
        }
    }

    /**
     * Get recent commits for activity tracking
     */
    async getRecentCommits(owner: string, repo: string, since?: Date): Promise<{ sha: string; date: Date }[]> {
        try {
            const params: Parameters<typeof this.octokit.repos.listCommits>[0] = {
                owner,
                repo,
                per_page: 30,
            };
            if (since) {
                params.since = since.toISOString();
            }

            const { data } = await this.octokit.repos.listCommits(params);

            return data.map(commit => ({
                sha: commit.sha,
                date: new Date(commit.commit.committer?.date ?? commit.commit.author?.date ?? new Date()),
            }));
        } catch {
            return [];
        }
    }
}
