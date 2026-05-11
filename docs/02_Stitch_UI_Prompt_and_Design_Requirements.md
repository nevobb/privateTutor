# Stitch UI Prompt & Design Requirements

## מטרת המסמך

מסמך זה מיועד ל־Stitch. הוא מגדיר את עיצוב הממשק הראשוני של המורה הפרטי.

המטרה אינה ליצור “אפליקציית לימודים יפה”. המטרה היא ליצור סביבת עבודה אקדמית שבה נבו יכול ללמוד עם מורה אישי, לעבוד עם קבצים, לפתוח מרחבי עבודה לפי קורסים, ולעבור בין מצבי עבודה בצורה אינטואיטיבית.

---

## Design direction

Build a desktop-first responsive Hebrew RTL web app for a personal adaptive academic tutor.

The app should feel like:

```text
private tutor workspace
academic learning environment
calm focused study desk
```

It should not feel like:

```text
gamified course platform
LMS
customer support chat
children's learning app
feature-heavy analytics dashboard
```

---

## Main UI principles

1. Desktop-first layout.
2. Hebrew RTL interface.
3. Mobile usable but not primary.
4. Workspace-first navigation.
5. Tutor conversation is central, but not the only thing on screen.
6. Documents and context must be visible while learning.
7. UI must not push unnecessary next actions.
8. Hidden advanced controls for technical logs/settings.
9. Minimal visual noise.
10. Serious, focused, academic style.

---

## Required screens

### 1. Main Tutor Workspace

This is the main learning screen.

Desktop layout:

```text
[Left / secondary panel]    [Center main area]        [Right context panel]
Workspace tree              Tutor conversation         Active file / notes
Mode switch                 Scratchpad / answer area   Retrieved sources
Cost mode                   Current topic              Session memory mini-card
```

Because the app is RTL, Stitch should visually adapt the layout so navigation and reading feel natural in Hebrew.

Required elements:

- workspace name at top
- mode selector: Learning / Practice / Research / Build / Temporary Chat
- cost mode selector: Cheap Practice / Normal Learning / Deep Research
- tutor chat area
- file upload/drop zone
- active document preview
- current context indicator
- subtle “memory status” indicator
- hidden advanced menu entry

Tone of the screen:

```text
Clean.
Dense but readable.
Academic.
No gamification.
No badges, streaks, XP, or childish icons.
```

---

### 2. Workspace Manager

Nevo must be able to create and organize workspaces manually.

Required features:

- create workspace
- rename workspace
- move workspace into folder
- archive workspace
- view workspace path
- view workspace internal ID only in advanced details
- create folders such as Year / Semester

Example structure:

```text
שנה א
└── סמסטר ב
    ├── פיזיקה 2
    ├── חדו״א 2
    └── אלגברה ליניארית
```

Important design note:

The user sees a natural folder tree. The internal stable `workspace_id` is not shown unless advanced mode is open.

---

### 3. File Library / Knowledge Base

This screen shows files inside the active workspace.

Required elements:

- list of files
- file type: PDF / DOCX
- indexing status
- assigned topic
- summary status
- source role: knowledge source / practice context / temporary reference
- duplicate indicator
- confidence indicator for automatic classification
- action: confirm assignment
- action: change topic
- action: remove from knowledge base

Do not over-design this as a file management enterprise system. Keep it simple.

---

### 4. Learner Memory Viewer

This is not the main screen. It can be under Settings / Advanced.

Purpose:

Nevo can see what the tutor remembers about him.

Sections:

- teaching preferences
- recurring difficulties
- explanation styles that worked
- explanation styles that failed
- behavior corrections
- current learning trajectory
- active adaptive instructions

Actions:

- edit memory
- delete memory
- mark as wrong
- approve proposed memory
- reject proposed memory

Design style:

```text
Transparent but not noisy.
Readable cards.
No emotional language.
```

---

### 5. Decision Log

Hidden technical screen.

Language: technical English.

Purpose:

Debugging and transparency.

Show entries like:

```json
{
  "decision_type": "retrieval_scope",
  "active_workspace_id": "physics_2_2026",
  "reason": "User is currently inside Physics 2 workspace",
  "retrieval_scope": "workspace_only",
  "top_k": 4,
  "web_search": false,
  "timestamp": "2026-05-11T18:42:00+03:00"
}
```

This screen must not appear in the main learning flow.

