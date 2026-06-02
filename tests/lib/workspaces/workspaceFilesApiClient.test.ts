import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runWorkspaceFileExtraction,
  WorkspaceFilesApiError,
} from "../../../src/lib/workspaces/workspaceFilesApiClient";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const TOKEN = "test-bearer-token";

function makeOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeErrorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeFile(name: string, content = "pdf-content", type = "application/pdf"): File {
  return new File([content], name, { type });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("runWorkspaceFileExtraction", () => {
  it("sends multipart/form-data with file bytes", async () => {
    const fileItem = { id: "file-1", extractionStatus: "completed" };
    mockFetch.mockResolvedValueOnce(makeOkResponse(fileItem));

    const file = makeFile("lecture.pdf");
    await runWorkspaceFileExtraction({
      workspaceId: "ws-1",
      fileId: "file-1",
      idToken: TOKEN,
      file,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/workspaces/ws-1/files/file-1/extract");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const formData = init.body as FormData;
    expect(formData.get("file")).toBeInstanceOf(File);
    const sentFile = formData.get("file") as File;
    expect(sentFile.name).toBe("lecture.pdf");
  });

  it("does not set Content-Type header manually", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ id: "file-1" }));

    await runWorkspaceFileExtraction({
      workspaceId: "ws-1",
      fileId: "file-1",
      idToken: TOKEN,
      file: makeFile("a.pdf"),
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("includes Authorization header", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ id: "file-1" }));

    await runWorkspaceFileExtraction({
      workspaceId: "ws-1",
      fileId: "file-1",
      idToken: TOKEN,
      file: makeFile("a.pdf"),
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${TOKEN}`);
  });

  it("throws WorkspaceFilesApiError on 400", async () => {
    mockFetch.mockResolvedValueOnce(
      makeErrorResponse(400, "File bytes are required for extraction.")
    );

    await expect(
      runWorkspaceFileExtraction({
        workspaceId: "ws-1",
        fileId: "file-1",
        idToken: TOKEN,
        file: makeFile("a.pdf"),
      })
    ).rejects.toBeInstanceOf(WorkspaceFilesApiError);
  });

  it("throws WorkspaceFilesApiError with status on failure", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(404, "Workspace or file not found."));

    await expect(
      runWorkspaceFileExtraction({
        workspaceId: "ws-1",
        fileId: "missing",
        idToken: TOKEN,
        file: makeFile("a.pdf"),
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("uses the persisted file route without multipart bytes when local File state is gone after refresh", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ id: "file-1", extractionStatus: "completed" }));

    await runWorkspaceFileExtraction({
      workspaceId: "ws-1",
      fileId: "file-1",
      idToken: TOKEN,
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/workspaces/ws-1/files/file-1/extract");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("sends DOCX file with correct name", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ id: "file-2", extractionStatus: "completed" }));

    const file = makeFile(
      "notes.docx",
      "docx-bytes",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    await runWorkspaceFileExtraction({
      workspaceId: "ws-1",
      fileId: "file-2",
      idToken: TOKEN,
      file,
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const formData = init.body as FormData;
    const sentFile = formData.get("file") as File;
    expect(sentFile.name).toBe("notes.docx");
  });
});
