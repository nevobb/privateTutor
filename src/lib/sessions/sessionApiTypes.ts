import type { CostMode, WorkMode } from "../../types";

export interface SessionApiSession {
  id: string;
  workspaceId: string;
  title?: string;
  workMode: WorkMode;
  costMode: CostMode;
  activeTopic?: string;
  status: "active";
  startedAt: string;
  lastActiveAt: string;
}

export interface CreateSessionInput {
  workspaceId: string;
  title?: string;
  workMode?: WorkMode;
  costMode?: CostMode;
  activeTopic?: string;
}

export interface RenameSessionInput {
  title: string;
  workspaceId: string;
}

export interface DeleteSessionInput {
  workspaceId: string;
}
