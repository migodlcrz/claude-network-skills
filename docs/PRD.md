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
- A three-stage reasoning pipeline (Select → Verify → Write, the latter two as
  sub-agents) that ranks 3-5 focus contacts + 2-3 dormant contacts and explains why.
- Markdown brief output.
- Explicit handling of ≥2 failure modes.

### Out of scope (v1)
- Live Calendar / Gmail / CRM integrations (covered in Data Sourcing Strategy as
  the production path).
- PDF/email/Slack delivery of the brief (markdown to chat is enough for MVP).
- Editing the roster from within the skill.
- Multi-user / multi-CEO support.

## 4.5 Inputs and outputs

### Inputs
1. **Roster spreadsheet** (CSV or XLSX), one contact per row. Columns (tolerant
   header matching, so minor naming differences work):
   `Name, Role, Company, How she knows them, Last contact date, Last contact channel,
   Last contact summary, Relationship strength (1-5), Tags, Notes`.
2. **Goals** — `reference/goals.md`, the three quarterly goals plus a `goal_contacts`
   list of people/firms named in the goals (used for the missing-contact check).
3. **Config** — `~/.claude/network-focus.settings.json`, fully optional. By default
   the operator sets nothing: the loader auto-discovers the roster by looking for
   the single CSV/XLSX in a watch folder (`~/Documents/reports`). Settings exist
   only as manual overrides: `rosterPath` (one exact file, bypassing discovery —
   needed if more than one spreadsheet lives in the watch folder), `rosterFolder`
   (watch a different folder), `briefOutputDir` (save briefs somewhere other than
   the `~/Documents/network-focus-briefs` default; also overridable per-run via
   `NETWORK_BRIEF_OUTPUT_DIR`). This resolution order (env var → explicit setting →
   auto-discovery) is what removes path-typing from the non-technical operator's
   workflow entirely — see §5.1a.

### Loader output (deterministic → the LLM's only view of the data)
```jsonc
{
  "ok": true,
  "brief_output_dir": "/Users/.../network-focus-briefs",  // resolved, ready to use
  "roster": [{
    "name","role","company","relationship","last_contact_date",
    "last_contact_channel","last_contact_summary","strength","tags","notes",
    "signals": {                     // pre-computed objective features, not judgment
      "goal_matches": ["cto_hire"],  // which goals the row's tags/role/notes touch
      "goal_match_labels": ["CTO hire"],
      "days_since_contact": 68,
      "recency_bucket": "warm",      // fresh/recent/warm/aging/dormant/unknown
      "dormant_but_strong": false,   // strength>=4 & >90d: high-value reconnect
      "goal_aligned_but_weak": false,// goal-aligned but strength<=2
      "dormant_candidate": true      // 60+ days & goal-aligned: dormant-section pool
    }
  }],
  "quality": {
    "total_contacts": 25,
    "missing_goal_contacts": ["a16z"],
    "stale_contacts": ["Reid Hoffman", ...],   // >90 days
    "thin_contacts": [],                        // empty/short summary+notes
    "warnings": []                              // incl. ambiguous name matches
  }
}
// On failure: { "ok": false, "error": "...", "hint": "..." }
```

### Brief output (markdown)
- **This week's focus** — 3-5 people. Each: name/role/company, goal, grounded
  evidence, why now, suggested move, and **what's at risk if she waits**.
- **Dormant relationships** — 2-3 people (60+ days, goal-aligned) worth reviving.
- **Data notes** — surfaced failure-mode flags and any deliberate goal skew.

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

### 5.1a Zero-touch config — folder auto-discovery over path entry
The operator is explicitly non-technical, so we treat any file-path typing as a
usability bug, not an acceptable install step. `rosterPath` (an exact file) is
useful for an engineer testing this, but it's also exactly where a real operator
gets stuck — we hit this ourselves mid-build with a doubled `~/Users/...` typo that
silently pointed nowhere. The fix: the loader defaults to watching a folder
(`~/Documents/reports`) and auto-uses whatever single spreadsheet is dropped there.
The operator's entire "install" step becomes *put the file in this folder* — no
settings file to open, no path syntax to get wrong. `rosterPath`/`rosterFolder`
remain as explicit overrides for edge cases (multiple spreadsheets kept on hand, an
unusual save location), never as something a first-time operator has to touch.
Same principle extends to `briefOutputDir` for saved brief copies (§5.x below).

