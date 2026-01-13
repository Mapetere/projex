# Projex Legacy

> ⚠️ **ARCHIVED** — This is the legacy/prototype version of Projex. It served as an exploration phase for automating portfolio updates. The project has been rebuilt from scratch as [Projex v1](https://github.com/Mapetere/projex), which takes a fundamentally different approach as a *project observability probe* rather than a portfolio manager.

---

> Automatically infer projects from GitHub activity and generate portfolio entries.

[![npm version](https://img.shields.io/npm/v/projex-legacy-cli.svg)](https://www.npmjs.com/package/projex-legacy-cli)

## Installation

```bash
# Install globally
npm install -g projex-legacy-cli

# Or use npx
npx projex-legacy-cli setup
```

## Quick Start

```bash
# 1. Run the setup wizard
projex-legacy setup

# 2. Scan your GitHub for projects
projex-legacy scan

# 3. Review pending portfolio drafts
projex-legacy drafts

# 4. Approve and inject into your portfolio
projex-legacy approve github:username/repo-name
```

## Commands

| Command | Description |
|---------|-------------|
| `projex-legacy setup` | Interactive setup wizard |
| `projex-legacy scan` | Scan GitHub for projects |
| `projex-legacy list` | List all detected projects |
| `projex-legacy drafts` | Show pending portfolio drafts |
| `projex-legacy approve <id>` | Approve draft and inject into portfolio |
| `projex-legacy export` | Export approved entries as JSON |

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
