# YDB Installer Agent Guide

This file defines the project-level guidance for coding agents. Keep it concise and defer detailed product rules to the source documents.

## Source Of Truth

- Product behavior and acceptance criteria: `SPECIFICATION.md`
- Target design and preferred implementation shape: `ARCHITECTURE.md`

When a change depends on requirements, cite the relevant requirement ID or section instead of restating the document. If guidance conflicts, follow this order:

1. `SPECIFICATION.md`
2. `ARCHITECTURE.md`
3. this file
4. local code comments and nearby conventions

## Project Invariants

- Preserve the copy-and-use deployment model; do not make external infrastructure mandatory for baseline operation.
- Keep backend and REST API work in `Go`.
- Keep UI work in `React` and `TypeScript`, using `ydb-ui-components` as the primary UI library.
- Treat the public REST API as the contract between UI and backend; do not add private UI-only backend paths.
- Prefer direct `Go` orchestration and reusable `ydbops` integration over mandatory `Ansible`, `Python`, or subprocess-heavy execution paths.
- Keep workflow changes aligned with the persisted phase model from the specification.
- Follow the product safety rule: discover first, validate early, destroy late.
- Avoid logging or exposing secrets in errors, logs, reports, fixtures, or tests.

## Working Conventions

- Change source files, not generated assets. For UI changes, edit `ui/src` and related source files rather than `ui/dist` or `cmd/installer/web`.
- Keep operator-facing UI text localizable via resource files, with English fallback. Keep REST API messages and logs in English.
- Prefer small, explicit package boundaries that match `ARCHITECTURE.md` (`api`, `app`, `domain`, `execution`, `discovery`, `storage`, `security`, `artifacts`, `ui`).
- When implementing behavior, reference the requirement IDs you are satisfying in PRs, commit messages, design notes, or code comments where helpful.

## Cursor Rules

Cursor-specific always-on and file-scoped rules live in `.cursor/rules/`. Keep those rules short and reference this file plus the two source documents instead of duplicating them.
