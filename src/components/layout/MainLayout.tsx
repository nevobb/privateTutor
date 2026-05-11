import React, { ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
  rightSidebar: ReactNode;
  leftSidebar: ReactNode;
  header: ReactNode;
}

export default function MainLayout({ children, rightSidebar, leftSidebar, header }: MainLayoutProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-[#f8f9ff] text-[#0b1c30] overflow-hidden">
      <header className="flex h-16 items-center justify-between border-b border-[#c5c6ce] bg-white px-6">
        {header}
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Right Sidebar (Materials in RTL) */}
        <aside className="w-80 flex-shrink-0 border-l border-[#c5c6ce] bg-[#eff4ff] p-4 overflow-y-auto">
          {rightSidebar}
        </aside>

        {/* Center Column (Tutor) */}
        <main className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
          {children}
        </main>

        {/* Left Sidebar (Status in RTL) */}
        <aside className="w-80 flex-shrink-0 border-r border-[#c5c6ce] bg-[#eff4ff] p-4 overflow-y-auto">
          {leftSidebar}
        </aside>
      </div>
    </div>
  );
}
