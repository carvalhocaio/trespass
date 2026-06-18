# Trespass — Claude Agents & Skills

**Trespass** is an adversarial prompt-injection testing service. The Python agent (`agent/`) uses Google ADK to generate multi-turn attack probes against an LLM target endpoint, then returns a structured result to the caller (Hono backend).

Stack: **Python 3.12 · FastAPI · Google ADK · Pydantic v2 · httpx · uv · Ruff · mypy · pytest**

## Agent workflow

For any implementation task (new feature, bugfix, refactor, or any task that requires writing or modifying code), always invoke the `tech-lead` agent first. It will plan the execution and delegate to the correct specialist agents in the right order.

Do NOT invoke `tech-lead` for:
- `/commit` — run manually when you're ready to commit
- `/pr-description` — run manually when opening a PR
- `/changelog` — run manually when preparing a release
- `/docs` — run manually when documentation changes are needed

## How agents work

Agents are invoked as subagents via the `Task` tool or by calling them by name in Claude Code. Each agent has a focused role and a defined set of tools.

Start complex tasks with `tech-lead` — it will orchestrate the right agents in the right order. For simple tasks, call specialist agents directly.

## How skills work

Skills are invoked with `/skill-name` in the Claude Code prompt. Some skills accept an optional argument: `/commit`, `/review path/to/file`, `/changelog v1.3.0`.

**Convention skills** (`python-conventions`, `api-conventions`) are **path-based** — they activate automatically when Claude reads or writes files matching their `paths` patterns. They are never invoked manually.

## Agents

| Agent              | Invoke as       | Role                                                   |
| ------------------ | --------------- | ------------------------------------------------------ |
| `tech-lead`        | subagent / name | Orchestrates complex tasks, delegates, validates gates |
| `backend-engineer` | subagent / name | Implements Python/FastAPI code, ADK agent logic        |

## Skills

| Skill             | Invoke as          | Role                                                    |
| ----------------- | ------------------ | ------------------------------------------------------- |
| `commit`          | `/commit`          | Git commit following Conventional Commits               |
| `review`          | `/review`          | Code review: Clean Code + SOLID, by severity            |
| `security-review` | `/security-review` | Security-focused review: injection, auth, data exposure |
| `test`            | `/test`            | Generates or updates tests for changed code             |
| `pr-description`  | `/pr-description`  | Generates a complete PR description                     |
| `changelog`       | `/changelog`       | Generates or updates CHANGELOG.md                       |
| `docs`            | `/docs`            | Generates or updates README and other .md docs          |

## Convention skills (auto-loaded)

| Skill                | Activates on                                   |
| -------------------- | ---------------------------------------------- |
| `python-conventions` | `**/*.py`                                      |
| `api-conventions`    | `**/routes/**`, `**/api/**`, `**/handlers/**`… |

## Recommended flow for a new task

```
tech-lead
  └─ backend-engineer  (implements)
  └─ test              (generates tests)
  └─ review            (code quality gate)
  └─ security-review   (always — this service has LLM + external I/O surface)
  └─ commit            (finalizes commit)
  └─ pr-description    (when opening PR)
```

For releases: `changelog` → `docs` (if needed) → `commit`.
