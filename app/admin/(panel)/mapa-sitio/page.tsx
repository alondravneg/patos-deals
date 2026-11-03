import Link from "next/link";
import { ArrowRight, Compass, Layers3 } from "lucide-react";
import { adminNavigation } from "@/components/layout/admin-navigation";

export default function MapaSitioPage() {
  const totalModules = adminNavigation.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  return (
    <main className="min-h-screen bg-[#FDF9F7] px-4 py-7 text-[#0C304F] sm:px-6 sm:py-9 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#CC6255]">
              <Compass size={17} /> PATOS DEALS / NAVEGACIÓN
            </p>
            <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
              Mapa del sitio
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C]">
              Todas las herramientas del panel organizadas por área para
              encontrar rápidamente dónde realizar cada tarea.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#EFE7DE] bg-white px-4 py-3">
            <span className="rounded-xl bg-[#36709E]/10 p-2 text-[#36709E]">
              <Layers3 size={20} />
            </span>
            <span>
              <strong className="block text-xl tabular-nums">
                {totalModules}
              </strong>
              <span className="text-xs text-[#78909C]">
                módulos disponibles
              </span>
            </span>
          </div>
        </header>

        <section className="mb-7 rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#78909C]">
                Inicio del panel
              </p>
              <h2 className="mt-1 text-lg font-bold">
                Patos Deals · Panel de operaciones
              </h2>
              <p className="mt-1 text-sm text-[#78909C]">
                Acceso principal a las herramientas de administración.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0C304F] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#17466B]"
            >
              Ir al inicio <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {adminNavigation.map((group, index) => {
            const GroupIcon = group.icon;
            return (
              <article
                key={group.label}
                className="overflow-hidden rounded-2xl border border-[#EFE7DE] bg-white"
              >
                <div className="flex items-center gap-3 border-b border-[#EFE7DE] bg-[#FFFCFA] px-5 py-4">
                  <span className="rounded-xl bg-[#F3F7FA] p-2.5 text-[#36709E]">
                    <GroupIcon size={20} />
                  </span>
                  <div>
                    <h2 className="font-serif text-lg font-bold">
                      {group.label}
                    </h2>
                    <p className="text-xs text-[#78909C]">
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "módulo" : "módulos"}
                    </p>
                  </div>
                  <span className="ml-auto text-xs font-bold tabular-nums text-[#C2B8AE]">
                    0{index + 1}
                  </span>
                </div>
                <div className="divide-y divide-[#F1EAE4]">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center gap-3 px-5 py-4 transition hover:bg-[#FDF9F7]"
                      >
                        <span className="rounded-lg bg-[#FDF9F7] p-2 text-[#78909C] transition group-hover:bg-white group-hover:text-[#36709E]">
                          <ItemIcon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-[#0C304F]">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-[#78909C]">
                            {item.description}
                          </span>
                          <span className="mt-1 block text-[10px] font-medium text-[#B0A69C]">
                            {item.href}
                          </span>
                        </span>
                        <ArrowRight
                          size={16}
                          className="shrink-0 text-[#B0A69C] transition group-hover:translate-x-1 group-hover:text-[#CC6255]"
                        />
                      </Link>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>

        <p className="mt-6 text-center text-xs leading-5 text-[#78909C]">
          El menú, el pie de página y este mapa comparten una sola configuración
          de navegación. Al agregar o cambiar un módulo, actualiza{" "}
          <code className="rounded bg-white px-1.5 py-0.5">
            admin-navigation.ts
          </code>
          .
        </p>
      </div>
    </main>
  );
}
