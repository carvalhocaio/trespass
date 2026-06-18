# trespass — Proposta e Regras de Negócio

> Plataforma web self-hostável para teste de **prompt injection** em aplicações
> baseadas em LLM. O usuário registra seus próprios endpoints LLM, dispara
> campanhas de ataque adversarial, persiste os resultados e acompanha a
> evolução da postura de segurança ao longo do tempo.

**Status:** planejamento / início de implementação
**Stack:** Nuxt + Hono (Node) + PostgreSQL + Drizzle + Better-Auth (monorepo Turborepo/pnpm) · Agente adversarial em Python (Google ADK + FastAPI) no Cloud Run
**Última atualização desta proposta:** junho/2026

---

## 1. Visão geral e posicionamento

### 1.1. O problema

Aplicações que usam LLMs herdam uma classe de vulnerabilidade sem equivalente
no software tradicional: **prompt injection** (OWASP LLM01). Instruções
adversariais — vindas do input do usuário ou de conteúdo recuperado por RAG —
podem subverter o system prompt, vazar instruções/segredos, burlar guardrails
ou induzir o agente a chamar ferramentas indevidas. Diferente de um bug
determinístico, a suscetibilidade a injeção é **probabilística e muda a cada
deploy**: um ajuste no system prompt, uma troca de modelo ou uma nova ferramenta
podem reabrir uma brecha que estava fechada — sem que ninguém perceba.

### 1.2. O que o trespass é

Uma **plataforma web** onde o usuário:

1. registra os endpoints LLM que ele mesmo controla (Targets);
2. dispara campanhas de ataques de prompt injection contra eles;
3. recebe um veredito determinístico (vulnerável ou não) com transcript auditável;
4. acompanha a **regressão ao longo do tempo** — o diferencial central.

### 1.3. O que o trespass NÃO é (e por que isso importa)

O ecossistema de tooling de prompt injection já é maduro e consolidado em três
pilares, todos **CLI/biblioteca**:

- **Garak (NVIDIA):** scanner de vulnerabilidade com centenas de probes prontos.
- **PyRIT (Microsoft):** geração de cadeias de ataque novas, multi-turn e datasets adversariais.
- **Promptfoo:** harness de teste/regressão (adquirido pela OpenAI em março/2026).

O trespass **não tenta competir com esses scanners no terreno deles**. O nicho
onde eles são fracos é justamente onde o nosso stack é forte: uma **plataforma
web multi-target, com persistência, histórico e acompanhamento temporal**. O
"o quê" (payloads, detectores) pode até ser emprestado do mundo CLI; o valor
está no **"ao longo do tempo + multi-target + UI + multiusuário"**.

Decorrência prática: cada peça do stack se justifica.

| Peça | Justificativa |
|------|---------------|
| PostgreSQL / Drizzle | persistência de Runs e histórico de regressão |
| Better-Auth | multiusuário e *ownership* de Targets (também é salvaguarda) |
| Hono (Node) | API + runner single-turn do v1 |
| Nuxt | dashboard e visualização de campanhas/transcripts |
| Agente Python (ADK) | cérebro adversarial multi-turn (v2), isolado em serviço próprio |

---

## 2. Princípio ético central: canary, não conteúdo nocivo

Esta é a decisão de design mais importante do projeto e atravessa todas as
outras. **O objetivo de todo ataque é extrair um canary token** — um marcador
benigno (ex.: `TRESPASS-7F3A`) que o Target foi instruído a esconder.

Por que isso é correto:

- **Detecção determinística.** O canary vazou ou não vazou. Sem "LLM-as-judge"
  subjetivo no caminho crítico, sem ambiguidade no veredito.
- **Ética e auditabilidade.** Nunca tentamos arrancar conteúdo realmente
  perigoso (instruções de arma, dados sensíveis reais) do alvo. Provamos apenas
  que o alvo **pode ser induzido a violar uma instrução explícita** — que é
  exatamente o que define a vulnerabilidade de prompt injection.
