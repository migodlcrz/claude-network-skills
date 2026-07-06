# PRD — Network Focus Skill

**Author:** AI Builder Partner
**Stakeholder:** CEO, TerraGrid (50-person SaaS)
**Operator:** CEO's Chief of Staff (non-technical)
**Status:** v1 (trial build)

---

## 1. Problem

The CEO has hundreds of contacts but spends her time on whoever is already on her
calendar, not on the relationships that move her biggest goals forward. She has
three specific quarterly goals (below) and no bandwidth to audit her network by
hand each week. She wants to be deliberate about *who she invests time in*, backed
by her real contact history rather than gut feel.

## 2. Goal of this product

Every Monday, produce a **Network Focus brief**: the **3-5 people** the CEO should
invest in this week, each tied to one of her three goals, with a concrete suggested
action — so her week-planning session starts from a ranked, justified shortlist
instead of a blank page.

### Her three goals (this quarter)
1. **Series C** — $40M at $200M by end of Q3. Warm intros to Sequoia, a16z,
   Greylock; no process run yet. Needs investor relationships + credibility signals.
2. **Hire a CTO** — scaled 50→200+ eng org. Two candidates met, no fit. Needs more
   candidates and stronger intros.
3. **AI-safety relationships** — one casual Anthropic contact; nothing at MIRI, ARC,
   or academia. Wants to participate, not spectate.

## 3. Users

- **CEO (consumer)** — reads the brief, plans her week. Wants trust and brevity.
- **Chief of Staff (operator)** — runs the skill Monday morning, brings the brief to
  the CEO. **Non-technical.** Cannot debug code. Needs a one-command run and
  plain-language errors.

## 4. Scope

### In scope (v1)
- A packaged Claude Code **skill** installable into a global `~/.claude` with a
  single `npx` command (no project folder to download, mirrors the Claude Code
  install itself).
- A `/network-brief` slash command as the friendly trigger.
- Deterministic load + validation of a **local** CSV/XLSX roster.
- A single Claude reasoning pass that ranks 3-5 contacts and explains why.
- Markdown brief output.
- Explicit handling of ≥2 failure modes.

### Out of scope (v1)
- Live Calendar / Gmail / CRM integrations (covered in Data Sourcing Strategy as
  the production path).
- PDF/email/Slack delivery of the brief (markdown to chat is enough for MVP).
- Editing the roster from within the skill.
- Multi-user / multi-CEO support.

## 5. Design

### 5.1 Trust boundary — the core decision
The CEO must trust this brief enough to plan her week on it. Anything an LLM parses,
it can silently corrupt — a date, a strength score, a name. So we draw a hard line:

> **Deterministic code owns the data. The LLM owns the judgment.**

- `scripts/load_roster.js` reads, validates, and normalizes the spreadsheet, then
  emits clean structured JSON + a data-quality report. It has **zero runtime
  dependencies** (Node built-ins only, incl. a pure-Node XLSX reader via `zlib`) so
  nothing needs installing inside `~/.claude` and both CSV and XLSX "just work."
- Claude **never opens the spreadsheet.** It reasons only over the loader's output.

This makes the brief trustworthy *and* debuggable: when something looks wrong, it is
either bad data (the loader logs it) or bad judgment (one prompt to inspect) — never
an ambiguous mix.

### 5.2 Why one reasoning pass, not multiple agents
The prioritization — matching contacts to goals, weighing strength against
staleness, justifying each pick — is a single coherent judgment. Splitting it across
sequential agents adds handoff risk and debugging surface for no benefit. One pass
keeps the reasoning legible: clean facts in, ranked brief out. (An earlier idea of
"agent 1 parses, agent 2 writes" was rejected: agent-parsing reintroduces exactly
the hallucination risk the trust boundary exists to remove.)

### 5.3 Flow
```
npx github:…/claude-network-skills install   (one-time: copy skill into ~/.claude)
/network-brief
   └─> node scripts/load_roster.js           (deterministic: parse + validate)
          └─> {ok, roster[], quality{}}       (clean JSON to Claude)
                 └─> Claude: one reasoning pass over goals + roster + quality
                        └─> Markdown brief (3-5 picks) + Data notes
```

