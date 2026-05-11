# Workspace Persistence Boundary Report Draft

## Summary

This draft describes the planned workspace persistence boundary and the phased approach for implementing it. It is intentionally not a production-readiness statement.

## What will be stored first

The first implementation phase should store only the minimum durable workspace state required to reopen a workspace later. That includes:

- workspace identity;
- workspace name or label;
- workspace status;
- basic timestamps;
- small session references or summaries tied to the workspace.

The initial goal is to persist the workspace shell, not the full product surface.

## What is out of scope

Out of scope for this boundary:

- cloud deployment;
- production Firebase setup;
- secrets management;
- `.env` files;
- service account material;
- file/blob storage;
- learner memory;
- academic knowledge;
- retrieval indexes;
- Gemini or Genkit runtime work;
- anything that implies a production-ready persistence layer.

## Emulator-first approach

The planned implementation should start in the Firebase Emulator Suite and stay emulator-first until the local flow is stable.

The report expectation is:

1. define the boundary locally;
2. verify read/write behavior in the emulator;
3. keep the data model small and explicit;
4. defer cloud wiring until after the local path is proven.

## Relation to auth boundary

Workspace persistence is downstream from authentication.

The auth boundary establishes trusted user identity. The workspace boundary should then persist only data owned by that trusted identity. This keeps workspace records from becoming a substitute for auth and prevents request-body identity from being treated as authoritative.

## Expected future phases

### Phase 1

Persist the minimal workspace document and confirm it can be read back in local emulator testing.

### Phase 2

Add workspace session persistence and any small index documents needed to reopen the workspace cleanly.

### Phase 3

Expand the persisted surface only for clearly justified workspace state, with each addition reviewed against the boundary.

### Phase 4

Consider cloud project wiring and broader environment concerns only after the emulator workflow is stable and the auth boundary is already in place.

## Explicit non-goals

- no cloud;
- no secrets;
- no env files;
- no production claims;
- no broad persistence scope beyond the workspace boundary.

