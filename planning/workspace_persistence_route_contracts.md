# Workspace Persistence Route Contracts

This is a planning document only. It defines the likely server repository and route boundaries for workspace persistence. It does not implement storage, routes, auth, Gemini, mock tutor behavior, or tests.

## Scope for the next small PR

The next implementation should stay small and only wire the minimum server boundary needed for workspace persistence behind the tutor route.

Recommended first slice:

- create the server repository layer for workspaces and sessions
- add a thin route/service boundary for `POST /api/tutor`
- keep the current tutor behavior mock-backed
- validate ownership before any write
- append the user message and tutor message in order
- write decision log entries only through a single repository contract

## Likely server repository boundaries

Use a later server-only layout such as:

- `src/server/workspaces/workspaceRepository.ts`
- `src/server/workspaces/sessionRepository.ts`
- `src/server/workspaces/messageRepository.ts`
- `src/server/workspaces/decisionLogRepository.ts`
- `src/server/workspaces/workspaceService.ts`

Suggested test layout:

- `tests/server/workspaces/workspaceRepository.test.ts`
- `tests/server/workspaces/sessionRepository.test.ts`
- `tests/server/workspaces/messageRepository.test.ts`
- `tests/server/workspaces/decisionLogRepository.test.ts`
- `tests/server/workspaces/workspaceService.test.ts`
- `tests/server/routes/tutorRoute.test.ts`

Notes:

- Keep repository code server-only.
- Keep route code thin and delegating.
- Keep any auth-dependent ownership checks outside the repository write methods when possible.
- Do not spread workspace persistence logic into frontend code or generic utility code.

## Route/API boundaries

The later API layer should be split into:

- route handler: parses request, checks auth context, returns HTTP response
- application service: owns orchestration and write ordering
- repositories: perform workspace/session/message/decision-log reads and writes

Route surface for the next step:

- `POST /api/tutor`

Planned request boundary:

- accepts the current user message and minimal routing context
- resolves the trusted authenticated user id on the server
- does not trust any client-supplied `uid`
- does not accept direct write instructions from the client

Planned response boundary:

- returns the tutor visible response
- may return lightweight metadata later if needed
- should not leak internal write details

## Minimal function contracts

These are the smallest contracts the later implementation should support.

### `createWorkspace`

Purpose:
- create a workspace for the authenticated user

Inputs:

- `uid`
- `name`
- optional `description`

Returns:

- created workspace record

Behavior:

- must set ownership to the trusted server-side `uid`
- must initialize timestamps
- must not write session data

### `listWorkspaces`

Purpose:
- list workspaces for one user

Inputs:

- `uid`

Returns:

- ordered workspace summaries

Behavior:

- only returns workspaces owned by that `uid`
- should stay lightweight and summary-only

### `getWorkspace`

Purpose:
- fetch one workspace by id

Inputs:

- `uid`
- `workspaceId`

Returns:

- workspace record or `null`

Behavior:

- must verify ownership before returning data
- should not expose other users' records

### `createSession`

Purpose:
- start a session inside a workspace

Inputs:

- `uid`
- `workspaceId`
- optional `title`

Returns:

- created session record

Behavior:

- must validate workspace ownership first
- should initialize message counters and timestamps
- should not write message bodies inline

### `appendMessage`

Purpose:
- append one transcript message to a session

Inputs:

- `uid`
- `workspaceId`
- `sessionId`
- `role`
- `content`
- optional `toolName`
- optional `toolCallId`

Returns:

- created message record

Behavior:

- must validate workspace ownership before write
- must preserve append order
- should update session summary fields such as `messageCount` and `lastMessageAt` if the later design wants that in one place

### `listSessionMessages`

Purpose:
- read the ordered transcript for a session

Inputs:

- `uid`
- `workspaceId`
- `sessionId`

Returns:

- ordered message list

Behavior:

- must validate ownership before read
- should return messages in sequence order

### `writeDecisionLogEntry`

Purpose:
- record a durable decision log entry

Inputs:

- `uid`
- `workspaceId` or `null`
- `sessionId` or `null`
- `decisionType`
- `title`
- `decision`
- `rationale`

Returns:

- created decision log record

Behavior:

- must use the trusted user id
- should support workspace-linked and user-level entries
- should stay append-only

## `POST /api/tutor` later behavior

Later, this route should do the following in order:

1. Read the authenticated user from the server auth context and treat that as the trusted `uid`.
2. Validate that the target workspace belongs to that `uid`.
3. Append the incoming user message to the session transcript.
4. Call the tutor provider.
5. For the next PR, that provider can be a mock tutor.
6. In the later Gemini PR, swap the provider behind the same service contract.
7. Append the tutor message to the same session transcript.
8. Return the visible tutor response to the client.

Important constraints:

- the client must not provide a trusted `uid`
- ownership validation must happen before any persistence write
- the user message must be persisted before the tutor response is generated
- the tutor response must be persisted after generation
- the route should not directly talk to Firestore once the service layer exists

## Keep the next implementation small

The next PR should avoid turning this into a general platform layer.

Keep it to:

- one tutor route
- one workspace/session/message repository family
- one orchestration service
- one mock tutor adapter
- one decision log writer contract

Defer everything else:

- session branching
- multi-provider routing
- retrieval
- memory writing
- transcript summarization
- analytics
- background jobs
- retries beyond the minimal route needs

## Testing strategy

Use tests to lock the boundary before expanding it.

Repository tests should cover:

- create workspace ownership
- list only the current user's workspaces
- get workspace ownership enforcement
- create session under owned workspace
- append message sequencing
- list messages in order
- decision log write shape and ownership

Route/service tests should cover:

- trusted server-side `uid` usage
- reject cross-user workspace access
- append user message before tutor generation
- append tutor message after generation
- mock tutor response path
- later provider swap stays behind the same service contract
- no persistence write when ownership validation fails

Keep tests narrow and local to the contract. The goal is to prove the write order and ownership rules before any richer tutor behavior lands.
