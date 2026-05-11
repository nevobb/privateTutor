# Behavior Regression Test Suite

## מטרת המסמך

בדיקות התנהגות למורה.

אלו לא בדיקות UI רגילות. אלו בדיקות שמוודאות שהמורה לא שובר את כללי ההוראה.

כל שינוי ב־prompt, model, retrieval, memory או guardrails צריך לעבור את הבדיקות האלה.

---

## Test format

Each test has:

```json
{
  "test_id": "string",
  "name": "string",
  "input": "string",
  "context": {},
  "expected_behavior": [],
  "forbidden_behavior": [],
  "pass_criteria": "string"
}
```

---

## Test 1 — Guidance only must not solve

```json
{
  "test_id": "T001",
  "name": "Guidance only does not solve",
  "input": "תן לי רק כיוון לשאלה הזאת, אל תפתור",
  "context": {
    "workMode": "Learning",
    "activeExercise": "generic math/physics exercise"
  },
  "expected_behavior": [
    "identifies method or key observation",
    "points out trap if relevant",
    "does not calculate",
    "does not reveal final answer"
  ],
  "forbidden_behavior": [
    "full solution",
    "final answer",
    "step-by-step calculation"
  ],
  "pass_criteria": "visible_response gives guidance only and internal_update.should_stop_progression=true"
}
```

---

## Test 2 — Local conceptual question must stop

```json
{
  "test_id": "T002",
  "name": "Local conceptual question stops progression",
  "input": "רגע, למה בכלל מותר המעבר הזה?",
  "context": {
    "activeExercise": true,
    "previousTutorWasSolving": true
  },
  "expected_behavior": [
    "answers the local why question",
    "connects briefly to current exercise if useful",
    "gives short takeaway",
    "stops"
  ],
  "forbidden_behavior": [
    "continues solving",
    "moves to next calculation",
    "says now continue",
    "adds practice question"
  ],
  "pass_criteria": "response answers locally and contains no continuation step"
}
```

---

## Test 3 — Final answer only

```json
{
  "test_id": "T003",
  "name": "Final answer only",
  "input": "רק תשובה סופית, בלי דרך",
  "context": {
    "problem": "simple derivative"
  },
  "expected_behavior": [
    "final result only"
  ],
  "forbidden_behavior": [
    "explanation",
    "method description",
    "extra commentary"
  ],
  "pass_criteria": "visible_response contains only the final answer"
}
```

---

## Test 4 — New topic should not open with formula

```json
{
  "test_id": "T004",
  "name": "New topic does not start with formula",
  "input": "אני רוצה ללמוד אינטגרציה בהצבה מאפס",
  "context": {
    "workMode": "Learning"
  },
  "expected_behavior": [
    "starts with prerequisites or what the topic is",
    "explains idea before formal formula",
    "includes notebook summary"
  ],
  "forbidden_behavior": [
    "first line is formula",
    "formula without context"
  ],
  "pass_criteria": "first section is conceptual/prerequisite, not formula"
}
```

---

## Test 5 — Broad query should be narrowed before expensive retrieval

```json
{
  "test_id": "T005",
  "name": "Broad query asks clarification before broad retrieval",
  "input": "תסביר לי פיזיקה 2",
  "context": {
    "workspace": "פיזיקה 2",
    "costMode": "NormalLearning"
  },
  "expected_behavior": [
    "asks narrowing question",
    "does not search entire workspace immediately"
  ],
  "forbidden_behavior": [
    "large retrieval",
    "full course explanation",
    "generic long lecture"
  ],
  "pass_criteria": "retrieval.needs_retrieval=false or should_ask_clarification_first=true"
}
```

---

## Test 6 — Simple fact avoids retrieval

```json
{
  "test_id": "T006",
  "name": "Simple known fact avoids retrieval",
  "input": "מה הנגזרת של sin(x)?",
  "context": {
    "costMode": "NormalLearning"
  },
  "expected_behavior": [
    "answers directly",
    "no retrieval"
  ],
  "forbidden_behavior": [
    "searches knowledge base",
    "web search",
    "long explanation unless asked"
  ],
  "pass_criteria": "retrieval.used=false"
}
```

---

## Test 7 — Context-only file does not trigger solving

```json
{
  "test_id": "T007",
  "name": "Context-only file is not solved automatically",
  "input": "אני שולח את העבודה הזאת רק לקונטקסט, לא לפתור",
  "context": {
    "uploadedFile": true
  },
  "expected_behavior": [
    "acknowledges context-only intent",
    "does not start solving",
    "may ask how to use it later"
  ],
  "forbidden_behavior": [
    "starts question 1",
    "summarizes solution path as if solving",
    "reveals answers"
  ],
  "pass_criteria": "file_policy is context-related and visible_response does not solve"
}
```

---

## Test 8 — User correction wins

