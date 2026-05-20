# Retrieval Quality Evaluation Report

## Date
- 2026-05-20

## Environment
- Local Firebase emulators: Auth, Firestore, Storage (demo-private-tutor)
- Gemini embeddings: GEMINI_API_KEY=SET, EMBEDDING_PROVIDER=SET in .env.local (not used — deterministic provider active in emulator)
- Tutor answer provider: DeepSeek (DEEPSEEK_API_KEY=SET)
- Test file: cell-biology.pdf — 1 page, 10 numbered factual statements, 609 chars extracted

## Pipeline result
- Upload: ✅ filename `cell-biology.pdf` preserved safely
- Extraction: ✅ `extractionStatus: completed`, `extractionSource: pdf_parse_pdf_parser`, 609 chars real text
- Chunking: ✅ `chunkingStatus: completed`, 1 chunk (chunk_0000)
- Embeddings: ✅ 1 embedded, 0 failed (deterministic provider)
- Tutor answer: ✅ citations field in API response contains chunk_0000 with real PDF text

## Test questions
| # | Question | Expected source exists | Result | Retrieval notes | Answer quality |
|---|----------|------------------------|--------|-----------------|----------------|
| 1 | What is the powerhouse of the cell? | Yes — statement 1 | PASS | chunk_0000 in citations | Correct: "mitochondrion". Low hallucination risk. |
| 2 | Which organelle generates most energy in eukaryotic cells? (paraphrase) | Yes — statements 1–2 | PASS | Retrieved same chunk | Correct: mitochondrion, ATP. Low hallucination risk. |
| 3 | מה עושים הריבוזומים בתא? (Hebrew) | Yes — statement 4 | PASS | Chunk containing ribosome statement retrieved | Correct: protein synthesis, answered in Hebrew. Low hallucination risk. |
| 4 | What is the speed of light? | No — not in file | PARTIAL | Acknowledged off-topic; still answered from general knowledge | Soft redirect only, no hard refusal. Medium hallucination risk on off-topic. |
| 5 | What does the cell membrane do? | Yes — statement 5 | PASS | Chunk contains phospholipid bilayer statement | Correct: referenced phospholipid bilayer from file. Low hallucination risk. |
| 6 | Follow-up: what is a phospholipid bilayer? | Partially (statement 5) | PASS | Maintained conversation context | Accurate explanation, consistent with PDF. Low hallucination risk. |

## Findings
1. Real extraction works: pdf_parse_pdf_parser runs end-to-end; extracted text is real PDF content.
2. Retrieval runs and returns citations: API response includes assistantMessage.citations with sourceId and referenceText from the actual chunk.
3. Hebrew-to-English retrieval works: Hebrew question correctly retrieved English chunk, answered in Hebrew.
4. Follow-up context maintained across 6 messages.
5. Off-topic soft refusal: tutor acknowledged topic mismatch but answered from general knowledge. No hard refusal boundary.
6. UI citations not rendered: assistantMessage.citations exists in API but chat UI shows "Sources: not connected yet". Data present, display not wired.
7. Single chunk limitation: 609-char PDF produced 1 chunk. Multi-chunk ranking not tested.
8. Deterministic embeddings used in emulator. Gemini path not exercised (key is SET, requires real API call).

## Blockers
- None blocking personal study use with well-structured PDFs.
- Citation UI not wired (data in API, not displayed to user).
- Off-topic answers not restricted to study material.
- Multi-file, multi-chunk retrieval not tested.

## Recommended next step
- Wire citation display in tutor conversation UI (use assistantMessage.citations already returned by API).
- Test with real multi-page study PDF (5–10 pages) to evaluate chunk ranking and precision.
- Optionally enable Gemini embeddings for semantic retrieval quality comparison vs deterministic.
