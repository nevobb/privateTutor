# Gemini Integration Plan

This is a planning document. It does not add Gemini packages, API calls, runtime config, or secrets.

## Gemini-first MVP

Gemini is the planned first model provider for the MVP, but Gemini should be treated as an engine inside the product, not the product itself.

## Server-side API calls only

- Gemini calls must happen server-side.
- Frontend code must never import Gemini SDKs.
- Frontend code must never hold `GEMINI_API_KEY`.
- The first implementation should use a server boundary with mock provider fallback.

## No frontend keys

- No API keys in React components.
- No API keys in TypeScript app models.
- No provider secrets in Firestore provider settings.
- No real values in committed files.

## Structured output

Gemini responses must be requested as structured output with at least:

- visible response for Nevo
- citations/source IDs
- local question metadata
- retrieval decision metadata
- memory candidate metadata
- decision log event metadata

## Schema validation

- Validate model output before showing it.
- Reject malformed responses.
- Do not silently treat malformed output as success.
- Keep visible response separate from internal updates.

## Repair-once fallback

If structured output is invalid:

1. Retry once with a repair prompt.
2. If repair fails, return a safe visible fallback.
3. Log the failure in Decision Log later.
4. Do not pretend Gemini succeeded.

## Visible response vs internal updates

- `visible_response` is the Hebrew tutor answer shown to Nevo.
- `internal_updates` are for memory candidates, retrieval metadata, and decision logging.
- Internal updates must not be rendered as learner-facing text unless intentionally surfaced in a future UI.

## Model selection later by cost mode

- Cheap Practice should prefer lower-cost behavior and minimal retrieval.
- Normal Learning should use default model/retrieval behavior.
- Deep Research may allow stronger model settings, broader retrieval, and more citations.
- Do not build broad multi-provider UI in the MVP.

## No implementation in this PR

This PR does not:

- install Gemini packages
- call Gemini
- add `GEMINI_API_KEY`
- add environment files
- add model provider implementation
- add network calls
