"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  Users,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

type Customer = {
  id: string;
  full_name: string;
};

type OperationPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
};

type Sale = {
  id: string;
  folio: string;
  sale_date: string;
  status: string;
  customer_id: string | null;
  operation_period_id: string | null;
};

type SaleItem = {
  id: string;
  sale_id: string;
  inventory_unit_id: string;
  released_at: string | null;
};

type InventoryUnit = {
  id: string;
  unit_number: number;
  status: string;
  purchase_items: {
    product_name: string;
    brand: string | null;
    model: string | null;
    sku: string | null;
  } | null;
};

type PendingItem = {
  id: string;
  unitId: string;
  unitNumber: number;
  unitStatus: string;
  saleId: string;
  folio: string;
  saleDate: string;
  productName: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
};

type DeliveryGroup = {
  key: string;
  customerId: string;
  customerName: string;
  periodId: string;
  periodName: string;
  periodStatus: string;
  periodStart: string;
  periodEnd: string | null;
  items: PendingItem[];
};

type DeliveryResult = {
  success: boolean;
  items_delivered: number;
  sales_affected: number;
  remaining_items_in_period: number;
  period_finished: boolean;
};

const supabase = createClient();

const dateFormat = (value: string | null) => {
  if (!value) return "Sin fecha de cierre";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
};

const statusLabel: Record<string, string> = {
  reserved: "Reservado",
  sold: "Vendido",
};

const PAGE_SIZE = 8;

