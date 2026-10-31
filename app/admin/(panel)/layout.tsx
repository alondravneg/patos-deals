import type { ReactNode } from "react";

export default function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FDF9F7] text-[#0C304F]">
      {children}
    </div>
  );
}