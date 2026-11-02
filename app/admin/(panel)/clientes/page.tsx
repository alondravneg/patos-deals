"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Mail,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

type Sale = {
  id: string;
  folio: string;
  customer_id: string;
  sale_date: string;
  status: string;
};

type SaleItem = {
  sale_id: string;
  sale_price_mxn: number | string;
  released_at: string | null;
};

type Payment = {
  id: string;
  status: string;
  amount_mxn: number | string;
};

type PaymentAllocation = {
  payment_id: string;
  sale_id: string;
  amount_mxn: number | string;
  superseded_at: string | null;
};

type SaleBalance = {
  sale: Sale;
  total: number;
  received: number;
  balance: number;
};

type CustomerSummary = {
  customer: Customer;
  salesCount: number;
  total: number;
  received: number;
  balance: number;
  sales: SaleBalance[];
};

type CustomerFilter = "all" | "current" | "debt" | "inactive";

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const inputClass =
  "w-full rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm text-[#0C304F] outline-none transition placeholder:text-[#78909C] focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10";

export default function ClientesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(
    null,
  );

  const loadData = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const [
          customersResult,
          salesResult,
          itemsResult,
          paymentsResult,
          allocationsResult,
        ] = await Promise.all([
          supabase
            .from("customers")
            .select("id, full_name, phone, email, notes, active, created_at")
            .order("full_name", { ascending: true }),
          supabase
            .from("sales")
            .select("id, folio, customer_id, sale_date, status")
            .neq("status", "cancelled")
            .order("sale_date", { ascending: false }),
          supabase
            .from("sale_items")
            .select("sale_id, sale_price_mxn, released_at")
            .is("released_at", null),
          supabase.from("payments").select("id, status, amount_mxn"),
          supabase
            .from("payment_allocations")
            .select("payment_id, sale_id, amount_mxn, superseded_at")
            .is("superseded_at", null),
        ]);

        const results = [
          customersResult,
          salesResult,
          itemsResult,
          paymentsResult,
          allocationsResult,
        ];
        const failed = results.find((result) => result.error);
        if (failed?.error) throw failed.error;

        setCustomers((customersResult.data ?? []) as Customer[]);
        setSales((salesResult.data ?? []) as Sale[]);
        setSaleItems((itemsResult.data ?? []) as SaleItem[]);
        setPayments((paymentsResult.data ?? []) as Payment[]);
        setAllocations((allocationsResult.data ?? []) as PaymentAllocation[]);
      } catch (err) {
        console.error("Error cargando Clientes:", err);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el directorio de clientes.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const customerSummaries = useMemo<CustomerSummary[]>(() => {
    const saleTotalById = new Map<string, number>();
    saleItems.forEach((item) => {
      saleTotalById.set(
        item.sale_id,
        (saleTotalById.get(item.sale_id) ?? 0) + Number(item.sale_price_mxn),
      );
    });

    const paymentById = new Map(
      payments.map((payment) => [payment.id, payment]),
    );
    const receivedBySale = new Map<string, number>();

    allocations.forEach((allocation) => {
      const payment = paymentById.get(allocation.payment_id);
      if (
        !payment ||
        payment.status === "cancelled" ||
        payment.status === "refunded"
      )
        return;
      receivedBySale.set(
        allocation.sale_id,
        (receivedBySale.get(allocation.sale_id) ?? 0) +
          Number(allocation.amount_mxn),
      );
    });

    const salesByCustomer = new Map<string, SaleBalance[]>();
    sales.forEach((sale) => {
      const total = saleTotalById.get(sale.id) ?? 0;
      const received = receivedBySale.get(sale.id) ?? 0;
      const item: SaleBalance = {
        sale,
        total,
        received,
        balance: Math.max(total - received, 0),
      };
      const current = salesByCustomer.get(sale.customer_id) ?? [];
      current.push(item);
      salesByCustomer.set(sale.customer_id, current);
    });

    return customers.map((customer) => {
      const customerSales = (salesByCustomer.get(customer.id) ?? []).sort(
        (a, b) =>
          b.sale.sale_date.localeCompare(a.sale.sale_date) ||
          b.sale.folio.localeCompare(a.sale.folio),
      );
      return {
        customer,
        salesCount: customerSales.length,
        total: customerSales.reduce((sum, item) => sum + item.total, 0),
        received: customerSales.reduce((sum, item) => sum + item.received, 0),
        balance: customerSales.reduce((sum, item) => sum + item.balance, 0),
        sales: customerSales,
      };
    });
  }, [customers, sales, saleItems, payments, allocations]);

  const activeSummaries = customerSummaries.filter(
    (item) => item.customer.active,
  );
  const debtorsCount = activeSummaries.filter(
    (item) => item.balance > 0.009,
  ).length;
  const currentCount = activeSummaries.filter(
    (item) => item.balance <= 0.009 && item.salesCount > 0,
  ).length;
  const noPurchaseCount = activeSummaries.filter(
    (item) => item.salesCount === 0,
  ).length;
  const totalReceivable = activeSummaries.reduce(
    (sum, item) => sum + item.balance,
    0,
  );

  const filteredCustomers = customerSummaries.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      `${item.customer.full_name} ${item.customer.phone ?? ""} ${item.customer.email ?? ""}`
        .toLowerCase()
        .includes(query);

    const matchesFilter =
      filter === "all" ||
      (filter === "current" &&
        item.customer.active &&
        item.balance <= 0.009 &&
        item.salesCount > 0) ||
      (filter === "debt" && item.customer.active && item.balance > 0.009) ||
      (filter === "inactive" && !item.customer.active);

    return matchesSearch && matchesFilter;
  });

  return (
    <main className="min-h-screen bg-[#FDF9F7] px-4 py-7 text-[#0C304F] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-[#36709E]">
              <Users size={16} /> Operaciones / Clientes
            </p>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Clientes
            </h1>
            <p className="mt-1 text-sm text-[#78909C]">
              Directorio de clientes y estado de cuenta.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm font-semibold text-[#0C304F] transition hover:border-[#36709E]/40 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Actualizar clientes
          </button>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-[#FDECEC] p-4 text-sm text-[#A94442]">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <p className="text-sm text-[#78909C]">Clientes activos</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {loading ? "—" : activeSummaries.length}
            </p>
            <p className="mt-1 text-xs text-[#78909C]">
              Registrados desde Ventas
            </p>
          </article>
          <article className="rounded-2xl border border-[#CDE9D6] bg-[#EFF9F1] p-5">
            <p className="text-sm text-[#477A56]">Al corriente</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-[#367B4B]">
              {loading ? "—" : currentCount}
            </p>
            <p className="mt-1 text-xs text-[#5D8A69]">Sin saldo pendiente</p>
          </article>
          <article className="rounded-2xl border border-[#F3D1D0] bg-[#FDEEEE] p-5">
            <p className="text-sm text-[#A65A57]">Con adeudo</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-[#B65350]">
              {loading ? "—" : debtorsCount}
            </p>
            <p className="mt-1 text-xs text-[#B36B68]">
              Clientes con saldo pendiente
            </p>
          </article>
          <article className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <p className="text-sm text-[#78909C]">Total por cobrar</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {loading ? "—" : money(totalReceivable)}
            </p>
            <p className="mt-1 text-xs text-[#78909C]">
              De todos los clientes activos
            </p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#EFE7DE] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#EFE7DE] p-5 sm:p-6">
            <div>
              <h2 className="font-serif text-xl font-bold">
                Directorio de clientes
              </h2>
              <p className="mt-1 text-sm text-[#78909C]">
                Selecciona un cliente para consultar sus ventas y pagos.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#78909C]"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, teléfono o correo..."
                  className={`${inputClass} pl-10`}
                />
              </div>
              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as CustomerFilter)
                }
                className={`${inputClass} sm:max-w-56`}
                aria-label="Filtrar clientes"
              >
                <option value="all">Todos los clientes</option>
                <option value="current">Al corriente</option>
                <option value="debt">Con adeudo</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-56 items-center justify-center text-sm text-[#78909C]">
              Cargando clientes y estados de cuenta...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Users size={30} className="mx-auto mb-3 text-[#9AAEBB]" />
              <p className="font-semibold">No encontramos clientes</p>
              <p className="mt-1 text-sm text-[#78909C]">
                {customers.length === 0
                  ? "Los clientes que registres desde Ventas aparecerán aquí automáticamente."
                  : "Prueba con otro nombre o cambia el filtro."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EFE7DE]">
              {filteredCustomers.map((item) => {
                const isExpanded = expandedCustomerId === item.customer.id;
                const isInactive = !item.customer.active;
                const hasDebt = item.balance > 0.009;
                const statusLabel = isInactive
                  ? "Inactivo"
                  : hasDebt
                    ? `Adeudo ${money(item.balance)}`
                    : item.salesCount > 0
                      ? "Al corriente"
                      : "Sin compras";
                const statusClass = isInactive
                  ? "border border-slate-200 bg-slate-50 text-slate-600"
                  : hasDebt
                    ? "border border-[#F3D1D0] bg-[#FDEEEE] text-[#AD514E]"
                    : item.salesCount > 0
                      ? "border border-[#CDE9D6] bg-[#EFF9F1] text-[#477A56]"
                      : "border border-[#E5EAF0] bg-[#F7F9FB] text-[#6C8291]";

                return (
                  <article key={item.customer.id} className="px-5 py-4 sm:px-6">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCustomerId(
                          isExpanded ? null : item.customer.id,
                        )
                      }
                      className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 rounded-xl bg-[#36709E]/10 p-2.5 text-[#36709E]">
                          <UserRound size={19} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {item.customer.full_name}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#78909C]">
                            {item.customer.phone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone size={12} />
                                {item.customer.phone}
                              </span>
                            )}
                            {item.customer.email && (
                              <span className="inline-flex items-center gap-1">
                                <Mail size={12} />
                                {item.customer.email}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-[#78909C]">
                            {item.salesCount}{" "}
                            {item.salesCount === 1 ? "venta" : "ventas"} ·{" "}
                            {money(item.total)} comprado
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${statusClass}`}
                        >
                          {hasDebt && !isInactive && (
                            <CircleDollarSign size={13} className="mr-1.5" />
                          )}
                          {!hasDebt && !isInactive && item.salesCount > 0 && (
                            <CheckCircle2 size={13} className="mr-1.5" />
                          )}
                          {statusLabel}
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={18} className="text-[#78909C]" />
                        ) : (
                          <ChevronDown size={18} className="text-[#78909C]" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-4 rounded-xl border border-[#EFE7DE] bg-[#FDF9F7] p-4 sm:p-5">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs text-[#78909C]">
                              Total comprado
                            </p>
                            <p className="mt-1 font-bold">
                              {money(item.total)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs text-[#78909C]">
                              Total recibido
                            </p>
                            <p className="mt-1 font-bold text-[#367B4B]">
                              {money(item.received)}
                            </p>
                          </div>
                          <div
                            className={`rounded-xl p-3 ${hasDebt ? "bg-[#FDEEEE]" : "bg-[#EFF9F1]"}`}
                          >
                            <p
                              className={`text-xs ${hasDebt ? "text-[#A65A57]" : "text-[#477A56]"}`}
                            >
                              Saldo pendiente
                            </p>
                            <p
                              className={`mt-1 font-bold ${hasDebt ? "text-[#AD514E]" : "text-[#367B4B]"}`}
                            >
                              {money(item.balance)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5">
                          <h3 className="mb-3 text-sm font-bold">
                            Historial de ventas
                          </h3>
                          {item.sales.length === 0 ? (
                            <p className="rounded-lg bg-white p-4 text-sm text-[#78909C]">
                              Este cliente todavía no tiene ventas registradas.
                            </p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-[#EFE7DE] bg-white">
                              <table className="w-full min-w-[620px] text-left text-sm">
                                <thead className="bg-[#F8F5F1] text-xs uppercase tracking-wide text-[#78909C]">
                                  <tr>
                                    <th className="px-4 py-3 font-semibold">
                                      Folio
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                      Fecha
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold">
                                      Total
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold">
                                      Recibido
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold">
                                      Saldo
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold">
                                      Estado
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#EFE7DE]">
                                  {item.sales.map((sale) => (
                                    <tr key={sale.sale.id}>
                                      <td className="whitespace-nowrap px-4 py-3 font-semibold">
                                        {sale.sale.folio}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-[#78909C]">
                                        {formatDate(sale.sale.sale_date)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right">
                                        {money(sale.total)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right">
                                        {money(sale.received)}
                                      </td>
                                      <td
                                        className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${sale.balance > 0.009 ? "text-[#AD514E]" : "text-[#477A56]"}`}
                                      >
                                        {money(sale.balance)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right">
                                        <span
                                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sale.balance > 0.009 ? "bg-[#FDEEEE] text-[#AD514E]" : "bg-[#EFF9F1] text-[#477A56]"}`}
                                        >
                                          {sale.balance > 0.009
                                            ? "Pendiente"
                                            : "Liquidada"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {item.customer.notes && (
                          <p className="mt-4 text-sm text-[#78909C]">
                            Notas: {item.customer.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {!loading && (
          <p className="mt-4 text-right text-xs text-[#78909C]">
            {noPurchaseCount}{" "}
            {noPurchaseCount === 1
              ? "cliente activo sin compras"
              : "clientes activos sin compras"}{" "}
            · {customerSummaries.filter((item) => !item.customer.active).length}{" "}
            inactivos
          </p>
        )}
      </div>
    </main>
  );
}
