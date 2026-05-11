# Workspace Persistence Boundary

This document defines a planned workspace persistence boundary. It is a design note, not an implementation report. It does not claim production readiness.

## Purpose

The workspace boundary is for durable app state that belongs to a signed-in user and a specific workspace. It is intentionally narrow so we can persist the minimum useful state first and expand later without leaking unrelated data into Firestore.

## What will be stored first

The first planned storage layer should cover only lightweight workspace state, such as:

- workspace identity and display fields;
- workspace status and timestamps;
- workspace-level session indexes or summaries;
- small user-owned references needed to reopen a workspace later.

This first phase is about restoring the workspace shell, not storing full content history, learning data, or large payloads.

## Out of scope

The following are out of scope for the initial workspace persistence boundary:

- cloud deployment;
- production Firebase project wiring;
- secrets or service account handling;
- `.env` files or secret loading flows;
- file uploads or binary blobs;
- learner memory persistence;
- academic knowledge persistence;
- retrieval indexes;
- Genkit or Gemini integration;
- broad account settings or profile management.

## Emulator-first approach

The boundary should be developed and validated against the Firebase Emulator Suite first. Local emulator testing is the default path for this work.

That means:

- verify the schema and write paths locally;
- keep local configuration explicit and temporary;
- avoid depending on live cloud resources for the first implementation;
- treat emulator coverage as the acceptance target for the early phases.

## Relation to auth boundary

This workspace boundary depends on a separate auth boundary.

Auth answers the question "who is this user?" and workspace persistence answers "what workspace state belongs to that user?". The workspace layer should only operate on trusted user identity coming from the auth boundary, not from user-controlled request data.

That separation matters because it keeps identity enforcement and persistence concerns from collapsing into one brittle path.

## Expected implementation phases

### Phase 1

Create the minimal workspace document shape and write it through the emulator. Focus on workspace metadata only.

### Phase 2

Add session-level persistence needed to reopen an existing workspace and recover its basic state.

### Phase 3

Add more detailed workspace-associated records only when the product genuinely needs them, keeping each new collection or document type small and bounded.

### Phase 4

Only after the emulator path is stable should cloud project wiring and environment-specific deployment concerns be considered.

## Guardrails

- No cloud-first shortcuts.
- No secrets in repository files.
- No env file commitment as part of the boundary.
- No claim that this is finished, hardened, or production ready.

