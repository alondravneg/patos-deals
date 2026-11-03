import type { ReactNode } from "react";
import AdminHeader from "@/components/layout/AdminHeader";
import AdminFooter from "@/components/layout/AdminFooter";

/**
 * Shell compartido para los módulos del grupo (panel).
 * Si tu proyecto ya tiene un layout en esta ruta, conserva su lógica de sesión/
 * permisos y agrega AdminHeader + AdminFooter alrededor de {children}.
 */
export default function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FDF9F7]">
      <AdminHeader />
      <div className="min-w-0 flex-1 [&>main]:!min-h-0">{children}</div>
      <AdminFooter />
    </div>
  );
}
