# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.1] - 2026-06-18

### Improved
- Removed unused Python/FastAPI agent scaffolding — the repository is now a pure TypeScript monorepo. (#af5e994)

## [1.5.0] - 2026-06-18

### Added
- Terminal-style progress panel on the scan results page — shows each scan phase in real time (dependency audit, file tree fetch, code pattern scan, optional LLM review) with step counts, ✓/△/✗ icons, and a final severity summary line. Progress is persisted in a new `progress` column on the `scan` table (JSONB) so refreshing the page mid-scan retains state.

## [1.4.0] - 2026-06-18

### Added
- "Open GitHub Issue" button inside each expanded finding on the scan results page — opens a new tab on GitHub with title and body pre-filled (severity, category, file, snippet, remediation). Zero backend changes; uses GitHub's `/issues/new?title=&body=` pre-fill URL.

## [1.3.0] - 2026-06-18

### Added
- Re-scan button on the scan results page — creates a new scan for the same repository and navigates to the fresh result immediately. Disabled while a scan is already running.

### Fixed
- Scan results page was blank because `GET /api/scans/:id` returned the raw scan row without joining the repository; it now includes `repo.fullName` and `repo.htmlUrl`.
- `POST /api/scans` response was not wrapped in `{ scan }`, causing the dashboard to fail to navigate to the new scan page.

## [1.2.0] - 2026-06-18

### Added
- Dashboard now shows the latest scan summary per repository (critical / high / medium counts, or "Clean") fetched in a single additional query on `GET /api/repos`.
- Repository search input on the Dashboard — same case-insensitive client-side filter as the Repos page.
- Scan can be triggered directly from the Dashboard per repository row.

### Removed
- `/repos` page removed — all repository management (sync, search, scan) is now consolidated in `/dashboard`. The Repos nav link is gone.

## [1.1.0] - 2026-06-18

### Added
- Repository search input on the Repos page — filters by name client-side with case-insensitive matching; shows a "no match" state when the query returns nothing.
- Global `cursor: pointer` for all button elements via a base CSS rule — no per-component class needed.

### Fixed
- Repos page was reading `res.repos` from the API response when the server returns a plain array, so the list was always empty after sync.
- GitHub OAuth redirect landed on `localhost:3000/dashboard` (Hono) instead of the frontend; `callbackURL` now uses the page's own origin so the redirect always goes to the correct port.

### Improved
- Login page redesigned as a borderless, minimal layout — GitHub OAuth only, no email/password form.

## [1.0.0] - 2026-06-18

### Added
- GitHub repository security scanner with four analysis layers: hardcoded secrets detection, SAST patterns (SQL injection, eval, XSS, command injection, weak crypto), dependency CVE auditing via OSV.dev, and optional LLM-powered code review using your own API key. (#dc9d30d)
- OAuth and email/password authentication powered by Better-Auth, with GitHub OAuth as the primary login method. (#dc9d30d)
- Encrypted-at-rest storage for GitHub Personal Access Tokens and LLM API keys using AES-256-GCM. (#dc9d30d)
- REST API covering repository sync from GitHub, full scan lifecycle (create, poll, results), and secrets management — all routes protected by session middleware. (#dc9d30d)
- Nuxt 4 frontend with dark hacker aesthetic: landing page, dashboard, repository list, scan results with per-severity breakdown and expandable findings, and a settings page for API key configuration. (#dc9d30d)
- Google ADK adversarial probe generation agent (Python / FastAPI) as the foundation for LLM endpoint testing in a future release. (#9aa24f1)
- SVG favicon using the Shield brand icon, Host Grotesk as the body typeface, and a version badge in the landing page footer.

### Fixed
- `NPM_VERSION_STRIP_RE` regex stripped all `^`-prefixed npm versions to empty strings, causing OSV dependency-audit queries to silently return zero results for most packages.
- Dependency findings always received `null` file attribution due to a manifest type comparison that could never be true; findings now correctly resolve to `package.json` or `requirements.txt`.
- Unexpected errors in the background scan job were silently dropped via `console.error` without updating the scan row; the fallback now writes `status: "error"` to the database.
- `db2` naming inconsistency in the secrets route; all handlers now create per-request database connections uniformly.