### 5.4 Scoring guidance (judgment, not a rigid formula)
Goal alignment is the gate; then leverage over comfort; balance across the three
goals; factor relationship strength and staleness (a strong-but-stale contact is a
high-value reconnect); every pick gets a concrete action. Full guidance lives in
`SKILL.md` so it is versioned with the skill.

## 6. Failure modes (≥2 required; we handle four)

| # | Failure mode | Detection | Behavior |
|---|--------------|-----------|----------|
| A | **Goal-named contact missing from roster** (e.g. a16z, Greylock, the Anthropic researcher) | Loader cross-checks `goal_contacts` in `goals.md` against roster names/companies | Brief continues with available contacts; **Data notes** flags the missing name and tells the operator to add a row |
| B | **Stale / thin data** | Loader flags last-contact dates older than 90 days, or empty summary+notes | Contact may still be picked if it serves a goal, but flagged low-confidence in **Data notes** |
| C | **Roster unreachable / unparseable** | Loader returns `ok:false` with a plain-language `error` + `hint` | No brief is produced; operator gets a plain-language fix (check `rosterPath`, export as CSV, etc.) |
| D | **Ambiguous name match** | A goal name matches multiple roster rows | Loader lists candidates in `warnings`; brief asks operator to disambiguate rather than guessing |

Design principle: **never fabricate a result.** Every failure surfaces to the
operator in language a non-engineer can act on.

## 7. Data Sourcing Strategy (production deployment)

For this trial the skill consumes a pre-collected spreadsheet directly. In a real
deployment, the roster would be assembled and kept fresh from multiple sources:

### Sources
| Source | Feeds | Mechanism | Cadence |
|--------|-------|-----------|---------|
| **Calendar (MCP)** | Last-contact date/channel (meetings), who she's actually meeting | Google Calendar MCP server; derive "last meeting" per attendee email | Nightly sync |
| **Gmail (MCP)** | Last-contact date/channel (email), thread summaries → last-contact summary | Gmail MCP; summarize latest thread per contact | Nightly sync |
| **CRM (e.g. Affinity/Salesforce)** | Relationship strength, how-she-knows-them, tags, deal/stage context | CRM API or MCP; system of record for structured relationship fields | Nightly sync; CRM is source of truth on conflict |
| **Manual entry** | Notes, corrections, new contacts not yet in any system, relationship strength overrides | Chief of staff edits the sheet / CRM | Ad hoc, before the Monday run |
| **Enrichment (optional)** | Role, company, seniority for thin contacts | Clearbit/LinkedIn-style enrichment API | On new-contact creation |

### Sync cadence
- **Nightly** consolidation job merges Calendar + Gmail + CRM into a canonical
  roster store, deduped by email/name.
- **Monday pre-run** the operator does a quick manual pass (add/correct anything the
  CEO mentioned over the weekend), then runs the brief.

### What stays manual (deliberately)
- **Relationship strength (1-5)** — a human judgment; auto-scoring from email volume
  would reward noise over depth. CRM value with manual override.
- **Notes and nuance** — "not the right fit," "prefers warm intros" — context no API
  captures.
- **Goal definitions** (`goals.md`) — set by the CEO/CoS, not inferred.

### Trade-offs
- **Freshness vs. noise:** auto-deriving last-contact from Calendar/Gmail is fresh
  but noisy (scheduling threads, out-of-office). We mitigate with per-contact
  summarization and let manual notes override.
- **Automation vs. trust:** the more we auto-populate, the less the CEO trusts the
  brief if one field is wrong. Keeping strength + notes human-owned preserves trust
  where it matters most.
- **MCP vs. direct API:** MCP servers keep the skill portable and credential-scoped;
  direct APIs are more work but sometimes needed for CRM-specific fields.
- **Same trust boundary holds:** even with live sources, a deterministic
  consolidation layer would still own the data and hand Claude clean facts — the
  reasoning pass would not change.

## 8. Success criteria
- Operator can install and run the brief with **no code**, following the README.
- Brief always names 3-5 people, each tied to a goal with a concrete action.
- All four failure modes produce a clear, actionable operator message — never a
  crash or a fabricated brief.
- The CEO can trace any pick back to a real roster row.

## 9. Future work
- Deliver the brief as PDF/email/Slack.
- Track week-over-week: who was recommended, who she actually contacted, outcomes.
- Live MCP sources per the Data Sourcing Strategy.
- Feedback loop: CEO marks picks helpful/not to tune scoring.
