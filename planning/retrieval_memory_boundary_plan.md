# Retrieval and Memory Boundary Plan

This is a planning document. It does not implement retrieval, Gemini File Search, Google Search Grounding, persistence, or memory writes.

## Strict separation

Learner Memory and Academic Knowledge must stay separate.

Learner Memory stores:

- how Nevo learns
- pacing preferences
- recurring difficulties
- user corrections
- teaching behavior rules
- durable learning preferences

Academic Knowledge stores:

- files
- source metadata
- summaries
- concepts
- citations
- course material
- generated academic practice material when explicitly requested later

## Retrieval routing before retrieval

Every user message should be routed before retrieval. The router should decide:

- whether retrieval is needed
- retrieval scope
- whether clarification is needed first
- retrieval budget
- whether web search is allowed
- whether no retrieval is safer

## Allowed retrieval scopes

- `none`
- `session`
- `topic`
- `workspace`
- `concept_library`
- `global_learner_memory`
- `web`

No whole-knowledge-base retrieval by default.

## Cost mode effect

- Cheap Practice: minimal retrieval, no web by default, prefer summaries and local reasoning.
- Normal Learning: workspace-scoped retrieval, summaries first, limited chunks, web only when justified.
- Deep Research: broader retrieval, raw chunks when needed, more citations, web allowed when justified.

## Work mode effect

- Learning: default patient explanation, source-aware when needed.
- Practice: lower-cost, hint-oriented, minimal retrieval.
- Research: broader source use and citations.
- Build: implementation-focused, still source-aware.
- Temporary Chat: no automatic permanent memory or knowledge writes.

## Temporary Chat policy

Temporary Chat may use current context for the answer, but must not automatically write:

- durable learner memory
- academic knowledge
- adaptive instructions
- permanent workspace structure

Any permanent write from Temporary Chat requires explicit user approval in a later implementation.

## Source and citation policy

- Cite course/file sources when academic material is used.
- Disclose web search when web search is used.
- If web sources conflict with course material, report the conflict instead of silently choosing.
- Simple known academic facts may avoid retrieval when confidence is high.

## No whole-KB retrieval by default

Broad questions should be narrowed before expensive retrieval. Retrieval should start with metadata filtering, then summaries, then narrow source chunks when necessary.
