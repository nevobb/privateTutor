import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FilePanel from "../../../src/components/files/FilePanel";
import type { UploadedFile } from "../../../src/types";

function makeFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    id: "file-1",
    name: "very-long-file-name-that-should-truncate-in-narrow-sidebar-layout-for-rtl-testing.pdf",
    url: "",
    uploadedAt: new Date("2026-05-20T10:00:00.000Z"),
    sourceType: "pdf",
    assignmentStatus: "unassigned",
    indexingStatus: "not-indexed",
    extractionStatus: "not_started",
    chunkingStatus: "not_started",
    ...overrides,
  };
}

describe("FilePanel processing actions", () => {
  it("renders Continue processing when extraction is completed and chunking is not_started", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeFile({ extractionStatus: "completed", chunkingStatus: "not_started" })]}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).toContain("Continue processing");
  });

  it("shows Ready for learning when extraction, chunking, and embedding are all completed", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeFile({ extractionStatus: "completed", chunkingStatus: "completed", embeddingStatus: "completed" })]}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).toContain("Ready for learning");
    expect(html).not.toContain("Continue processing");
  });

  it("shows Continue processing when chunking is done but embedding is not_started", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeFile({ extractionStatus: "completed", chunkingStatus: "completed", embeddingStatus: "not_started" })]}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).toContain("Continue processing");
    expect(html).toContain("Create embeddings to complete file readiness");
    expect(html).not.toContain("Ready for learning");
  });

  it("shows Retry processing on failed status", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeFile({ extractionStatus: "failed" })]}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).toContain("Retry processing");
  });

  it("keeps continue action and status visible with long filenames", () => {
    const html = renderToStaticMarkup(
      <FilePanel files={[makeFile()]} onContinueProcessing={async () => {}} />
    );

    expect(html).toContain("Continue processing");
    expect(html).toContain("truncate");
  });

  it("shows Ready for learning after page refresh when all three statuses are completed in Firestore", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeFile({ extractionStatus: "completed", chunkingStatus: "completed", embeddingStatus: "completed" })]}
        processingStatusByFileId={{}}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).toContain("Ready for learning");
    expect(html).not.toContain("Continue processing");
  });

  it("displays Hebrew original filename when name is set to original", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeFile({ name: "תרגול מעגלים.pdf" })]}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).toContain("תרגול מעגלים.pdf");
  });
});
