# privateTutor — תמונת מצב עדכנית

תאריך: 2026-06-03  
גרסה: v0.2 — עודכן לפי החלטות נבו  
מטרה: קובץ מצב מפורט לסוכנים ולנבו: איפה הפרויקט עומד, מה הוטמע, מה תוקן, מה עדיין שבור/חסר, ומה ההחלטות המחייבות להמשך.

---

## 0. החלטות מוצר חדשות שננעלו

### קונטקסט קבצים בשיחה

1. קובץ שנבחר דרך `Use in chat` נשאר active context לכל השיחה עד שנבו מחליף אותו או מנקה אותו.

2. אם נבחרים כמה קבצים, המורה יעבוד עם כולם יחד, אבל נבו ייתן לו הוראות מה לעשות איתם.  
   לדוגמה:
   - "השווה בין שני הקבצים"
   - "תשתמש בקובץ הראשון כפתרון ובשני כשאלות"
   - "תתמקד רק בקובץ השני"

3. צריך לתכנן עתידית כפתור `Clear context` כדי למנוע הצפת קונטקסט.  
   זה לא חייב להיכנס בשלב הראשון, אבל צריך להיות חלק מהמודל.

4. כפתור/פעולה להוספת חומר מהקורס צריך להיקרא בעברית:
   ```text
   בחר חומר מהקורס
   ```

5. המורה לא אמור לחפש בכל הקורס כברירת מחדל.  
   הוא יחפש בכל הקורס רק אם נבו ביקש במפורש או נתן הוראה ברורה לכך.

6. Learner Memory הוא יעד קרוב, אבל לא לפני שקבצים וקונטקסט עובדים בצורה תקינה.

---

## 1. תקציר מנהלים

הפרויקט `privateTutor` עבר משלב של אב־טיפוס שביר לשלב שבו יש בסיס MVP אישי שמתחיל להיות שימושי.

מה כבר קיים:
- Workspace / Course בסיסי.
- שיחות.
- העלאת קבצים לבסיס הידע של הקורס.
- עיבוד קבצים: upload → extract → chunk → embeddings / understanding.
- Deep PDF מבוקר.
- Retrieval.
- Tutor response.
- Soft delete לשיחות ולקבצים.
- UI משופר לפי כיוון Stitch.
- Settings מתוקן.
- Project Brain לסוכנים.
- מנגנון `attachedFileIds` בצד backend.
- Retrieval prioritization לקבצים שמוגדרים כקונטקסט פעיל.
- Readiness gate שמונע מהמורה להמציא תשובה מקובץ שעוד לא מוכן.

הבעיה המרכזית שהתגלתה:
- העלאת קובץ חדש ישירות לשיחה אינה מתאימה ללמידה אקדמית, כי pipeline העיבוד לא מספיק להסתיים לפני התשובה.
- לכן הגישה הנכונה יותר היא: קודם להעלות קבצים לבסיס הידע של הקורס, לעבד אותם, ורק אחרי שהם מוכנים לבחור אותם כקונטקסט לשיחה.

החלטת מוצר עדכנית:

> קבצים לא צריכים להיכנס קודם כל לשיחה.  
> קבצים צריכים להיכנס קודם לבסיס הידע של הקורס, לעבור עיבוד, ורק לאחר שהם מוכנים — המשתמש יבחר אותם כקונטקסט לשיחה.

המודל החדש:

```text
Study Materials / Course Knowledge Base
        ↓
קובץ מעובד ומוכן
        ↓
בחר חומר מהקורס / Use in chat
        ↓
attachedFileIds בהודעה
        ↓
retrieval מתעדף את הקובץ
        ↓
המורה עונה מתוך הקונטקסט הנבחר
```

---

## 2. מצב Git / ענף / Commits אחרונים

הענף הפעיל לפי הדוחות האחרונים:

```text
repair/workspace-cleanup-fit-check
```

נקודת HEAD שנראתה בדוחות:

```text
1b900d8 docs: add working tree consolidation execution report
```

לאחר מכן בוצעו או תוכננו commits נוספים סביב:

```text
feat: wire composer attachments into message send
feat: prioritize attached files in retrieval
docs: add course knowledge context picker fit check
```

