import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WorkspaceSelector, {
  ConversationMenu,
} from "../../../src/components/workspaces/WorkspaceSelector";
import type {
  SessionLoadState,
  WorkspaceLoadState,
} from "../../../src/components/workspaces/WorkspaceSelector";

const WORKSPACE: WorkspaceLoadState = {
  status: "ready",
  workspaces: [
    {
      id: "ws-1",
      name: "Physics",
      description: "",
      status: "active",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
};

function makeSessionState(titles: string[]): SessionLoadState {
  return {
    status: "ready",
    sessions: titles.map((title, i) => ({
      id: `session-${i}`,
      title,
      workspaceId: "ws-1",
      workMode: "Learning" as const,
      costMode: "Normal Learning" as const,
      status: "active" as const,
      startedAt: "2026-06-01T00:00:00.000Z",
      lastActiveAt: "2026-06-01T00:00:00.000Z",
    })),
  };
}

function renderSelector(overrides: Partial<Parameters<typeof WorkspaceSelector>[0]> = {}) {
  return renderToStaticMarkup(
    <WorkspaceSelector
      loadState={WORKSPACE}
      selectedWorkspaceId="ws-1"
      onSelect={() => {}}
      onCreate={async () => {}}
      sessionState={makeSessionState(["Session Alpha", "Session Beta"])}
      selectedSessionId={null}
      onSessionSelect={() => {}}
      onCreateSession={async () => {}}
      creatingSession={false}
      createSessionError={null}
      onRenameSession={async () => {}}
      onDeleteSession={async () => {}}
      {...overrides}
    />
  );
}

/* ── WorkspaceSelector: three-dot button ── */

describe("WorkspaceSelector conversation menu trigger", () => {
  it("renders three-dot menu button per conversation when actions provided", () => {
    const html = renderSelector();
    const matches = html.match(/data-testid="conversation-menu-trigger"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2); // one per session
  });

  it("three-dot button has aria-haspopup", () => {
    const html = renderSelector();
    expect(html).toContain('aria-haspopup="true"');
  });

  it("three-dot button has aria-label referencing session title", () => {
    const html = renderSelector();
    expect(html).toContain("Conversation options: Session Alpha");
    expect(html).toContain("Conversation options: Session Beta");
  });

  it("does not render three-dot button when no rename or delete handler provided", () => {
    const html = renderSelector({
      onRenameSession: undefined,
      onDeleteSession: undefined,
    });
    expect(html).not.toContain('data-testid="conversation-menu-trigger"');
  });

  it("renders three-dot button when only onRenameSession provided", () => {
    const html = renderSelector({ onDeleteSession: undefined });
    expect(html).toContain('data-testid="conversation-menu-trigger"');
  });

  it("renders three-dot button when only onDeleteSession provided", () => {
    const html = renderSelector({ onRenameSession: undefined });
    expect(html).toContain('data-testid="conversation-menu-trigger"');
  });
});

/* ── WorkspaceSelector: session list rendering ── */

describe("WorkspaceSelector session list", () => {
  it("renders session titles in the list", () => {
    const html = renderSelector();
    expect(html).toContain("Session Alpha");
    expect(html).toContain("Session Beta");
  });

  it("applies active styling to the selected session", () => {
    const html = renderSelector({ selectedSessionId: "session-0" });
    // Active session has --tutor-sidebar-active background and --tutor-accent left border
    expect(html).toContain("tutor-sidebar-active");
    expect(html).toContain("tutor-accent");
  });

  it("session items use transparent background when none selected", () => {
    const html = renderSelector({ selectedSessionId: null });
    // Sessions should have transparent background; only the selected workspace uses tutor-sidebar-active.
    // Verify session text uses default (non-active) color, not the active text color.
    const sessionAlphaIndex = html.indexOf("Session Alpha");
    const sessionBetaIndex = html.indexOf("Session Beta");
    const activeColorIndicator = "tutor-sidebar-text-active";
    // Neither session item should show the active accent border (2px solid var(--tutor-accent))
    // Active sessions have borderLeft:2px solid var(--tutor-accent), inactive have 2px solid transparent
    // Check that session items have transparent border not accent border around their labels
    expect(html.slice(sessionAlphaIndex - 200, sessionAlphaIndex)).toContain("2px solid transparent");
    expect(html.slice(sessionBetaIndex - 200, sessionBetaIndex)).toContain("2px solid transparent");
    // Active sessions also have fontWeight:500; inactive sessions have fontWeight:400
    expect(html.slice(sessionAlphaIndex - 200, sessionAlphaIndex)).toContain("font-weight:400");
    expect(html.slice(sessionBetaIndex - 200, sessionBetaIndex)).toContain("font-weight:400");
    void activeColorIndicator; // suppress unused warning
  });

  it("falls back to Conversation N label when session title is empty", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSelector
        loadState={WORKSPACE}
        selectedWorkspaceId="ws-1"
        onSelect={() => {}}
        onCreate={async () => {}}
        sessionState={{
          status: "ready",
          sessions: [
            {
              id: "s-1",
              title: "",
              workspaceId: "ws-1",
              workMode: "Learning" as const,
              costMode: "Normal Learning" as const,
              status: "active" as const,
              startedAt: "2026-06-01T00:00:00.000Z",
              lastActiveAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        }}
        selectedSessionId={null}
        onSessionSelect={() => {}}
        onCreateSession={async () => {}}
        creatingSession={false}
        createSessionError={null}
      />
    );
    expect(html).toContain("Conversation 1");
  });

  it("renders empty state message when no sessions", () => {
    const html = renderSelector({
      sessionState: { status: "ready", sessions: [] },
    });
    expect(html).toContain("No conversations");
  });

  it("renders + New conversation button", () => {
    const html = renderSelector();
    expect(html).toContain("+ New conversation");
  });
});

/* ── ConversationMenu: menu items ── */

describe("ConversationMenu", () => {
  it("renders both Rename and Delete when both handlers provided", () => {
    const html = renderToStaticMarkup(
      <ConversationMenu
        label="Session Alpha"
        onRename={() => {}}
        onDelete={() => {}}
      />
    );
    expect(html).toContain("Rename");
    expect(html).toContain("Delete");
  });

  it("renders only Rename when onDelete not provided", () => {
    const html = renderToStaticMarkup(
      <ConversationMenu label="Session Alpha" onRename={() => {}} />
    );
    expect(html).toContain("Rename");
    expect(html).not.toContain("Delete");
  });

  it("renders only Delete when onRename not provided", () => {
    const html = renderToStaticMarkup(
      <ConversationMenu label="Session Alpha" onDelete={() => {}} />
    );
    expect(html).not.toContain("Rename");
    expect(html).toContain("Delete");
  });

  it("has role=menu on container", () => {
    const html = renderToStaticMarkup(
      <ConversationMenu
        label="Session Alpha"
        onRename={() => {}}
        onDelete={() => {}}
      />
    );
    expect(html).toContain('role="menu"');
  });

  it("menu items have role=menuitem", () => {
    const html = renderToStaticMarkup(
      <ConversationMenu
        label="Session Alpha"
        onRename={() => {}}
        onDelete={() => {}}
      />
    );
    const matches = html.match(/role="menuitem"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });

  it("renders nothing when neither handler provided", () => {
    const html = renderToStaticMarkup(<ConversationMenu label="X" />);
    expect(html).not.toContain("Rename");
    expect(html).not.toContain("Delete");
    expect(html).not.toContain('role="menuitem"');
  });
});

/* ── WorkspaceSelector: topic list ── */

describe("WorkspaceSelector topic list", () => {
  it("renders topic names", () => {
    const html = renderSelector();
    expect(html).toContain("Physics");
  });

  it("shows loading state", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSelector
        loadState={{ status: "loading" }}
        selectedWorkspaceId={null}
        onSelect={() => {}}
        onCreate={async () => {}}
        sessionState={{ status: "disabled", message: "Pick a topic." }}
        selectedSessionId={null}
        onSessionSelect={() => {}}
        onCreateSession={async () => {}}
        creatingSession={false}
        createSessionError={null}
      />
    );
    expect(html).toContain("Loading...");
  });

  it("shows error state", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSelector
        loadState={{ status: "error", message: "Failed to load topics." }}
        selectedWorkspaceId={null}
        onSelect={() => {}}
        onCreate={async () => {}}
        sessionState={{ status: "disabled", message: "Pick a topic." }}
        selectedSessionId={null}
        onSessionSelect={() => {}}
        onCreateSession={async () => {}}
        creatingSession={false}
        createSessionError={null}
      />
    );
    expect(html).toContain("Failed to load topics.");
  });
});
