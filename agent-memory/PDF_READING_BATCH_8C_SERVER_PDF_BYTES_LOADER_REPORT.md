# PDF Reading Batch 8C — Server-side PDF Bytes Loader Report

## 1. Branch name and HEAD commit
- Branch: `repair/deep-pdf-cache-metadata`
- HEAD: `8b2d595 feat: add Deep PDF cache metadata policy`

## 2. Files changed
New files created:
- `src/server/workspaces/firebaseStoragePdfBytesLoader.ts`
- `tests/server/workspaces/firebaseStoragePdfBytesLoader.test.ts`

Memory/docs created:
- `agent-memory/PDF_READING_BATCH_8C_SERVER_PDF_BYTES_LOADER_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md` (sync entry appended)

No existing source files modified.

## 3. Existing Firebase Storage/server utilities found
- `src/server/firebase/firebaseAdminApp.ts` — provides `getFirebaseAdminApp()`, `getFirebaseAdminFirestore()`, `getFirebaseAdminAuth()`. Already handles emulator vs production credential selection.
- `src/server/firebase/firebaseServerRuntimeMode.ts` — provides `getFirebaseServerMode()`, `isFirebaseServerEmulatorMode()`, `getRequiredServerProjectId()`.
- `firebase-admin/storage` v13 — `getStorage(app).bucket(name)` available and tested. Returns `Bucket` with `.file(path).download()` and `.file(path).getMetadata()`.
- `src/lib/firebase/storageUploadClient.ts` — client-side upload utility. Establishes the storagePath convention: `users/{userId}/workspaces/{workspaceId}/files/{fileId}/{fileName}`. Also establishes 20 MB max file size.
- No existing server-side Firebase Storage read helper existed — this batch adds the first one.

## 4. Loader module/interface added

### New file: `src/server/workspaces/firebaseStoragePdfBytesLoader.ts`

**Implements:** `PdfBytesLoader` interface (from `documentUnderstandingProvider.ts`), which `GeminiPdfUnderstandingProvider` already expects:
```ts
export interface PdfBytesLoader {
  loadPdfBytes(input: Pick<DocumentUnderstandingInput, ...>): Promise<Uint8Array>;
}
```

**Extends with rich method:** `FirebaseStoragePdfBytesLoader` adds:
```ts
interface FirebaseStoragePdfBytesLoader extends PdfBytesLoader {
  loadPdfBytesWithMetadata(input: {...}): Promise<PdfLoadResult>;
}
```

**Factory:**
```ts
export function createFirebaseStoragePdfBytesLoader(
  deps: FirebaseStoragePdfBytesLoaderDeps = { getStorageBucket: getDefaultStorageBucket }
): FirebaseStoragePdfBytesLoader
```

**Singleton export:**
```ts
export const firebaseStoragePdfBytesLoader: FirebaseStoragePdfBytesLoader =
  createFirebaseStoragePdfBytesLoader();
```

## 5. Loader input/output shape

### Input (to `loadPdfBytesWithMetadata`)
```ts
{
  userId: string;
  workspaceId: string;
  fileId: string;
  fileName: string;
  storagePath: string;
  sourceType: string;
}
```

This matches `Pick<DocumentUnderstandingInput, ...>` that `PdfBytesLoader.loadPdfBytes` already expects — no interface breakage.

### Output — `PdfLoadResult` (discriminated union)
```ts
| {
    ok: true;
    bytes: Uint8Array;
    sizeBytes: number;
    contentType: string;
    storageGeneration: string | undefined;  // GCS object generation — used for deepPdfStorageGeneration
    inputHash: string;                       // sha256 of bytes — used for deepPdfInputHash
    storagePath: string;
  }
| { ok: false; code: PdfLoadErrorCode; message: string }
```

`loadPdfBytes()` (interface method) wraps the rich method — returns `Uint8Array` on success, throws with `"code: message"` on failure.

## 6. Ownership/path validation behavior

