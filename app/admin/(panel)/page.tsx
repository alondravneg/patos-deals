import Link from "next/link";

const sections = [
  {
    title: "Ventas",
    description: "Consulta y administra las ventas.",
    href: "/admin/ventas",
  },
  {
    title: "Inventario",
    description: "Controla productos y movimientos de inventario.",
    href: "/admin/inventario",
  },
  {
    title: "Compras",
    description: "Consulta las compras y sus detalles.",
    href: "/admin/compras",
  },
  {
    title: "Clientes",
    description: "Consulta la información de tus clientes.",
    href: "/admin/clientes",
  },
  {
    title: "Finanzas",
    description: "Revisa pagos, gastos y movimientos financieros.",
    href: "/admin/finanzas",
  },
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f8f5f1] px-6 py-10 md:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#CC6255]">
              Patos Deals
            </p>

            <h1 className="text-3xl font-semibold text-gray-900">
              Panel administrativo
            </h1>

            <p className="mt-2 text-gray-500">
              Bienvenida al centro de operaciones.
            </p>
          </div>

          <Link
            href="/admin/login"
            className="inline-flex w-fit items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Volver al inicio de sesión
          </Link>
        </header>

        <section>
          <h2 className="mb-5 text-lg font-semibold text-gray-900">
            Módulos del sistema
          </h2>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  {section.title}
                </h3>

                <p className="mt-2 min-h-12 text-sm leading-6 text-gray-500">
                  {section.description}
                </p>

                <Link
                  href={section.href}
                  className="mt-5 inline-flex text-sm font-semibold text-[#CC6255] hover:text-purple-900"
                >
                  Abrir módulo →
                </Link>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t border-gray-200 pt-5 text-sm text-gray-400">
          Patos Deals · Sistema de administración
        </footer>
      </div>
    </main>
  );
}
