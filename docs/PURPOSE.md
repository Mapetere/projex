# PURPOSE.md — Projex v1

> This document is immutable for v1. If code disagrees with this, code loses.

## What Projex Is

**Projex is a project observability probe.**

It observes development signals from GitHub and infers probable projects with explicit uncertainty.

## Core Principles

1. **Observation, not judgment** — Projex reports what it sees, not whether it's good
2. **Inference, not assertion** — Every conclusion carries confidence and reasoning
3. **Transparency over magic** — Human-readable outputs, deterministic heuristics
4. **Correctness over convenience** — Better to admit uncertainty than fabricate certainty

## The Single Responsibility

Projex answers one question:

> "What projects exist in this GitHub account, and how confident are we about each?"

It does NOT answer:
- "Is this project good?"
- "Should this be in my portfolio?"
- "How productive was I?"

## Success Criteria for v1

Projex v1 is complete when it can:

1. Connect to a GitHub account
2. Observe repository signals (commits, languages, activity patterns)
3. Infer project boundaries with explicit confidence scores
4. Output human-readable drafts with reasoning attached
5. Allow humans to accept, reject, or refine inferences

Nothing more. Nothing less.
