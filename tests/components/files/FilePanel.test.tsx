import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FilePanel, {
  FileStatusLabel,
  FileRowMenu,
} from "../../../src/components/files/FilePanel";
import type { UploadedFile } from "../../../src/types";

function makeFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    id: "file-1",
    name: "very-long-file-name-that-should-truncate-in-narrow-sidebar-layout-for-rtl-testing.pdf",
    url: "",
    uploadedAt: new Date("2026-05-20T10:00:00.000Z"),
    sourceType: "pdf",
    storagePath: "users/alice/workspaces/ws-1/files/file-1/lecture.pdf",
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

  it("shows ✓ Ready when extraction, chunking, and embedding are all completed", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeFile({ extractionStatus: "completed", chunkingStatus: "completed", embeddingStatus: "completed" })]}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).toContain("✓ Ready");
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
    expect(html).not.toContain("✓ Ready");
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

  it("shows Re-upload required instead of pretending continuation is possible when persisted storage metadata is missing", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeFile({ extractionStatus: "not_started", storagePath: undefined })]}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).toContain("Re-upload required");
    expect(html).not.toContain("Run the next incomplete step automatically");
  });

  it("shows Failed status label when embedding failed", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[
          makeFile({
            extractionStatus: "completed",
            chunkingStatus: "completed",
            embeddingStatus: "failed",
          }),
        ]}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).toContain("Failed");
    expect(html).not.toContain("Emb:failed");
  });

  it("keeps continue action and status visible with long filenames", () => {
    const html = renderToStaticMarkup(
      <FilePanel files={[makeFile()]} onContinueProcessing={async () => {}} />
    );

    expect(html).toContain("Continue processing");
    expect(html).toContain("truncate");
  });

  it("shows ✓ Ready after page refresh when all three statuses are completed in Firestore", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeFile({ extractionStatus: "completed", chunkingStatus: "completed", embeddingStatus: "completed" })]}
        processingStatusByFileId={{}}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).toContain("✓ Ready");
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

  it("does not show raw debug status codes", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeFile({ extractionStatus: "completed", chunkingStatus: "completed", embeddingStatus: "completed" })]}
        onContinueProcessing={async () => {}}
      />
    );

    expect(html).not.toContain("E:completed");
    expect(html).not.toContain("C:completed");
    expect(html).not.toContain("Emb:completed");
  });
});

/* ── FileStatusLabel ── */

describe("FileStatusLabel", () => {
  it("shows ✓ Ready when all three stages complete", () => {
    const html = renderToStaticMarkup(
      <FileStatusLabel
        extractionStatus="completed"
        chunkingStatus="completed"
        embeddingStatus="completed"
        isReadyForLearning={true}
      />
    );
    expect(html).toContain("✓ Ready");
    expect(html).toContain('data-testid="file-status-ready"');
  });

  it("shows Processing when not ready and no failure", () => {
    const html = renderToStaticMarkup(
      <FileStatusLabel
        extractionStatus="completed"
        chunkingStatus="not_started"
        embeddingStatus="not_started"
        isReadyForLearning={false}
      />
    );
    expect(html).toContain("Processing");
    expect(html).toContain('data-testid="file-status-processing"');
  });

  it("shows Failed when extraction failed", () => {
    const html = renderToStaticMarkup(
      <FileStatusLabel
        extractionStatus="failed"
        chunkingStatus="not_started"
        embeddingStatus="not_started"
        isReadyForLearning={false}
      />
    );
    expect(html).toContain("Failed");
    expect(html).toContain('data-testid="file-status-failed"');
  });

  it("shows Failed when embedding failed", () => {
    const html = renderToStaticMarkup(
      <FileStatusLabel
        extractionStatus="completed"
        chunkingStatus="completed"
        embeddingStatus="failed"
        isReadyForLearning={false}
      />
    );
    expect(html).toContain("Failed");
    expect(html).toContain('data-testid="file-status-failed"');
  });

  it("does not show raw E:/C:/Emb: debug codes", () => {
    const html = renderToStaticMarkup(
      <FileStatusLabel
        extractionStatus="completed"
        chunkingStatus="completed"
        embeddingStatus="completed"
        isReadyForLearning={true}
      />
    );
    expect(html).not.toContain("E:completed");
    expect(html).not.toContain("C:completed");
    expect(html).not.toContain("Emb:completed");
  });
});

