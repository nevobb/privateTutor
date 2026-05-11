import {
  Workspace,
  UploadedFile,
  LearnerMemory,
  AcademicKnowledgeItem,
  Session,
  TutorMessage,
  DecisionLogEntry,
  BehaviorTest
} from "../types";

export const mockWorkspace: Workspace = {
  id: "ws-1",
  name: "Hebrew Literature Phase 2",
  description: "Advanced studies in modern Hebrew literature.",
  path: ["BA Literature", "Year 2", "Hebrew Literature"],
  stableIdentityNote: "Mock workspace identity stays stable even if the display path changes.",
};

export const mockFiles: UploadedFile[] = [
  {
    id: "f-1",
    name: "Agnon_Stories.pdf",
    url: "/mock/Agnon_Stories.pdf",
    uploadedAt: new Date(),
    workspaceId: "ws-1",
    assignmentStatus: "assigned",
    indexingStatus: "not-indexed",
    sourceType: "pdf",
  },
  {
    id: "f-2",
    name: "Bialik_Poems.pdf",
    url: "/mock/Bialik_Poems.pdf",
    uploadedAt: new Date(),
    workspaceId: "ws-1",
    assignmentStatus: "assigned",
    indexingStatus: "not-indexed",
    sourceType: "pdf",
  },
];

export const mockLearnerMemory: LearnerMemory = {
  id: "lm-1",
  userId: "user-1",
  observations: [
    {
      id: "obs-1",
      observation: "Struggles with future tense conjugation of Pa'al.",
      timestamp: new Date(),
      confidence: 0.72,
      state: "active",
      source: "conversation",
    },
  ],
  masteryLevel: 65,
};

export const mockAcademicKnowledge: AcademicKnowledgeItem = {
  id: "ak-1",
  title: "The Role of the Narrator in Agnon's Work",
  content: "Agnon often employs an unreliable, traditional-seeming narrator who creates ironic distance from the modern themes of the story.",
  sourceId: "f-1",
  workspaceId: "ws-1",
  sourceType: "uploaded_file",
  citationLabel: "Agnon_Stories.pdf",
};

export const mockTutorMessages: TutorMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: "What is the main theme of Agnon's story?",
  },
  {
    id: "msg-2",
    role: "tutor",
    content: "Agnon often explores the tension between tradition and modernity. In the text we reviewed, the narrator plays a key role in this.",
    citations: [
      {
        id: "cite-1",
        referenceText: "Agnon often employs an unreliable narrator...",
        sourceId: "f-1",
      },
    ],
  },
  {
    id: "msg-3",
    role: "user",
    content: "Can you give me a hint on how to conjugate the verb he used?",
  },
];

export const mockSession: Session = {
  id: "sess-1",
  userId: "user-1",
  workspaceId: "ws-1",
  messages: mockTutorMessages,
};

export const mockDecisionLogEntry: DecisionLogEntry = {
  id: "dl-1",
  decisionType: "mock_alignment",
  title: "Separate Academic Knowledge and Learner Memory",
  decision: "Decided to keep AcademicKnowledgeItem and LearnerMemory as strictly separate entities.",
  rationale: "To ensure that the tutor's assessment of the learner does not pollute the objective factual base of the academic material.",
  date: new Date().toISOString(),
};

export const mockBehaviorTest: BehaviorTest = {
  id: "bt-1",
  description: "Tutor does not reveal full solution when asked for hint",
  expectedOutcome: "The tutor provides a guiding question or partial information, rather than the complete answer.",
};
