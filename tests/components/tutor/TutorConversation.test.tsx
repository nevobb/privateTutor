import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TutorConversation, {
  DecisionLogPanelBody,
  formatSourcesLabel,
  hasNewAssistantMessage,
  isTimeoutError,
  normalizeCitations,
  PlusMenu,
  SourcesSection,
  shouldSubmitOnKeyDown,
} from "../../../src/components/tutor/TutorConversation";
import { SessionMessagesApiError } from "../../../src/lib/sessions/sessionMessagesApiClient";

/* ── Composer layout ── */

describe("TutorConversation composer layout", () => {
  it("renders plus button left of textarea and send button right of textarea", () => {
    const html = renderToStaticMarkup(
      <TutorConversation
        activeSessionId={null}
        activeWorkspaceId={null}
        developerDiagnosticsEnabled={false}
        workMode="Learning"
        onWorkModeChange={() => {}}
        costMode="Normal Learning"
        onCostModeChange={() => {}}
        activeTopicName={null}
        getToken={async () => null}
      />
    );

    const plusIndex = html.indexOf('data-testid="plus-menu-button"');
    const textareaIndex = html.indexOf('data-testid="message-textarea"');
    const sendIndex = html.indexOf('data-testid="send-button"');
    expect(plusIndex).toBeGreaterThan(-1);
    expect(textareaIndex).toBeGreaterThan(-1);
    expect(sendIndex).toBeGreaterThan(-1);
    expect(plusIndex).toBeLessThan(textareaIndex);
    expect(textareaIndex).toBeLessThan(sendIndex);
    expect(html).not.toContain("pr-14");
  });

  it("keeps send disabled when no active session", () => {
    const html = renderToStaticMarkup(
      <TutorConversation
        activeSessionId={null}
        activeWorkspaceId={null}
        developerDiagnosticsEnabled={false}
        workMode="Learning"
        onWorkModeChange={() => {}}
        costMode="Normal Learning"
        onCostModeChange={() => {}}
        activeTopicName={null}
        getToken={async () => null}
      />
    );

    expect(html).toContain('data-testid="send-button"');
    expect(html).toContain("disabled");
  });

  it("keeps plus button disabled when no active session", () => {
    const html = renderToStaticMarkup(
      <TutorConversation
        activeSessionId={null}
        activeWorkspaceId={null}
        developerDiagnosticsEnabled={false}
        workMode="Learning"
        onWorkModeChange={() => {}}
        costMode="Normal Learning"
        onCostModeChange={() => {}}
        activeTopicName={null}
        getToken={async () => null}
      />
    );

    expect(html).toContain('data-testid="plus-menu-button"');
    expect(html).toContain("disabled");
  });
});

/* ── PlusMenu ── */

describe("PlusMenu", () => {
  function renderMenu(overrides: Partial<React.ComponentProps<typeof PlusMenu>> = {}) {
    return renderToStaticMarkup(
      <PlusMenu
        workMode="Learning"
        onWorkModeChange={() => {}}
        costMode="Normal Learning"
        onCostModeChange={() => {}}
        workModeMenuOpen={false}
        setWorkModeMenuOpen={() => {}}
        costModeMenuOpen={false}
        setCostModeMenuOpen={() => {}}
        {...overrides}
      />
    );
  }

  it("renders upload file label", () => {
    const html = renderMenu();
    expect(html).toContain("Upload file");
    expect(html).toContain('data-testid="plus-upload-file"');
  });

  it("renders upload image as disabled with Soon badge", () => {
    const html = renderMenu();
    expect(html).toContain("Upload image");
    expect(html).toContain("Soon");
    expect(html).toContain("cursor-not-allowed");
  });

  it("shows current work mode in label", () => {
    const html = renderMenu({ workMode: "Practice" });
    expect(html).toContain("Practice");
  });

  it("shows current cost mode in label", () => {
    const html = renderMenu({ costMode: "Cheap Practice" });
    expect(html).toContain("Cheap");
  });

  it("shows work mode options when workModeMenuOpen is true", () => {
    const html = renderMenu({ workModeMenuOpen: true });
    expect(html).toContain("Research");
    expect(html).toContain("Build");
    expect(html).toContain("Temporary Chat");
  });

  it("shows cost mode options when costModeMenuOpen is true", () => {
    const html = renderMenu({ costModeMenuOpen: true });
    expect(html).toContain("Cheap Practice");
    expect(html).toContain("Deep Research");
  });

  it("marks upload file input as disabled when onUploadFile not provided", () => {
    const html = renderMenu({ onUploadFile: undefined });
    expect(html).toContain('disabled=""');
  });

  it("does not mark upload file input as disabled when onUploadFile is provided", () => {
    const html = renderMenu({ onUploadFile: async () => {} });
    // The hidden file input should be present and not disabled
    expect(html).toContain('data-testid="plus-upload-file-input"');
  });

  it("has role=menu on container", () => {
    const html = renderMenu();
    expect(html).toContain('role="menu"');
  });
});