- **Liberdade criativa onde importa.** O agente adversarial fica livre para ser
  criativo *na técnica* (roleplay, encoding, crescendo), mas o alvo do ataque é
  sempre o canary, nunca um payload nocivo.

É o mesmo princípio que garak e PyRIT usam para medir suscetibilidade sem
materializar dano. No trespass ele é regra de negócio, não detalhe de
implementação.

---

## 3. Entidades e regras de negócio

As seis entidades centrais e suas invariantes.

### 3.1. Target

Um endpoint LLM que o usuário registra (provider, modelo, system prompt,
base URL, credencial).

**Regra dura — ownership:** um Target só pode ser visualizado, editado ou
testado pelo usuário que o registrou (via Better-Auth). Isto **não é apenas
permissão**: é a principal salvaguarda ética da ferramenta. Só se testa o que é
seu ou o que você está autorizado a testar. A credencial do Target nunca é
exposta em respostas de API nem persistida fora do registro do Target.

**Campos:** `base_url` (compatível-OpenAI), `model`, `system_prompt`, `api_key`
(opcional — endpoints locais sem auth são válidos), `extra_headers`.

### 3.2. Payload (Attack)

Um template de injeção versionável, com:

- `categoria` / `técnica` (ver taxonomia, seção 4);
- `texto`/`template` do ataque;
- `objetivo` (qual violação tenta provocar);
- `detector esperado` (qual lógica decide sucesso).

### 3.3. Campaign / Run

A execução de um conjunto de Payloads contra um Target. Tem status, timestamp e
referência à **versão do system prompt** testada (crucial para regressão: você
precisa saber contra qual configuração o resultado vale).

**Regra — execução assíncrona:** um Run é um **job**, não uma request síncrona.
O POST cria o Run e retorna na hora; o processamento roda em background; o front
faz polling do status. Isso vale já no v1 (runner single-turn no Hono) e evita
estourar o timeout de função, independente de runtime.

### 3.4. Result

A saída de um Payload contra um Target dentro de um Run.

**Regra — inversão de intuição:** o campo central é `success` (booleano), e
**`success = true` significa que a injeção FUNCIONOU = o alvo é VULNERÁVEL**.
Bom para nós, ruim para o alvo. Essa inversão é contraintuitiva (no teste
tradicional, "passou" é bom) e deve ser explícita em todo lugar — schema, UI,
logs — para não gerar leitura errada.

### 3.5. Detector / Scorer

A lógica que decide se um Result teve `success`.

**Regra — determinístico primeiro:** começa com matching de canary (regex,
comparação de string, normalização). LLM-as-judge só entra depois, e nunca no
caminho crítico do veredito principal. A robustez do detector de canary tem
sutilezas (case, espaços, canary partido por encoding) que são tratadas na
implementação.

### 3.6. Finding / Regression

Quando um Payload que **falhava** passa a ter **sucesso** (ou vice-versa) entre
dois Runs no mesmo Target. Este é o ouro do produto.

**Regra — o histórico é o ativo:** rastrear a contagem de probes vulneráveis ao
longo do tempo. Se a contagem não cai, alguém shipou uma regressão e ninguém
viu — e esse fato, por si só, já é o achado que justifica a ferramenta existir.

---

## 4. Taxonomia de ataque (o catálogo de Payloads)

Define *o que* o produto testa. Mapeada ao OWASP LLM01.

| Categoria | Descrição | Prioridade |
|-----------|-----------|------------|
| **Injeção direta** | Instrução adversarial no input ("ignore as instruções acima…") | v1 |
| **Jailbreak / roleplay** | Encenação para contornar persona/guardrails | v1 (alta) |
| **Vazamento de system prompt** | Extração das instruções/segredos do alvo | v1 |
| **Encoding / ofuscação** | base64, leetspeak, unicode, idioma alternativo p/ burlar filtros | v1 |
| **Injeção indireta** | Payload escondido em conteúdo recuperado (RAG/web/email) | v2 |
| **Multi-turn (crescendo)** | Escalada gradual ao longo de 5–20 turnos, driblando detecção por mensagem isolada | v2 |
| **Abuso de tool/function-call** | Forçar o agente a chamar ferramentas indevidas ou exfiltrar dados | v2 |

