"use client";

import React, { ReactNode, useState } from "react";

interface MainLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  activeTopicName?: string | null;
}

export default function MainLayout({ children, sidebar, activeTopicName }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("tutor-sidebar-collapsed") === "true"
  );

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("tutor-sidebar-collapsed", String(next));
      return next;
    });
  };

  const topicInitial = activeTopicName?.[0]?.toUpperCase() ?? null;

  return (
    <div
      dir="ltr"
      className="flex h-screen w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(255,255,255,0.82), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.34), transparent 18%), var(--tutor-bg)",
      }}
    >
      {/* Left sidebar */}
      <aside
        className="relative flex-shrink-0 flex flex-col"
        style={{
          width: collapsed ? "48px" : "var(--tutor-sidebar-width)",
          transition: "width 200ms ease",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.02), transparent 18%), var(--tutor-sidebar)",
          borderRight: "1px solid var(--tutor-sidebar-border)",
          boxShadow: "18px 0 36px rgba(13, 18, 29, 0.10)",
          overflow: "visible",
        }}
      >
        {collapsed ? (
          /* ── Mini-rail ── */
          <div
            className="flex flex-col items-center pt-3 gap-4 w-full"
            style={{ overflow: "hidden" }}
          >
            <button
              type="button"
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-base"
              style={{
                background: "var(--tutor-sidebar-hover)",
                color: "var(--tutor-sidebar-text-active)",
                border: "1px solid var(--tutor-sidebar-border)",
              }}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              ›
            </button>

            {topicInitial && (
              <div
                className="w-7 h-7 flex items-center justify-center rounded-md text-xs font-semibold select-none"
                style={{
                  background: "var(--tutor-sidebar-active)",
                  color: "var(--tutor-sidebar-text-active)",
                }}
                title={activeTopicName ?? undefined}
              >
                {topicInitial}
              </div>
            )}
          </div>
        ) : (
          /* ── Expanded sidebar ── */
          <>
            {/* Collapse button — always visible, positioned in header area */}
            <button
              type="button"
              onClick={toggle}
              className="flex items-center justify-center"
              style={{
                position: "absolute",
                top: "16px",
                right: "20px",
                width: "30px",
                height: "30px",
                background: "var(--tutor-sidebar-hover)",
                color: "var(--tutor-sidebar-text-active)",
                border: "1px solid var(--tutor-sidebar-border)",
                borderRadius: "12px",
                cursor: "pointer",
                zIndex: 20,
                fontSize: "14px",
                boxShadow: "var(--tutor-shadow-sm)",
              }}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              ‹
            </button>

            {/* Sidebar content */}
            <div
              className="flex flex-col h-full min-w-0"
              style={{ overflow: "hidden" }}
            >
              {sidebar}
            </div>
          </>
        )}
      </aside>

      {/* Main chat area */}
      <main
        className="flex flex-1 flex-col overflow-hidden"
        style={{ background: "var(--tutor-bg)" }}
      >
        {children}
      </main>
    </div>
  );
}
