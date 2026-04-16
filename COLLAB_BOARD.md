# COLLAB_BOARD

Minimal strict protocol for CODEX ↔ CLAUDE collaboration.

## Session

- Type: `—` | BUG_FIX · FEATURE · REFACTOR · META · INVESTIGATION
- Status: `IDLE` | IDLE · ACTIVE · COMPLETED · ABORTED
- Reset: `2026-02-19`
- Topic: `—`
- Goal: `—`
- Done: `—`
- Stall: CHECK=15m, HANDOFF=10m

## State

- CLAUDE: `ON_HOLD` — PRIMARY
- CODEX: `ON_HOLD` — SECONDARY
- Valid: `START` · `WORKING` · `ON_HOLD` · `DONE`

## Turn Format

Each turn: heading `### TURN-{P|I}{n} ({ACTOR})` with required fields:

- **Header**: PART (PLAN|IMPL) · RESPONDS_TO (<turn>|NEW) · POINTS (<ids>|N/A)
- **Body**: FINDINGS · CHALLENGE · PROPOSAL — bullet list or N/A each
- **Evidence**: Disputed claims require ≥1: file:line, test output, doc ref, or step-by-step reasoning
- **Handoff**: Self WORKING→ON_HOLD, other ON_HOLD→START (only after content final)

## Point Tracker

| ID | Part | Title | Status | Resolved In |
|----|------|-------|--------|-------------|

Statuses: OPEN · AGREED · REJECTED · DEFERRED · OUT_OF_SCOPE. Prefixes: P* (plan), I* (impl).

## Rules

1. **Single State section** — hand-state lines appear only under `## State`.
2. **Session contract** — PRIMARY fills Session before PLAN; SECONDARY ACKs in first turn.
3. **Two phases** — PLAN → IMPLEMENTATION. IMPL starts only when no OPEN plan points + both `AGREE_FINAL_PLAN: YES`.
4. **State machine** — Receiver acts only on `START`. Enter: self→WORKING, other→ON_HOLD. Exit: self→ON_HOLD, other→START. No parallel turns.
5. **Stall recovery** — No update for CHECK → log `STALL_CHECK`. Still silent after HANDOFF → set stalled ON_HOLD, self→START.
6. **Deadlock** — Max 3 unresolved turns/point → PRIMARY decides: `DECISION: <id> → ACCEPT|REJECT|DEFER`.
7. **Impl authority** — Only PRIMARY edits project files (except this board). SECONDARY reviews. Each impl turn records `BRANCH`, `BASE_COMMIT`, `LATEST_COMMIT`.
8. **Terminal** — COMPLETED/ABORTED sets both hands DONE; no new turns after.

## PLAN

AGREE_FINAL_PLAN: NO

## IMPLEMENTATION

AGREE_FINAL_IMPLEMENTATION: NO
