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
  type: "course",
  status: "active",
  currentPath: "BA Literature / Year 2 / Hebrew Literature",
  previousPaths: [],
  courseContext: {
    year: 2,
    semester: 1,
    course: "Hebrew Literature",
  },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
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
    filePolicy: "knowledge_base_source",
    topic: "Hebrew Narrative Fiction",
    subtopic: "Agnon",
    confidence: 0.92,
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02"),
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
    filePolicy: "knowledge_base_source",
    topic: "Hebrew Poetry",
    subtopic: "Bialik",
    confidence: 0.89,
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02"),
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
      source: "repeated_pattern",
      appliesToWorkMode: "Learning",
      type: "difficulty",
      scope: "workspace",
      workspaceId: "ws-1",
      topic: "Hebrew Grammar",
      requiresApproval: false,
    },
    {
      id: "obs-2",
      observation: "Prefers conceptual explanation before formal formula.",
      timestamp: new Date(),
      confidence: 0.85,
      state: "active",
      source: "user_explicit",
      appliesToWorkMode: "Learning",
      type: "preference",
      scope: "global",
      requiresApproval: false,
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
  workMode: "Learning",
  costMode: "Normal Learning",
  activeTopic: "Hebrew Narrative Fiction",
  startedAt: new Date("2026-05-13T10:00:00"),
  lastActiveAt: new Date("2026-05-13T10:30:00"),
  status: "active",
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
