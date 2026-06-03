# Diagram Awareness Diagnostic

## Branch / working tree
- Branch: `repair/workspace-cleanup-fit-check`
- Working tree at audit start was **not clean**:
  - `src/app/globals.css`
  - `src/components/tutor/TutorConversation.tsx`
  - `src/components/workspaces/WorkspaceSelector.tsx`
- Those files are unrelated to this diagnostic and were left untouched.

## Root cause hypothesis
The current behavior is most likely caused by a **combination** of issues, not a single missing toggle:

1. **Deep PDF can run, but its schema is still mostly text/structure-oriented.**
   The Gemini Deep PDF provider is asked to be honest about unclear formulas/diagrams, but it is **not asked to produce first-class diagram/circuit descriptions** as a dedicated output artifact.

2. **There is no persisted field specifically for diagram/figure/circuit descriptions.**
   The persisted artifacts are pages, outline sections, and detected questions. None of those has a dedicated visual-description slot.

3. **Tutor grounding still treats retrieved chunk text as the evidence source of truth.**
   Artifact-aware grounding only adds locator hints. It does not inject a structured “diagram description” artifact because no such artifact exists.

4. **There is still explicit prompt/routing language that says visual diagrams are not analysed.**
   So even if Deep PDF helped extract better structure, the tutor is still being told to preserve a text-only limitation, and some requests are hard-routed to a visual-limitation shortcut before any Deep PDF-aware tutor path can help.

## Deep PDF status path
### Does Deep PDF run at all?
Yes, it can.

- Deep PDF orchestration is implemented in `/Users/nevobiton/private-tutor-project/privateTutor/src/server/workspaces/deepPdfOrchestrationService.ts`.
- It:
  - loads the file
  - checks cache/policy
  - loads PDF bytes
  - calls `deps.deepPdfProvider.run(...)`
  - persists pages / outline / detectedQuestions
  - marks `deepPdfStatus = "completed"`

### Important clarification
There is **no separate file** named `geminiPdfUnderstandingProvider.ts` in this repo.
The Gemini provider implementation lives inside:
- `/Users/nevobiton/private-tutor-project/privateTutor/src/server/workspaces/documentUnderstandingProvider.ts`

So the Deep PDF path exists, but it is not yet a diagram-aware tutoring path in the richer sense Nevo wants.

## Provider prompt/schema
### 1. Does the Gemini provider ask for diagrams/figures/circuits/visual layout?
**Partially, but weakly.**

In `/Users/nevobiton/private-tutor-project/privateTutor/src/server/workspaces/documentUnderstandingProvider.ts`, `buildGeminiDocumentPrompt(...)` says:
- “If formulas, diagrams, or visual elements are unclear, mark them as low-confidence...”

That is an **honesty instruction**, not a **diagram extraction contract**.

It does **not** explicitly say things like:
- describe the circuit topology
- capture figure captions
- summarize graph axes/trends
- produce per-diagram notes
- extract visual layout into structured fields

### 2. Does the output schema have a field for diagram descriptions?
**No.**

Current Gemini structured output shape includes:
- `pageCount`
- `pages[]` with text/textQuality
- `outline`
- `detectedQuestions[]`
- `qualitySignals`
- `extractionQuality`
- `confidence`
- `warnings`

There is **no dedicated field** like:
- `diagramNotes`
- `figureDescriptions`
- `circuitDescriptions`
- `visualSummaries`
- `pageVisualSummary`

So even if Gemini informally notices a circuit/diagram, the code has nowhere explicit to keep it except maybe loose text inside question `textPreview` or page text.

## Artifact persistence
### Are diagram descriptions persisted anywhere?
**Not as a first-class concept.**

Persisted artifacts in `/Users/nevobiton/private-tutor-project/privateTutor/src/server/workspaces/documentArtifactRepository.ts` are:
- `pages`
- `documentOutline`
- `detectedQuestions`

Those records preserve:
- extracted/cleaned page text
- section labels/titles/page refs
- detected question labels/summaries/page refs/confidence

But there is **no explicit persisted visual-description field** in the artifact model.

So even when Deep PDF completes successfully, there is no durable “this circuit shows X, these nodes connect Y/Z, this graph trends upward” artifact for tutor runtime to reuse.

## Tutor context
### Are diagram descriptions included in grounding context?
**No, not directly.**

Artifact-aware grounding in `/Users/nevobiton/private-tutor-project/privateTutor/src/server/workspaces/sessionMessageApiService.ts` can add:
- matched question label
- page label
- clean question summary/topic/extraction note
- page text hint
- a Deep PDF status note

But it still does **not** inject dedicated diagram/circuit descriptions, because none are stored.

Also, the grounding note explicitly says to:
- rely on retrieved chunk text for actual claims
- especially around formulas or diagrams

That means artifacts are only navigational hints; they do not replace the text-chunk evidence path.

### Is the answer likely coming from text-only chunks instead of Deep PDF artifacts?
**Very likely, yes — at least for factual answering.**

Current grounded tutor flow still uses:
- retrieved chunks as evidence
- artifact hints only as locator/context steering

So if the PDF understanding helped identify question structure but did not persist diagram meaning, the tutor still ends up answering from text-heavy chunks and preserving a text-only caution.

## Inventory behavior
### Are diagram descriptions included in inventory answers?
**No.**

`/Users/nevobiton/private-tutor-project/privateTutor/src/server/tutor/fileInventoryService.ts` focuses on:
- question/section labels
- clean text details
- page labels
- extraction quality tone

It has no visual-description rendering path.

Even with `deepPdfStatus === "completed"`, the inventory becomes more confident about structure, but not about visual diagrams/circuits specifically.

