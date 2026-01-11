# Projex

> Automatically infer projects from GitHub activity and generate portfolio entries.

[![npm version](https://img.shields.io/npm/v/projex.svg)](https://www.npmjs.com/package/projex)

## Installation

```bash
# Install globally
npm install -g projex

# Or use npx
npx projex setup
```

## Quick Start

```bash
# 1. Run the setup wizard
projex setup

# 2. Scan your GitHub for projects
projex scan

# 3. Review pending portfolio drafts
projex drafts

# 4. Approve and inject into your portfolio
projex approve github:username/repo-name
```

## Commands

| Command | Description |
|---------|-------------|
| `projex setup` | Interactive setup wizard |
| `projex scan` | Scan GitHub for projects |
| `projex list` | List all detected projects |
| `projex drafts` | Show pending portfolio drafts |
| `projex approve <id>` | Approve draft and inject into portfolio |
| `projex export` | Export approved entries as JSON |

## How It Works

1. **Signal Ingestion** — Polls GitHub for repository activity
2. **Inference Engine** — Detects tech stack, purpose, and completion status
3. **Portfolio Integration** — Analyzes your existing portfolio design and generates matching project cards

```
GitHub Activity → Event Bus → Inference → Portfolio Draft → Your Portfolio
```

## Supported Portfolio Types

- **HTML/CSS** — Injects into index.html, projects.html
- **Markdown** — Appends to README.md, projects.md (Jekyll, Hugo)
- **React/Next.js** — Updates src/data/projects.ts

## Configuration

Config is stored at `~/.projex/config.json`:

```json
{
  "github": {
    "token": "ghp_xxx",
    "username": "your-username",
    "pollingIntervalMinutes": 60
  },
  "portfolio": {
    "path": "/path/to/portfolio",
    "autoCommit": false
  }
}
```

## Desktop App

For a GUI experience with system tray, see [packages/app](./packages/app).

```bash
# Build the Tauri app (requires Rust)
npm run tauri build
```

## License

MIT