צריך לוודא מקומית מה בדיוק כבר committed ומה עדיין ב־working tree.

Commits מסודרים שכבר דווחו:

```text
947ddb7 docs: add project brain and QA reconciliation reports
a5dc4c9 fix: repair settings navigation and persistence
e4ebd8b feat: add message attachment data model
38b889a feat: align tutor workspace UI with Stitch design
1b900d8 docs: add working tree consolidation execution report
```

שאלות בדיקת Git לפני המשך:
- האם C2/C3 נשמר?
- האם C4 נשמר?
- האם C5A fit check נשמר?
- האם `QA_GAP_REPORT.md` עדיין untracked?
- האם working tree נקי לפני C5B/C5C?

---

## 3. מטרת הפרויקט

הפרויקט נועד להיות מורה פרטי אישי ארוך־טווח ללמידה אקדמית.

עקרונות מוצר:
- Understanding before progress.
- מורה סבלני.
- מורה מסתגל.
- זיכרון לימודי לאורך זמן.
- מודע לקורס / workspace.
- מודע למקורות.
- מבוסס קבצים וחומרי לימוד.
- חסכוני בעלויות.
- מתאים ללמידה לאורך חודשים.

מה הפרויקט לא אמור להיות:
- לא chatbot גנרי.
- לא LMS.
- לא dashboard כבד.
- לא gamification.
- לא file-search wrapper פשוט.
- לא מערכת שרצה קדימה בלי לוודא הבנה.

---

## 4. סטאק וכיוונים טכניים

החלטות ברירת מחדל:
- Desktop-first responsive web app.
- Hebrew RTL UI בהמשך/כבר חלקית.
- App-managed files.
- Firebase Authentication.
- Firestore.
- Firebase Storage.
- Gemini-first במקור, אך בפועל DeepSeek משמש tutor provider כרגע.
- Gemini Deep PDF למסמכים.
- Google Search Grounding עדיין לא מחובר.
- Tavily אופציונלי עתידי.
- Learner Memory נפרד מ־Academic Knowledge Base.
- Cost modes: Cheap Practice / Normal Learning / Deep Research.
- Work modes: Learning / Practice / Research / Build / Temporary Chat.

מצב בפועל לפי QA reconciliation:
- DeepSeek provider קיים ועובד אם `DEEPSEEK_API_KEY` מוגדר.
- Gemini משמש כרגע בעיקר ל־Deep PDF / document understanding.
- Genkit לא בשימוש בפועל.
- Firebase Admin SDK קיים.
- Storage upload קיים.
- Production env validation עדיין חסר.
- Web search provider אמיתי עדיין חסר.
- Learner Memory write loop עדיין לא מוכח/לא סגור.

---

## 5. Project Brain לסוכנים

נבנה Project Brain אופרטיבי:

```text
agent-memory/PROJECT_BRAIN/
├── 00_CURRENT_STATE.md
├── 01_SYSTEM_PIPELINE_CONTRACTS.md
├── 02_CHANGE_IMPACT_MATRIX.md
├── 03_RISK_REGISTER.md
├── 04_AGENT_PREFLIGHT_PROTOCOL.md
├── 05_REGRESSION_SMOKE_PLAYBOOK.md
├── 06_DECISION_LOG_COMPACT.md
├── 07_OPEN_ISSUES_AND_DEFERRED_WORK.md
└── 08_AGENT_REPORT_TEMPLATE.md
```

בנוסף `AGENTS.md` עודכן כך שסוכנים אמורים:
1. לקרוא Project Brain לפני implementation.
2. להריץ Graphify.
3. לייצר impact prediction לפני קוד.
4. לציין בדוח אילו קבצי Brain נקראו.
5. לא לשנות קוד בלי להבין pipelines מושפעים.

הבעיה שזה פתר:
- סוכנים שיפרו רכיב מקומי אבל שברו pipeline אחר.
- סוכנים הוסיפו כפתור שנראה עובד אבל לא מחובר.
- סוכנים לא חזו race condition.
- סוכנים לא ידעו לזהות אילו חוזים אסור לשבור.

מצב נוכחי:
- Project Brain קיים.
- צריך לוודא שכל סוכן ממשיך להשתמש בו.
- דוחות C4 / C5A כבר הראו שיפור: הם זיהו timing mismatch ו־readiness race.

