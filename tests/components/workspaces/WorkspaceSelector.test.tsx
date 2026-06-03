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

/* ── Courses section ── */

describe("WorkspaceSelector courses section", () => {
  it("renders Courses section label (not Topics)", () => {
    const html = renderSelector();
    expect(html).toContain("Courses");
    expect(html).toContain('data-testid="courses-section-label"');
    expect(html).not.toContain(">Topics<");
  });

  it("renders course names", () => {
    const html = renderSelector();
    expect(html).toContain("Physics");
  });

  it("renders folder icon for course items", () => {
    const html = renderSelector();
    expect(html).toContain('data-testid="folder-icon"');
  });

  it("renders course nav item with testid", () => {
    const html = renderSelector();
    expect(html).toContain('data-testid="course-nav-item"');
  });

  it("shows No courses yet when no workspaces", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSelector
        loadState={{ status: "ready", workspaces: [] }}
        selectedWorkspaceId={null}
        onSelect={() => {}}
        onCreate={async () => {}}
        sessionState={{ status: "disabled", message: "Select a course." }}
        selectedSessionId={null}
        onSessionSelect={() => {}}
        onCreateSession={async () => {}}
        creatingSession={false}
        createSessionError={null}
      />
    );
    expect(html).toContain("No courses yet");
    expect(html).not.toContain("No topics yet");
  });

  it("renders + New course button", () => {
    const html = renderSelector();
    expect(html).toContain("+ New course");
    expect(html).not.toContain("+ New topic");
  });
});

/* ── Session hierarchy nested under course ── */

describe("WorkspaceSelector session hierarchy", () => {
  it("renders sessions nested under selected course", () => {
    const html = renderSelector();
    expect(html).toContain('data-testid="sessions-under-course"');
  });

  it("renders session titles", () => {
    const html = renderSelector();
    expect(html).toContain("Session Alpha");
    expect(html).toContain("Session Beta");
  });

  it("applies active background to the selected session", () => {
    const html = renderSelector({ selectedSessionId: "session-0" });
    expect(html).toContain("background:rgba(255,255,255,0.09)");
  });

  it("inactive session items use font-weight 400", () => {
    const html = renderSelector({ selectedSessionId: null });
    expect(html).toContain("font-weight:400");
  });

  it("active session item has font-weight 500", () => {
    const html = renderSelector({ selectedSessionId: "session-0" });
    expect(html).toContain("font-weight:500");
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

  it("renders empty state when no sessions", () => {
    const html = renderSelector({ sessionState: { status: "ready", sessions: [] } });
    expect(html).toContain("No conversations");
  });

  it("renders + New conversation button", () => {
    const html = renderSelector();
    expect(html).toContain("+ New conversation");
  });

  it("does not render sessions section when no workspace selected", () => {
    const html = renderSelector({ selectedWorkspaceId: null });
    expect(html).not.toContain('data-testid="sessions-under-course"');
    expect(html).not.toContain("Session Alpha");
  });
});

/* ── Three-dot menu trigger ── */

describe("WorkspaceSelector conversation menu trigger", () => {
  it("renders three-dot menu button per conversation when actions provided", () => {
    const html = renderSelector();
    const matches = html.match(/data-testid="conversation-menu-trigger"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
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

/* ── ConversationMenu ── */

describe("ConversationMenu", () => {
  it("renders both Rename and Delete when both handlers provided", () => {
    const html = renderToStaticMarkup(
      <ConversationMenu label="Session Alpha" onRename={() => {}} onDelete={() => {}} />
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
      <ConversationMenu label="Session Alpha" onRename={() => {}} onDelete={() => {}} />
    );
    expect(html).toContain('role="menu"');
  });

  it("menu items have role=menuitem", () => {
    const html = renderToStaticMarkup(
      <ConversationMenu label="Session Alpha" onRename={() => {}} onDelete={() => {}} />
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

/* ── Loading / error states ── */

describe("WorkspaceSelector loading and error states", () => {
  it("shows loading state", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSelector
        loadState={{ status: "loading" }}
        selectedWorkspaceId={null}
        onSelect={() => {}}
        onCreate={async () => {}}
        sessionState={{ status: "disabled", message: "Select a course." }}
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
        loadState={{ status: "error", message: "Failed to load courses." }}
        selectedWorkspaceId={null}
        onSelect={() => {}}
        onCreate={async () => {}}
        sessionState={{ status: "disabled", message: "Select a course." }}
        selectedSessionId={null}
        onSessionSelect={() => {}}
        onCreateSession={async () => {}}
        creatingSession={false}
        createSessionError={null}
      />
    );
    expect(html).toContain("Failed to load courses.");
  });
});
