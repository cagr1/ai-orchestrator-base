# OrchestOS — Professional Workflow Guide

This document answers: **how does a professional use Claude Code without repeating context every session?**

---

## The Core Problem (and the solution)

Context repetition happens when you treat the **conversation** as the memory system.
Every new session, you re-explain the architecture, the rules, the current state.

The fix: externalize state into files that Claude reads automatically. The conversation becomes a workspace, not a history book.

```
WRONG:  User explains context → Claude works → context lost next session
RIGHT:  Files hold context → Claude reads files → works → updates files → next session reads them
```

---

## How the system is wired (automatic context)

### Layer 1 — CLAUDE.md (always loaded, zero effort)

`CLAUDE.md` in the project root is loaded automatically at the start of every Claude Code session.
Put here: system overview, key file locations, execution rules, agent roles.

You already have this. It means you never have to explain what OrchestOS is.

### Layer 2 — .claude/PROJECT_INSTRUCTIONS.md (loaded as project context)

Loaded alongside CLAUDE.md. Put here: session protocol, what to read before acting.

**Current content**: "Read PROJECT_STATE.md and NEXT_ACTIONS.md before acting. One blocker at a time."

This is the discipline rule Claude follows every session without you asking.

### Layer 3 — The 5 control docs (Claude reads on demand, prompted by PROJECT_INSTRUCTIONS)

- `PROJECT_STATE.md` — where the system is right now
- `NEXT_ACTIONS.md` — what to do next, in priority order
- `WORKFLOW_RULES.md` — constraints that cannot be violated
- `CHANGELOG_EXECUTION.md` — audit trail of every change
- `SYSTEM_MAP.md` — how the system actually works (verified, not assumed)

These docs replace the need to re-explain. Claude reads them at session start and has full context.

### Layer 4 — .claude/agents/ (specialized subagents)

Instead of asking Claude to "review this change", you invoke a specialized agent:

- `arch-reviewer` — evaluates if a runner.js change is structural or symptomatic
- `patch-worker` — applies a surgical fix when the breakpoint is already known
- `repo-explorer` — traces execution paths before any fix is proposed

Each agent has its own memory, prompt, and tool access. You don't re-explain their role.

### Layer 5 — Memory system (.claude/memory/ and auto-memory)

Claude's persistent memory across sessions. Stores:
- What you've learned about the user's preferences
- Feedback on what approaches worked/failed
- Project decisions that aren't in the code

---

## Concrete session examples

### Opening a new session (the right way)

```
Read PROJECT_STATE.md and NEXT_ACTIONS.md.
What is the current P1 blocker and what's the plan?
```

Claude reads the docs, tells you the active blocker, and proposes the next step.
You didn't explain anything. The docs did.

---

### Delegating a known fix

```
The hash comparison in runner.js line 840 uses a stale hash after an async LLM call.
Fix it using patch-worker.
```

Claude invokes `patch-worker` with the exact breakpoint. The agent reads the file,
applies the minimal change, and returns a diff with validation steps.
You didn't explain how patch-worker works — its prompt handles that.

---

### Structural change review

```
I want to add Engram integration to runner.js.
Before implementing, run arch-reviewer on the proposed approach.
```

Claude invokes `arch-reviewer`. The agent reads runner.js, evaluates the change
against loop closure, state integrity, and evidence preservation, and returns
a structured verdict. No re-explaining of OrchestOS internals.

---

### Closing a session (the right way)

```
Session complete. Update the 5 control docs with what changed today.
```

Claude updates CHANGELOG, PROJECT_STATE, and NEXT_ACTIONS.
Next session opens with accurate state. No repetition.

---

## Why this works (the principle)

Claude Code sessions are stateless by default — each one starts fresh.
But the **filesystem is persistent**. By writing decisions, state, and context into files,
you move memory from the conversation (volatile) to the codebase (durable).

The professional workflow is:
1. **Write rules into files** (CLAUDE.md, PROJECT_INSTRUCTIONS.md, WORKFLOW_RULES.md)
2. **Write state into files** (PROJECT_STATE.md, NEXT_ACTIONS.md)
3. **Write history into files** (CHANGELOG_EXECUTION.md)
4. **Tell Claude to read before acting** (PROJECT_INSTRUCTIONS.md does this automatically)
5. **Update files at session end** (keeps context fresh for next time)

You become the director. Claude reads the files and executes.
You never repeat yourself because the files remember.

---

## What you have vs what's still missing

### Already working
- CLAUDE.md loads automatically
- PROJECT_INSTRUCTIONS.md loads automatically
- 5 control docs exist and are up to date
- arch-reviewer and patch-worker agents are configured
- DEFAULT_PROMPT.md updated to reflect current phase

### Still pending
- Engram integration (cross-run planner memory — P4 in NEXT_ACTIONS)
- model-per-skill config (Codex for code, minimax for drafts — P2)
- Resume button in dashboard (P3)

### How to open the next session with zero context loss

```
(Claude Code reads CLAUDE.md and PROJECT_INSTRUCTIONS.md automatically)

Then you type:
"Read PROJECT_STATE.md and NEXT_ACTIONS.md. What's P1?"
```

That's it. Full context in two lines.

---

## The one mistake to avoid

**Do not put session state in the conversation.**

Saying "remember we fixed T6 last time" works only in this conversation.
Writing it in CHANGELOG_EXECUTION.md works in every future conversation.

If it's worth remembering, write it to a file.
