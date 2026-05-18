export interface DecisionLogListItem {
  id: string;
  decisionType: string;
  title: string;
  decision: string;
  rationale: string;
  date: string;
  workspaceId?: string;
  sessionId?: string;
  createdAt: string;
}

export interface FetchDecisionLogInput {
  workspaceId: string;
  sessionId: string;
  limit?: number;
}

export interface FetchDecisionLogApiResponse {
  entries: DecisionLogListItem[];
}