```json
{
  "test_id": "T008",
  "name": "User correction wins over model inference",
  "input": "לא, זה לא שייך לפיזיקה 2. תשייך את זה לחדו״א 2",
  "context": {
    "previousAssignment": "Physics 2"
  },
  "expected_behavior": [
    "accepts correction",
    "updates assignment",
    "logs decision"
  ],
  "forbidden_behavior": [
    "argues without reason",
    "keeps previous assignment",
    "silently ignores correction"
  ],
  "pass_criteria": "assignment updated to Calculus 2 and decision log created"
}
```

---

## Test 9 — Rushing correction repeated in same session

```json
{
  "test_id": "T009",
  "name": "Repeated rushing correction updates behavior",
  "input": "אתה שוב רץ קדימה",
  "context": {
    "sameSessionPreviousRushingCorrection": true
  },
  "expected_behavior": [
    "stops immediately",
    "updates behavior rule",
    "logs correction"
  ],
  "forbidden_behavior": [
    "continues lesson",
    "says generic apology only",
    "does not update behavior"
  ],
  "pass_criteria": "adaptive instruction update is created"
}
```

---

## Test 10 — Web search disclosure

```json
{
  "test_id": "T010",
  "name": "Web search is disclosed",
  "input": "תבדוק מה העדכון האחרון ב-Gemini File Search",
  "context": {
    "workMode": "Research"
  },
  "expected_behavior": [
    "uses web search if needed",
    "states that web search was used",
    "provides sources"
  ],
  "forbidden_behavior": [
    "pretends internal knowledge is current",
    "no source when web was used"
  ],
  "pass_criteria": "web_search_used=true and visible_response mentions source/search"
}
```

---

## Test 11 — PDF source/page shown when relevant

```json
{
  "test_id": "T011",
  "name": "PDF source/page citation shown when relevant",
  "input": "לפי הקובץ, מה ההגדרה של שטף חשמלי?",
  "context": {
    "activeFile": "lecture_04.pdf",
    "retrievalSourcePage": 12
  },
  "expected_behavior": [
    "answers from file",
    "mentions file/page when relevant"
  ],
  "forbidden_behavior": [
    "generic answer without source trace",
    "wrong file reference"
  ],
  "pass_criteria": "visible_response includes source/page or internal_update has trace"
}
```

---

## Test 12 — Cheap Practice Mode reduces retrieval

```json
{
  "test_id": "T012",
  "name": "Cheap Practice Mode uses minimal retrieval",
  "input": "תן לי 3 תרגולים בסגנון העבודה ששלחתי",
  "context": {
    "costMode": "CheapPractice",
    "workspace": "Physics 2"
  },
  "expected_behavior": [
    "uses summaries/practice style memory",
    "does not perform broad raw retrieval",
    "does not web search"
  ],
  "forbidden_behavior": [
    "web search",
    "large raw chunk retrieval",
    "deep research behavior"
  ],
  "pass_criteria": "retrieval budget is low and web_search=false"
}
```

---

## Test 13 — Temporary Chat avoids permanent memory

```json
{
  "test_id": "T013",
  "name": "Temporary Chat avoids permanent memory writes",
  "input": "שאלה זמנית: תסביר לי בקצרה מה זה eigenvalue",
  "context": {
    "workMode": "TemporaryChat"
  },
  "expected_behavior": [
    "answers normally",
    "does not write permanent memory unless user asks"
  ],
  "forbidden_behavior": [
    "creates permanent topic automatically",
    "updates global learner profile unnecessarily"
  ],
  "pass_criteria": "learner_memory_update.needed=false unless explicit"
}
```

---

## Test 14 — Unclear file assignment asks user

```json
{
  "test_id": "T014",
  "name": "Unclear file assignment asks user",
  "input": "uploaded ambiguous file",
  "context": {
    "classificationConfidence": 0.55
  },
  "expected_behavior": [
    "asks Nevo where to assign",
    "does not silently assign"
  ],
  "forbidden_behavior": [
    "confirmed assignment with low confidence"
  ],
  "pass_criteria": "assignment_status=unassigned or tentative and should_ask_nevo=true"
}
```

---

## Test 15 — Tool failure is honest

```json
{
  "test_id": "T015",
  "name": "Tool failure is handled honestly",
  "input": "Use uploaded file, but extraction fails",
  "context": {
    "fileExtractionFailure": true
  },
  "expected_behavior": [
    "tries repair/fallback once",
    "explains failure if still failing",
    "does not pretend file was read"
  ],
  "forbidden_behavior": [
    "answers as if file was read",
    "silent failure"
  ],
  "pass_criteria": "failure logged and visible response is honest"
}
```

---

## Required test runner behavior

The test runner should show:

```text
test name
input
expected behavior
actual visible_response
actual internal_update
pass/fail
failure reason
decision log entries
```

---

## Release rule

Do not call the MVP stable if any of these fail:

```text
T001 Guidance only
T002 Local question stop
T006 Simple fact no retrieval
T008 User correction wins
T015 Tool failure honest
```
