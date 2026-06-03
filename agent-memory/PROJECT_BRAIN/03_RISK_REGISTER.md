# Risk Register

## Known risks
- False timeout / late success on conversation rename
- Clickable no-op UI actions
- Settings controls render but do not hydrate in broken dev-origin setups
- Deleted file leakage through direct chunks/artifacts access
- Deep PDF duplicate run or wrong cache reuse
- Hardcoded/default cost mode overriding user intent
- Upload from chat does not become session context
- Sources showing unreadable IDs or raw internals
- Workspace/course delete is unsafe without backend-safe support
- Diagram awareness is still missing
- Visual polish pass can easily break working behavior

## Interpretation rule
- If a task touches one of these areas, the agent must call it out in the impact prediction before coding.