---

### 6. Settings / Provider Settings

Required sections:

- API provider settings
- Gemini API key / environment status
- future provider slots
- default model
- cheap model
- deep model
- web search provider
- retrieval provider
- cost limits

Do not expose API keys in the frontend in the real app. This screen should show status and configuration, not raw secrets.

---

### 7. Behavior Test Screen

This can be hidden under Advanced / Developer.

Purpose:

Run behavior regression tests.

Required elements:

- list of tests
- run all tests
- run selected test
- pass/fail result
- model response
- expected behavior
- failure reason

Example tests:

```text
Guidance only must not solve.
Local question must stop.
Broad question must ask to narrow.
Context-only file must not trigger solving.
```

---

## Main Stitch prompt

Paste this into Stitch:

```text
Design a desktop-first responsive Hebrew RTL web app for a personal adaptive academic tutor.

The product is a private academic tutor workspace, not a course platform and not a generic chatbot.

Primary user: Nevo, a university student who wants a patient adaptive tutor that learns how he learns over time.

Core design goals:
- desktop-first
- Hebrew RTL
- serious academic style
- clean and focused
- no gamification
- no childish visuals
- no unnecessary analytics dashboard
- support long study sessions on a computer

Main app concepts:
1. User-managed workspaces
   The user can create folders/workspaces such as פיזיקה 2, חדו״א 2, שנה א / סמסטר ב.
   Workspaces behave like learning folders.
   The tutor uses the active workspace as context.

2. Main Tutor Workspace screen
   Include:
   - workspace tree/navigation
   - mode selector: Learning, Practice, Research, Build, Temporary Chat
   - cost mode selector: Cheap Practice, Normal Learning, Deep Research
   - central tutor conversation
   - document/context panel
   - upload area for PDF/DOCX
   - scratchpad or working area
   - subtle current context indicator
   - subtle memory status indicator

3. File Library screen
   Show files in the active workspace with:
   - file name
   - file type
   - assigned topic
   - indexing status
   - summary status
   - source role: knowledge source / practice context / temporary reference
   - confirm or change assignment actions

4. Learner Memory Viewer
   Hidden/secondary screen where Nevo can inspect and edit what the tutor remembers:
   - teaching preferences
   - recurring difficulties
   - explanation styles that worked
   - explanation styles that failed
   - behavior corrections
   - adaptive instructions

5. Hidden Decision Log
   Technical English log, not part of the main learning UI.

6. Settings / Provider Settings
   Show model provider status, retrieval provider status, web search provider status, and cost modes.

Visual style:
- calm
- focused
- academic
- readable
- modern but not flashy
- dense enough for serious study
- no XP, streaks, points, badges, or gamified elements

Responsive behavior:
- desktop layout is primary
- mobile should be usable for quick review and short questions
- no native mobile app design required
```

---

## Follow-up prompts for Stitch

### If Stitch makes it too gamified

```text
Remove all gamification, badges, streaks, points, playful illustrations, and motivational UI. This should look like a serious academic workspace for long study sessions, not a learning game.
```

### If Stitch makes it too much like a chatbot

```text
This should not be only a chatbot. Add a strong workspace structure, document/context panel, file library, and current learning context. The chat is central, but the product is a tutor workspace.
```

### If Stitch ignores RTL

```text
Convert the entire interface to Hebrew RTL. Navigation, reading flow, panels, labels, and document context should feel natural for Hebrew users.
```

### If Stitch makes too many dashboards

```text
Reduce analytics and dashboard elements. The main experience is studying with a tutor, not watching graphs. Keep only subtle status indicators.
```

### If Stitch hides files too much

```text
Make files and active documents more visible. The tutor must work with PDF/DOCX course materials, so the active document/context panel is important.
```

---

## Design acceptance checklist

A good Stitch result must include:

```text
Desktop-first layout
Hebrew RTL
Workspace/folder navigation
Main tutor conversation
Document/context panel
PDF/DOCX upload area
Mode selector
Cost mode selector
File library
Memory viewer
Hidden decision log
Settings/provider screen
No gamification
No unnecessary analytics dashboard
```

Reject the design if:

```text
It looks like a generic chatbot.
It looks like a children’s learning app.
It hides files/document context.
It has no workspace structure.
It is mobile-first.
It is LTR-first.
It adds gamification.
It makes memory/decision log part of the main screen.
```