export default function EntregasPage() {
  const [groups, setGroups] = useState<DeliveryGroup[]>([]);
  const [periods, setPeriods] = useState<OperationPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveringKey, setDeliveringKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const loadDeliveries = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [customersResult, periodsResult, salesResult] = await Promise.all([
        supabase.from("customers").select("id, full_name").order("full_name"),
        supabase
          .from("operation_periods")
          .select("id, name, start_date, end_date, status")
          .order("start_date", { ascending: false }),
        supabase
          .from("sales")
          .select(
            "id, folio, sale_date, status, customer_id, operation_period_id",
          )
          .not("operation_period_id", "is", null)
          .neq("status", "cancelled")
          .order("sale_date", { ascending: false }),
      ]);

      if (customersResult.error) throw customersResult.error;
      if (periodsResult.error) throw periodsResult.error;
      if (salesResult.error) throw salesResult.error;

      const customers = (customersResult.data ?? []) as Customer[];
      const nextPeriods = (periodsResult.data ?? []) as OperationPeriod[];
      const activeSales = ((salesResult.data ?? []) as Sale[]).filter(
        (sale) => sale.customer_id && sale.operation_period_id,
      );

      setPeriods(nextPeriods);

      if (activeSales.length === 0) {
        setGroups([]);
        return;
      }

      const saleIds = activeSales.map((sale) => sale.id);
      const { data: saleItemData, error: saleItemsError } = await supabase
        .from("sale_items")
        .select("id, sale_id, inventory_unit_id, released_at")
        .in("sale_id", saleIds)
        .is("released_at", null);

      if (saleItemsError) throw saleItemsError;

      const saleItems = (saleItemData ?? []) as SaleItem[];
      if (saleItems.length === 0) {
        setGroups([]);
        return;
      }

      const inventoryIds = [
        ...new Set(saleItems.map((item) => item.inventory_unit_id)),
      ];
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory_units")
        .select(
          `
          id,
          unit_number,
          status,
          purchase_items!inventory_units_purchase_item_id_fkey (
            product_name,
            brand,
            model,
            sku
          )
        `,
        )
        .in("id", inventoryIds);

      if (inventoryError) throw inventoryError;

      const saleById = new Map(activeSales.map((sale) => [sale.id, sale]));
      const customerById = new Map(
        customers.map((customer) => [customer.id, customer]),
      );
      const periodById = new Map(
        nextPeriods.map((period) => [period.id, period]),
      );
      const unitById = new Map(
        ((inventoryData ?? []) as unknown as InventoryUnit[]).map((unit) => [
          unit.id,
          unit,
        ]),
      );
      const grouped = new Map<string, DeliveryGroup>();

      for (const saleItem of saleItems) {
        const sale = saleById.get(saleItem.sale_id);
        const unit = unitById.get(saleItem.inventory_unit_id);
        if (!sale || !unit || !sale.customer_id || !sale.operation_period_id)
          continue;
        if (!["reserved", "sold"].includes(unit.status)) continue;

        const customer = customerById.get(sale.customer_id);
        const period = periodById.get(sale.operation_period_id);
        if (!customer || !period) continue;

        const key = `${customer.id}:${period.id}`;
        let group = grouped.get(key);

        if (!group) {
          group = {
            key,
            customerId: customer.id,
            customerName: customer.full_name,
            periodId: period.id,
            periodName: period.name,
            periodStatus: period.status,
            periodStart: period.start_date,
            periodEnd: period.end_date,
            items: [],
          };
          grouped.set(key, group);
        }

        const product = unit.purchase_items;
        group.items.push({
          id: saleItem.id,
          unitId: unit.id,
          unitNumber: unit.unit_number,
          unitStatus: unit.status,
          saleId: sale.id,
          folio: sale.folio,
          saleDate: sale.sale_date,
          productName: product?.product_name ?? "Producto sin nombre",
          brand: product?.brand ?? null,
          model: product?.model ?? null,
          sku: product?.sku ?? null,
        });
      }

      const nextGroups = [...grouped.values()]
        .filter((group) => group.items.length > 0)
        .map((group) => ({
          ...group,
          items: group.items.sort((a, b) =>
            a.productName.localeCompare(b.productName, "es"),
          ),
        }))
        .sort((a, b) => {
          const periodDifference = b.periodStart.localeCompare(a.periodStart);
          return (
            periodDifference ||
            a.customerName.localeCompare(b.customerName, "es")
          );
        });

      setGroups(nextGroups);
    } catch (err) {
      console.error("Error cargando entregas:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las entregas.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups.filter((group) => {
      if (periodFilter !== "all" && group.periodId !== periodFilter)
        return false;
      if (!query) return true;

      const groupText = [group.customerName, group.periodName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const itemText = group.items
        .map((item) =>
          [
            item.productName,
            item.brand,
            item.model,
            item.sku,
            item.folio,
            item.unitNumber,
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ")
        .toLowerCase();
      return groupText.includes(query) || itemText.includes(query);
    });
  }, [groups, periodFilter, search]);

  const pendingItemsCount = groups.reduce(
    (total, group) => total + group.items.length,
    0,
  );
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedGroups = filteredGroups.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );

  function toggleExpanded(groupKey: string) {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function changePage(nextPage: number) {
    setCurrentPage(Math.min(Math.max(1, nextPage), totalPages));
    setExpandedGroups(new Set());
  }

  async function handleDeliver(group: DeliveryGroup) {
    if (group.periodStatus === "finished") {
      setError("Este periodo ya está cerrado y no acepta nuevas entregas.");
      return;
    }

    const confirmed = window.confirm(
      `¿Confirmar la entrega de ${group.items.length} artículo(s) para ${group.customerName}?\n\nPeriodo: ${group.periodName}\nVentas involucradas: ${new Set(group.items.map((item) => item.saleId)).size}\n\nTodos los artículos pendientes de este cliente en el periodo se marcarán como entregados.`,
    );
    if (!confirmed) return;

    setDeliveringKey(group.key);
    setError("");
    setSuccess("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "deliver_customer_period_orders",
        {
          p_customer_id: group.customerId,
          p_operation_period_id: group.periodId,
          p_notes: `Entrega grupal registrada desde el módulo de Entregas. Cliente: ${group.customerName}. Periodo: ${group.periodName}.`,
        },
      );

      if (rpcError) throw rpcError;
      const result = data as DeliveryResult;
      if (!result?.success) throw new Error("Supabase no confirmó la entrega.");

      const closeMessage = result.period_finished
        ? " El periodo quedó cerrado porque ya no tiene artículos pendientes."
        : ` Quedan ${result.remaining_items_in_period} artículo(s) pendientes en el periodo.`;
      setSuccess(
        `Entrega registrada: ${result.items_delivered} artículo(s) de ${group.customerName} en ${group.periodName}, correspondientes a ${result.sales_affected} venta(s).${closeMessage}`,
      );
      await loadDeliveries(true);
    } catch (err) {
      console.error("Error registrando entrega:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo registrar la entrega.",
      );
    } finally {
      setDeliveringKey(null);
    }
  }

  const periodsWithPending = useMemo(() => {
    const ids = new Set(groups.map((group) => group.periodId));
    return periods.filter((period) => ids.has(period.id));
  }, [groups, periods]);

  return (
    <main className="min-h-screen bg-[#FDF9F7] px-4 py-6 text-[#0C304F] sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#CC6255]">
              <Truck size={17} /> OPERACIÓN
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Entregas
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C] sm:text-base">
              Reúne los artículos pendientes por cliente y periodo, incluso
              cuando pertenecen a distintas ventas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDeliveries(true)}
            disabled={loading || refreshing || deliveringKey !== null}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DDD4CD] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#F3F7FA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Actualizar
          </button>
        </header>

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        )}

        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard
            title="Entregas pendientes"
            value={String(groups.length)}
            description="Grupos de cliente y periodo"
            icon={<Users size={21} />}
          />
          <SummaryCard
            title="Artículos pendientes"
            value={String(pendingItemsCount)}
            description="Unidades reservadas o vendidas"
            icon={<PackageCheck size={21} />}
          />
        </section>

        <section className="mb-5 rounded-2xl border border-[#E5DCD5] bg-white p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
              />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                  setExpandedGroups(new Set());
                }}
                placeholder="Buscar cliente, producto o folio..."
                className="w-full rounded-xl border border-[#EFE7DE] bg-white py-3 pl-10 pr-4 text-sm text-[#0C304F] outline-none transition placeholder:text-[#78909C] focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10"
              />
            </div>
            <div className="relative">
              <CalendarDays
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
              />
              <select
                value={periodFilter}
                onChange={(event) => {
                  setPeriodFilter(event.target.value);
                  setCurrentPage(1);
                  setExpandedGroups(new Set());
                }}
                className="w-full appearance-none rounded-xl border border-[#EFE7DE] bg-white py-3 pl-10 pr-4 text-sm text-[#0C304F] outline-none transition focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10"
              >
                <option value="all">Todos los periodos con pendientes</option>
                {periodsWithPending.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-[#EFE7DE] bg-white text-sm text-[#78909C]">
              <LoaderCircle size={22} className="animate-spin" /> Cargando
              entregas pendientes...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5DCD5] bg-white px-5 py-14 text-center">
              <ClipboardCheck
                size={36}
                className="mx-auto mb-3 text-[#36709E]"
              />
              <h2 className="font-bold">No hay entregas pendientes</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#78909C]">
                Cuando existan artículos reservados o vendidos que todavía no se
                hayan entregado, aparecerán agrupados por cliente y periodo.
              </p>
            </div>
          ) : (
            <>
              {paginatedGroups.map((group) => {
                const salesCount = new Set(
                  group.items.map((item) => item.saleId),
                ).size;
                const isDelivering = deliveringKey === group.key;
                const isPeriodFinished = group.periodStatus === "finished";
                const isExpanded = expandedGroups.has(group.key);

                return (
                  <article
                    key={group.key}
                    className="overflow-hidden rounded-2xl border border-[#E5DCD5] bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(group.key)}
                      aria-expanded={isExpanded}
                      aria-controls={`delivery-details-${group.key}`}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#FDF9F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#36709E] sm:px-6"
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-2.5">
                        <span className="truncate text-base font-bold text-[#0C304F] sm:text-lg">
                          {group.customerName}
                        </span>
                        <span className="shrink-0 rounded-full bg-[#F3F7FA] px-2.5 py-1 text-xs font-semibold text-[#36709E]">
                          {group.items.length}{" "}
                          {group.items.length === 1 ? "artículo" : "artículos"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[#526B7A] sm:text-sm">
                        <span className="hidden sm:inline">
                          {isExpanded ? "Ocultar productos" : "Ver productos"}
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </span>
                    </button>

                    {isExpanded && (
                      <div
                        id={`delivery-details-${group.key}`}
                        className="border-t border-[#EFE7DE]"
                      >
                        <div className="flex flex-col gap-2 bg-[#FDF9F7] px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
                          <div>
                            <p className="font-semibold text-[#526B7A]">
                              {group.periodName}
                            </p>
                            <p className="mt-0.5 text-xs text-[#78909C]">
                              {dateFormat(group.periodStart)} –{" "}
                              {dateFormat(group.periodEnd)} · {salesCount}{" "}
                              {salesCount === 1 ? "venta" : "ventas"}
                            </p>
                          </div>
                          {isPeriodFinished && (
                            <span className="w-fit rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                              Periodo cerrado
                            </span>
                          )}
                        </div>

                        <div className="divide-y divide-[#F1EBE6]">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-[#0C304F]">
                                  {item.productName}
                                </p>
                                <p className="mt-0.5 text-xs text-[#78909C]">
                                  {[item.brand, item.model, item.sku]
                                    .filter(Boolean)
                                    .join(" · ") || "Sin detalles adicionales"}
                                  {` · Unidad #${item.unitNumber}`}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-lg bg-[#FDF9F7] px-2.5 py-1.5 font-medium text-[#526B7A]">
                                  {item.folio}
                                </span>
                                <span
                                  className={`rounded-lg px-2.5 py-1.5 font-semibold ${item.unitStatus === "reserved" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}
                                >
                                  {statusLabel[item.unitStatus] ??
                                    item.unitStatus}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col gap-2 border-t border-[#EFE7DE] p-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                          <button
                            type="button"
                            onClick={() => void handleDeliver(group)}
                            disabled={
                              deliveringKey !== null || isPeriodFinished
                            }
                            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0C304F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#17466B] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          >
                            {isDelivering ? (
                              <LoaderCircle
                                size={17}
                                className="animate-spin"
                              />
                            ) : (
                              <CheckCircle2 size={17} />
                            )}
                            {isDelivering
                              ? "Registrando entrega..."
                              : `Entregar ${group.items.length} ${group.items.length === 1 ? "artículo" : "artículos"}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}

              <div className="flex flex-col gap-3 rounded-2xl border border-[#E5DCD5] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-center text-xs text-[#78909C] sm:text-left">
                  Mostrando{" "}
                  <span className="font-semibold text-[#0C304F]">
                    {pageStart + 1}–
                    {Math.min(pageStart + PAGE_SIZE, filteredGroups.length)}
                  </span>{" "}
                  de{" "}
                  <span className="font-semibold text-[#0C304F]">
                    {filteredGroups.length}
                  </span>{" "}
                  grupos
                </p>
                <nav
                  aria-label="Paginación de entregas"
                  className="flex items-center justify-center gap-2"
                >
                  <button
                    type="button"
                    onClick={() => changePage(safeCurrentPage - 1)}
                    disabled={safeCurrentPage === 1}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E5DCD5] px-3 text-sm font-semibold text-[#526B7A] transition hover:bg-[#FDF9F7] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />{" "}
                    <span className="hidden sm:inline">Anterior</span>
                  </button>
                  <span className="min-w-20 text-center text-sm font-semibold tabular-nums text-[#0C304F]">
                    {safeCurrentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => changePage(safeCurrentPage + 1)}
                    disabled={safeCurrentPage === totalPages}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E5DCD5] px-3 text-sm font-semibold text-[#526B7A] transition hover:bg-[#FDF9F7] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="hidden sm:inline">Siguiente</span>{" "}
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            </>
          )}
        </section>

        <p className="mt-6 text-center text-xs leading-5 text-[#78909C]">
          La confirmación registra cada unidad, su movimiento de inventario y su
          evento de entrega. El periodo se cierra automáticamente cuando ya no
          tiene artículos pendientes.
        </p>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[#E5DCD5] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#78909C]">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-xs text-[#78909C]">{description}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3F7FA] text-[#36709E]">
          {icon}
        </div>
      </div>
    </article>
  );
}