**Nota de priorização:** o roleplay merece destaque — estudos recentes (2025)
com 1.400+ prompts encontraram taxa de sucesso de ~89% em injeções baseadas em
roleplay contra modelos de fronteira. É a categoria de maior retorno no v1.

O **multi-turn (crescendo)** é o caso que justifica o agente adversarial em
Python: é um ataque que refina a si mesmo a cada turno e por isso precisa de um
LLM no loop, não de um payload estático.

---

## 5. Arquitetura

### 5.1. Visão de alto nível

```
┌─────────────────────────────────────────────┐        ┌──────────────────────────┐
│  MONOREPO (Vercel)                           │        │  AGENTE PYTHON (Cloud Run)│
│                                              │        │                          │
│  apps/web   (Nuxt)   ── dashboard, auth UI   │        │  FastAPI + Google ADK    │
│  apps/server (Hono)  ── API, auth, CRUD,     │  HTTP  │  cérebro adversarial     │
│                         runner SINGLE-TURN   │ ─────▶ │  multi-turn (crescendo)  │
│  packages/db   (Drizzle/Postgres)            │  A2A   │  STATELESS — sem banco   │
│  packages/auth (Better-Auth)                 │ ◀───── │  sem CRUD, sem persistir │
│  packages/env                                │        │                          │
└─────────────────────────────────────────────┘        └──────────────────────────┘
        │
        ▼
   PostgreSQL (Neon)  ── Targets, Payloads, Runs, Results, Findings
```

### 5.2. Divisão de responsabilidades

| Camada | Responsabilidade | Não faz |
|--------|------------------|---------|
| **Hono (monorepo)** | CRUD, auth, ownership, persistência, runner single-turn, geração e guarda do canary | — |
| **Agente Python** | Loop adversarial multi-turn; gera probes; chama o alvo; devolve transcript + veredito | banco, CRUD, persistência, guardar segredo de Target |

O agente Python é **stateless**: recebe os dados do Target + um objetivo, roda o
loop, devolve o resultado e esquece tudo. Quem persiste é sempre o Hono/Postgres.

### 5.3. Por que o agente fica fora da Vercel

A Vercel roda FastAPI como uma única função serverless, com teto de duração
(default 300s; até 800s GA em planos pagos; 1800s em beta com config). Um agente
crescendo (5–20 turnos × N payloads, cada turno uma chamada de LLM) é carga
*bursty/long-running* — péssimo encaixe para função-por-request, e ainda esbarra
no teto de bundle (500 MB). O Google ADK foi feito para ambientes cloud-native
como o Cloud Run (scale-to-zero resolve o custo, sem brigar com timeout). Daí a
separação: **monorepo na Vercel, agente no Cloud Run**, conversando por HTTP/A2A.

---

## 6. Stack e decisões registradas

### 6.1. Monorepo

Scaffold via Better-T-Stack:

```
pnpm create better-t-stack@latest trespass \
  --frontend nuxt --backend hono --runtime node \
  --database postgres --orm drizzle --api none \
  --auth better-auth --payments none \
  --addons biome husky turborepo ultracite \
  --examples none --db-setup none \
  --web-deploy none --server-deploy none \
  --git --package-manager pnpm --install
```

Decisões e o porquê:

- **`--runtime node` (não bun):** estabilidade. O runtime Bun na Vercel ainda é
  beta; Node é maduro. Bônus: o Hono nasce com `@hono/node-server` (não
  `Bun.serve`), o que resolve o problema de `Bun.serve` não ser suportado na
  Vercel — o entrypoint já é Node-friendly. Desenvolver local com Bun é opcional;
  o deploy mira Node.
- **`--package-manager pnpm`:** workspaces estritos, dedup de dependências,
  excelente com Turborepo. A Vercel detecta pnpm pelo lockfile automaticamente.
- **`--db-setup none`:** Postgres configurado à mão, com Neon (mesma stack do
  dev-telemetry) via connection string no Drizzle.
