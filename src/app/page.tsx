"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import CollapsiblePanel from "../components/layout/CollapsiblePanel";
import WorkspaceSelector, {
  type SessionLoadState,
  type WorkspaceLoadState,
} from "../components/workspaces/WorkspaceSelector";
import FilePanel from "../components/files/FilePanel";
import type { FileUploadStatus } from "../components/files/FilePanel";
import MemoryPanel from "../components/memory/MemoryPanel";
import TutorConversation, {
  buildStagedAttachment,
  canAddMoreAttachments,
  removeStagedAttachment,
} from "../components/tutor/TutorConversation";
import type { StagedAttachment } from "../components/tutor/TutorConversation";
import { AuthShell } from "../components/auth/AuthShell";
import { useClientAuth } from "../lib/firebase/useClientAuth";
import { getClientFirebaseModeLabel } from "../lib/firebase/firebaseClientApp";
import {
  fetchWorkspaces,
  createWorkspace,
  WorkspaceApiError,
} from "../lib/workspaces/workspaceApiClient";
import type { WorkspaceListItem } from "../lib/workspaces/workspaceApiTypes";
import {
  createSession,
  deleteSession,
  fetchSessions,
  renameSession,
  SessionApiError,
} from "../lib/sessions/sessionApiClient";
import type { SessionApiSession } from "../lib/sessions/sessionApiTypes";
import {
  deleteLearnerMemory,
  fetchLearnerMemory,
  patchLearnerMemory,
} from "../lib/memory/learnerMemoryApiClient";
import type { LearnerMemoryObservationItem } from "../lib/memory/learnerMemoryApiTypes";
import type { CostMode, WorkMode } from "../types";
import type { UploadedFile } from "../types";
import {
  createWorkspaceFileMetadata,
  deleteWorkspaceFile,
  fetchWorkspaceFiles,
  runWorkspaceFileChunking,
  runWorkspaceFileEmbeddings,
  runWorkspaceFileExtraction,
  WorkspaceFilesApiError,
} from "../lib/workspaces/workspaceFilesApiClient";
import { uploadLearningFileToStorage, validateLearningFile } from "../lib/firebase/storageUploadClient";
import {
  applyStoredDisplayPreferences,
  DEV_DIAGNOSTICS_STORAGE_KEY,
  readStoredDevDiagnosticsPreference,
  serializeDeveloperDiagnosticsFlag,
} from "../lib/settings/settingsPreferences";

function sortSessionsByRecent(sessions: SessionApiSession[]): SessionApiSession[] {
  return [...sessions].sort((a, b) => {
    const aTime = Date.parse(a.lastActiveAt || a.startedAt || "");
    const bTime = Date.parse(b.lastActiveAt || b.startedAt || "");
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
    return bTime - aTime;
  });
}

function getSafeSessionErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof SessionApiError)) {
    return fallback;
  }

  if (error.status === 401) {
    return "פג תוקף ההתחברות. יש להתחבר מחדש.";
  }

  if (error.status === 404) {
    return "המרחב שנבחר לא נמצא.";
  }

  if (error.status === 503) {
    return "שירות השיחות אינו זמין כרגע.";
  }

  return fallback;
}