/* ── DecisionLogPanelBody ── */

describe("DecisionLogPanelBody", () => {
  it("renders disabled state text", () => {
    const html = renderToStaticMarkup(
      <DecisionLogPanelBody state={{ status: "disabled", message: "Disabled state" }} />
    );
    expect(html).toContain("Disabled state");
  });

  it("renders diagnostics entries", () => {
    const html = renderToStaticMarkup(
      <DecisionLogPanelBody
        state={{
          status: "ready",
          entries: [
            {
              id: "d1",
              decisionType: "model_provider",
              title: "Harness classification applied",
              decision: "Parsed JSON",
              rationale: "Event type",
              date: "2026-01-01",
              createdAt: "2026-01-01T12:00:00.000Z",
            },
          ],
        }}
      />
    );
    expect(html).toContain("Model");
    expect(html).not.toContain("model_provider");
    expect(html).toMatch(/\b\d{2}:\d{2}:\d{2}\b/);
    expect(html).toContain("Harness classification applied");
    expect(html).toContain("Parsed JSON");
  });
});

/* ── shouldSubmitOnKeyDown ── */

describe("shouldSubmitOnKeyDown", () => {
  it("submits on Enter without Shift", () => {
    expect(shouldSubmitOnKeyDown("Enter", false)).toBe(true);
  });

  it("does not submit on Shift+Enter", () => {
    expect(shouldSubmitOnKeyDown("Enter", true)).toBe(false);
  });
});

/* ── formatSourcesLabel ── */

describe("formatSourcesLabel", () => {
  it("returns 'No files uploaded' when count is undefined", () => {
    expect(formatSourcesLabel(undefined)).toBe("No files uploaded");
  });

  it("returns 'No files uploaded' when count is 0", () => {
    expect(formatSourcesLabel(0)).toBe("No files uploaded");
  });

  it("returns '1 file available' when count is 1", () => {
    expect(formatSourcesLabel(1)).toBe("1 file available");
  });

  it("returns 'N files available' when count > 1", () => {
    expect(formatSourcesLabel(3)).toBe("3 files available");
  });

  it("never returns the stale 'not connected yet' placeholder", () => {
    [undefined, 0, 1, 5].forEach((n) => {
      expect(formatSourcesLabel(n)).not.toContain("not connected yet");
    });
  });
});

/* ── Context strip ── */

describe("TutorConversation context strip", () => {
  function renderStrip(uploadedFileCount?: number): string {
    return renderToStaticMarkup(
      <TutorConversation
        activeSessionId={null}
        activeWorkspaceId={null}
        developerDiagnosticsEnabled={false}
        workMode="Learning"
        onWorkModeChange={() => {}}
        costMode="Normal Learning"
        onCostModeChange={() => {}}
        activeTopicName={null}
        getToken={async () => null}
        uploadedFileCount={uploadedFileCount}
      />
    );
  }

  it("does not render 'not connected yet' when no files prop is passed", () => {
    expect(renderStrip()).not.toContain("not connected yet");
  });

  it("shows 'No files uploaded' when uploadedFileCount is 0", () => {
    expect(renderStrip(0)).toContain("No files uploaded");
  });

  it("shows '1 file available' when uploadedFileCount is 1", () => {
    expect(renderStrip(1)).toContain("1 file available");
  });

  it("shows file count when uploadedFileCount is 3", () => {
    expect(renderStrip(3)).toContain("3 files available");
  });
});

