# Jarvis Architecture Concepts

---

## agents/ vs skills/ — ключова різниця

| | `skills/` | `agents/` |
|---|---|---|
| **Що це** | Знання/правила | Окремий процес |
| **Де живе** | `~/.claude/skills/` або `.claude/skills/` | `~/.claude/agents/` або `.claude/agents/` |
| **Завантажується** | Через `@reference` в CLAUDE.md або командах | Автоматично, Claude Code читає всі файли |
| **Контекст** | В основній сесії | Власний ізольований контекст |
| **Модель** | Модель основної сесії | Власна модель (`model:` в frontmatter) |
| **Tools** | Немає своїх | Власні (`tools:` в frontmatter) |
| **Бачить розмову** | Так | Ні — тільки brief |
| **Токени** | Завантажуються один раз на сесію | Платиш per виклик (system prompt) |
| **Коли використовувати** | Правила, стек, архітектурні рішення | Окремі задачі — написати код, перевірити, зробити аудит |

### Приклад правильного розподілу

```
skills/                              agents/
  jarvis/loop/outer-loop.md    ←      jarvis-planner.md   (model: opus)
  jarvis/loop/inner-loop.md    ←      jarvis-executor.md  (model: haiku)
  jarvis/ledger/tasks-schema.md ←     jarvis-reviewer.md  (model: opus)
  jarvis/ledger/defects-schema.md ←   jarvis-bugfixer.md  (model: sonnet)
                                       jarvis-security.md  (model: opus)
```

Skills — оркестратор читає сам.
Agents — оркестратор викликає через Task tool.

---

## Як формується brief

Brief — текст який оркестратор передає subagent при виклику через Task tool.

### Три джерела brief

```
Brief =
  [1] task brief         з tasks.md (title, file, what to do)
+ [2] artifact           git diff / tsc output / файл
+ [3] project rules      витяг з jarvis.context.md
```

### Що НЕ потрапляє в brief

```
❌ вся conversation history
❌ інші tasks з tasks.md
❌ весь codebase
❌ skills які не передані явно
❌ результати попередніх subagent викликів (якщо не додані оркестратором)
```

### Brief для різних агентів

| Agent | Що в brief | Чому саме це |
|---|---|---|
| jarvis-planner | user request + existing tasks.md | Planner не повинен бачити код |
| jarvis-executor | task description + file paths + Executor Rules | Вузький контекст → дешевший Haiku |
| jarvis-reviewer | git diff + task title + Review Rules | Тільки зміни, не весь файл |
| jarvis-bugfixer | defect entry + file path + acceptance criteria | Точна ціль, без зайвого |
| jarvis-security | git diff або конкретні файли | Контекстний аналіз, не патерн |

### Чому brief важливий для економії

```
Без правильного brief:
  Reviewer отримує весь файл (500 рядків) + diff
  → 500 рядків × кожен виклик × 3 rounds = дорого

З правильним brief:
  Reviewer отримує тільки diff (30 рядків) + правила з context
  → 30 рядків × кожен виклик × 3 rounds = дешево
```

---

## jarvis.context.md — per-project контекст для глобальних агентів

### Проблема яку вирішує

Глобальний `inner-loop.md` не може знати назви локальних skills (`architecture.md`, `design-agent.md`) — вони різні в кожному проєкті.

### Рішення

Один стандартний файл з відомою назвою в корені кожного проєкту:

```
client-repo/jarvis.context.md       ← client rules
tg-octopus/jarvis.context.md        ← tg-octopus rules
finfamily/jarvis.context.md         ← finfamily rules
```

Глобальний оркестратор (`inner-loop.md`) читає тільки `jarvis.context.md` — назва завжди однакова, вміст різний.

### Структура файлу

```markdown
# Jarvis Project Context — <project-name>

## Stack
<одна строчка з технологіями>

## Review Rules
<правила для jarvis-reviewer — передаються в кожен I2 brief>

## Executor Rules
<правила для jarvis-executor — передаються в кожен I1 brief>
```

### Аналоги в інших системах

| Система | Файл | Механізм читання |
|---|---|---|
| cq | `cq.toml` | MCP (`mcp__ledger__get_config`) |
| agentskills.io | `.claude/skills/<name>/SKILL.md` | Автоматично Claude Code |
| Наш Jarvis | `jarvis.context.md` | `cat jarvis.context.md` в inner-loop |

Всі три — одна ідея: стандартна назва, різний вміст per-project.

---

## Як поєднати глобальний і локальний reviewer

### Варіант A — Composition (рекомендовано)

Глобальний reviewer залишається без змін.
Локальні правила йдуть в `jarvis.context.md` → передаються в brief.

```
Плюси: нуль дублювання, оновлення глобального reviewer не ламає локальне
Мінуси: потрібен jarvis.context.md в кожному проєкті
```

### Варіант B — Override

Локальний `client/.claude/agents/jarvis-reviewer.md` замінює глобальний.

```
Плюси: повний контроль над промптом
Мінуси: треба копіювати весь глобальний промпт + додавати локальне
       оновлення глобального = ручна синхронізація
```

### Варіант C — Chain

Локальна команда викликає спочатку спеціалізованого агента (design-checker),
потім глобального reviewer. Результати об'єднуються.

```
Плюси: різні агенти для різних перевірок, кожен зі своєю моделлю
Мінуси: два виклики замість одного = більше токенів і часу
Коли: design-checker на Haiku + security-reviewer на Opus паралельно
```

---

## Правила написання .md для агентів

### Frontmatter — обов'язкові поля

```yaml
---
name: jarvis-reviewer          # ім'я для Task tool виклику
description: |                 # КРИТИЧНО — Claude вирішує коли викликати
  Adversarial reviewer.        # по цьому тексту. Конкретніше = точніше.
  Use after every EXECUTOR     # "PROACTIVELY invoke" = підказка автовиклику
  change before task is done.
tools: Read, Bash, Grep        # мінімум потрібних tools
model: opus                    # tier routing
---
```

### Три обов'язкових розділи промпту

```markdown
## Input
Що саме отримує агент. Чим вужче — тим дешевше.
❌ "the codebase"
✅ "`git diff HEAD` only — never full files"

## Output format
Явний формат відповіді. Без нього — розлогий текст.
❌ "Return your findings"
✅ "Return ONLY JSON: {verdict, issues: [...]}"

## Does NOT
Що агент не робить. Без цього — "допомагає" за межами задачі.
❌ (відсутній розділ)
✅ "Does NOT touch files outside declared scope"
   "Does NOT add unrequested features"
```

### Модель по задачі

| Задача | Модель | Чому |
|---|---|---|
| Декомпозиція, планування | opus | Потрібне глибоке мислення |
| Виконання чіткої задачі | haiku | Вузький контекст, прості інструкції |
| Адверсаріальний review | opus | Потрібна найкраща модель щоб ловити баги |
| Виправлення конкретного дефекту | sonnet | Є чітка інструкція, не треба Opus |
| Summarization / explain | haiku | Механічна задача |
| Security audit (data flow) | opus | Контекстний аналіз, не патерн |