Path convention from `storageUploadClient.ts`:
```
users/{userId}/workspaces/{workspaceId}/files/{fileId}/{fileName}
```

Validation steps (in order, short-circuits on first failure):
1. `sourceType !== "pdf"` → `wrong_source_type`
2. Empty or whitespace `storagePath` → `missing_storage_path`
3. `storagePath.includes("..")` → `invalid_path_format` (traversal guard)
4. `STORAGE_PATH_PATTERN` match fails → `invalid_path_format`
5. `parsedPath.userId !== input.userId` → `ownership_mismatch`
6. `parsedPath.fileId !== input.fileId` → `file_id_mismatch`

Validation happens before any Firebase Storage call — no network round-trip for clearly invalid inputs.

## 7. File identity/hash/generation behavior

### Content hash (`inputHash`)
- `crypto.createHash('sha256').update(bytes).digest('hex')` — standard Node.js `crypto`, no new dependencies.
- 64-character lowercase hex string.
- Deterministic: same bytes → same hash. Different bytes → different hash.
- Computed after download, before returning bytes.
- No raw bytes or content logged — only the hash digest.
- Feeds directly into `deepPdfInputHash` field added in Batch 8B.

### Storage generation (`storageGeneration`)
- Read from `fileHandle.getMetadata()` → `metadata.generation` (GCS object generation number as string).
- Returned as `string | undefined` — absent if metadata does not include it.
- Changes when the same storage object is overwritten.
- Feeds directly into `deepPdfStorageGeneration` field added in Batch 8B.

Both fields together allow the Batch 8B cache policy (`evaluateDeepPdfCacheState`) to confirm whether a previous Deep PDF result matches the current stored file version.

## 8. Error handling behavior

### Error codes (`PdfLoadErrorCode`)
| Code | Trigger |
|---|---|
| `wrong_source_type` | `sourceType !== "pdf"` |
| `missing_storage_path` | empty/whitespace `storagePath` |
| `invalid_path_format` | traversal or non-matching path |
| `ownership_mismatch` | path userId ≠ input userId |
| `file_id_mismatch` | path fileId ≠ input fileId |
| `file_too_large` | metadata size or download size > 20 MB |
| `wrong_content_type` | metadata contentType not in allowed set |
| `storage_unavailable` | bucket init throws (e.g. emulator not configured) |
| `storage_read_error` | `getMetadata()` or `download()` throws |
| `empty_bytes` | download returned an empty buffer |

### Principles
- `loadPdfBytesWithMetadata` never throws — always returns `PdfLoadResult`.
- `loadPdfBytes` (interface method) throws on failure — safe for `GeminiPdfUnderstandingProvider.resolvePdfBytes()` which already catches.
- Error messages include error context but never raw PDF bytes or document content.
- Metadata is fetched before download for fast fail on size/type errors.
- `application/octet-stream` is tolerated as a content type (some uploads store without explicit type).

## 9. Tests added/updated

### `tests/server/workspaces/firebaseStoragePdfBytesLoader.test.ts` (32 tests)

All tests use mocked `StorageFileHandle` / `StorageBucketHandle`. No real Firebase calls.

**Valid PDF path (6 tests):**
- ok=true with bytes
- correct sizeBytes
- storageGeneration from metadata
- inputHash is 64-char hex
- same bytes → same hash (deterministic)
- different bytes → different hashes
- storagePath returned in result

**Non-PDF source type (2 tests):**
- docx rejected with `wrong_source_type`
- no storage call made when type is wrong

**Missing storagePath (2 tests):**
- empty string → `missing_storage_path`
- whitespace → `missing_storage_path`

**Path ownership validation (4 tests):**
- userId mismatch → `ownership_mismatch`
- fileId mismatch → `file_id_mismatch`
- traversal `..` → `invalid_path_format`
- arbitrary path → `invalid_path_format`

**Oversized file (4 tests):**
- metadata size > 20 MB → `file_too_large`
- download size > 20 MB → `file_too_large`
- exactly at limit → ok
- `PDF_BYTES_MAX_SIZE` constant is 20 MB

