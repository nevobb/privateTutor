"use client";

import React from "react";
import MainLayout from "../components/layout/MainLayout";
import WorkspaceSelector from "../components/workspaces/WorkspaceSelector";
import FilePanel from "../components/files/FilePanel";
import MemoryPanel from "../components/memory/MemoryPanel";
import TutorConversation from "../components/tutor/TutorConversation";
import { mockWorkspace, mockFiles, mockLearnerMemory, mockTutorMessages } from "../mock/data";

export default function Home() {
  const header = (
    <div className="flex items-center justify-between w-full">
      <WorkspaceSelector workspaces={[mockWorkspace]} selectedWorkspaceId={mockWorkspace.id} />
      <div className="flex items-center space-x-4 space-x-reverse">
        <span className="text-sm font-medium text-[#44474d]">משתמש בדיקה</span>
        <div className="w-8 h-8 rounded-full bg-[#dce9ff] flex items-center justify-center text-[#041632] font-bold text-sm">N</div>
      </div>
    </div>
  );

  return (
    <MainLayout
      header={header}
      rightSidebar={<FilePanel files={mockFiles} />}
      leftSidebar={<MemoryPanel memory={mockLearnerMemory} />}
    >
      <TutorConversation initialMessages={mockTutorMessages} />
    </MainLayout>
  );
}
