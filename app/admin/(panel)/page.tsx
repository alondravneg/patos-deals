import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  Boxes,
  ChartNoAxesCombined,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

const sections = [
  {
    title: "Ventas",
    description: "Consulta y administra las ventas de tu negocio.",
    href: "/admin/ventas",
    icon: ShoppingCart,
    label: "Operaciones",
  },
  {
    title: "Inventario",
    description: "Controla tus productos y movimientos de inventario.",
    href: "/admin/inventario",
    icon: Boxes,
    label: "Productos",
  },
  {
    title: "Compras",
    description: "Consulta las compras y sus respectivos detalles.",
    href: "/admin/compras",
    icon: ArrowDownRight,
    label: "Abastecimiento",
  },
  {
    title: "Clientes",
    description: "Consulta y administra la información de tus clientes.",
    href: "/admin/clientes",
    icon: Users,
    label: "Contactos",
  },
  {
    title: "Finanzas",
    description: "Revisa pagos, gastos y movimientos financieros.",
    href: "/admin/finanzas",
    icon: Wallet,
    label: "Administración",
  },
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Barra superior */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link
            href="/admin"
            aria-label="Patos Deals, inicio del panel"
            className="relative block h-11 w-44 shrink-0"
          >
            <Image
              src="/res/img/patos-deals.svg"
              alt="Patos Deals"
              fill
              priority
              sizes="176px"
              className="object-contain object-left"
            />
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              Panel administrativo
            </span>

            <span
              className="h-2.5 w-2.5 rounded-full bg-success"
              title="Panel disponible"
              aria-label="Panel disponible"
            />
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        {/* Encabezado */}
        <section className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-brand-orange">
              Centro de operaciones
            </p>

            <h1 className="font-heading text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
              Panel administrativo
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              Gestiona las operaciones de Patos Deals desde un solo lugar.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-full border border-border bg-surface px-4 py-2 sm:self-auto">
            <ChartNoAxesCombined
              size={17}
              className="text-brand-orange"
              aria-hidden="true"
            />

            <span className="text-sm font-medium text-brand-navy">
              Vista general
            </span>
          </div>
        </section>

        {/* Módulos */}
        <section aria-labelledby="modules-heading">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2
                id="modules-heading"
                className="font-heading text-xl font-semibold text-brand-navy"
              >
                Módulos del sistema
              </h2>

              <p className="mt-1 text-sm text-muted">
                Selecciona una sección para comenzar.
              </p>
            </div>

            <span className="hidden rounded-lg bg-surface-secondary px-3 py-1.5 text-xs font-semibold text-brand-navy sm:inline-flex">
              {sections.length} módulos
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {sections.map((section, index) => {
              const Icon = section.icon;

              return (
                <Link
                  key={section.title}
                  href={section.href}
                  className="group block rounded-[var(--radius-card)] outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-4"
                  aria-label={`Abrir módulo de ${section.title}`}
                >
                  <article className="pd-card flex h-full min-h-56 flex-col p-6">
                    <div className="mb-6 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-secondary text-brand-navy transition-colors duration-200 group-hover:bg-brand-orange group-hover:text-white">
                        <Icon size={23} strokeWidth={1.8} />
                      </div>

                      <span className="text-xs font-medium tracking-wide text-muted/70">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="flex-1">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-orange">
                        {section.label}
                      </p>

                      <h3 className="font-heading text-xl font-semibold text-brand-navy transition-colors group-hover:text-brand-orange">
                        {section.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-muted">
                        {section.description}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                      <span className="text-sm font-semibold text-brand-blue transition-colors group-hover:text-brand-orange">
                        Abrir módulo
                      </span>

                      <ArrowRight
                        size={18}
                        className="text-brand-blue transition-transform duration-200 group-hover:translate-x-1 group-hover:text-brand-orange"
                        aria-hidden="true"
                      />
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Pie de página */}
        <footer className="mt-12 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} Patos Deals
          </p>

          <p className="text-xs text-muted">Sistema de administración</p>
        </footer>
      </div>
    </main>
  );
}
