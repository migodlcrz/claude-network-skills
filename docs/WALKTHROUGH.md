# Stakeholder Walkthrough — Network Focus Skill

This is the narrative I'd walk you (the CEO) through in a 5-minute demo. It covers
the problem I solved, the one decision that shaped everything, how it works, and
what I'd build next.

---

## 1. The problem, in your words

You have hundreds of contacts but your week gets eaten by whoever's already on your
calendar — not the relationships that actually move your three goals: Series C, the
CTO hire, and getting into the AI-safety conversation. You don't have time to audit
your network by hand every week. So I built a tool that does that audit for you and
hands your chief of staff a ranked shortlist every Monday.

## 2. The one decision that shaped everything

Everything hinges on one question: **will you trust the brief enough to plan your
week on it?**

If an AI reads your spreadsheet directly, it can quietly get a date wrong, misread a
relationship score, or blur two people together — and you'd never know. Once that
happens once, you stop trusting the whole thing.

So I drew a hard line:

> **Plain code owns the facts. The AI owns the judgment.**

A small, deterministic script reads and checks your spreadsheet and produces clean,
verified data. The AI never opens the spreadsheet — it only reasons over the checked
facts: which contact serves which goal, who's worth a reconnect, what the specific
opening is. Every recommendation traces back to a real row you can point at.

This also makes it debuggable for a non-technical operator: if something looks off,
it's either the data (the script says so, in plain English) or the judgment (one
place to look) — never a murky mix.

I deliberately rejected a flashier "two AI agents talking to each other" design: it
would have reintroduced exactly the trust problem I was trying to eliminate.

## 3. How your chief of staff uses it

Non-technical, one command:
1. One-time: run the installer, point it at the roster file.
2. Every Monday: open Claude Code, type `/network-brief`, read the brief.

No code, ever. Errors come back as plain-language instructions ("the file moved,
here's how to fix it"), never stack traces.

## 4. What the brief looks like

<!-- REAL_OUTPUT_PLACEHOLDER: paste the actual generated brief here once run on the
real roster, so the stakeholder sees a concrete example. -->

Each pick names the goal it serves, why it's worth your time *this* week
(relationship strength + how long it's been + the specific opening), and a concrete
next step. It always balances across your three goals rather than handing you five
investors and nothing on the CTO search.

## 5. When the data is imperfect (it always is)

I built in four honest failure modes instead of pretending the data is clean:
- **Someone named in your goals isn't in the roster** (e.g. a16z, Greylock) → the
  brief flags it and tells the operator to add them.
- **Stale or thin history** → the person can still be recommended, but marked
  low-confidence so you verify before reaching out.
- **The spreadsheet can't be read** → no brief is faked; the operator gets a clear
  fix.
- **A name is ambiguous** → it asks rather than guessing.

The rule throughout: **never fabricate a result.** A brief you can't trust is worse
than a brief that admits what it doesn't know.

## 6. What I'd build next

- Live data: pull last-contact info from Calendar and Gmail automatically, keep
  relationship strength and notes human-owned (the PRD's Data Sourcing Strategy
  lays this out).
- A feedback loop: track who you actually contacted vs. who was recommended, and
  tune from there.
- Delivery beyond chat: a formatted PDF or a Slack message Monday morning.

## 7. Why this is the right scope for a v1

It ships, it's trustworthy, and a non-engineer can run it Monday morning. Everything
fancier (live integrations, feedback loops, richer delivery) sits on top of this
same trust boundary without changing it — which is exactly what a good v1 should do.
