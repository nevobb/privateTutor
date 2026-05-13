import React, { ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
}

export default function MainLayout({ children, sidebar }: MainLayoutProps) {
  return (
    /*
     * dir="ltr" here so the flex row is predictably left→right
     * at the layout level, regardless of the global RTL default.
     * Individual content areas set their own dir as needed.
     */
    <div
      dir="ltr"
      className="flex h-screen w-full overflow-hidden"
      style={{ background: "var(--tutor-bg)" }}
    >
      {/* Left sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col overflow-hidden"
        style={{
          width: "var(--tutor-sidebar-width)",
          background: "var(--tutor-sidebar)",
          borderRight: "1px solid var(--tutor-border)",
        }}
      >
        {sidebar}
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
