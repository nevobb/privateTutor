import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TutorConversation, {
  DecisionLogPanelBody,
  shouldSubmitOnKeyDown,
} from "../../../src/components/tutor/TutorConversation";

describe("TutorConversation composer layout", () => {
  it("renders send button outside textarea and without overlay padding", () => {
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

    const buttonIndex = html.indexOf('data-testid="send-button"');
    const textareaIndex = html.indexOf('data-testid="message-textarea"');
    expect(buttonIndex).toBeGreaterThan(-1);
    expect(textareaIndex).toBeGreaterThan(-1);
    expect(buttonIndex).toBeLessThan(textareaIndex);
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
});

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

describe("shouldSubmitOnKeyDown", () => {
  it("submits on Enter without Shift", () => {
    expect(shouldSubmitOnKeyDown("Enter", false)).toBe(true);
  });

  it("does not submit on Shift+Enter", () => {
    expect(shouldSubmitOnKeyDown("Enter", true)).toBe(false);
  });
});
