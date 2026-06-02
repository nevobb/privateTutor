import { beforeAll, describe, expect, it } from "vitest";
import { assertFirestoreEmulatorRunning, describeFirebaseWorkspaceEmulator } from "../../firebase/firestoreTestUtils";
import { createWorkspace } from "../../../src/server/workspaces/workspaceRepository";
import { createUploadedFile, getUploadedFile } from "../../../src/server/workspaces/uploadedFileRepository";
import {
  getDocumentOutline,
  listDetectedQuestions,
  listDocumentPages,
  replaceDetectedQuestions,
  replaceDocumentPages,
  saveDocumentOutline,
} from "../../../src/server/workspaces/documentArtifactRepository";

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let userCounter = 0;

function nextUser(prefix: string): string {
  userCounter += 1;
  return `${prefix}-${runId}-${userCounter}`;
}

describeFirebaseWorkspaceEmulator("documentArtifactRepository against the Firestore emulator", () => {
  beforeAll(async () => {
    await assertFirestoreEmulatorRunning();
  });

  async function createUploadedPdf(userId: string) {
    const workspace = await createWorkspace(userId, { name: "Physics" });
    const file = await createUploadedFile(userId, {
      workspaceId: workspace.id,
      name: "Homework 1.pdf",
      sourceType: "pdf",
      assignmentStatus: "assigned",
      indexingStatus: "indexed",
      summaryStatus: "not_requested",
      summarySource: "none",
      extractionStatus: "completed",
      chunkingStatus: "completed",
      understandingStatus: "not_started",
      deepPdfStatus: "not_started",
    });

    return { workspace, file };
  }

  it("creates and lists page artifacts in page order", async () => {
    const alice = nextUser("alice");
    const { file } = await createUploadedPdf(alice);

    await replaceDocumentPages(alice, file.id, [
      {
        pageId: "page_0002",
        fileId: file.id,
        pageNumber: 2,
        extractedText: "עמוד 2",
        cleanedText: "עמוד 2",
        textQuality: "partial",
        charCount: 6,
        sourceChunkIds: ["chunk-2"],
        sourceReferences: [{ fileId: file.id, pageNumber: 2, sourceChunkIds: ["chunk-2"] }],
      },
      {
        pageId: "page_0001",
        fileId: file.id,
        pageNumber: 1,
        extractedText: "עמוד 1",
        cleanedText: "עמוד 1",
        textQuality: "good",
        charCount: 6,
        sourceChunkIds: ["chunk-1"],
      },
    ]);

    const pages = await listDocumentPages(alice, file.id);
    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.pageId)).toEqual(["page_0001", "page_0002"]);
    expect(pages[0].textQuality).toBe("good");
  });

  it("stores and reads a singleton document outline safely", async () => {
    const alice = nextUser("alice");
    const { file } = await createUploadedPdf(alice);

    const saved = await saveDocumentOutline(alice, file.id, {
      outlineId: "v1",
      fileId: file.id,
      title: "מטלה 1",
      confidence: "medium",
      sections: [
        {
          sectionId: "section-1",
          label: "שאלה 1",
          title: "שדה מגנטי",
          pageStart: 1,
          pageEnd: 2,
          charStart: 0,
          charEnd: 180,
          sourceChunkIds: ["chunk-1"],
          confidence: 0.84,
          subsections: [],
        },
      ],
      sourceReferences: [{ fileId: file.id, pageStart: 1, pageEnd: 2, sourceChunkIds: ["chunk-1"] }],
    });

    expect(saved.outlineId).toBe("v1");
    const loaded = await getDocumentOutline(alice, file.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe("מטלה 1");
    expect(loaded?.sections[0].label).toBe("שאלה 1");
  });

  it("creates and lists detected questions in char order", async () => {
    const alice = nextUser("alice");
    const { file } = await createUploadedPdf(alice);

    await replaceDetectedQuestions(alice, file.id, [
      {
        questionId: "q_002",
        fileId: file.id,
        label: "שאלה 2",
        questionNumber: 2,
        topic: "חישוב שדה",
        summary: "סיכום קצר",
        pageStart: 2,
        pageEnd: 2,
        charStart: 200,
        charEnd: 350,
        sourceChunkIds: ["chunk-2"],
        subsections: [],
        confidence: 0.73,
      },
      {
        questionId: "q_001",
        fileId: file.id,
        label: "שאלה 1",
        questionNumber: 1,
        pageStart: 1,
        pageEnd: 1,
        charStart: 0,
        charEnd: 180,
        sourceChunkIds: ["chunk-1"],
        subsections: [
          {
            label: "סעיף א׳",
            charStart: 30,
            charEnd: 60,
            sourceChunkIds: ["chunk-1"],
          },
        ],
        confidence: 0.91,
      },
    ]);

    const questions = await listDetectedQuestions(alice, file.id);
    expect(questions).toHaveLength(2);
    expect(questions.map((question) => question.questionId)).toEqual(["q_001", "q_002"]);
    expect(questions[0].subsections[0].label).toBe("סעיף א׳");
  });

  it("returns empty/null safely when artifacts do not exist and leaves legacy file records readable", async () => {
    const alice = nextUser("alice");
    const { file } = await createUploadedPdf(alice);

    await expect(listDocumentPages(alice, file.id)).resolves.toEqual([]);
    await expect(listDetectedQuestions(alice, file.id)).resolves.toEqual([]);
    await expect(getDocumentOutline(alice, file.id)).resolves.toBeNull();

    const loadedFile = await getUploadedFile(alice, file.id);
    expect(loadedFile).not.toBeNull();
    expect(loadedFile?.understandingStatus).toBe("not_started");
    expect(loadedFile?.deepPdfStatus).toBe("not_started");
  });
});