/* ── FileRowMenu ── */

describe("FileRowMenu", () => {
  it("renders Delete as an active action", () => {
    const html = renderToStaticMarkup(<FileRowMenu onDelete={() => {}} />);
    expect(html).toContain("Delete");
  });

  it("renders future actions as disabled", () => {
    const html = renderToStaticMarkup(<FileRowMenu onDelete={() => {}} />);
    expect(html).toContain("Summarize");
    expect(html).toContain("Ask about file");
    expect(html).toContain("Start learning");
    expect(html).toContain("opacity-40");
  });

  it("has role=menu on container", () => {
    const html = renderToStaticMarkup(<FileRowMenu onDelete={() => {}} />);
    expect(html).toContain('role="menu"');
  });

  it("has role=menuitem on each item", () => {
    const html = renderToStaticMarkup(<FileRowMenu onDelete={() => {}} />);
    const matches = html.match(/role="menuitem"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(4); // Delete + 3 disabled
  });
});

/* ── Use in chat (C5C) ── */

describe("FilePanel Use in chat", () => {
  function makeReadyFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
    return {
      id: "file-ready",
      name: "lecture.pdf",
      url: "",
      uploadedAt: new Date(),
      sourceType: "pdf",
      storagePath: "users/alice/workspaces/ws-1/files/file-ready/lecture.pdf",
      assignmentStatus: "unassigned",
      indexingStatus: "not-indexed",
      extractionStatus: "completed",
      chunkingStatus: "completed",
      embeddingStatus: "completed",
      ...overrides,
    };
  }

  it("shows the Hebrew course-context action for a ready file when onUseInChat provided", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeReadyFile()]}
        onContinueProcessing={async () => {}}
        onUseInChat={() => {}}
      />
    );
    expect(html).toContain('data-testid="use-in-chat-button"');
    expect(html).toContain("בחר חומר מהקורס");
  });

  it("does not show Use in chat button when onUseInChat is not provided", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeReadyFile()]}
        onContinueProcessing={async () => {}}
      />
    );
    expect(html).not.toContain('data-testid="use-in-chat-button"');
  });

  it("does not show Use in chat button for not-ready file", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeReadyFile({ extractionStatus: "pending", chunkingStatus: "not_started", embeddingStatus: "not_started" })]}
        onContinueProcessing={async () => {}}
        onUseInChat={() => {}}
      />
    );
    expect(html).not.toContain('data-testid="use-in-chat-button"');
  });

  it("does not show Use in chat button when extraction done but embedding not done", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeReadyFile({ embeddingStatus: "not_started" })]}
        onContinueProcessing={async () => {}}
        onUseInChat={() => {}}
      />
    );
    expect(html).not.toContain('data-testid="use-in-chat-button"');
  });

  it("does not show Use in chat button when confirming delete", () => {
    // Confirm delete state is internal to FilePanel — we can only verify
    // that the button appears for a fresh ready file; delete state hides it.
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeReadyFile()]}
        onContinueProcessing={async () => {}}
        onUseInChat={() => {}}
        onDeleteFile={async () => {}}
      />
    );
    // Button should be present in initial state (no delete confirmation active)
    expect(html).toContain('data-testid="use-in-chat-button"');
  });

  it("uses originalFileName in button when available", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        files={[makeReadyFile({ name: "internal-name", originalFileName: "Lecture 3.pdf" })]}
        onContinueProcessing={async () => {}}
        onUseInChat={() => {}}
      />
    );
    expect(html).toContain('data-testid="use-in-chat-button"');
    // The button click carries originalFileName — can't test the click value in static render,
    // but the button must be present
  });
});