export default function Home() {
  const { authState, getToken, signIn, signOut } = useClientAuth();
  const [workspaceState, setWorkspaceState] = useState<WorkspaceLoadState>({
    status: "loading",
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const [sessionState, setSessionState] = useState<SessionLoadState>({
    status: "disabled",
    message: "בחר נושא כדי לטעון שיחות.",
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [createSessionError, setCreateSessionError] = useState<string | null>(null);

  const [workMode, setWorkMode] = useState<WorkMode>("Learning");
  const [costMode, setCostMode] = useState<CostMode>("Normal Learning");
  const [developerDiagnosticsEnabled, setDeveloperDiagnosticsEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return readStoredDevDiagnosticsPreference(window.localStorage);
  });
  const [memoryObservations, setMemoryObservations] = useState<LearnerMemoryObservationItem[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [stagedContextFiles, setStagedContextFiles] = useState<StagedAttachment[]>([]);
  const [fileUploadStatus, setFileUploadStatus] = useState<FileUploadStatus>({ state: "idle" });
  const [fileProcessingStatusById, setFileProcessingStatusById] = useState<
    Record<string, string | undefined>
  >({});
  const [pendingFilesByFileId, setPendingFilesByFileId] = useState<Record<string, File | undefined>>({});
  const processingInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DEV_DIAGNOSTICS_STORAGE_KEY,
        serializeDeveloperDiagnosticsFlag(developerDiagnosticsEnabled)
      );
    } catch {
      // Ignore storage write errors to keep UI functional.
    }
  }, [developerDiagnosticsEnabled]);

  // Apply saved display settings (font size, chat max-width) from Settings page
  useEffect(() => {
    applyStoredDisplayPreferences(window.localStorage, document.documentElement.style);
  }, []);

  const handleWorkspaceSelect = useCallback((workspaceId: string): void => {
    setActiveSessionId(null);
    setCreateSessionError(null);
    setActiveWorkspaceId(workspaceId);
  }, []);

  useEffect(() => {
    if (authState.status !== "signed-in") return;

    let cancelled = false;

    void (async () => {
      setWorkspaceState({ status: "loading" });
      try {
        const token = await getToken();
        if (!token) {
          setWorkspaceState({ status: "error", message: "לא ניתן לאמת את המשתמש." });
          return;
        }
        const workspaces = await fetchWorkspaces(token);
        if (cancelled) return;
        setWorkspaceState({ status: "ready", workspaces });
        setActiveWorkspaceId((prev) =>
          prev !== null ? prev : workspaces.length > 0 ? workspaces[0].id : null
        );
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof WorkspaceApiError ? err.message : "שגיאה בטעינת הנושאים.";
        setWorkspaceState({ status: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authState.status, getToken]);

  useEffect(() => {
    let cancelled = false;

    const syncSessions = async (): Promise<void> => {
      if (authState.status !== "signed-in") {
        if (!cancelled) {
          setActiveSessionId(null);
          setSessionState({ status: "disabled", message: "התחבר כדי לראות שיחות." });
        }
        return;
      }

      if (!activeWorkspaceId) {
        if (!cancelled) {
          setActiveSessionId(null);
          setSessionState({ status: "disabled", message: "בחר נושא כדי לטעון שיחות." });
        }
        return;
      }

      setSessionState({ status: "loading" });
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setSessionState({ status: "error", message: "לא ניתן לאמת את המשתמש." });
          }
          return;
        }

        const sessions = sortSessionsByRecent(
          await fetchSessions(token, activeWorkspaceId)
        );
        if (cancelled) return;

        setSessionState({ status: "ready", sessions });
        setActiveSessionId(sessions.length > 0 ? sessions[0].id : null);
      } catch (err: unknown) {
        if (cancelled) return;
        setSessionState({
          status: "error",
          message: getSafeSessionErrorMessage(err, "שגיאה בטעינת השיחות."),
        });
      }
    };

    void syncSessions();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, authState.status, getToken]);

  const reloadWorkspaceFiles = useCallback(async (): Promise<void> => {
    if (authState.status !== "signed-in" || !activeWorkspaceId) {
      setUploadedFiles([]);
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        setUploadedFiles([]);
        return;
      }
      const files = await fetchWorkspaceFiles(token, activeWorkspaceId);
      setUploadedFiles(
        files.map((item) => ({
          id: item.id,
          name: item.originalFileName ?? item.fileName,
          originalFileName: item.originalFileName,
          url: "",
          uploadedAt: new Date(item.uploadedAt),
          workspaceId: item.workspaceId,
          assignmentStatus: item.assignmentStatus as UploadedFile["assignmentStatus"],
          indexingStatus: item.indexingStatus as UploadedFile["indexingStatus"],
          sourceType: item.sourceType,
          topic: item.topic,
          confidence: item.confidence,
          storagePath: item.storagePath,
          summaryStatus: item.summaryStatus as UploadedFile["summaryStatus"],
          summaryText: item.summaryText,
          summarySource: item.summarySource,
          summaryErrorCode: item.summaryErrorCode,
          summaryUpdatedAt: item.summaryUpdatedAt ? new Date(item.summaryUpdatedAt) : null,
          extractionStatus: item.extractionStatus,
          extractedText: item.extractedText,
          extractedTextPreview: item.extractedTextPreview,
          extractedTextCharCount: item.extractedTextCharCount,
          extractionSource: item.extractionSource,
          extractionErrorCode: item.extractionErrorCode,
          extractionUpdatedAt: item.extractionUpdatedAt ? new Date(item.extractionUpdatedAt) : null,
          chunkingStatus: item.chunkingStatus,
          chunkCount: item.chunkCount,
          chunkingErrorCode: item.chunkingErrorCode,
          chunkingUpdatedAt: item.chunkingUpdatedAt ? new Date(item.chunkingUpdatedAt) : null,
          embeddingStatus: item.embeddingStatus,
          embeddingUpdatedAt: item.embeddingUpdatedAt ? new Date(item.embeddingUpdatedAt) : null,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        }))
      );
    } catch {
      setUploadedFiles([]);
    }
  }, [activeWorkspaceId, authState.status, getToken]);

  const runFileProcessingPipeline = useCallback(
    async (options: {
      workspaceId: string;
      fileId: string;
      token: string;
      fileBytes?: File;
      initialFile?: UploadedFile;
    }): Promise<void> => {
      const { workspaceId, fileId, token, fileBytes, initialFile } = options;

      if (processingInFlightRef.current.has(fileId)) {
        return;
      }
      processingInFlightRef.current.add(fileId);

      try {
        const latestFiles = await fetchWorkspaceFiles(token, workspaceId);
        const latest = latestFiles.find((item) => item.id === fileId);
        const effectiveExtractionStatus = latest?.extractionStatus ?? initialFile?.extractionStatus ?? "not_started";
        const effectiveChunkingStatus = latest?.chunkingStatus ?? initialFile?.chunkingStatus ?? "not_started";

        if (effectiveExtractionStatus !== "completed") {
          setFileProcessingStatusById((prev) => ({ ...prev, [fileId]: "Extracting text..." }));
          await runWorkspaceFileExtraction({
            workspaceId,
            fileId,
            idToken: token,
            file: fileBytes,
          });
        }

        if (effectiveChunkingStatus !== "completed") {
          setFileProcessingStatusById((prev) => ({ ...prev, [fileId]: "Chunking text..." }));
          await runWorkspaceFileChunking({
            workspaceId,
            fileId,
            idToken: token,
            costMode,
          });
        }

        setFileProcessingStatusById((prev) => ({ ...prev, [fileId]: "Creating embeddings..." }));
        const embeddingResult = await runWorkspaceFileEmbeddings({
          workspaceId,
          fileId,
          idToken: token,
        });

        await reloadWorkspaceFiles();
        setFileProcessingStatusById((prev) => ({
          ...prev,
          [fileId]:
            embeddingResult.failedChunkCount > 0
              ? `Embeddings done (${embeddingResult.embeddedChunkCount} ok, ${embeddingResult.failedChunkCount} failed).`
              : "Ready for learning",
        }));
      } catch (error: unknown) {
        const message = error instanceof WorkspaceFilesApiError ? error.message : "Processing failed.";
        setFileProcessingStatusById((prev) => ({ ...prev, [fileId]: message }));
      } finally {
        processingInFlightRef.current.delete(fileId);
      }
    },
    [reloadWorkspaceFiles]
  );

  useEffect(() => {
    void reloadWorkspaceFiles();
  }, [reloadWorkspaceFiles]);

  const handleFileSelected = useCallback(
    async (file: File): Promise<void> => {
      if (authState.status !== "signed-in" || !activeWorkspaceId || !authState.user?.userId) {
        setFileUploadStatus({ state: "error", message: "נדרש משתמש מחובר ומרחב פעיל להעלאה." });
        return;
      }

      setFileUploadStatus({ state: "validating" });
      const validation = validateLearningFile(file);
      if (!validation.ok) {
        setFileUploadStatus({ state: "error", message: validation.reason });
        return;
      }

      try {
        setFileUploadStatus({ state: "uploading" });
        const fileId = crypto.randomUUID();
        const uploaded = await uploadLearningFileToStorage({
          file,
          userId: authState.user.userId,
          workspaceId: activeWorkspaceId,
          fileId,
        });

        const token = await getToken();
        if (!token) {
          setFileUploadStatus({ state: "error", message: "לא ניתן לאמת את המשתמש לשמירת המטא-דאטה." });
          return;
        }

        setFileUploadStatus({ state: "saving_metadata" });
        const createdFile = await createWorkspaceFileMetadata({
          workspaceId: activeWorkspaceId,
          idToken: token,
          fileName: uploaded.fileName,
          originalFileName: uploaded.originalFileName,
          sourceType: uploaded.sourceType,
          storagePath: uploaded.storagePath,
        });

        setPendingFilesByFileId((prev) => ({ ...prev, [createdFile.id]: file }));
        await reloadWorkspaceFiles();
        setFileUploadStatus({ state: "done", message: "Uploaded. Processing started automatically..." });
        void runFileProcessingPipeline({
          workspaceId: activeWorkspaceId,
          fileId: createdFile.id,
          token,
          fileBytes: file,
        });
      } catch (error: unknown) {
        const message =
          error instanceof WorkspaceFilesApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "ההעלאה נכשלה.";
        setFileUploadStatus({ state: "error", message });
      }
    },
    [activeWorkspaceId, authState, getToken, reloadWorkspaceFiles, runFileProcessingPipeline]
  );

  const handleToggleFileContext = useCallback(
    (fileId: string, fileName: string) => {
      setStagedContextFiles((prev) => {
        const exists = prev.find((x) => x.fileId === fileId);
        if (exists) {
          return prev.filter((x) => x.fileId !== fileId);
        }
        if (!canAddMoreAttachments(prev.length)) return prev; // limit
        return [...prev, buildStagedAttachment({ fileId, fileName })];
      });
    },
    []
  );

  const handleRemoveStagedContext = useCallback((localId: string) => {
    setStagedContextFiles((prev) => removeStagedAttachment(prev, localId));
  }, []);

  const handleClearStagedContext = useCallback(() => {
    setStagedContextFiles([]);
  }, []);

  const handleContinueProcessing = useCallback(
    async (fileId: string): Promise<void> => {
      if (authState.status !== "signed-in" || !activeWorkspaceId) return;
      const token = await getToken();
      if (!token) return;
      const fileBytes = pendingFilesByFileId[fileId];
      const fileRecord = uploadedFiles.find((item) => item.id === fileId);
      void runFileProcessingPipeline({
        workspaceId: activeWorkspaceId,
        fileId,
        token,
        fileBytes,
        initialFile: fileRecord,
      });
    },
    [
      activeWorkspaceId,
      authState.status,
      getToken,
      pendingFilesByFileId,
      runFileProcessingPipeline,
      uploadedFiles,
    ]
  );

  const handleDeleteFile = useCallback(
    async (fileId: string): Promise<void> => {
      if (authState.status !== "signed-in" || !activeWorkspaceId) return;
      const token = await getToken();
      if (!token) throw new Error("לא ניתן לאמת את המשתמש.");

      await deleteWorkspaceFile({ workspaceId: activeWorkspaceId, fileId, idToken: token });

      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    },
    [activeWorkspaceId, authState.status, getToken]
  );

  const handleCreateWorkspace = useCallback(
    async (name: string): Promise<void> => {
      const token = await getToken();
      if (!token) throw new Error("לא מאומת.");
      const workspace: WorkspaceListItem = await createWorkspace(token, { name });
      setWorkspaceState((prev) => {
        const existing = prev.status === "ready" ? prev.workspaces : [];
        return { status: "ready", workspaces: [...existing, workspace] };
      });
      setActiveSessionId(null);
      setCreateSessionError(null);
      setActiveWorkspaceId(workspace.id);
    },
    [getToken]
  );

  const handleCreateSession = useCallback(async (): Promise<void> => {
    if (!activeWorkspaceId) {
      setCreateSessionError("בחר נושא לפני יצירת שיחה חדשה.");
      return;
    }

    setCreatingSession(true);
    setCreateSessionError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("לא ניתן לאמת את המשתמש.");
      }

      const created = await createSession(token, {
        workspaceId: activeWorkspaceId,
        workMode,
        costMode,
      });

      setSessionState((prev) => {
        const existing = prev.status === "ready" ? prev.sessions : [];
        const merged = [created, ...existing.filter((entry) => entry.id !== created.id)];
        return {
          status: "ready",
          sessions: sortSessionsByRecent(merged),
        };
      });
      setActiveSessionId(created.id);
    } catch (err: unknown) {
      setCreateSessionError(getSafeSessionErrorMessage(err, "יצירת שיחה נכשלה."));
    } finally {
      setCreatingSession(false);
    }
  }, [activeWorkspaceId, costMode, getToken, workMode]);

  const handleDeleteSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!activeWorkspaceId) return;
    const token = await getToken();
    if (!token) throw new Error("לא ניתן לאמת את המשתמש.");

    await deleteSession(token, sessionId, { workspaceId: activeWorkspaceId });

    setSessionState((prev) => {
      if (prev.status !== "ready") return prev;
      const remaining = prev.sessions.filter((s) => s.id !== sessionId);
      return { ...prev, sessions: remaining };
    });

    // If the deleted session was the active one, select first remaining or clear.
    setActiveSessionId((prev) => {
      if (prev !== sessionId) return prev;
      return null;
    });
  }, [activeWorkspaceId, getToken]);

  const handleRenameSession = useCallback(async (sessionId: string, newTitle: string): Promise<void> => {
    if (!activeWorkspaceId) return;
    const token = await getToken();
    if (!token) throw new Error("לא ניתן לאמת את המשתמש.");

    const updated = await renameSession(token, sessionId, {
      title: newTitle,
      workspaceId: activeWorkspaceId,
    });

    setSessionState((prev) => {
      if (prev.status !== "ready") return prev;
      return {
        ...prev,
        sessions: prev.sessions.map((s) => (s.id === sessionId ? updated : s)),
      };
    });
  }, [activeWorkspaceId, getToken]);

  const reloadMemory = useCallback(async (): Promise<void> => {
    if (authState.status !== "signed-in") {
      setMemoryObservations([]);
      return;
    }

    setMemoryLoading(true);
    try {
      const observations = await fetchLearnerMemory(getToken, activeWorkspaceId ?? undefined);
      setMemoryObservations(observations);
    } catch {
      setMemoryObservations([]);
    } finally {
      setMemoryLoading(false);
    }
  }, [activeWorkspaceId, authState.status, getToken]);

  useEffect(() => {
    void reloadMemory();
  }, [reloadMemory]);

  const displayName =
    authState.status === "signed-in"
      ? (authState.user?.displayName ?? authState.user?.email ?? "משתמש")
      : null;

  const avatarLetter =
    authState.status === "signed-in"
      ? (authState.user?.displayName?.[0]?.toUpperCase() ?? "N")
      : "N";

  const activeTopicName: string | null =
    workspaceState.status === "ready" && activeWorkspaceId !== null
      ? (workspaceState.workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null)
      : null;

  const sidebar = (
    <div className="flex flex-col h-full" dir="ltr">
      {/* Sidebar header: app name + user */}
      <div
        className="px-4 py-5 flex-shrink-0 space-y-3"
        style={{ borderBottom: "1px solid var(--tutor-sidebar-border)" }}
      >
        <div className="flex items-center justify-between gap-3 pr-10">
          <span
            className="text-[2rem] font-semibold leading-none"
            style={{
              fontFamily: "'Lora', Georgia, serif",
              color: "var(--tutor-sidebar-text-active)",
              letterSpacing: "-0.01em",
            }}
          >
            Private Tutor
          </span>
          {authState.status === "signed-in" && (
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              className="rounded-md px-2 py-1 text-[11px] font-medium flex-shrink-0"
              style={{
                border: "1px solid var(--tutor-sidebar-border)",
                color: "var(--tutor-sidebar-text-muted)",
              }}
            >
              Sign out
            </button>
          )}
        </div>
        {authState.status === "signed-in" && (
          <div
            className="flex items-center gap-3 rounded-2xl px-3 py-3 min-w-0"
            style={{
              border: "1px solid var(--tutor-sidebar-border)",
              background: "var(--tutor-sidebar-hover)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--tutor-accent), #96a7e5)",
                boxShadow: "0 8px 16px rgba(123,143,212,0.28)",
              }}
              title={displayName ?? undefined}
              aria-label={displayName ?? "משתמש"}
            >
              {avatarLetter}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-[15px] font-medium truncate" style={{ color: "var(--tutor-sidebar-text-active)" }}>
                {authState.user?.displayName ?? "Signed in"}
              </div>
              <div
                className="text-[12px] truncate mt-0.5"
                style={{ color: "var(--tutor-sidebar-text-muted)" }}
                title={authState.user?.email ?? undefined}
              >
                {authState.user?.email ?? "No email"}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--tutor-sidebar-text-muted)" }}>
                Mode: {getClientFirebaseModeLabel()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation: workspaces + sessions */}
      <div className="flex-1 overflow-y-auto py-1">
        <WorkspaceSelector
          loadState={workspaceState}
          selectedWorkspaceId={activeWorkspaceId}
          onSelect={handleWorkspaceSelect}
          onCreate={handleCreateWorkspace}
          sessionState={sessionState}
          selectedSessionId={activeSessionId}
          onSessionSelect={setActiveSessionId}
          onCreateSession={handleCreateSession}
          creatingSession={creatingSession}
          createSessionError={createSessionError}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
        />
      </div>

      {/* Collapsible support panels */}
      <div className="flex-shrink-0">
        <CollapsiblePanel
          title="Study materials"
          itemCount={uploadedFiles.length}
          defaultOpen={false}
        >
          <FilePanel
            files={uploadedFiles}
            disabled={!activeWorkspaceId || authState.status !== "signed-in"}
            onFileSelected={handleFileSelected}
            uploadStatus={fileUploadStatus}
            onContinueProcessing={handleContinueProcessing}
            processingStatusByFileId={fileProcessingStatusById}
            onDeleteFile={handleDeleteFile}
            onUseInChat={authState.status === "signed-in" && activeWorkspaceId ? handleToggleFileContext : undefined}
            stagedContextFiles={stagedContextFiles}
          />
        </CollapsiblePanel>
        <CollapsiblePanel
          title="Tutor memory"
          defaultOpen={false}
        >
          <MemoryPanel
            observations={memoryObservations}
            loading={memoryLoading}
            onApprove={async (id) => {
              await patchLearnerMemory(getToken, id, { action: "approve" });
              await reloadMemory();
            }}
            onReject={async (id) => {
              await patchLearnerMemory(getToken, id, { action: "reject" });
              await reloadMemory();
            }}
            onEdit={async (id, content) => {
              await patchLearnerMemory(getToken, id, { action: "edit", content });
              await reloadMemory();
            }}
            onDelete={async (id) => {
              await deleteLearnerMemory(getToken, id);
              await reloadMemory();
            }}
          />
        </CollapsiblePanel>
        <div
          className="px-4 py-5 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid var(--tutor-sidebar-border)" }}
        >
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--tutor-sidebar-text-muted)" }}>
              Workspace
            </div>
            <div className="text-[13px] mt-1" style={{ color: "var(--tutor-sidebar-text-active)" }}>
              Private Tutor
            </div>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs transition-colors"
            style={{
              color: "var(--tutor-sidebar-text)",
              border: "1px solid var(--tutor-sidebar-border)",
              textDecoration: "none",
              background: "rgba(255,255,255,0.04)",
            }}
            title="Settings"
            aria-label="Open Settings"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--tutor-sidebar-text-active)";
              (e.currentTarget as HTMLAnchorElement).style.background = "var(--tutor-sidebar-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--tutor-sidebar-text-muted)";
              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            }}
          >
            <GearIcon />
            <span>Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <AuthShell authState={authState} onSignIn={signIn}>
      <MainLayout sidebar={sidebar} activeTopicName={activeTopicName}>
        <TutorConversation
          activeSessionId={activeSessionId}
          activeWorkspaceId={activeWorkspaceId}
          workMode={workMode}
          onWorkModeChange={setWorkMode}
          costMode={costMode}
          onCostModeChange={setCostMode}
          activeTopicName={activeTopicName}
          getToken={getToken}
          developerDiagnosticsEnabled={developerDiagnosticsEnabled}
          uploadedFileCount={uploadedFiles.length}
          onFileSelected={authState.status === "signed-in" && activeWorkspaceId ? handleFileSelected : undefined}
          stagedContextFiles={stagedContextFiles}
          onRemoveStagedContext={handleRemoveStagedContext}
          onClearStagedContext={handleClearStagedContext}
          files={uploadedFiles}
          onToggleFileContext={handleToggleFileContext}
        />
      </MainLayout>
    </AuthShell>
  );
}

function GearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="1.8" />
      <path d="M6 1v1.2M6 9.8V11M1 6h1.2M9.8 6H11M2.5 2.5l.85.85M8.65 8.65l.85.85M9.5 2.5l-.85.85M3.35 8.65l-.85.85" />
    </svg>
  );
}