### 5.2 Single agent vs. sub-agents — where we drew the line
We evaluated this twice, at two different seams, and answered differently each time:

**Parsing the spreadsheet: no agent.** An earlier idea — "agent 1 parses, agent 2
writes" — was rejected. A parsing agent can misread a date or blur two
similarly-named contacts, and because it's a model call, you might never notice.
That reintroduces exactly the hallucination risk §5.1's trust boundary exists to
remove. Parsing stays deterministic code, full stop.

**Selecting who matters this week: no additional agent.** Ranking contacts against
three goals — weighing strength, recency, and timing together — is one coherent
judgment call, not a set of independently-decomposable sub-tasks. Splitting the
*selection* itself across agents would just add a handoff with no new capability.

**Checking the selection, and writing it up: yes, two sub-agents.** These are
genuinely different jobs from selection and from each other:
- **`verify-brief`** — an *adversarial* check, deliberately not the same agent
  (or reasoning thread) that made the picks. Given only the picks and the raw
  data, it tries to find ungrounded citations, goal imbalance, or eligibility
  errors. A self-check by the same reasoning that produced the picks is weaker
  than an independent one — it's prone to rationalizing its own output.
- **`write-brief`** — a rendering job, constrained to only the already-verified
  facts. Separating "decide" from "phrase persuasively" means a citation can't
  quietly get more confident or more specific in the prose than the underlying
  evidence supports.

Each of these three stages (Select, Verify, Write) has a narrow, checkable job.
That's the bar for "appropriate" sub-agent use, not agent-count for its own sake.

### 5.3 Flow
```
npx github:…/claude-network-skills install   (one-time: copy skill + 2 sub-agents into ~/.claude)
/network-brief
   └─> node scripts/load_roster.js              (deterministic: parse + validate + PRE-SCORE)
          └─> {ok, roster[+signals], quality{}}  (clean JSON to Claude)
                 └─> SELECT (main thread): who + why → structured JSON picks, no prose
                        └─> VERIFY (sub-agent `verify-brief`): independent grounding
                            + goal-balance check → {verified, issues[], goal_coverage}
                               └─> WRITE (sub-agent `write-brief`): renders verified
                                   picks into markdown, adds no new facts
                                      └─> Brief (executive summary + focus + dormant
                                          + data notes), emitted unmodified
```

### 5.4 Reliability: pre-scoring + grounding + independent verification
Three design choices compound to make the brief more consistent and less prone to
fabrication:

1. **Deterministic pre-scoring.** The loader computes objective `signals` per contact
   (goal matches via word-boundary keyword scan, recency bucket, dormant/weak flags).
   Select reasons over these *structured features* instead of re-deriving them from
   raw text each run — so picks are stable week to week and less hallucination-prone.
2. **Grounding rule.** Every pick must cite specific evidence that exists in that
   contact's row (a real summary/notes line, strength, or date). If Select can't
   point to a concrete field, it can't make the claim. This is the primary
   anti-hallucination lever and it keeps every recommendation traceable to a row.
3. **Independent verification.** `verify-brief` re-checks every citation and the
   goal balance from a fresh context — it did not make the picks, so it isn't
   defending its own reasoning. This catches the failure mode grounding alone
   can't: a citation that's *technically* present but doesn't really support the
   claim, or a goal that quietly got zero coverage.

### 5.5 Scoring guidance (judgment, not a rigid formula)
Goal alignment is the gate; then leverage over comfort; timing/openings; balance
across the three goals; factor relationship strength and staleness (a strong-but-cold
contact is a high-value reconnect). Every focus pick gets a concrete move + a risk of
inaction; the dormant section holds 2-3 separate 60+-day goal-aligned reconnects.
Full guidance lives in `SKILL.md` so it is versioned with the skill.

