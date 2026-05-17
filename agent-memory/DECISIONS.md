# Decisions

This file records approved project decisions for privateTutor.
Do not treat ideas or open questions as decisions.

| Step / Date | Decision | Reason | Status |
|---|---|---|---|
| Product direction | privateTutor is a personal adaptive academic tutor, not an LMS, dashboard, generic chatbot, or agent platform. | Product must stay focused on understanding before progress. | Approved |
| Product direction | Build a deeper personal tutor, not a broader learning platform. | DeepTutor research showed platform sprawl risk. | Approved |
| UX direction | Main chat remains the visual center. | The product should feel like a personal tutor workspace, not a management dashboard. | Approved |
| Step 38C/38D | UI direction is calm study desk / personal tutor workspace. | Nevo rejected noisy/dashboard-like UI and wanted a modern, calm, warm, personal learning space. | Approved |
| UX layout | Sidebar is physically on the left for now, with possible future option to switch. | Nevo preferred modern app convention while keeping future flexibility. | Approved |
| Step 38C/38D | Work modes are visually simplified: Learn and Practice are primary; Research is secondary/advanced. | Avoid overloading the interface. | Approved |
| Step 39 | Browser must not own tutor response generation after Step 39. | Session transcript boundary moved tutor turn generation to the server. | Approved |
| Step 39 | Session transcripts persist by session. | Refresh and session switching must preserve conversation continuity. | Approved |
| Security baseline | Firestore rules must remain strict owner-only. | No global server-emulator bypass or cross-user leak. | Approved |
| Data model direction | Learner Memory must remain separate from Academic Knowledge. | User learning behavior and academic source content are different domains. | Approved |
| Step 39.6A | Repo-native project memory is the source of truth for agents. | Avoid dependency on chat history or manual prompt passing. | Approved |
| Workflow boundary | Subspace may be used as an external workflow tool, but is not part of the MVP architecture. | Avoid external workflow dependency inside the product. | Approved |
| Process | Agent branches must start from origin/main and PR base must be main. | Prevent dirty PRs and wrong-base history issues. | Approved |
| Step 39.5 | Forbidden artifacts from AGENT_TASK_PROTOCOL.md must not enter PRs. | Prevent `docs/superpowers`, logs, `.codex`, screenshots, and unrelated files from polluting PRs. | Approved |
