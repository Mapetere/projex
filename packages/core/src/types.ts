/**
 * Core event types for the portfolio inference system.
 * All signals are normalized to these event structures.
 */

// ============================================================================
// Event Types
// ============================================================================

export type EventType =
    | 'repo.created'
    | 'repo.pushed'
    | 'repo.topics_changed'
    | 'repo.description_changed'
    | 'repo.archived'
    | 'repo.enriched';

export interface RepoIdentifier {
    /** Unique ID in format "github:owner/repo" */
    id: string;
    /** Repository name */
    name: string;
    /** Full repository URL */
    url: string;
    /** Owner (user or org) */
    owner: string;
}

export interface BaseEvent {
    eventId: string;
    eventType: EventType;
    timestamp: Date;
    source: 'github';
    repo: RepoIdentifier;
}

export interface RepoCreatedEvent extends BaseEvent {
    eventType: 'repo.created';
    payload: {
        description: string | null;
        topics: string[];
        isPrivate: boolean;
    };
}

export interface RepoPushedEvent extends BaseEvent {
    eventType: 'repo.pushed';
    payload: {
        commitCount: number;
        branch: string;
    };
}

export interface RepoTopicsChangedEvent extends BaseEvent {
    eventType: 'repo.topics_changed';
    payload: {
        topics: string[];
        previousTopics: string[];
    };
}

export interface RepoDescriptionChangedEvent extends BaseEvent {
    eventType: 'repo.description_changed';
    payload: {
        description: string | null;
        previousDescription: string | null;
    };
}

export interface RepoArchivedEvent extends BaseEvent {
    eventType: 'repo.archived';
    payload: {
        archivedAt: Date;
    };
}

export interface RepoEnrichedEvent extends BaseEvent {
    eventType: 'repo.enriched';
    payload: {
        languages: Record<string, number>;
        readme: string | null;
        packageFiles: PackageFileInfo[];
        defaultBranch: string;
        starCount: number;
        forkCount: number;
    };
}

export interface PackageFileInfo {
    type: 'npm' | 'cargo' | 'pip' | 'go' | 'gem' | 'composer';
    filename: string;
    dependencies: string[];
    devDependencies: string[];
}

export type SignalEvent =
    | RepoCreatedEvent
    | RepoPushedEvent
    | RepoTopicsChangedEvent
    | RepoDescriptionChangedEvent
    | RepoArchivedEvent
    | RepoEnrichedEvent;

// ============================================================================
// Project Types
// ============================================================================

export type ProjectStatus = 'ACTIVE' | 'LIKELY_COMPLETED' | 'COMPLETED' | 'ARCHIVED' | 'IGNORED';
export type PortfolioStatus = 'NONE' | 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface TechStackItem {
    name: string;
    category: 'language' | 'framework' | 'library' | 'tool' | 'platform';
    confidence: number;
    source: 'languages_api' | 'package_file' | 'readme' | 'topics';
}

export interface Project {
    /** Unique ID: "github:owner/repo" */
    id: string;
    name: string;
    displayName: string;
    owner: string;
    url: string;

    status: ProjectStatus;
    isPrivate: boolean;

    // Inferred data
    purpose: string | null;
    techStack: TechStackItem[];
    topics: string[];

    // Timeline
    startDate: Date;
    lastActivityDate: Date;
    completionDate: Date | null;

    // Confidence scores (0-1)
    confidence: {
        purpose: number;
        techStack: number;
        completion: number;
    };

    // Raw data for re-inference
    rawData: {
        description: string | null;
        readme: string | null;
        languages: Record<string, number>;
        packageFiles: PackageFileInfo[];
    };

    // Portfolio
    portfolioStatus: PortfolioStatus;
    portfolioDraft: PortfolioDraft | null;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
}

export interface PortfolioDraft {
    title: string;
    tagline: string;
    description: string;
    techStack: string[];
    timelineStart: Date;
    timelineEnd: Date | null;
    highlights: string[];
    githubUrl: string;
    liveUrl: string | null;

    // User modifications
    userEdits: Partial<Omit<PortfolioDraft, 'userEdits' | 'approved' | 'approvedAt'>>;
    approved: boolean;
    approvedAt: Date | null;
}

// ============================================================================
// Configuration
// ============================================================================

export interface Config {
    github: {
        token: string;
        username: string;
        pollingIntervalMinutes: number;
    };
    inference: {
        completionThresholdDays: number;
        minCommitsForCompletion: number;
    };
    storage: {
        dataDir: string;
    };
}