---

## 6. Graphify

Graphify מותקן ומשמש ל:
- `graphify update .`
- `graphify query ...`

הוא עוזר להבין קשרי קוד ו־pipelines.

הודעת הטיפ:

```text
Tip: set GEMINI_API_KEY or GOOGLE_API_KEY to use Gemini for semantic extraction.
```

אינה חובה.

משמעות Gemini API ב־Graphify:
- שדרוג אופציונלי ל־semantic extraction של docs, reports, images, papers, project memory.
- Graphify עובד גם בלי זה לצורכי קוד ו־graph.

החלטה כרגע:
- לא לחסום פיתוח בגלל GEMINI_API_KEY ל־Graphify.
- אפשר לשקול להוסיף בהמשך לשיפור הבנת מסמכים ו־Project Brain.

---

## 7. File / PDF Pipeline

קיים pipeline בסיסי:

```text
Upload
→ Storage
→ Metadata
→ extraction
→ chunking
→ embeddings
→ document understanding
→ retrieval
→ tutor response
```

Deep PDF:
- `GeminiPdfUnderstandingProvider`
- `PdfBytesLoader`
- Deep PDF metadata/cache
- quality gate
- runtime integration
- readiness/state handling

החלטות חשובות:
- Cheap Practice לא אמור להריץ Deep PDF אוטומטית.
- Normal Learning / Deep Research יכולים להריץ לפי gate.
- לא לעבד אותו קובץ שוב אם כבר יש cache תקין.
- Deep PDF לא רץ לכל שאלה מחדש.

מה עדיין חסר:
- Diagram-aware Deep PDF.
- `DocumentFigure` schema.
- הבנת שרטוטים / מעגלים / גרפים.
- grounding על figure ספציפי.

בפיזיקה/מעגלים זה חשוב מאוד.

---

## 8. Upload / Storage

לפי QA reconciliation, הממצא הישן “file upload לא מחובר ל־Firebase Storage” סווג כ־Already Fixed.

הזרימה הנוכחית:
```text
client uploads bytes to Firebase Storage
server stores metadata
server-side loader reads bytes back for processing
```

כלומר endpoint שמקבל metadata בלבד אינו בהכרח בעיה — זו ארכיטקטורה שבה ה־client מעלה bytes והשרת מנהל metadata ועיבוד.

צריך לשמר:
- Storage path validation.
- ownership validation.
- workspace validation.
- soft delete filtering.
- processing lifecycle.

---

## 9. Workspace / Course / Study Materials

מה קיים:
- Workspaces / Courses קיימים.
- Study Materials / FilePanel קיים.
- קבצים נטענים ומוצגים.
- יש סטטוסים.
- יש soft delete לקבצים.
- יש upload והתחלת processing.

מה תוקן:
- File soft delete.
- Deleted file exclusion from inventory / retrieval / grounding / FilePanel.

מה חסר:
- Workspace/course soft delete.
- Course archive.
- Safe cascade semantics.

אין לחשוף מחיקת קורס/Workspace דרך UI בלי backend safe delete.

---

## 10. Sessions / Conversations

מה קיים:
- שיחות נשמרות.
- messages נשמרים.
- rename conversation קיים.
- soft delete conversation קיים.
- active session handling.

מה תוקן:
- Rename false timeout.
- timeout עלה מ־8000ms ל־25000ms.
- regression test נוסף.
- manual smoke עבר לפי נבו.

אפשרות עתידית:
- optimistic rename UI עם rollback, לא דחוף.

---

## 11. Settings

מה היה שבור:
- Settings navigation השתמש ב־raw `<a>`.
- Back עשה full page reload.
- controls לא הגיבו ב־127.0.0.1 בגלל dev-origin/hydration.
- dev diagnostics נדרס ל־false.
- font/chat width לא נשמרו טוב.

מה תוקן:
- `next/link` במקום raw `<a>`.
- `allowedDevOrigins` ב־`next.config.ts`.
- `settingsPreferences` helper.
- font size persistence.
- chat width persistence.
- dev diagnostics persistence.
- theme/palette נשאר ב־Settings.

מצב נוכחי:
- לפי הדוח: תקין.
- צריך לוודא manual smoke בסשן מחובר אם לא נעשה.

