import { beforeEach, describe, expect, it, vi } from "vitest";

type DocData = Record<string, unknown>;
const store = new Map<string, DocData>();

function makeDb() {
  return {
    doc(path: string) {
      return {
        async set(data: DocData) {
          store.set(path, data);
        },
        async get() {
          const data = store.get(path);
          return {
            exists: Boolean(data),
            data: () => data,
          };
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

import { getDocumentOutline, replaceDocumentOutline } from "../../../src/server/workspaces/documentOutlineRepository";

const userId = "outline-repo-user";
const workspaceId = "ws-o";
const fileId = "file-o";

beforeEach(() => {
  store.clear();
});

describe("documentOutlineRepository", () => {
  it("replaces and reads the current outline", async () => {
    await replaceDocumentOutline(userId, workspaceId, fileId, {
      id: "current",
      userId,
      workspaceId,
      fileId,
      title: "Midterm",
      sections: [
        {
          sectionId: "section_0001",
          title: "Part A",
          pageStart: 1,
          pageEnd: 3,
          confidence: "medium",
        },
      ],
    });

    const outline = await getDocumentOutline(userId, workspaceId, fileId);
    expect(outline).not.toBeNull();
    expect(outline?.sections).toHaveLength(1);
    expect(outline?.title).toBe("Midterm");
  });
});
