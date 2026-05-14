"use client";

import React, { ReactNode, useState, useEffect } from "react";

interface MainLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  activeTopicName?: string | null;
}

export default function MainLayout({ children, sidebar, activeTopicName }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("tutor-sidebar-collapsed") === "true");
  }, []);

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
      style={{ background: "var(--tutor-bg)" }}
    >
      {/* Left sidebar */}
      <aside
        className="relative flex-shrink-0 flex flex-col"
        style={{
          width: collapsed ? "48px" : "var(--tutor-sidebar-width)",
          transition: "width 200ms ease",
          background: "var(--tutor-sidebar)",
          borderRight: "1px solid var(--tutor-border)",
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
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-base"
              style={{ color: "var(--tutor-sidebar-text)", background: "transparent" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--tutor-sidebar-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
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
            {/* Edge-tab collapse trigger — sits on the right border */}
            <button
              type="button"
              onClick={toggle}
              className="flex items-center justify-center transition-opacity opacity-40 hover:opacity-100"
              style={{
                position: "absolute",
                right: "-13px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "13px",
                height: "40px",
                background: "var(--tutor-sidebar)",
                border: "1px solid var(--tutor-border)",
                borderLeft: "none",
                borderRadius: "0 6px 6px 0",
                cursor: "pointer",
                zIndex: 10,
                color: "var(--tutor-sidebar-text-muted)",
                fontSize: "10px",
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