---

## 12. UI / Stitch

מה הוטמע:
- UI עבר שיפור משמעותי.
- sidebar יותר נקי.
- conversation action menu.
- plus menu.
- Settings page.
- FilePanel יותר נקי.
- ThemePicker עבר ל־Settings.
- visual alignment לפי Stitch.

מה עדיין לא מושלם:
- לא כל עיצוב Stitch הוטמע.
- Study Materials drawer יכול להיות עשיר יותר.
- Sources UI עדיין לא מספיק טוב.
- empty states לא בהכרח ברמה הסופית.
- התחושה של “מרחב לימודי” עדיין דורשת polish.

החלטה:
- לא להמשיך כרגע ל־visual polish כללי לפני שסוגרים את מודל הקבצים כקונטקסט לשיחה.

---

## 13. Sources / Citations

מה קיים:
- מודל citations כולל `sourceId`, `citationLabel`, `originalFileName`, `pageNumber`, `referenceText`.

מה עובד חלקית:
- filename מוצג.
- referenceText מוצג.
- pageNumber קיים בטייפים אבל לא בהכרח מוצג ב־UI.

מה חסר:
- label של file name + page number.
- section/question grouping.
- quote/relevance display.
- source cards קריאים יותר.

עדיפות:
- P2, אחרי סגירת קונטקסט קבצים.

---

## 14. Learner Memory

מה קיים:
- `learnerMemoryRepository`
- `learnerMemoryApiService`
- Firestore-backed paths

הפער:
- לא הוכח שה־tutor `internalUpdate.learner_memory_update` באמת נכתב ל־repository.
- ייתכן שהמורה מייצר “צריך לעדכן זיכרון”, אבל אין write loop מלא.

מצב נוכחי:
- Learner Memory אמיתי עדיין לא סגור.
- לא להתייחס אליו כ־feature עובד.

החלטת נבו:
- Learner Memory הוא יעד קרוב.
- אבל הוא לא מגיע לפני שקבצים וקונטקסט עובדים בצורה תקינה.

סדר נכון:
1. לסגור קבצים כקונטקסט.
2. לוודא שהמורה עובד נכון עם קובץ פעיל.
3. רק אז Learner Memory write path audit.
4. לאחר מכן implementation של memory loop.

---

## 15. Tutor Provider / LLM

מצב נוכחי:
- `DeepSeekTutorProvider` קיים ועובד אם `DEEPSEEK_API_KEY` מוגדר.
- mock fallback קיים אם key חסר.
- Gemini tutor provider לא קיים.
- Gemini משמש ל־Deep PDF.
- Genkit לא מותקן ולא בשימוש.

סיכון:
- בפרודקשן אסור ליפול בשקט ל־mock.

צריך:
```text
production startup guard:
אם FIREBASE_MODE=production ואין DEEPSEEK_API_KEY או provider אמיתי — fail fast
```

החלטה:
- לא blocker לשימוש אישי מקומי כרגע.
- כן blocker ל־production.

---

## 16. Web Search

מצב נוכחי:
- webSearchProvider interface קיים.
- מימוש אמיתי כנראה לא מחובר.
- Google Search Grounding לא מחובר בפועל.

עדיפות:
- לא מיידית.
- אחרי קונטקסט קבצים, PDF, sources, memory.

---

## 17. Conversation File Attachment — היסטוריה והחלטה חדשה

הכיוון הראשון שנוסה:
```text
בחר קובץ בקומפוזר
→ chip
→ Send
→ upload
→ attachedFileIds
→ retrieval
```

מה הוטמע:

C1 — Data model/backend:
- `attachedFileIds` בטיפוסי messages.
- schema validation.
- dedup/max count.
- validation ownership/workspace/deleted.
- message persistence.
- client send support.
- tests.

C2/C3 — Composer upload-on-send:
- בחר File object.
- chip.
- upload on send.
- collect fileId.
- send attachedFileIds.
- failure blocks send.
- chips remain on error.

C4 — Retrieval + readiness:
- derive active attached files.
- current turn IDs first.
- else latest previous user message with attachedFileIds.
- readiness gate.
- prioritizedFileIds in retrieval.
- no silent fallback if active file not ready.
- deterministic Hebrew not-ready response.

