/**
 * Workspace API emulator integration tests.
 *
 * Requires the Firestore emulator to be running.
 * Run via: FIREBASE_WORKSPACE_API_EMULATOR_TEST=1 vitest run tests/firebase/workspaceApi.emulator.test.ts
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  assertFirestoreEmulatorRunning,
} from "./firestoreTestUtils";
import type { AuthResult } from "../../src/server/auth/authTypes";
import {
  createWorkspacesGetHandler,
  createWorkspacesPostHandler,
} from "../../src/app/api/workspaces/route";
import { createWorkspaceByIdGetHandler } from "../../src/app/api/workspaces/[workspaceId]/route";
import { createWorkspaceMovePostHandler } from "../../src/app/api/workspaces/[workspaceId]/move/route";
import {
  createWorkspaceFilesGetHandler,
  createWorkspaceFilesPostHandler,
} from "../../src/app/api/workspaces/[workspaceId]/files/route";
import { createDecisionLogGetHandler } from "../../src/app/api/decision-log/route";

const WORKSPACE_API_EMULATOR_TEST_ENABLED = process.env.FIREBASE_WORKSPACE_API_EMULATOR_TEST === "1";
const describeWorkspaceApiEmulator = WORKSPACE_API_EMULATOR_TEST_ENABLED ? describe : describe.skip;

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let userCounter = 0;

function nextUser(prefix: string): string {
  userCounter += 1;
  return `${prefix}-${runId}-${userCounter}`;
}

function makeAuthResolver(userId: string): (req: Request) => Promise<AuthResult> {
  return async (_req) => ({ ok: true, user: { userId, email: `${userId}@test.example` } });
}

function makeFailingAuthResolver(): (req: Request) => Promise<AuthResult> {
  return async (_req) => ({ ok: false, status: 401, error: { error: "Unauthorized." } });
}

function makeByIdContext(workspaceId: string) {
  return { params: Promise.resolve({ workspaceId }) };
}

describeWorkspaceApiEmulator("workspace API emulator integration tests", () => {
  beforeAll(async () => {
    await assertFirestoreEmulatorRunning();
  });

  it("POST creates a workspace and returns 201 with correct shape", async () => {
    const alice = nextUser("alice");
    const handler = createWorkspacesPostHandler(makeAuthResolver(alice));
    const response = await handler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "API Test Workspace", description: "from API" }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBeTruthy();
    expect(body.userId).toBe(alice);
    expect(body.name).toBe("API Test Workspace");
    expect(body.status).toBe("active");
    expect(typeof body.createdAt).toBe("string");
  });

  it("GET list returns created workspace for owner", async () => {
    const alice = nextUser("alice");
    const postHandler = createWorkspacesPostHandler(makeAuthResolver(alice));
    await postHandler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Listed Workspace" }),
      })
    );

    const getHandler = createWorkspacesGetHandler(makeAuthResolver(alice));
    const response = await getHandler(new Request("http://localhost/api/workspaces"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.workspaces)).toBe(true);
    const found = body.workspaces.find((w: { name: string }) => w.name === "Listed Workspace");
    expect(found).toBeTruthy();
    expect(found.userId).toBe(alice);
  });

  it("GET list returns empty for user with no workspaces", async () => {
    const alice = nextUser("alice");
    const getHandler = createWorkspacesGetHandler(makeAuthResolver(alice));
    const response = await getHandler(new Request("http://localhost/api/workspaces"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workspaces).toHaveLength(0);
  });

  it("GET by ID returns workspace when owner accesses it", async () => {
    const alice = nextUser("alice");
    const postHandler = createWorkspacesPostHandler(makeAuthResolver(alice));
    const createResponse = await postHandler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Fetchable Workspace" }),
      })
    );
    const created = await createResponse.json();

    const getHandler = createWorkspaceByIdGetHandler(makeAuthResolver(alice));
    const response = await getHandler(
      new Request(`http://localhost/api/workspaces/${created.id}`),
      makeByIdContext(created.id)
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(created.id);
    expect(body.name).toBe("Fetchable Workspace");
  });

  it("GET by ID returns 404 for non-existent workspace", async () => {
    const alice = nextUser("alice");
    const getHandler = createWorkspaceByIdGetHandler(makeAuthResolver(alice));
    const response = await getHandler(
      new Request("http://localhost/api/workspaces/does-not-exist"),
      makeByIdContext("does-not-exist")
    );

    expect(response.status).toBe(404);
  });

  it("GET list returns 401 for missing auth", async () => {
    const getHandler = createWorkspacesGetHandler(makeFailingAuthResolver());
    const response = await getHandler(new Request("http://localhost/api/workspaces"));
    expect(response.status).toBe(401);
  });

  it("POST returns 400 for missing name", async () => {
    const alice = nextUser("alice");
    const handler = createWorkspacesPostHandler(makeAuthResolver(alice));
    const response = await handler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: "no name here" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("POST move updates currentPath while keeping workspace id unchanged", async () => {
    const alice = nextUser("alice");
    const postHandler = createWorkspacesPostHandler(makeAuthResolver(alice));
    const createResponse = await postHandler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Physics 2" }),
      })
    );
    const created = await createResponse.json();

    const moveHandler = createWorkspaceMovePostHandler(makeAuthResolver(alice));
    const moveResponse = await moveHandler(
      new Request(`http://localhost/api/workspaces/${created.id}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPath: " Year 1/ Semester B /Physics 2 " }),
      }),
      makeByIdContext(created.id)
    );

    expect(moveResponse.status).toBe(200);
    const moved = await moveResponse.json();
    expect(moved.id).toBe(created.id);
    expect(moved.currentPath).toBe("Year 1 / Semester B / Physics 2");
  });

  it("POST move tracks previousPaths without duplicating entries", async () => {
    const alice = nextUser("alice");
    const postHandler = createWorkspacesPostHandler(makeAuthResolver(alice));
    const createResponse = await postHandler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Physics 2" }),
      })
    );
    const created = await createResponse.json();

    const moveHandler = createWorkspaceMovePostHandler(makeAuthResolver(alice));

    await moveHandler(
      new Request(`http://localhost/api/workspaces/${created.id}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPath: "Year 1 / Semester B / Physics 2" }),
      }),
      makeByIdContext(created.id)
    );

    await moveHandler(
      new Request(`http://localhost/api/workspaces/${created.id}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPath: "Year 1 / Semester B / Mechanics / Physics 2" }),
      }),
      makeByIdContext(created.id)
    );

    const moveResponse = await moveHandler(
      new Request(`http://localhost/api/workspaces/${created.id}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPath: "Year 1 / Semester B / Mechanics / Physics 2" }),
      }),
      makeByIdContext(created.id)
    );

    expect(moveResponse.status).toBe(200);
    const moved = await moveResponse.json();
    expect(moved.previousPaths).toEqual(["Year 1 / Semester B / Physics 2"]);
  });

  it("POST files creates metadata and returns indexed lifecycle fields", async () => {
    const alice = nextUser("alice");
    const workspacePost = createWorkspacesPostHandler(makeAuthResolver(alice));
    const workspaceResponse = await workspacePost(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Files Workspace" }),
      })
    );
    const createdWorkspace = await workspaceResponse.json();

    const filesPost = createWorkspaceFilesPostHandler(makeAuthResolver(alice));
    const response = await filesPost(
      new Request(`http://localhost/api/workspaces/${createdWorkspace.id}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: "Mechanics Intro.pdf",
          sourceType: "pdf",
          topicHint: "Mechanics",
        }),
      }),
      makeByIdContext(createdWorkspace.id)
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.workspaceId).toBe(createdWorkspace.id);
    expect(body.assignmentStatus).toBe("assigned");
    expect(body.indexingStatus).toBe("indexed");
    expect(body.topic).toBe("Mechanics");
    expect(typeof body.confidence).toBe("number");
  });

  it("POST files returns 400 for unsupported sourceType", async () => {
    const alice = nextUser("alice");
    const filesPost = createWorkspaceFilesPostHandler(makeAuthResolver(alice));
    const response = await filesPost(
      new Request("http://localhost/api/workspaces/ws-1/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "notes.txt", sourceType: "txt" }),
      }),
      makeByIdContext("ws-1")
    );

    expect(response.status).toBe(400);
  });

  it("POST files returns 404 for cross-user workspace access", async () => {
    const alice = nextUser("alice");
    const bob = nextUser("bob");
    const workspacePost = createWorkspacesPostHandler(makeAuthResolver(alice));
    const workspaceResponse = await workspacePost(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Private Files Workspace" }),
      })
    );
    const createdWorkspace = await workspaceResponse.json();

    const filesPost = createWorkspaceFilesPostHandler(makeAuthResolver(bob));
    const response = await filesPost(
      new Request(`http://localhost/api/workspaces/${createdWorkspace.id}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "Mechanics Intro.pdf", sourceType: "pdf" }),
      }),
      makeByIdContext(createdWorkspace.id)
    );

    expect(response.status).toBe(404);
  });

  it("GET files lists only workspace-owned metadata entries", async () => {
    const alice = nextUser("alice");
    const workspacePost = createWorkspacesPostHandler(makeAuthResolver(alice));
    const workspaceResponse = await workspacePost(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Files List Workspace" }),
      })
    );
    const createdWorkspace = await workspaceResponse.json();

    const filesPost = createWorkspaceFilesPostHandler(makeAuthResolver(alice));
    await filesPost(
      new Request(`http://localhost/api/workspaces/${createdWorkspace.id}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "A.pdf", sourceType: "pdf" }),
      }),
      makeByIdContext(createdWorkspace.id)
    );

    const filesGet = createWorkspaceFilesGetHandler(makeAuthResolver(alice));
    const response = await filesGet(
      new Request(`http://localhost/api/workspaces/${createdWorkspace.id}/files`),
      makeByIdContext(createdWorkspace.id)
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.files)).toBe(true);
    expect(body.files).toHaveLength(1);
    expect(body.files[0].workspaceId).toBe(createdWorkspace.id);
  });

  it("writes decision log entries for assignment, classification and indexing", async () => {
    const alice = nextUser("alice");
    const workspacePost = createWorkspacesPostHandler(makeAuthResolver(alice));
    const workspaceResponse = await workspacePost(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Diagnostics Workspace" }),
      })
    );
    const createdWorkspace = await workspaceResponse.json();

    const filesPost = createWorkspaceFilesPostHandler(makeAuthResolver(alice));
    const fileResponse = await filesPost(
      new Request(`http://localhost/api/workspaces/${createdWorkspace.id}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: "Mechanics Intro.pdf",
          sourceType: "pdf",
          topicHint: "Mechanics",
        }),
      }),
      makeByIdContext(createdWorkspace.id)
    );
    expect(fileResponse.status).toBe(201);

    const decisionLogGet = createDecisionLogGetHandler(makeAuthResolver(alice));
    const logResponse = await decisionLogGet(
      new Request(`http://localhost/api/decision-log?workspaceId=${createdWorkspace.id}&limit=20`)
    );

    expect(logResponse.status).toBe(200);
    const logs = await logResponse.json();
    const decisionTypes = logs.entries.map((entry: { decisionType: string }) => entry.decisionType);
    expect(decisionTypes).toContain("file_assignment");
    expect(decisionTypes).toContain("topic_classification");
    expect(decisionTypes).toContain("file_indexing");
  });
});
