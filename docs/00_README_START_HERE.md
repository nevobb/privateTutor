# Personal Adaptive Academic Tutor — Project Docs

## איך להשתמש בחבילה הזאת

החבילה הזאת היא תיקיית הקונטקסט הראשית של פרויקט המורה הפרטי.

היא בנויה כך שתוכל להעביר אותה לכל סוכן/כלי AI שאמור לעזור לך לבנות את הפרויקט, בלי להסביר הכול מחדש בכל פעם.

הסדר המומלץ לקריאה:

1. `01_Product_Requirements_v0.2.md`
2. `02_Stitch_UI_Prompt_and_Design_Requirements.md`
3. `03_Google_AI_Studio_Build_Prompt.md`
4. `04_Firebase_Genkit_Backend_Architecture.md`
5. `05_Gemini_API_Integration_Spec.md`
6. `06_Retrieval_and_Memory_Technical_Spec.md`
7. `07_Jules_Task_List.md`
8. `08_MVP_Implementation_Checklist.md`
9. `09_Behavior_Regression_Test_Suite.md`
10. `10_Project_Folder_Agent_System_Instructions.md`
11. `11_References_and_Source_Notes.md`

## מטרת הפרויקט במשפט אחד

לבנות מורה פרטי אקדמי, דינמי וסבלני, שמכיר את נבו לאורך זמן, עובד עם קבצי קורס, מנהל זיכרון אישי וידע אקדמי בנפרד, יודע לחפש רק כשצריך, ולא שורף תקציב על retrieval מיותר.

## החלטות טכנולוגיות מרכזיות

- Web app בלבד ב־MVP.
- Desktop-first, אבל responsive.
- ממשק בעברית RTL.
- קבצים מנוהלים באפליקציה, לא דרך Google Drive כמקור ראשי.
- Firebase / Firestore / Storage כתשתית בסיסית.
- Genkit לשכבת AI flows ב־backend.
- Gemini-first ב־MVP.
- Gemini File Search ל־RAG ראשוני.
- RetrievalProvider abstraction כדי לא להינעל על פתרון אחד.
- Google Search Grounding לחיפוש רשת ב־MVP.
- Tavily כאופציה עתידית, לא חובה ב־MVP.
- הפרדה מלאה בין Learner Memory לבין Academic Knowledge Base.
- workspaces בניהול המשתמש.
- Cost modes: Cheap Practice / Normal Learning / Deep Research.
- מצבי עבודה: Learning / Practice / Research / Build / Temporary Chat.
- Decision Log טכני באנגלית, מוסתר מהמסך הראשי.
- Behavior regression tests חובה.

## מה לא לבנות בהתחלה

- Native mobile app.
- Voice / Live tutor.
- Screen sharing.
- OCR כבד.
- GraphRAG מלא.
- Analytics מורכב.
- Gamification.
- Multi-provider מלא עם הרבה מודלים כבר ביום הראשון.

## עיקרון עבודה

לא מתקדמים לבנייה לפני שמבינים את הדרישה.
לא משנים את החזון בלי אישור נבו.
לא הופכים את הפרויקט לצ׳אטבוט עם PDF.
