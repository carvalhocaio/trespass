# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.12.7] - 2026-06-21

### Fixed

- Google Gemini API key is now sent via the `x-goog-api-key` header instead of a URL query parameter, preventing accidental credential exposure in proxy and server logs. (`#a80da33`)
- LLM file analysis is now capped at 5 chunks (~30 KB) per file, preventing unbounded API calls on very large files. (`#a80da33`)
- Secrets scanner now resets regex state before each match, guarding against false negatives from stateful regular expressions. (`#a80da33`)

## [1.12.6] - 2026-06-21

### Improved

- LLM code review phase now runs up to 5 files concurrently, honours scan cancellation mid-phase, and is capped at 3 minutes total — dramatically reducing scan time for large repositories. (`#b354ff0`)

## [1.12.5] - 2026-06-21

### Fixed

- Dependency scanner no longer reports false positives for packages using pnpm `catalog:` or `workspace:` version specifiers — those entries are now skipped instead of being sent to OSV.dev with an empty version. (`#66537ed`)

## [1.12.4] - 2026-06-21

### Fixed

- SAST scanner no longer flags its own pattern metadata for `debugger`, `TODO`, `FIXME`, `HACK`, and `secur` keywords — all remaining self-reported false positives eliminated. (`#37cb9fd`)

## [1.12.3] - 2026-06-21

### Fixed

- SAST scanner no longer flags its own pattern metadata strings (title, description, regex) for `console.log` and `TODO/FIXME` patterns. (`#d9d24cc`)
- Server startup message now uses `process.stdout.write` instead of `console.log`, eliminating a self-reported SAST finding in production code. (`#410a9f4`)

## [1.12.2] - 2026-06-21

### Fixed

- SAST scanner no longer flags its own pattern metadata strings (title, description, remediation) for `dangerouslySetInnerHTML` and `Math.random()` patterns. (`#830371a`, `#e083b7b`)

## [1.12.1] - 2026-06-21

### Improved

- Test suite fixtures no longer cause the scanner to report false positives when scanning this repository itself. (`#97d17b5`…`#248b2ff`)

## [1.12.0] - 2026-06-21

### Fixed

- SAST scanner no longer flags `RegExp.prototype.exec()` method calls as potential shell command injection — only standalone `exec()`/`execSync()` calls are detected. (`#764f5b4`, `#7f9e267`)
- SAST scanner no longer flags `eval` appearing inside string literals or documentation text — only actual `eval(expression)` calls in code are detected. (`#15ea3d4`, `#007d0bd`, `#8b73367`)

## [1.11.0] - 2026-06-20

### Fixed
- Scans no longer interrupted mid-execution — migrated from Vercel serverless to Railway (persistent Node.js process), eliminating the platform timeout that killed long-running and LLM-assisted scans. (#c87ce5b)
- Inconsistent dark background tone across pages — content area now uses a uniform color, removing the visible contrast between card sections and empty page space. (#676141c)

## [1.10.2] - 2026-06-19

### Fixed
- Browser notifications now display the Trespass shield icon instead of the default Nuxt favicon.

## [1.10.1] - 2026-06-19

### Improved
- LLM opt-in dialog extracted into a shared `ScanLlmDialog` component used by both Scan and Re-scan — buttons are now consistent size and the close (×) icon is removed since "No, skip" covers that action.

## [1.10.0] - 2026-06-19

### Added
- LLM review is now opt-in per scan — when an LLM is configured, clicking "Scan" or "Re-scan" opens a dialog asking "No, skip" or "Yes, include" before starting. Without LLM configured the scan starts immediately with no extra click.

### Fixed
- Dialog close button no longer overlaps the title text on long repository names — title now truncates with right padding.

## [1.9.0] - 2026-06-19

### Added
- Notificações nativas do sistema operacional ao término de um scan — exibe o repositório, contagem de findings críticos/altos e status (concluído, falhou, cancelado). Solicita permissão ao iniciar um scan.

### Fixed
- Timer de duração na tela do scan agora atualiza segundo a segundo em vez de saltar a cada 3 s — tick independente do polling.
- Timeout forçado de 4 minutos (`Promise.race`) removido da rota `POST /api/scans` — o scan agora roda até conclusão completa incluindo LLM review; scans realmente presos são detectados pelo `STUCK_THRESHOLD_MS` de 10 min.
- Header e footer alinhados à mesma largura máxima (`max-w-5xl`) que o conteúdo principal.
- Pool de conexões PostgreSQL migrado para singleton com configurações otimizadas para o Neon free tier (`max: 3`, `idleTimeoutMillis: 240 s`, `connectionTimeoutMillis: 30 s`) — elimina `ETIMEDOUT` por pool exaurido sob carga concorrente.
- Guards de processo (`unhandledRejection` / `uncaughtException`) adicionados ao servidor — erros inesperados são logados sem derrubar o processo; exceções não capturadas encerram com `exit(1)` para reinício limpo pelo supervisor.
- Configuração SSL do banco corrigida para `sslmode=verify-full`. (#2e94dfa)
- Servidor Hono não conflita mais com a porta 3000 quando embutido como middleware Nuxt. (#bf64e01)

### Documentation
- Variáveis de ambiente atualizadas na documentação. (#e72f1ae)

## [1.8.1] - 2026-06-19

### Fixed
- Scans que travavam permanentemente em "running" após timeout do processo agora são marcados como `error` automaticamente — inclui timeout por chamada LLM (60 s), timeout global do scan (4 min) e detecção lazy de processos órfãos. (#de6d1e8)

## [1.8.0] - 2026-06-18

### Fixed
- "Stop Scan" agora para o scan imediatamente ao pressionar o botão — o scanner verifica o cancelamento antes de cada arquivo no loop, em vez de apenas entre fases. O passo "Scanning code patterns..." agora exibe ✗ interrupted ao ser interrompido. (#a5e7671)

## [1.7.0] - 2026-06-18

### Added
- Scans em andamento (`running`) no dashboard agora exibem um link "View →" que navega para a tela de detalhes em tempo real — antes só aparecia o texto "Scanning..." sem navegação possível.
- Novo botão "Stop Scan" na tela de detalhes do scan — cancela imediatamente qualquer scan em fila ou em andamento, com feedback visual e mensagem no terminal do progresso.

### Improved
- Novo status `cancelled` no ciclo de vida do scan (além de `queued`, `running`, `done`, `error`) — o scanner verifica o cancelamento entre fases e não sobrescreve o status caso o scan já tenha terminado (proteção contra race condition).

## [1.6.0] - 2026-06-18

### Improved
- GitHub Actions CI pipeline now runs typecheck, lint, and 108 automated tests on every pull request and push to main. (#d61d394)
- GitHub Actions release workflow automatically creates a GitHub Release with notes on every version tag push. (#d61d394)

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