- **Addons:** Biome + ultracite (lint/format zero-config), Husky (git hooks),
  Turborepo (build de monorepo).

### 6.2. Agente Python

- **Google ADK (Python), não JS nem Go.** O ADK-JS oficial ainda carrega aviso
  de "não recomendado para produção" antes do 1.0. ADK-Go é production-ready
  (v1.x GA), mas o **Python está mais maduro (v2.x GA)** e — decisivo — todo o
  ecossistema de red-team (garak, PyRIT, datasets, detectores) é Python. Além
  disso o F1 RAG já usa ADK em Python: terreno conhecido. Go só ganharia se o
  serviço também fosse o runner de alta concorrência, o que não é o caso (o
  runner single-turn vive no Hono).
- **FastAPI + Uvicorn:** ASGI, encaixa no preset Python do Cloud Run.
- **httpx:** cliente async para chamar o endpoint alvo (externo e arbitrário —
  controle total sobre timeout/headers/retry).
- **pydantic + pydantic-settings:** contrato e config validados.
- **Layout `src/`:** evita import acidental, força testar o pacote como será
  empacotado.

---

## 7. Contrato do agente Python (fronteira Hono ↔ Python)

É o acordo que permite desenvolver os dois lados em paralelo. Resumo dos
schemas (definição canônica em `agent/src/trespass_agent/models.py`).

### 7.1. Request — `PromptInjectionRequest`

| Campo | Tipo | Observação |
|-------|------|------------|
| `run_id` | str | ID de correlação gerado pelo Hono; apenas ecoado de volta |
| `target` | TargetConfig | `base_url`, `model`, `system_prompt`, `api_key?`, `extra_headers` |
| `canary` | str (≥6) | token benigno que o alvo deve esconder; presença = sucesso |
| `objective` | str? | objetivo em linguagem natural; se ausente, derivado do canary |
| `allowed_techniques` | list | técnicas permitidas (default: todas) — permite isolar categorias |
| `max_turns` | int? | override **só para baixo**: orquestrador aplica `min(req, settings)` |

### 7.2. Response — `PromptInjectionResult`

| Campo | Tipo | Observação |
|-------|------|------------|
| `run_id` | str | ecoa o request |
| `success` | bool | **true = injeção funcionou = alvo vulnerável** |
| `stop_reason` | enum | `canary_leaked` / `max_turns` / `budget_exceeded` / `target_error` |
| `turns_used` | int | quantos turnos do atacante rodaram |
| `winning_technique` | enum? | técnica do turno que vazou o canary |
| `winning_turn_index` | int? | índice do turno vencedor |
| `elapsed_seconds` | float | duração do loop |
| `transcript` | list | sequência completa probe/resposta, para auditoria e UI |

### 7.3. Decisões de contrato

- **`extra="ignore"` nos dois lados.** Deploy independente: se o Hono passar a
  mandar um campo novo antes de o Python ser atualizado, o Python ignora em vez
  de rejeitar com 422. Independência de deploy > rigidez de schema.
- **Canary vem do Hono, não é gerado no Python.** Quem cria e guarda o canary é
  quem persiste o Run (o Hono). O Python recebe, instrui o alvo a escondê-lo e
  checa o vazamento — mantendo-se stateless.
- **A credencial do Target entra mas nunca sai.** `PromptInjectionResult` não
  tem `api_key` em nenhum lugar. Auditável.
- **`api_key` opcional.** Endpoints locais (Ollama, vLLM) frequentemente não têm
  auth — e são justamente onde se testam modelos sem guardrails.

---

## 8. Detecção e scoring

- **v1 — determinístico:** matching de canary (regex + comparação normalizada).
  Trata case, espaços e canary partido por ofuscação. Sem LLM no caminho.
- **v2 — LLM-as-judge (opcional, fora do caminho crítico):** para classificar
  *qualidade*/severidade de respostas ambíguas, nunca para decidir o veredito
  binário principal.
