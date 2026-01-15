/**
 * Projex v1 - Core Type Definitions
 * 
 * Data model for a CLI-based project observability probe
 * that infers probable projects from GitHub activity.
 */

// =============================================================================
// RAW SIGNAL (Append-Only Facts)
// =============================================================================

/**
 * GitHub signal types supported in v1.
 * Each represents an observable artifact of work.
 */
export type GitHubSignalType =
    | "commit"
    | "pull_request"
    | "issue_comment"
    | "branch_create";

/**
 * An immutable, append-only record of observed GitHub activity.
 * These are facts, not interpretations.
 */
export interface RawSignal {
    /** UUID, locally generated, immutable */
    id: string;

    /** ISO 8601 timestamp of when the event occurred on GitHub */
    capturedAt: string;

    /** Signal source - fixed to "github" for v1 */
    source: "github";

    /** Type of GitHub activity observed */
    signalType: GitHubSignalType;

    /** Raw GitHub API response fragment, preserved for auditability */
    payload: Record<string, unknown>;

    // Provenance

    /** API endpoint used to fetch this signal, e.g., "/repos/{owner}/{repo}/commits" */
    apiEndpoint: string;

    /** ISO 8601 timestamp of when we fetched this from GitHub */
    fetchedAt: string;

    /** GitHub repository in "owner/repo" format */
    repository: string;
}

// =============================================================================
// INFERRED PROJECT (Probabilistic Entity)
// =============================================================================

/**
 * Confidence levels for human readability.
 * Maps to numeric ranges: low (<0.4), medium (0.4-0.7), high (>=0.7)
 */
export type ConfidenceLevel = "low" | "medium" | "high";

/**
 * A probabilistic inference that a repository represents an active project.
 * This is an interpretation, not a fact.
 */
export interface InferredProject {
    /** UUID */
    id: string;

    /** ISO 8601 timestamp of when this inference was made */
    inferredAt: string;

    // Identity (probabilistic)

    /** Best-guess project name (usually repo name) */
    probableName: string;

    /** GitHub repositories contributing to this inference */
    repositories: string[];

    // Confidence

    /** Human-readable confidence level */
    confidence: ConfidenceLevel;

    /** Numeric confidence score, 0.0 - 1.0 */
    confidenceScore: number;

    // Temporal bounds

    /** ISO 8601 timestamp of earliest contributing signal */
    firstSignalAt: string;

    /** ISO 8601 timestamp of latest contributing signal */
    lastSignalAt: string;

    // Linkage

    /** References to RawSignal.id values that contributed */
    contributingSignalIds: string[];

    /** Reference to InferenceReasoning.id */
    reasoningId: string;
}

// =============================================================================
// INFERENCE REASONING (Why the Inference Exists)
// =============================================================================

/**
 * Result of applying a single heuristic to the signal data.
 */
export interface HeuristicResult {
    /** Heuristic identifier, e.g., "burst-activity" */
    heuristicId: string;

    /** Human-readable name of the heuristic */
    heuristicName: string;

    /** Whether this heuristic matched */
    matched: boolean;

    /** Contribution to confidence score (0.0 - 1.0) */
    weight: number;

    /** Specific details about what triggered this heuristic */
    details: string;
}

/**
 * Explicit reasoning chain explaining why an inference exists.
 * Every inference must be explainable.
 */
export interface InferenceReasoning {
    /** UUID */
    id: string;

    /** ISO 8601 timestamp of creation */
    createdAt: string;

    /** Which heuristics were applied and their results */
    heuristicsApplied: HeuristicResult[];

    // Human-readable explanation

    /** One-line summary of the inference reasoning */
    summary: string;

    /** Bullet points of reasoning (array of strings) */
    explanation: string[];

    // Explicit uncertainty

    /** Known limitations of this inference */
    caveats: string[];

    /** Other valid interpretations of the same signals */
    alternativeInterpretations: string[];
}

// =============================================================================
// HEURISTIC DEFINITIONS
// =============================================================================

/**
 * Identifiers for v1 heuristics.
 */
export type HeuristicId =
    | "commit-burst"
    | "pr-activity"
    | "repository-recurrence"
    | "cross-signal-reinforcement"
    | "branch-follow-through";

/**
 * Heuristic configuration (weights and thresholds).
 */
export interface HeuristicConfig {
    id: HeuristicId;
    name: string;
    description: string;
    weight: number;
    enabled: boolean;
}

/**
 * Default heuristic configurations for v1.
 */
export const DEFAULT_HEURISTICS: HeuristicConfig[] = [
    {
        id: "commit-burst",
        name: "Commit Burst Detection",
        description: "3+ commits to the same repository within a 7-day window",
        weight: 0.4,
        enabled: true,
    },
    {
        id: "pr-activity",
        name: "PR Activity Indicator",
        description: "A merged or review-requested PR in the past 14 days",
        weight: 0.3,
        enabled: true,
    },
    {
        id: "repository-recurrence",
        name: "Repository Recurrence",
        description: "Activity on the same repository across 2+ distinct calendar weeks",
        weight: 0.2,
        enabled: true,
    },
    {
        id: "cross-signal-reinforcement",
        name: "Cross-Signal Reinforcement",
        description: "Multiple signal types (commit + PR, or commit + issue comment) on the same repository",
        weight: 0.0, // This is a multiplier (1.3x), not additive
        enabled: true,
    },
    {
        id: "branch-follow-through",
        name: "Branch Initiation + Commits",
        description: "Branch creation followed by 2+ commits to that branch within 5 days",
        weight: 0.3,
        enabled: true,
    },
];

// =============================================================================
// CLI CONFIGURATION
// =============================================================================

/**
 * Configuration for the CLI and inference engine.
 */
export interface ProjexConfig {
    /** GitHub personal access token */
    githubToken?: string;

    /** GitHub username to observe */
    username: string;

    /** Default lookback period in days */
    lookbackDays: number;

    /** Path to signal storage directory */
    signalsDir: string;

    /** Path to draft output directory */
    draftsDir: string;

    /** Confidence thresholds */
    confidenceThresholds: {
        low: number;    // Below this is low confidence
        high: number;   // At or above this is high confidence
    };

    /** Cross-signal reinforcement multiplier */
    crossSignalMultiplier: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: Omit<ProjexConfig, "username" | "githubToken"> = {
    lookbackDays: 14,
    signalsDir: "./signals",
    draftsDir: "./drafts",
    confidenceThresholds: {
        low: 0.4,
        high: 0.7,
    },
    crossSignalMultiplier: 1.3,
};
