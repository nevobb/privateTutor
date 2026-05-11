# References and Source Notes

## מטרת המסמך

מסמך זה מרכז מקורות רשמיים/טכניים ששימשו לקבלת החלטות בפרויקט.

הקישורים כאן מיועדים לעיון ולבדיקת יכולות הכלים לפני ביצוע.

---

## Google AI Studio

### Build apps in Google AI Studio

Source:

```text
https://ai.google.dev/gemini-api/docs/aistudio-build-mode
```

Relevant notes:

- Google AI Studio Build Mode supports building apps with natural language prompting.
- It supports full-stack runtimes.
- It supports server-side logic.
- It supports secure secrets management.
- It supports npm package support.

### Develop Full-Stack Apps in Google AI Studio

Source:

```text
https://ai.google.dev/gemini-api/docs/aistudio-fullstack
```

Relevant notes:

- Google AI Studio can build applications beyond client-side prototypes.
- Server-side runtime can manage secrets and connect to external APIs.

---

## Gemini API

### Gemini API File Search

Source:

```text
https://ai.google.dev/gemini-api/docs/file-search
```

Relevant notes:

- File Search enables Retrieval Augmented Generation.
- It imports, chunks, and indexes data.
- It retrieves relevant information based on prompt.
- Retrieved information is used as model context.

### Gemini API File Search multimodal updates

Source:

```text
https://blog.google/innovation-and-ai/technology/developers-tools/expanded-gemini-api-file-search-multimodal-rag/
```

Relevant notes:

- Updates include multimodal support.
- Updates include custom metadata.
- Updates include page-level citations.
- These features support efficient and verifiable RAG.

### Function calling

Source:

```text
https://ai.google.dev/gemini-api/docs/function-calling
```

Relevant notes:

- Function calling connects models to external tools and APIs.
- The model can determine when to call specific functions.
- Useful for bridging natural language to real actions/data.

### Structured outputs

Source:

```text
https://ai.google.dev/gemini-api/docs/structured-output
```

Relevant notes:

- Structured output allows model responses to follow a schema.
- Relevant for separating visible tutor response from internal updates.

### Grounding with Google Search

Source:

```text
https://ai.google.dev/gemini-api/docs/google-search
```

Relevant notes:

- Connects Gemini to real-time web content.
- Works with all available languages.
- Helps provide accurate answers with verifiable sources beyond knowledge cutoff.

### Context caching

Source:

```text
https://ai.google.dev/gemini-api/docs/caching
```

Relevant notes:

- Useful for repeated stable context such as tutor instructions, formula sheets, and course summaries.

---

## Firebase / Genkit

### Firebase AI Logic

Source:

```text
https://firebase.google.com/docs/ai-logic
```

Relevant notes:

- Firebase AI Logic SDKs can call Gemini models.
- Supports text, multimodal prompts, structured output, and images.

### Genkit docs

Source:

```text
https://genkit.dev/
```

Relevant notes:

- Genkit is an open-source framework for building AI-powered apps.
- Useful for flows, actions, prompts, testing, deployment, and observability.

### Genkit flows

Source:

```text
https://genkit.dev/docs/js/flows/
```

Relevant notes:

- Flows provide type safety.
- Flows integrate with developer UI.
- Flows help with deployment and observability.
- Object-based schemas are recommended for future extensibility.

---

## Stitch

### Stitch

Source:

```text
https://stitch.withgoogle.com/
```

Relevant notes:

- Used for AI-assisted UI design.
- Appropriate for generating initial web/mobile UI concepts from natural language prompts.

---

## Jules

### Jules docs

Source:

```text
https://jules.google/docs/
```

Relevant notes:

- Jules is useful for GitHub-based coding tasks.
- Best used with small, explicit tasks rather than broad project instructions.

---

## External search option

### Tavily

Source:

```text
https://tavily.com/
```

Relevant notes:

- Search API aimed at AI agents and RAG workflows.
- Useful as future optional WebSearchProvider.
- Not required in MVP.

---

## Implementation caution notes

1. Do not rely on one model provider too deeply.
2. Keep provider abstractions from the beginning.
3. Do not expose API keys in frontend.
4. Do not send whole knowledge base to model.
5. Do not treat vector search as full memory.
6. Keep Learner Memory and Academic Knowledge Base separate.
7. Use behavior regression tests before calling the tutor stable.
8. Web search must be disclosed when used.
9. File indexing must have clear status and failure handling.
10. User corrections must override model inference.
