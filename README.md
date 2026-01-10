# Nodal Asteroid

An event-driven system that automatically infers software project lifecycle from GitHub activity and generates draft portfolio entries.

## Features

- **Signal Ingestion**: Polls GitHub for repository changes (creates, pushes, archives)
- **Tech Stack Detection**: Analyzes languages, package files, and READMEs to identify frameworks and tools
- **Purpose Extraction**: Extracts project descriptions from READMEs and repository metadata
- **Completion Detection**: Identifies likely completed projects based on 90-day inactivity threshold
- **Portfolio Generation**: Creates draft portfolio entries for review and approval

## Quick Start

```bash
# Install dependencies
npm install

# Set required environment variables
export GITHUB_TOKEN="your-github-token"
export GITHUB_USERNAME="your-username"

# Run a single poll cycle
npm run dev -- poll

# List detected projects
npm run dev -- list

# List pending portfolio drafts
npm run dev -- drafts

# Start continuous polling (60 min interval)
npm run dev -- start
```

## Commands

| Command | Description |
|---------|-------------|
| `poll` | Run a single poll cycle |
| `start` | Start continuous polling |
| `list` | List all detected projects |
| `drafts` | List portfolio drafts pending review |
| `approve <id>` | Approve a portfolio draft |
| `export` | Export approved portfolios as JSON |

## Configuration

Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | (required) | GitHub personal access token |
| `GITHUB_USERNAME` | (required) | Your GitHub username |
| `POLLING_INTERVAL_MINUTES` | 60 | How often to poll GitHub |
| `COMPLETION_THRESHOLD_DAYS` | 90 | Days of inactivity to mark as completed |
| `DATA_DIR` | `./data` | Where to store project data |

## Architecture

```
Signal Ingestion → Event Bus → Inference Engine → Portfolio Generator
     ↓                              ↓
 GitHub API             ProjectDetector, Enricher,
                        LifecycleTracker
```

## License

MIT
