import { beforeEach, describe, expect, it, vi } from "vitest";

type DocData = Record<string, unknown>;
const store = new Map<string, DocData>();

function makeDb() {
  return {
    collection(path: string) {
      return {
        async get() {
          const docs = Array.from(store.entries())
            .filter(([key]) => key.startsWith(`${path}/`))
            .map(([key, data]) => ({
              id: key.split("/").at(-1) ?? "",
              data: () => data,
              ref: {
                delete: async () => {
                  store.delete(key);
                },
              },
            }));

          return { docs };
        },
        orderBy() {
          return this;
        },
      };
    },
    doc(path: string) {
      return {
        async set(data: DocData) {
          store.set(path, data);
        },
      };
    },
  };
}

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  withFirestoreEmulatorClient: vi.fn(async (_userId: string, handler: (client: { db: ReturnType<typeof makeDb> }) => Promise<unknown>) => {
    return handler({ db: makeDb() });
  }),
}));

import { listDetectedQuestions, replaceDetectedQuestions } from "../../../src/server/workspaces/detectedQuestionRepository";

const userId = "detected-repo-user";
const workspaceId = "ws-q";
const fileId = "file-q";

beforeEach(() => {
  store.clear();
});

describe("detectedQuestionRepository", () => {
  it("replaces and lists detected questions", async () => {
    await replaceDetectedQuestions(userId, workspaceId, fileId, [
      {
        id: "question_0002",
        userId,
        workspaceId,
        fileId,
        labelRaw: "Question 2",
        questionNumber: 2,
        confidence: "high",
      },
      {
        id: "question_0001",
        userId,
        workspaceId,
        fileId,
        labelRaw: "Question 1",
        questionNumber: 1,
        confidence: "high",
      },
    ]);

    const listed = await listDetectedQuestions(userId, workspaceId, fileId);
    expect(listed).toHaveLength(2);
    expect(listed[0]?.labelRaw).toBe("Question 2");
    expect(listed[1]?.labelRaw).toBe("Question 1");
  });
});