מה גילינו בבדיקה:
- המורה החזיר הודעה שהקובץ עדיין בעיבוד.
- זו התנהגות נכונה טכנית.
- אבל היא חושפת בעיית UX: PDF לימודי לא יכול להיות מועלה ולהיענות מיד.

החלטת מוצר חדשה:
```text
Upload to course knowledge base first
Then select ready course files as chat context
```

המודל החדש:
```text
Study Materials:
- upload files
- process
- ready status

FilePanel:
- Use in chat / בחר חומר מהקורס על קובץ מוכן

Composer:
- chip של {fileId, fileName}
- send message with attachedFileIds
```

מה שצריך לשנות:
- להפסיק להשתמש ב־raw File object כ־staged attachment.
- להסיר/לעקוף upload-on-send כ־flow מרכזי.
- להרים staged selected context state ל־`page.tsx`.
- FilePanel יקבל `onUseInChat`.
- רק קבצים מוכנים יהיו selectable.

---

## 18. Course Knowledge Context Picker

Fit Check המליץ על MVP Option B:

```text
FilePanel "Use in chat"
```

ולא plus menu picker כרגע.

למה Option B:
- הנתונים כבר נמצאים ב־FilePanel.
- יש readiness status.
- קל למנוע בחירת קובץ לא מוכן.
- פחות מורכב מ־plus menu picker.
- מתאים ל־Study Materials-first.

Ready file definition:
```text
isReadyForLearning =
extractionStatus completed
AND chunkingStatus completed
AND embeddingStatus completed
```

זו הגדרה קשיחה יותר מ־C4 gate, אבל נכונה לבחירה ידנית של קונטקסט.

### החלטות UX לפי נבו

- קובץ שנבחר נשאר active context לכל השיחה עד שמחליפים אותו או מנקים אותו.
- כמה קבצים יכולים להיות פעילים יחד.
- נבו ייתן הוראות למורה איך לעבוד עם כמה קבצים.
- צריך לתכנן Clear context עתידי.
- פעולה להוספת קונטקסט תיקרא:
  ```text
  בחר חומר מהקורס
  ```
- המורה לא יחפש בכל הקורס כברירת מחדל.

---

## 19. מה תוקן כבר — רשימה מרוכזת

- Project Brain נבנה.
- Graphify workflow הוטמע סביב סוכנים.
- Settings navigation/persistence תוקן.
- Rename timeout תוקן.
- Conversation soft delete קיים.
- File soft delete קיים.
- Deleted files excluded from normal runtime retrieval/inventory.
- Storage upload מחובר.
- Deep PDF controlled runtime קיים.
- Deep PDF cache/metadata קיים.
- Artifact-aware inventory קיים.
- Artifact-aware grounding קיים.
- C1 `attachedFileIds` backend קיים.
- C4 retrieval prioritization/readiness gate קיים או הוטמע בדוח.
- UI/Stitch visual pass בוצע.

---

## 20. בעיות פתוחות / פערים אמיתיים

- Course Knowledge Context Picker עדיין לא הוטמע.
- C2/C3 upload-on-send צריך repurpose/remove כ־main UX.
- Tutor wording סביב active context עדיין צריך polish.
- Sources UI עדיין חלש.
- Diagram-aware Deep PDF חסר.
- Learner Memory write loop לא סגור.
- Production env validation חסר.
- Provider startup guard חסר.
- Web search לא מחובר.
- Workspace/course soft delete חסר.
- Semantic summary hierarchy חסר.
- Plus menu צריך עדכון לפי המודל החדש.

---

## 21. פיצ׳רים שנבו רצה והוטמעו

- העלאת קבצים לקורס.
- קריאת PDF דיגיטלי.
- תשובות על בסיס קבצים.
- הצגת Study Materials.
- מורה שמסוגל לעבוד עם PDF כבד יותר דרך Deep PDF.
- הפרדת קבצים מחוקים.
- שינוי שם שיחה.
- מחיקת שיחה.
- Settings לשליטה בגודל טקסט / רוחב / theme.
- UI רגוע יותר.
- Project Brain לסוכנים.
- מנגנון `attachedFileIds` backend.
- readiness response במקום תשובה מומצאת כאשר קובץ עדיין בעיבוד.

