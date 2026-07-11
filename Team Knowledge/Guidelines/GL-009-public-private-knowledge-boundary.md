# GL-009 - Public/private knowledge boundary

## Purpose

This repository may be public during the myPKA/Fusion247Brain merge and testing phase. Team Knowledge can describe architecture, process, and acceptance criteria publicly; Warwick's personal context should remain in the local/private PKM layer unless he explicitly approves a specific publication.

## Public by default

- Team contracts and adapter shims.
- SOPs, Workstreams, Guidelines, templates, and architecture tasks.
- Abstract session-log records that describe decisions without embedding personal evidence.
- Public-facing examples that do not reveal Warwick's journal content, current state, or private preferences.

## Private/local by default

- Journal entries.
- "About Warwick" and current-context views.
- Detailed personal aims, day-state, preferences, health or neurodivergence-related context, and lived experience.
- Personal evidence used to tune source valuation, agent routing, or retrieval.

## Operating rule

When a public architecture change depends on personal context, record the mechanism publicly and keep the personal evidence local. Link abstractly where needed. Do not commit the personal evidence to a public branch unless Warwick explicitly approves that exact publication in the current session.

## Git rule

`.gitignore` excludes the main local/private context surfaces while the repository remains public. `.gitignore` does not protect content that has already been committed, so personal material must be kept out of public commit history before pushing.
