---
name: python-conventions
description: Python coding conventions for this project — style, typing, async, error handling and FastAPI layering. Auto-loaded when editing .py files.
user-invocable: false
paths:
  - "**/*.py"
---

Apply these conventions whenever you read or write Python files in this project.

## Tooling

- Package manager: `uv` — never use `pip install` directly
- Formatter: `ruff format`
- Linter: `ruff check --fix`
- Type checker: `mypy --strict` — run before considering a file done
- Always run all three before considering a file done
- Max line length: **100 characters** (configured in `pyproject.toml`)

## Imports

- Order: stdlib → third-party → local, each group separated by a blank line
- Never use wildcard imports (`from x import *`)
- Use `from __future__ import annotations` when needed for forward references

## Typing

- Type hints are **mandatory** on all public functions — parameters and return type
- Prefer `X | None` over `Optional[X]`
- Prefer `list[str]` over `List[str]`, `dict[str, int]` over `Dict[str, int]`
- Use `TypeAlias` and `NewType` to make domain concepts explicit
- Avoid `Any` — document with a comment if unavoidable

## Functions and classes

- Functions do one thing; max ~20 lines before considering extraction
- Docstrings on all public functions and classes
- No mutable default arguments (`def f(x=None)` not `def f(x=[])`)
- Constants in `UPPER_SNAKE_CASE` at module level
- Private helpers prefixed with `_`

## Async

- I/O-bound functions are `async def`
- Never call blocking I/O inside `async def` without `run_in_executor`
- Use `asyncio.sleep`, never `time.sleep` in async context
- Use `asyncio.gather` for concurrent independent coroutines

## Error handling

- Create domain-specific exceptions: `class UserNotFoundError(Exception): ...`
- Never silence with bare `except: pass` or `except Exception: pass`
- Use `contextlib.suppress` only for truly harmless errors, with a comment

## FastAPI layering

- **Routes** (`api/`): HTTP only — no business logic inside route functions
- **Orchestrator** (`orchestrator/`): domain logic — never import from `fastapi`
- **Targets** (`targets/`): external I/O only — orchestrator never uses `httpx` directly
- Map domain exceptions to HTTP in exception handlers, not in route functions
- `HTTPException` never leaves the `api/` layer
- Use Pydantic models for all request bodies and responses
- All public models use `ConfigDict(extra="ignore")` to tolerate version skew with callers

## Google ADK (project-specific)

- `attacker/agent.py` wraps ADK — keep it isolated from `api/` and `orchestrator/`
- Configuration always comes from `Settings` (via `get_settings()`) — never hardcode model names or keys
- `SecretStr` fields: access with `.get_secret_value()` only at the I/O call site; never store the result
- `get_settings()` is `@lru_cache` — call `get_settings.cache_clear()` in tests that patch env vars

## Testing (project-specific)

- Use `respx` to mock `httpx` calls — never hit real network endpoints in tests
- `asyncio_mode = "auto"` is configured — no `@pytest.mark.asyncio` needed
- Test files live in `agent/tests/`, mirroring `src/trespass_agent/`