**Storage failure (6 tests):**
- metadata fetch error → `storage_read_error`
- download error → `storage_read_error`
- bucket init error → `storage_unavailable`
- empty download buffer → `empty_bytes`
- always resolves (never throws) from rich method
- wrong content type → `wrong_content_type`

**PdfBytesLoader interface (3 tests):**
- `loadPdfBytes` returns `Uint8Array`
- `loadPdfBytes` throws on bucket init failure
- `loadPdfBytes` throws with error code for wrong source type

**No byte/content logging (2 tests):**
- error message < 500 chars, no null bytes
- success result has no `text`/`content`/`extractedText` field

**Regression (2 tests):**
- factory callable with injected deps
- two loader instances are independent

## 10. Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ 65 files passed, 18 skipped; 760 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ 4130 nodes, 5664 edges, 283 communities

## 11. What was intentionally not implemented
- No live Firebase Storage calls (all tests mock the storage layer).
- No Gemini connection or execution.
- No automatic trigger from upload/chunk/tutor flows.
- No quality gate integration.
- No orchestration wiring (Batch 8D will inject the loader into the Deep PDF orchestration path).
- No emulator-mode storage configuration test (would require a running Storage emulator).
- No PDF content parsing or validation beyond magic bytes (out of scope).
- No client-side Firebase Storage API usage (server-only module).
- No storage byte caching / persistence beyond returning the bytes to the caller.

## 12. Risks / open decisions
- **Emulator mode guard:** `getDefaultStorageBucket()` throws in emulator mode when `FIREBASE_STORAGE_EMULATOR_HOST` is not set. This is the safe behavior — tests should always inject deps. Production code needs `FIREBASE_STORAGE_BUCKET` env var.
- **`application/octet-stream` tolerated:** Some uploads may store without an explicit content type. The loader accepts it. Future tightening: require PDF magic bytes check before accepting `application/octet-stream`.
- **Size guard from metadata vs download:** Both are checked, but metadata size could theoretically differ from download size (race condition on overwrite). The download-size guard is the authoritative one.
- **No PDF magic bytes check:** The loader does not validate `%PDF-` header bytes. This is intentional for Batch 8C — a future hardening batch can add it.
- **`as unknown as StorageBucketHandle` cast:** The Firebase Admin Storage `Bucket` type returns a 2-element `MetadataResponse` tuple from `getMetadata()`, but the test mock interface expects a 1-element tuple. The cast is safe because the real Firebase call returns a superset of what the interface needs, and tests inject fully typed mocks.
- **Singleton export:** `firebaseStoragePdfBytesLoader` is a singleton that calls `getDefaultStorageBucket()` lazily. It will throw at call time (not import time) if env is not configured — safe for test environments.

## 13. Ready for Batch 8D Controlled Deep PDF Execution?
**YES**

Batch 8D can:
1. Inject `createFirebaseStoragePdfBytesLoader({ getStorageBucket: ... })` into `GeminiPdfUnderstandingProvider` via its existing `pdfBytesLoader` dep slot.
2. The `GeminiPdfUnderstandingProvider` already calls `this.pdfBytesLoader.loadPdfBytes(...)` — no provider changes needed.
3. The orchestration service can use `loadPdfBytesWithMetadata()` to get `inputHash` and `storageGeneration` for cache persistence before or after calling the provider.
4. The Batch 8B cache policy (`evaluateDeepPdfCacheState`) already consumes those two fields.

The boundary is clean and complete.

## 14. Confirmation that no Gemini/runtime execution was added
Confirmed:
- No Gemini API calls.
- No `GeminiPdfUnderstandingProvider` instantiation connected to any runtime path.
- No quality gate wired to execution.
- No tutor response behavior changed.
- No inventory/retrieval/upload runtime behavior changed.

## 15. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 16. Confirmation that no git pull was run
Confirmed:
- No `git pull`
