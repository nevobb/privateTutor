import { describe, expect, it } from "vitest";
import { fileExtractionProvider } from "../../../src/server/workspaces/fileExtractionProvider";

describe("fileExtractionProvider", () => {
  it("returns deterministic placeholder extraction text for pdf", async () => {
    const result = await fileExtractionProvider.extractText({
      userId: "alice",
      workspaceId: "ws-1",
      fileId: "file-1",
      fileName: "Mechanics.pdf",
      sourceType: "pdf",
      storagePath: "users/alice/workspaces/ws-1/files/file-1/Mechanics.pdf",
    });

    expect(result.source).toBe("deterministic_test_parser");
    expect(result.text).toContain("Extraction boundary placeholder for Mechanics.pdf");
    expect(result.text).toContain("Real PDF/DOCX parsing is not implemented yet.");
  });

  it("throws on invalid input", async () => {
    await expect(
      fileExtractionProvider.extractText({
        userId: "alice",
        workspaceId: "ws-1",
        fileId: "file-1",
        fileName: "bad.pdf",
        sourceType: "pdf",
        storagePath: "",
      })
    ).rejects.toThrow("unsupported_input");
  });
});
