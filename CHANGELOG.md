# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