## Prompt behavior
### Does the prompt explicitly tell the tutor diagrams may not be visible?
**Yes — strongly.**

In `/Users/nevobiton/private-tutor-project/privateTutor/src/server/tutor/deepseekGroundingPrompt.ts` the grounding section always includes:
- “Visual limitation (state only when directly relevant): current analysis is text-based; visual diagrams and circuits are not analysed at this time.”

This is a very strong residual instruction.

### Does routing also enforce this?
**Yes.**

In `/Users/nevobiton/private-tutor-project/privateTutor/src/server/workspaces/sessionMessageApiService.ts`:
- `visual_reference_request` is still a deterministic shortcut
- it returns a hard-coded limitation response saying the tutor does not visually analyze graphs/circuits/diagrams from PDF

So for explicit diagram-style questions, the system still bypasses any nuanced Deep PDF-aware tutor behavior and goes straight to the visual-limitation answer.

## Likely reason for "text-only" claim
Most likely explanation:

### If the user asked an explicitly visual question
Example: “תסביר את השרטוט”, “מה רואים במעגל”, “מה יש בגרף”

Then the answer is probably coming from:
- `requestClassification.intent === "visual_reference_request"`
- which triggers the deterministic visual shortcut in `sessionMessageApiService.ts`

That path **does not consult Deep PDF artifact content at all**.

### If the user asked a normal content question
Then the answer may still say something like diagrams aren’t visible because:
- grounding prompt still injects the text-based visual limitation line
- retrieval still depends on chunks as evidence
- Deep PDF artifacts do not contain first-class diagram descriptions

So the tutor can identify question structure and numeric values, but still honestly concludes it does not have robust diagram semantics.

## Direct answers to the diagnostic questions
### 1. Does the Gemini Deep PDF provider ask Gemini to describe diagrams, figures, circuits, graphs, and visual layouts?
- **Not strongly enough.** It only asks Gemini to mark unclear formulas/diagrams honestly.
- It does **not** define a dedicated extraction contract for diagram/circuit/graph descriptions.

### 2. Does the output schema have any field for visual descriptions / figures / diagrams?
- **No.**

### 3. Are diagram descriptions persisted anywhere?
- **No dedicated persistence path exists for them.**

### 4. Are diagram descriptions included in inventory answers?
- **No.**

### 5. Are diagram descriptions included in grounding context for tutor answers?
- **No dedicated diagram descriptions are injected.** Only question/page text hints and status notes.

### 6. Does the prompt explicitly tell the tutor that diagrams may not be visible?
- **Yes.** Both the grounding prompt and the visual-reference shortcut do this.

### 7. Under what file state would the tutor say "text-only recognition"?
- If the request is classified as `visual_reference_request`, regardless of Deep PDF completion.
- Also when grounded answering still relies on chunk evidence and the prompt keeps the visual limitation active.

### 8. Is the answer likely coming from text-only chunks instead of Deep PDF artifacts?
- **Yes, for the actual factual answer path.** Deep PDF currently improves structure more than visual meaning.

### 9. What minimal fix would make physics circuit diagrams visible enough for tutoring?
- Add a **small visual-description field** to Deep PDF output/artifacts, such as per-question or per-page `diagramNote` / `visualSummary`.
- Populate it only when Gemini can confidently describe a figure/circuit/graph from the PDF.
- Thread that field into artifact-aware grounding for explicit section/page questions.
- Narrow the visual-limitation prompt so it only applies when no Deep PDF visual note exists.

### 10. What should be deferred?
- Full page-image / Gemini Vision pipeline
- OCR
- general real-time visual reasoning over arbitrary images
- broad retrieval redesign
- richer multimodal tutoring claims before the artifact model supports them

## Recommended smallest fix
**Smallest useful repair:**
1. Extend `buildGeminiDocumentPrompt(...)` to explicitly request:
   - brief circuit/diagram/graph descriptions when visible
   - figure/caption-level notes
   - uncertainty when not clear
2. Add one narrow structured field to Deep PDF output, for example:
   - `visualSummary?: string` on page artifacts, or
   - `diagramNote?: string` on detected questions/sections
3. Persist that field in existing artifacts
4. Use it only in artifact-aware grounding for relevant question/page references
5. Relax the tutor’s visual-limitation wording **only when such a visual note exists**

That would be a contained Batch-sized fix without jumping to Phase E page-image vision.

## Recommended robust fix
**Robust fix:**
- Add a proper diagram-aware artifact layer with fields such as:
  - `figureDescriptions[]`
  - `diagramNotes[]`
  - `circuitSummary`
  - `graphSummary`
  - page-level visual references tied to sections/questions
- Then teach tutor runtime to:
  - prefer those artifacts for explicit visual/circuit/graph questions
  - fall back to chunk text when they are absent
- Keep page-image/Vision as a later upgrade for cases where PDF-native extraction still misses the visual semantics.

## Risks
- If we only weaken the prompt wording without adding visual artifacts, the tutor may overclaim visual understanding.
- If we add free-text visual summaries without confidence/uncertainty rules, physics tutoring could become too confident about diagrams.
- If we try to solve this by broad visual routing first, we’ll overcomplicate runtime before the artifact model is ready.

## Clear conclusion
This is **not primarily a “Deep PDF didn’t run” diagnosis**.

The strongest current diagnosis is:
- Deep PDF may very well be running,
- but the provider/artifact model is still **structure-first, not diagram-description-first**,
- and tutor routing/prompting still contains **hard text-only visual limitation behavior**.

## Ready for repair
- **YES**

## Safety
- I did not change code.
- I did not change Deep PDF behavior.
- I did not change retrieval.
- I did not run `git add`.
- I did not commit.
- I did not push.
- I did not run `git pull`.