- **Stop reasons distinguem achado de limite operacional:** `canary_leaked`
  (sucesso real) vs. `max_turns` / `budget_exceeded` / `target_error` (o teste
  terminou sem conclusão de vulnerabilidade). Não confundir "não vazou" com
  "deu erro no alvo".

---

## 9. Deploy

| Componente | Plataforma | Notas |
|------------|------------|-------|
| `apps/web` (Nuxt) | Vercel | preset Nitro nativo |
| `apps/server` (Hono) | Vercel | runtime **Node** (não Bun beta); envolver `app` do Hono com o handler Node / adapter `hono/vercel`; Root Directory no monorepo |
| `packages/db` | Neon (Postgres) | connection string no Drizzle |
| Agente Python | Google Cloud Run | scale-to-zero; sem teto de timeout problemático; alternativas: Railway, Fly.io, Render |

**Importante:** o v1 inteiro vive no monorepo (runner single-turn no Hono). O
Cloud Run só entra no v2. Dá para subir o v1 100% na Vercel e plugar o agente
Python depois, sem impacto no que já está no ar.

---

## 10. Roadmap

### v1 — Plataforma single-turn (sem Python)

- Auth + ownership de Targets (Better-Auth).
- CRUD de Targets e Payloads.
- Runner **single-turn** no Hono (job assíncrono + polling).
- Catálogo de ataques single-turn: injeção direta, jailbreak/roleplay,
  vazamento de system prompt, encoding.
- Detector determinístico de canary.
- Persistência de Runs/Results + visualização de transcript.
- Acompanhamento de regressão entre Runs.

### v2 — Agente adversarial (Python/Cloud Run entra aqui)

- Serviço FastAPI + Google ADK no Cloud Run.
- Ataque **multi-turn (crescendo)**: agente que refina probes a cada turno.
- **Injeção indireta** (payload via conteúdo recuperado).
- **Abuso de tool/function-call.**
- LLM-as-judge para severidade (fora do caminho crítico).

### Backlog / ideias

- Importar seeds de payload de garak/promptfoo para o catálogo.
- Comparativo de modelos lado a lado num mesmo conjunto de ataques.
- Alertas de regressão (notificar quando a contagem de probes vulneráveis sobe).

---

## 11. Salvaguardas, ética e segurança

O trespass é uma ferramenta de **segurança defensiva** — análoga a um scanner de
vulnerabilidade para apps LLM. As salvaguardas são parte do design, não um
adendo:

1. **Ownership obrigatório.** Só se testa Target registrado pelo próprio
   usuário. É a barreira primária contra uso contra sistemas de terceiros.
2. **Canary, não conteúdo nocivo.** Os ataques provam suscetibilidade extraindo
   um token benigno; nunca materializam dano real.
3. **Segredos não vazam.** Credenciais de Target usam tipo secreto (não aparecem
   em log/`repr`), entram por request, e nunca constam no resultado.
4. **Auditabilidade.** Todo Run guarda transcript completo + a versão do system
   prompt testada. O que foi feito, contra o quê, fica registrado.
5. **Limites operacionais explícitos.** Timeout por chamada, teto de turnos e
   orçamento de tempo do loop — o serviço sempre termina dentro do limite da
   plataforma, sem loops infinitos nem custo descontrolado.

---

## 12. Glossário

| Termo | Significado |
|-------|-------------|
| **Target** | endpoint LLM sob teste, registrado pelo usuário |
| **Payload / Attack** | template de injeção (técnica + texto + objetivo + detector) |
| **Run / Campaign** | execução de um conjunto de Payloads contra um Target |
| **Result** | saída de um Payload num Run (`success` = vulnerável) |
| **Detector / Scorer** | lógica que decide se houve sucesso (canary vazou?) |
| **Finding / Regression** | mudança de status (passou a vazar / deixou de vazar) entre Runs |
| **Canary** | token benigno que o Target deve esconder; vazamento = vulnerabilidade |
| **Crescendo** | ataque multi-turn de escalada gradual |
| **A2A** | protocolo de comunicação agente-a-agente (usado entre Hono e o serviço Python) |

---