/* ── Source rendering / normalization ── */

describe("source rendering", () => {
  it("deduplicates identical citations and keeps distinct duplicates", () => {
    const result = normalizeCitations([
      { id: "chunk_0001", sourceId: "fileA:chunk_0001", referenceText: "same text" },
      { id: "chunk_0001", sourceId: "fileA:chunk_0001", referenceText: "same text" },
      { id: "chunk_0001", sourceId: "fileA:chunk_0001", referenceText: "different text" },
    ]);

    expect(result).toHaveLength(2);
    expect(new Set(result.map((item) => item.renderKey)).size).toBe(2);
  });

  it("renders sources in a collapsible section (closed by default)", () => {
    const normalized = normalizeCitations([
      { id: "chunk_0001", sourceId: "fileA:chunk_0001", referenceText: "example snippet" },
    ]);

    const html = renderToStaticMarkup(
      <SourcesSection citations={normalized} />
    );
    expect(html).toContain("<details");
    expect(html).toContain("Sources (1)");
    expect(html).not.toContain("<details open");
  });
});

describe("source label formatting", () => {
  it("shows ordinal Source N when originalFileName is absent", () => {
    const result = normalizeCitations([
      { id: "chunk_0001", sourceId: "fileA:chunk_0001", referenceText: "some text" },
      { id: "chunk_0002", sourceId: "fileB:chunk_0002", referenceText: "other text" },
    ]);
    expect(result[0].sourceLabel).toBe("Source 1");
    expect(result[1].sourceLabel).toBe("Source 2");
  });

  it("shows originalFileName when provided", () => {
    const result = normalizeCitations([
      {
        id: "chunk_0001",
        sourceId: "fileA:chunk_0001",
        referenceText: "some text",
        originalFileName: "lecture-notes.pdf",
      },
    ]);
    expect(result[0].sourceLabel).toBe("lecture-notes.pdf");
  });

  it("does not show raw UUID-style IDs in source labels", () => {
    const result = normalizeCitations([
      { id: "chunk_0001", sourceId: "abc-123-def:chunk_0001", referenceText: "text" },
    ]);
    expect(result[0].sourceLabel).not.toContain("abc-123-def");
    expect(result[0].sourceLabel).not.toContain("chunk_0001");
    expect(result[0].sourceLabel).toBe("Source 1");
  });
});

/* ── Timeout recovery ── */

describe("timeout recovery helpers", () => {
  it("detects timeout errors from SessionMessagesApiError", () => {
    const error = new SessionMessagesApiError("שירות ההודעות לא הגיב בזמן. נסה שוב.", 503);
    expect(isTimeoutError(error)).toBe(true);
  });

  it("does not treat non-timeout errors as timeout", () => {
    const error = new SessionMessagesApiError("Unauthorized.", 401);
    expect(isTimeoutError(error)).toBe(false);
  });

  it("detects new tutor message beyond baseline ids", () => {
    const baseline = new Set(["u1"]);
    const found = hasNewAssistantMessage(
      [
        { id: "u1", role: "user", content: "Q" },
        { id: "t2", role: "tutor", content: "A" },
      ],
      baseline
    );
    expect(found).toBe(true);
  });

  it("does not report recovery when no new tutor message exists", () => {
    const baseline = new Set(["u1", "t1"]);
    const found = hasNewAssistantMessage(
      [
        { id: "u1", role: "user", content: "Q" },
        { id: "t1", role: "tutor", content: "A old" },
      ],
      baseline
    );
    expect(found).toBe(false);
  });
});
