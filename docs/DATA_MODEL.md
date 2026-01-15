# DATA_MODEL.md — Projex v1

> Defines the data structures that flow through Projex.

## Raw Signals (Inputs)

These are **observed facts** from GitHub. No inference, no interpretation.

```typescript
interface RawSignal {
  source: 'github';
  timestamp: string;          // ISO 8601
  type: SignalType;
  data: Record<string, unknown>;
}

type SignalType = 
  | 'repository'              // Repo metadata
  | 'commit'                  // Individual commit
  | 'commit_activity'         // Aggregated commit patterns
  | 'language'                // Detected languages
  | 'readme'                  // README content
  | 'release'                 // Tagged releases
  | 'contributor'             // Contributor data
  | 'topic';                  // Repo topics/tags
```

### Repository Signal
```typescript
{
  type: 'repository',
  data: {
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    pushed_at: string;
    is_fork: boolean;
    is_archived: boolean;
    is_private: boolean;
    stargazers_count: number;
    default_branch: string;
  }
}
```

### Commit Activity Signal
```typescript
{
  type: 'commit_activity',
  data: {
    total_commits: number;
    first_commit_at: string;
    last_commit_at: string;
    commit_frequency: 'burst' | 'steady' | 'sporadic' | 'dormant';
    authors: string[];
  }
}
```

---

## Inferred Entities (Outputs)

These are **conclusions drawn from signals**. Every inference carries:
- **Confidence** — How sure are we? (0.0 to 1.0)
- **Reasoning** — Why do we believe this?
- **Evidence** — What signals support this?

```typescript
interface InferredProject {
  id: string;                   // Stable identifier
  name: string;                 // Human-readable name
  
  // Inference metadata
  confidence: number;           // 0.0 - 1.0
  reasoning: string;            // Human-readable explanation
  evidence: Evidence[];         // Supporting signals
  
  // Inferred properties
  status: ProjectStatus;
  purpose: string | null;       // What does this project do?
  techStack: string[];          // Detected technologies
  timespan: {
    started: string;
    lastActive: string;
  };
  
  // Source references
  repositories: string[];       // GitHub repo full names
}

interface Evidence {
  signal_type: SignalType;
  summary: string;              // "42 commits over 3 months"
  weight: number;               // How much this contributed to confidence
}

type ProjectStatus = 
  | 'active'                    // Recent activity
  | 'maintained'                // Occasional updates
  | 'dormant'                   // No recent activity
  | 'archived'                  // Explicitly archived
  | 'experimental';             // Low confidence, exploratory
```

---

## Confidence Levels

| Range | Label | Meaning |
|-------|-------|---------|
| 0.9 - 1.0 | `definite` | Strong signals, clear project boundary |
| 0.7 - 0.9 | `probable` | Good signals, minor ambiguity |
| 0.5 - 0.7 | `possible` | Mixed signals, notable uncertainty |
| 0.3 - 0.5 | `unclear` | Weak signals, human review recommended |
| 0.0 - 0.3 | `speculative` | Insufficient data, low confidence |

---

## Example Output

```json
{
  "id": "projex-2024",
  "name": "Projex",
  "confidence": 0.85,
  "reasoning": "Single-purpose repository with consistent commit history, clear README, and npm package configuration. High confidence this is a distinct project.",
  "evidence": [
    { "signal_type": "commit_activity", "summary": "127 commits over 4 months", "weight": 0.3 },
    { "signal_type": "readme", "summary": "Describes CLI tool for portfolio automation", "weight": 0.25 },
    { "signal_type": "language", "summary": "TypeScript (94%)", "weight": 0.15 },
    { "signal_type": "repository", "summary": "Not a fork, has releases", "weight": 0.15 }
  ],
  "status": "active",
  "purpose": "CLI tool for inferring GitHub projects and generating portfolio entries",
  "techStack": ["TypeScript", "Node.js"],
  "timespan": {
    "started": "2024-09-15",
    "lastActive": "2025-01-13"
  },
  "repositories": ["Mapetere/projex"]
}
```
