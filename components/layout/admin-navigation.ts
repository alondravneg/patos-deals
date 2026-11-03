import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileImage,
  HandCoins,
  Package,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  label: string;
  icon: LucideIcon;
  items: AdminNavItem[];
};

/**
 * Rutas identificadas en los módulos que ya se han trabajado para Patos Deals.
 * Si una ruta cambia en el proyecto, actualízala aquí y se reflejará en header,
 * footer y mapa del sitio.
 */
export const adminNavigation: AdminNavGroup[] = [
  {
    label: "Operación",
    icon: CalendarDays,
    items: [
      {
        label: "Periodos",
        href: "/admin/periodos",
        description:
          "Organiza fines de semana de compras, fechas y tipo de cambio.",
        icon: CalendarDays,
      },
      {
        label: "Compras",
        href: "/admin/compras",
        description: "Registra tickets de compra, tiendas, productos y costos.",
        icon: ShoppingBag,
      },
      {
        label: "Inventario",
        href: "/admin/inventario",
        description:
          "Consulta unidades, disponibilidad, reservas y uso personal.",
        icon: Package,
      },
      {
        label: "Ventas",
        href: "/admin/ventas",
        description: "Registra ventas, productos, precios y anticipos.",
        icon: ShoppingCart,
      },
      {
        label: "Entregas",
        href: "/admin/entregas",
        description:
          "Agrupa productos pendientes por cliente y periodo para entregar.",
        icon: Truck,
      },
    ],
  },
  {
    label: "Clientes",
    icon: Users,
    items: [
      {
        label: "Directorio de clientes",
        href: "/admin/clientes",
        description: "Consulta clientes, compras y estado de cuenta.",
        icon: Users,
      },
      {
        label: "Tickets / Estados de cuenta",
        href: "/admin/tickets",
        description: "Genera y comparte comprobantes visuales por cliente.",
        icon: FileImage,
      },
    ],
  },
  {
    label: "Finanzas",
    icon: Wallet,
    items: [
      {
        label: "Cuentas y pagos",
        href: "/admin/finanzas",
        description:
          "Consulta cuentas por cobrar, registra abonos y revisa pagos.",
        icon: Wallet,
      },
      {
        label: "Gastos operativos",
        href: "/admin/finanzas/gastos",
        description: "Registra y clasifica gastos por periodo.",
        icon: ClipboardList,
      },
      {
        label: "Resultados por periodo",
        href: "/admin/finanzas/resultados",
        description: "Revisa ventas, costos, gastos, utilidad y rendimiento.",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Capital",
    icon: HandCoins,
    items: [
      {
        label: "Inversionistas",
        href: "/admin/inversionistas",
        description:
          "Administra aportaciones, participaciones y pagos de rendimiento.",
        icon: HandCoins,
      },
    ],
  },
];

export const allAdminNavItems = adminNavigation.flatMap((group) => group.items);

export function isAdminRouteActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