---

## 22. פיצ׳רים שנבו רצה ועדיין לא הוטמעו או לא סגורים

- בחירת קובץ מוכן מתוך בסיס הידע כקונטקסט לשיחה.
- `Use in chat` / `בחר חומר מהקורס` ב־FilePanel.
- plus menu מותאם למודל החדש.
- Clear context.
- המורה אומר בבירור: “אני עובד כרגע על הקובץ X”.
- זיכרון לימודי אמיתי לאורך זמן.
- התאמה בזמן אמת לרמת הלומד.
- ניתוח שרטוטים/מעגלים/דיאגרמות ב־PDF.
- sources קריאים עם עמודים וציטוטים.
- web search אמיתי.
- workspace/course archive/delete בטוח.
- summary hierarchy לקורס/נושא/סמסטר.
- production deployment hardening.

---

## 23. סדר עבודה מומלץ מכאן

מיידי:
1. לוודא commits נקיים:
   - C2/C3 אם נשמר.
   - C4 אם נשמר.
   - C5A fit check אם נשמר.
2. ליישם:
   - C5B/C5C — Use Ready Course Knowledge Files as Chat Context.

אחרי זה:
3. C5D — wording polish:
   - “Selected context”.
   - “בחר חומר מהקורס”.
   - “Upload to study materials”.
   - not-ready response טבעי פחות טכני.
4. Manual smoke:
   - upload to Study Materials.
   - wait ready.
   - Use in chat / בחר חומר מהקורס.
   - ask question.
   - follow-up.

לאחר שה־context flow יציב:
5. Sources UI עם page number.
6. Diagram-aware Deep PDF.
7. Learner Memory write loop audit/implementation.
8. Production env/provider guard.
9. Workspace/course soft delete.
10. Web search.

---

## 24. כללי זהירות לסוכנים

לפני כל task:
1. Read `AGENTS.md`.
2. Read `PROJECT_BRAIN`.
3. Run Graphify.
4. Produce impact prediction.
5. List what can break.
6. List tests/smoke.
7. Implement smallest safe batch.
8. No git pull.
9. No git add/commit/push unless explicitly authorized.

אסור כרגע:
- לא להחזיר upload-on-send כ־main UX.
- לא להוסיף `primaryFileId` בלי החלטה.
- לא לשנות Deep PDF תוך כדי UI context picker.
- לא לבנות workspace delete בלי backend spec.
- לא להוסיף source UI אם metadata pipeline לא ברור.
- לא להוסיף learner memory לפני write path audit.
- לא לאפשר למורה לחפש בכל הקורס כברירת מחדל בלי הוראה מפורשת מנבו.

---

## 25. החלטות שנותרו פתוחות

שאלות שעדיין אפשר להכריע בהמשך:

1. האם `Clear context` יופיע כבר בשלב C5B/C5C או רק אחר כך?
2. האם “בחר חומר מהקורס” יהיה ב־FilePanel בלבד או גם בתפריט הפלוס?
3. האם קבצים לא מוכנים יוצגו disabled או יוסתרו מאפשרות הבחירה?
4. האם FilePanel ייפתח אוטומטית אחרי upload חדש?
5. האם להוסיף retry processing לקובץ שנכשל?
6. האם כשיש קובץ פעיל המורה יציין את שם הקובץ בכל תשובה או רק בהתחלת שיחה/החלפת קונטקסט?
7. האם אם קובץ פעיל לא מכיל תשובה, המורה ישאל אם לחפש בכל הקורס או פשוט יגיד שלא מצא בקובץ הפעיל?

---

## 26. הצעד הבא המומלץ

לא להמשיך ל־features חדשים לפני שמיישמים את ההחלטה החדשה:

```text
C5B/C5C — Use Ready Course Knowledge Files as Chat Context
```

מטרת השלב:

```text
FilePanel:
ready file → בחר חומר מהקורס / Use in chat

Composer:
chip עם fileId/fileName

Send:
attachedFileIds

Retrieval:
C4 כבר מתעדף

Tutor:
מתחיל לענות מתוך הקובץ הנבחר
```

זה השלב שאמור להפוך את העבודה עם קבצים למשהו שמתאים למורה לימודי ולא לצ׳אט גנרי.
