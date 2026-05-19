import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/learnerMemoryApiService", () => ({
  learnerMemoryApiService: {
    listForUser: vi.fn(),
    patchObservation: vi.fn(),
    deleteObservation: vi.fn(),
  },
}));

vi.mock("../../../src/server/workspaces/learnerMemoryApiSchemas", () => ({
  parseLearnerMemoryPatchRequest: vi.fn(),
  toLearnerMemoryObservationApiItem: vi.fn((item: unknown) => item),
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { createLearnerMemoryGetHandler } from "../../../src/app/api/learner-memory/route";
import {
  createLearnerMemoryDeleteHandler,
  createLearnerMemoryPatchHandler,
} from "../../../src/app/api/learner-memory/[observationId]/route";
import { learnerMemoryApiService } from "../../../src/server/workspaces/learnerMemoryApiService";
import {
  parseLearnerMemoryPatchRequest,
  toLearnerMemoryObservationApiItem,
} from "../../../src/server/workspaces/learnerMemoryApiSchemas";

const mockList = vi.mocked(learnerMemoryApiService.listForUser);
const mockPatch = vi.mocked(learnerMemoryApiService.patchObservation);
const mockDelete = vi.mocked(learnerMemoryApiService.deleteObservation);
const mockParsePatch = vi.mocked(parseLearnerMemoryPatchRequest);
const mockSerialize = vi.mocked(toLearnerMemoryObservationApiItem);

function okAuth(): (request: Request) => Promise<AuthResult> {
  return async () => ({ ok: true, user: { userId: "alice", email: "alice@test.example" } });
}

function failAuth(): (request: Request) => Promise<AuthResult> {
  return async () => ({ ok: false, status: 401, error: { error: "Unauthorized." } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("learnerMemory routes", () => {
  it("GET returns observations", async () => {
    mockList.mockResolvedValueOnce([{ id: "mem-1" }] as never);
    mockSerialize.mockReturnValueOnce({ id: "mem-1", content: "x" } as never);

    const res = await createLearnerMemoryGetHandler(okAuth())(new Request("http://localhost/api/learner-memory"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.observations).toHaveLength(1);
  });

  it("PATCH validates and updates", async () => {
    mockParsePatch.mockReturnValueOnce({ ok: true, input: { action: "approve" } });
    mockPatch.mockResolvedValueOnce({ id: "mem-1" } as never);
    mockSerialize.mockReturnValueOnce({ id: "mem-1", state: "active" } as never);

    const handler = createLearnerMemoryPatchHandler(okAuth());
    const res = await handler(
      new Request("http://localhost/api/learner-memory/mem-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: Promise.resolve({ observationId: "mem-1" }) }
    );

    expect(res.status).toBe(200);
  });

  it("DELETE returns 404 for missing", async () => {
    mockDelete.mockResolvedValueOnce(false);
    const handler = createLearnerMemoryDeleteHandler(okAuth());
    const res = await handler(
      new Request("http://localhost/api/learner-memory/missing", { method: "DELETE" }),
      { params: Promise.resolve({ observationId: "missing" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 on auth fail", async () => {
    const res = await createLearnerMemoryGetHandler(failAuth())(new Request("http://localhost/api/learner-memory"));
    expect(res.status).toBe(401);
  });
});