### 5.6 Model choice
**All three reasoning stages (Select, Verify, Write) run on Claude Opus** (`opus`,
via `model: inherit` in each sub-agent so they match the main session). The brief
is the entire product surface — a judgment call per week that the CEO plans around
— so quality dominates cost at this volume (~25 rows, three model calls, run
weekly). Verify in particular benefits from Opus-level reasoning: it has to
independently re-derive whether a citation truly supports a claim, not just
pattern-match text. **The loader uses no model at all** — it's deterministic code.

### 5.7 Claude Code primitives used
- **Skills packaging** — the deliverable is a proper `SKILL.md` skill (name,
  description, workflow, versioned scoring guidance), installable into `~/.claude`.
- **Slash command** — `/network-brief` is the non-technical trigger.
- **Structured input + deterministic scripting** — the loader is the trust boundary.
- **Sub-agents, used where the job genuinely decomposes** — `verify-brief` (adversarial
  grounding/balance check) and `write-brief` (constrained rendering), each installed
  as its own agent file and invoked as a distinct step after Select. See §5.2 for
  where we did and didn't add a sub-agent, and why each line was drawn there.
- **MCP** — not used in v1 (no live data sources to connect to); see §7 for where it
  belongs in production.

## 6. Failure modes (≥2 required; we handle five)

| # | Failure mode | Detection | Behavior |
|---|--------------|-----------|----------|
| A | **Goal-named contact missing from roster** (e.g. a16z, Greylock, the Anthropic researcher) | Loader cross-checks `goal_contacts` in `goals.md` against roster names/companies | Brief continues with available contacts; **Data notes** flags the missing name and tells the operator to add a row |
| B | **Stale / thin data** | Loader flags last-contact dates older than 90 days, or empty summary+notes | Contact may still be picked if it serves a goal, but flagged low-confidence in **Data notes** |
| C | **Roster unreachable / unparseable** | Loader returns `ok:false` with a plain-language `error` + `hint` (no file in the watch folder, unsupported type, bad Excel data, etc.) | No brief is produced; operator gets a plain-language fix — e.g. "save your roster into `~/Documents/reports`" |
| D | **Ambiguous name match** | A goal name matches multiple roster rows | Loader lists candidates in `warnings`; brief asks operator to disambiguate rather than guessing |
| E | **Ambiguous roster file** (a variant of C, called out separately since it's specific to auto-discovery) | More than one CSV/XLSX sits in the watch folder | Loader returns `ok:false`, refuses to guess which is current, and tells the operator to remove the old file(s) or set `rosterPath` explicitly |

Note: A and B trigger on the provided roster (a16z missing; 7 stale contacts). C, D,
and E are handled in code but do not trigger on this dataset — they are exercised
via malformed/missing/duplicate test inputs, not staged in the demo.

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
- Operator can install and run the brief with **no code**, following the handoff doc.
- Brief always names 3-5 focus people — each tied to a goal, with a concrete move and
  a stated risk of inaction — plus 2-3 dormant reconnect candidates.
- Every pick is traceable to a real roster row (grounding rule); no invented details.
- `verify-brief` returns `verified: true` (or its issues are visibly resolved/flagged
  in Data notes) before the brief is written up — no unverified brief reaches the CEO.
- All four failure modes produce a clear, actionable operator message — never a
  crash or a fabricated brief.
- Picks are stable run-to-run on unchanged data (pre-scoring reduces variance).

## 9. Future work
- Deliver the brief as PDF/email/Slack.
- Track week-over-week: who was recommended, who she actually contacted, outcomes.
- Live MCP sources per the Data Sourcing Strategy.
- Feedback loop: CEO marks picks helpful/not to tune scoring.
- At 500+ contacts, add a deterministic shortlist stage in the loader (pre-filter to
  goal-aligned/dormant candidates by score) before Select ever sees the roster —
  keeps context small and avoids "lost in the middle" inconsistency at scale.
