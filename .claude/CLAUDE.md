# Trespass — Python Project Standards

This project is an adversarial prompt-injection testing agent. The Python service exposes a FastAPI endpoint that receives a `PromptInjectionRequest`, runs a multi-turn attack campaign via Google ADK against the target LLM, and returns a `PromptInjectionResult`.

Apply these standards whenever you write or review code in this project.

## Tooling

- Package manager: `uv` — never use `pip install` directly
- Formatter: `ruff format`
- Linter: `ruff check --fix`
- Type checker: `mypy --strict`
- Tests: `pytest` with `pytest-asyncio` (`asyncio_mode = "auto"`)
- Line length: **100 characters** (configured in `pyproject.toml`)

Run before considering any file done:

```bash
cd agent && uv run ruff check --fix src/ && uv run ruff format src/ && uv run mypy src/
```

## Layer architecture

```
api/          ← FastAPI routes — HTTP parsing and response only
attacker/     ← ADK agent that generates attack probes
orchestrator/ ← multi-turn loop logic (crescendo, budget control)
detectors/    ← canary detection, stop-reason evaluation
targets/      ← httpx client that calls the target endpoint
models.py     ← public boundary: PromptInjectionRequest / PromptInjectionResult
config.py     ← Settings via pydantic-settings, injected from env
```

Rules:
- `api/` contains no business logic — delegates to `orchestrator/`
- `orchestrator/` is HTTP-agnostic — no `Request`/`Response` imports from FastAPI
- `targets/` isolates all external I/O — the orchestrator never uses httpx directly

## Pydantic models

- All public API boundaries use `model_config = ConfigDict(extra="ignore")` to tolerate version skew between this service and Hono
- `SecretStr` for all credentials — never plain `str`
- `Field(...)` with `description=` on all public model fields
- Enums as `str, Enum` subclasses — `str` serialization is deliberate

## Google ADK

- Use `google-adk` (GA 2.x) for adversarial probe generation
- The ADK agent lives in `attacker/agent.py` — keep it isolated from `api/`
- Configuration (model name, API key) is always read from `Settings` — never hardcoded
- `attacker_model` default is `gemini-flash-latest`; the key is `TRESPASS_GEMINI_API_KEY`

## Attack loop limits

- `max_turns` hard ceiling: 1–20 (enforced by `Settings.max_turns`); request overrides respected only downward
- `target_timeout_seconds`: timeout for each individual call to the target
- `run_budget_seconds`: total wall-clock ceiling for the whole loop — seatbelt beyond `max_turns`

## Async

- I/O-bound functions are `async def`
- Never `time.sleep()` inside `async def` — use `asyncio.sleep()`
- Use `asyncio.gather()` for independent concurrent coroutines
- Never mix blocking I/O inside `async def` without `run_in_executor`

## Error handling

- Create domain exceptions per module (`class TargetTimeoutError(Exception)`)
- Never `except Exception: pass` or `except Exception: raise`
- Map domain errors to HTTP status codes only in the route layer
- `HTTPException` never leaves `api/`

## Testing

- Use `respx` to mock `httpx` calls — never make real network calls in unit tests
- `asyncio_mode = "auto"` means no `@pytest.mark.asyncio` decorator needed
- Call `get_settings.cache_clear()` in tests that override environment variables
- `tests/` mirrors `src/trespass_agent/` — one test file per module
