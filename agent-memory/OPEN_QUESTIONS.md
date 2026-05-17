# Open Questions

This file tracks unresolved questions that require Nevo's decision.
Do not treat these as approved decisions.

## Active questions

### Q1 — Step 40 implementation shape

Question:
Should Step 40 be:
A. provider abstraction / Gemini-Genkit preflight first
B. direct Gemini + Genkit integration

Recommendation:
Do provider abstraction / preflight first unless Nevo explicitly approves direct connection.

Why it matters:
Direct Gemini/Genkit integration may require package/env/provider decisions. The project should avoid adding secrets, packages, or provider behavior without explicit approval.

Status:
Open

### Q2 — Gemini model choice for MVP

Question:
Which Gemini model should be used first for MVP tutor responses?

Recommendation:
Decide only when starting the real provider step. Keep mock provider as fallback.

Status:
Open

### Q3 — Secret handling and environment setup

Question:
Where should local Gemini/Genkit secrets live for development, and what exact env variable names should be used?

Recommendation:
Use local env only, never frontend code, never committed files. Decide before real provider connection.

Status:
Open

### Q4 — Retrieval timing

Question:
Should retrieval begin immediately after Gemini/Genkit, or should the first real provider step remain non-retrieval?

Recommendation:
First connect real tutor provider without retrieval. Add retrieval later as a separate boundary.

Status:
Open

### Q5 — File upload timing

Question:
When should file upload / Firebase Storage be introduced?

Recommendation:
After provider boundary and before retrieval, unless Nevo changes priority.

Status:
Open
