import type { AuthenticatedUser } from "../auth/authTypes";
import type { TutorInternalUpdate, MemoryObservationType } from "../../types";
import { writeDecisionLogEntry as defaultWriteDecisionLogEntry } from "./decisionLogRepository";
import {
  createLearnerMemoryObservation as defaultCreateLearnerMemoryObservation,
  deleteLearnerMemoryObservation as defaultDeleteLearnerMemoryObservation,
  getLearnerMemoryObservation as defaultGetLearnerMemoryObservation,
  listLearnerMemoryObservations as defaultListLearnerMemoryObservations,
  updateLearnerMemoryObservation as defaultUpdateLearnerMemoryObservation,
  type LearnerMemoryObservationRecord,
} from "./learnerMemoryRepository";

const HIGH_CONFIDENCE_THRESHOLD = 0.85;

interface Repositories {
  listLearnerMemoryObservations: typeof defaultListLearnerMemoryObservations;
  getLearnerMemoryObservation: typeof defaultGetLearnerMemoryObservation;
  createLearnerMemoryObservation: typeof defaultCreateLearnerMemoryObservation;
  updateLearnerMemoryObservation: typeof defaultUpdateLearnerMemoryObservation;
  deleteLearnerMemoryObservation: typeof defaultDeleteLearnerMemoryObservation;
  writeDecisionLogEntry: typeof defaultWriteDecisionLogEntry;
}

function defaultRepositories(): Repositories {
  return {
    listLearnerMemoryObservations: defaultListLearnerMemoryObservations,
    getLearnerMemoryObservation: defaultGetLearnerMemoryObservation,
    createLearnerMemoryObservation: defaultCreateLearnerMemoryObservation,
    updateLearnerMemoryObservation: defaultUpdateLearnerMemoryObservation,
    deleteLearnerMemoryObservation: defaultDeleteLearnerMemoryObservation,
    writeDecisionLogEntry: defaultWriteDecisionLogEntry,
  };
}

export interface LearnerMemoryApiService {
  listForUser(user: AuthenticatedUser, workspaceId?: string): Promise<LearnerMemoryObservationRecord[]>;
  patchObservation(
    user: AuthenticatedUser,
    observationId: string,
    input: { action: "edit" | "approve" | "reject"; content?: string; type?: MemoryObservationType }
  ): Promise<LearnerMemoryObservationRecord | null>;
  deleteObservation(user: AuthenticatedUser, observationId: string): Promise<boolean>;
  processMemoryCandidate(params: {
    user: AuthenticatedUser;
    workspaceId: string;
    userMessage: string;
    internalUpdate: TutorInternalUpdate;
    temporaryChat: boolean;
  }): Promise<void>;
}

export function createLearnerMemoryApiService(repositories: Repositories = defaultRepositories()): LearnerMemoryApiService {
  return {
    async listForUser(user, workspaceId) {
      return repositories.listLearnerMemoryObservations(user.userId, workspaceId);
    },

    async patchObservation(user, observationId, input) {
      const current = await repositories.getLearnerMemoryObservation(user.userId, observationId);
      if (!current) return null;

      if (input.action === "approve") {
        return repositories.updateLearnerMemoryObservation(user.userId, observationId, {
          state: "active",
          requiresApproval: false,
        });
      }

      if (input.action === "reject") {
        return repositories.updateLearnerMemoryObservation(user.userId, observationId, {
          state: "archived",
          requiresApproval: false,
        });
      }

      return repositories.updateLearnerMemoryObservation(user.userId, observationId, {
        content: input.content,
        type: input.type,
      });
    },

    async deleteObservation(user, observationId) {
      return repositories.deleteLearnerMemoryObservation(user.userId, observationId);
    },

    async processMemoryCandidate({ user, workspaceId, userMessage, internalUpdate, temporaryChat }) {
      const memoryUpdate = internalUpdate.learner_memory_update;
      if (!memoryUpdate.needed || temporaryChat) {
        return;
      }

      const detectedType = normalizeMemoryType(memoryUpdate.memory_type) ?? detectMemoryType(userMessage);
      if (!detectedType) {
        return;
      }

      const content = memoryUpdate.content.trim();
      if (content.length === 0) {
        return;
      }

      const existing = await repositories.listLearnerMemoryObservations(user.userId, workspaceId);
      const contradiction = hasContradiction(existing, detectedType, content);
      const deletionLike = isDeletionOrArchiveRequest(content);

      const shouldAutoSave =
        memoryUpdate.update_type === "small_auto" &&
        memoryUpdate.confidence >= HIGH_CONFIDENCE_THRESHOLD &&
        !contradiction &&
        !deletionLike;

      const created = await repositories.createLearnerMemoryObservation(user.userId, {
        type: detectedType,
        scope: "workspace",
        workspaceId,
        content,
        confidence: memoryUpdate.confidence,
        source: "model_inferred",
        requiresApproval: !shouldAutoSave,
        state: shouldAutoSave ? "active" : "tentative",
      });

      await repositories.writeDecisionLogEntry(user.userId, {
        decisionType: shouldAutoSave ? "memory_write" : "memory_not_written",
        title: "Learner memory policy",
        decision: shouldAutoSave
          ? "memory_saved_auto"
          : contradiction
            ? "memory_requires_approval_contradiction"
            : deletionLike
              ? "memory_requires_approval_archive_delete"
              : "memory_requires_approval_confidence",
        rationale: `type=${detectedType}; confidence=${memoryUpdate.confidence.toFixed(2)}; observation=${created.id}`,
        workspaceId,
      });
    },
  };
}

export const learnerMemoryApiService = createLearnerMemoryApiService();

function normalizeMemoryType(value: string): MemoryObservationType | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "preference") return "preference";
  if (normalized === "difficulty") return "difficulty";
  if (normalized === "correction") return "correction";
  if (normalized === "explanation_pattern") return "explanation_pattern";
  if (normalized === "pacing") return "pacing";
  if (normalized === "behavior_rule") return "behavior_rule";
  return null;
}

function detectMemoryType(message: string): MemoryObservationType | null {
  const m = message.toLowerCase();
  if (/(prefer|מעדיפ|תסביר לי|style)/.test(m)) return "preference";
  if (/(difficult|קשה לי|לא מבין|struggl)/.test(m)) return "difficulty";
  if (/(wrong|תיקון|לא נכון|correct)/.test(m)) return "correction";
  if (/(explain|הסבר|intuition|pattern)/.test(m)) return "explanation_pattern";
  if (/(slow|fast|pace|לאט|מהר)/.test(m)) return "pacing";
  if (/(always|never|כל פעם|אל ת|do not)/.test(m)) return "behavior_rule";
  return null;
}

function hasContradiction(
  existing: LearnerMemoryObservationRecord[],
  type: MemoryObservationType,
  content: string
): boolean {
  const normalized = normalizePolarity(content);
  return existing
    .filter((item) => item.type === type && item.state === "active")
    .some((item) => normalizePolarity(item.content ?? item.observation) !== normalized);
}

function normalizePolarity(content: string): "positive" | "negative" {
  return /(not|never|don't|אל|לא)/i.test(content) ? "negative" : "positive";
}

function isDeletionOrArchiveRequest(content: string): boolean {
  return /(delete|remove|forget|archive|מחק|תשכח|ארכיון)/i.test(content);
}
