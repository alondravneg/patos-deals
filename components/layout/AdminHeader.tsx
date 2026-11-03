"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Menu,
  X,
} from "lucide-react";
import { adminNavigation, isAdminRouteActive } from "./admin-navigation";

export default function AdminHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [brandLogoFailed, setBrandLogoFailed] = useState(false);
  const [openDesktopGroup, setOpenDesktopGroup] = useState<string | null>(null);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);

  // Close every menu after navigating to a different route.
  useEffect(() => {
    setOpenDesktopGroup(null);
    setOpenMobileGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  // Close menus when the user clicks/taps outside the header or presses Escape.
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !headerRef.current?.contains(target)) {
        setOpenDesktopGroup(null);
        setOpenMobileGroup(null);
        setMobileOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenDesktopGroup(null);
        setOpenMobileGroup(null);
        setMobileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggleDesktopGroup(label: string) {
    setOpenDesktopGroup((current) => (current === label ? null : label));
  }

  function toggleMobileGroup(label: string) {
    setOpenMobileGroup((current) => (current === label ? null : label));
  }

  function closeMenus() {
    setOpenDesktopGroup(null);
    setOpenMobileGroup(null);
    setMobileOpen(false);
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-[#EFE7DE] bg-white/95 text-[#0C304F] shadow-[0_3px_18px_rgba(12,48,79,0.045)] backdrop-blur-xl"
    >
      <div className="mx-auto flex min-h-[72px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/admin"
          onClick={closeMenus}
          className="group flex min-w-0 items-center gap-3"
          aria-label="Patos Deals, inicio del panel"
        >
          {brandLogoFailed ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0C304F] text-xl font-black text-white shadow-sm">
              P
            </span>
          ) : (
            <img
              src="/res/img/patos-deals.svg"
              alt="Patos Deals"
              onError={() => setBrandLogoFailed(true)}
              className="h-12 w-[150px] shrink-0 object-contain object-left"
            />
          )}
          <span className="hidden min-w-0 sm:block">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#78909C]">
              Panel de operaciones
            </span>
          </span>
        </Link>

        {/* Desktop: one controlled dropdown at a time. */}
        <nav
          className="hidden items-center gap-1 xl:flex"
          aria-label="Navegación principal"
        >
          {adminNavigation.map((group) => {
            const GroupIcon = group.icon;
            const groupActive = group.items.some((item) =>
              isAdminRouteActive(pathname, item.href),
            );
            const isOpen = openDesktopGroup === group.label;
            const menuId = `desktop-menu-${group.label
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}`;

            return (
              <div key={group.label} className="relative">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={menuId}
                  onClick={() => toggleDesktopGroup(group.label)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-[#F7F3EF] ${
                    groupActive || isOpen
                      ? "bg-[#F3F7FA] text-[#0C304F]"
                      : "text-[#526C7D]"
                  }`}
                >
                  <GroupIcon size={16} />
                  {group.label}
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div
                    id={menuId}
                    className="absolute left-0 top-full z-[60] mt-2 w-[330px] rounded-2xl border border-[#EFE7DE] bg-white p-2 shadow-[0_18px_50px_rgba(12,48,79,0.14)]"
                  >
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const active = isAdminRouteActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMenus}
                          className={`flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-[#FDF9F7] ${
                            active ? "bg-[#F3F7FA]" : ""
                          }`}
                        >
                          <span
                            className={`mt-0.5 rounded-lg p-2 ${
                              active
                                ? "bg-white text-[#36709E]"
                                : "bg-[#FDF9F7] text-[#78909C]"
                            }`}
                          >
                            <ItemIcon size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-[#0C304F]">
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-xs leading-5 text-[#78909C]">
                              {item.description}
                            </span>
                          </span>
                          <ChevronRight
                            size={15}
                            className="mt-1 shrink-0 text-[#A6B4BC]"
                          />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <Link
            href="/admin/mapa-sitio"
            onClick={closeMenus}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition hover:border-[#36709E] hover:bg-[#F3F7FA] ${
              pathname === "/admin/mapa-sitio"
                ? "border-[#36709E] bg-[#F3F7FA]"
                : "border-[#EFE7DE] bg-white"
            }`}
          >
            <Compass size={16} /> Mapa del sitio
          </Link>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileOpen((open) => !open);
            setOpenMobileGroup(null);
            setOpenDesktopGroup(null);
          }}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#EFE7DE] bg-white text-[#0C304F] transition hover:bg-[#FDF9F7] xl:hidden"
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#EFE7DE] bg-white px-4 pb-5 pt-3 shadow-lg xl:hidden">
          <div className="mx-auto max-w-3xl space-y-2">
            <Link
              href="/admin/mapa-sitio"
              onClick={closeMenus}
              className="flex items-center gap-2 rounded-xl bg-[#F3F7FA] px-4 py-3 text-sm font-bold text-[#0C304F]"
            >
              <Compass size={17} /> Mapa del sitio
              <span className="ml-auto text-xs font-medium text-[#78909C]">
                Ver todas las funciones
              </span>
            </Link>

            {adminNavigation.map((group) => {
              const GroupIcon = group.icon;
              const active = group.items.some((item) =>
                isAdminRouteActive(pathname, item.href),
              );
              const isOpen = openMobileGroup === group.label;
              const menuId = `mobile-menu-${group.label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")}`;

              return (
                <section
                  key={group.label}
                  className="rounded-xl border border-[#EFE7DE] bg-white"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={menuId}
                    onClick={() => toggleMobileGroup(group.label)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-[#0C304F]"
                  >
                    <GroupIcon size={17} className="text-[#36709E]" />
                    {group.label}
                    {active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#CC6255]" />
                    )}
                    <ChevronDown
                      size={15}
                      className={`ml-auto text-[#78909C] transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div id={menuId} className="space-y-1 px-2 pb-2">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = isAdminRouteActive(
                          pathname,
                          item.href,
                        );
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={closeMenus}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                              itemActive
                                ? "bg-[#F3F7FA] font-bold text-[#0C304F]"
                                : "text-[#526C7D] hover:bg-[#FDF9F7]"
                            }`}
                          >
                            <ItemIcon size={16} className="text-[#78909C]" />
                            {item.label}
                            {itemActive && (
                              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#CC6255]" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            <p className="flex items-center gap-2 px-1 pt-2 text-[11px] text-[#78909C]">
              <CircleHelp size={13} /> Toca una sección para ver sus módulos.
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
