"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  UnlockKeyhole,
  UserRound,
  RotateCcw,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

type PurchaseItem = {
  product_name: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  size: string | null;
  color: string | null;
  unit_cost_usd: number | string;
  unit_cost_mxn: number | string | null;
  exchange_rate: number | string;
  tax_rate: number | string;
  suggested_retail_price_mxn: number | string | null;
  wholesale_price_mxn: number | string | null;
};

type SaleRecord = {
  id: string;
  folio: string;
  sale_date: string;
  status: string;
};

type SaleItemRecord = {
  id: string;
  sale_id: string;
  sale_price_mxn: number | string;
  is_wholesale: boolean;
  sale_channel: string | null;
  released_at: string | null;
  release_reason: string | null;
  created_at: string;
  sales: SaleRecord | null;
};

type InventoryUnit = {
  id: string;
  unit_number: number;
  status: string;
  customer_id: string | null;
  retail_price_mxn: number | string | null;
  wholesale_price_mxn: number | string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  purchase_items: PurchaseItem;
  customers: { full_name: string } | null;
  sale_items: SaleItemRecord[];
};

type ReleaseResult = {
  success: boolean;
  folio: string;
  sale_cancelled: boolean;
  active_sale_items: number;
  unapplied_credit_mxn: number;
};

type UsageStatusResult = {
  success: boolean;
  product_name: string;
  unit_number: number;
  previous_status: string;
  new_status: string;
};

type StatusFilter =
  | "all"
  | "available"
  | "reserved"
  | "sold"
  | "delivered"
  | "personal_use"
  | "cancelled"
  | "returned";

const inputClass =
  "w-full rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm text-[#0C304F] outline-none transition placeholder:text-[#78909C] focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10";

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function usd(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

const statusLabels: Record<string, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
  delivered: "Entregado",
  personal_use: "Uso personal",
  cancelled: "Cancelado",
  returned: "Devuelto",
};

const statusClasses: Record<string, string> = {
  available: "bg-green-50 text-green-700",
  reserved: "bg-amber-50 text-amber-700",
  sold: "bg-blue-50 text-blue-700",
  delivered: "bg-slate-100 text-slate-700",
  personal_use: "bg-violet-50 text-violet-700",
  cancelled: "bg-red-50 text-red-700",
  returned: "bg-orange-50 text-orange-700",
};

export default function InventarioPage() {
  const supabase = useMemo(() => createClient(), []);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [changingUsageId, setChangingUsageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  const loadInventory = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const { data, error: queryError } = await supabase
          .from("inventory_units")
          .select(
            `
          id,
          unit_number,
          status,
          customer_id,
          retail_price_mxn,
          wholesale_price_mxn,
          notes,
          created_at,
          updated_at,
          purchase_items!inventory_units_purchase_item_id_fkey (
            product_name,
            brand,
            model,
            sku,
            size,
            color,
            unit_cost_usd,
            unit_cost_mxn,
            exchange_rate,
            tax_rate,
            suggested_retail_price_mxn,
            wholesale_price_mxn
          ),
          customers!inventory_units_customer_id_fkey (
            full_name
          ),
          sale_items (
            id,
            sale_id,
            sale_price_mxn,
            is_wholesale,
            sale_channel,
            released_at,
            release_reason,
            created_at,
            sales (
              id,
              folio,
              sale_date,
              status
            )
          )
        `,
          )
          .order("created_at", { ascending: false });

        if (queryError) throw queryError;
        setUnits((data ?? []) as unknown as InventoryUnit[]);
      } catch (err) {
        console.error("Error cargando Inventario:", err);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el inventario.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const counts = useMemo(
    () => ({
      total: units.length,
      available: units.filter((unit) => unit.status === "available").length,
      reserved: units.filter((unit) => unit.status === "reserved").length,
      personalUse: units.filter((unit) => unit.status === "personal_use")
        .length,
      sold: units.filter((unit) => ["sold", "delivered"].includes(unit.status))
        .length,
    }),
    [units],
  );

  const filteredUnits = useMemo(() => {
    const query = search.trim().toLowerCase();
    return units.filter((unit) => {
      if (statusFilter !== "all" && unit.status !== statusFilter) return false;
      const item = unit.purchase_items;
      const activeSaleItem = unit.sale_items
        ?.filter((saleItem) => !saleItem.released_at && saleItem.sales)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const haystack = [
        item?.product_name,
        item?.brand,
        item?.model,
        item?.sku,
        item?.size,
        item?.color,
        String(unit.unit_number),
        unit.customers?.full_name,
        activeSaleItem?.sales?.folio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [units, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart =
    filteredUnits.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const paginatedUnits = filteredUnits.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) setCurrentPage(safeCurrentPage);
  }, [currentPage, safeCurrentPage]);

  async function handleRelease(unit: InventoryUnit) {
    const activeSaleItem = unit.sale_items
      ?.filter((saleItem) => !saleItem.released_at && saleItem.sales)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

    if (unit.status !== "reserved" || !activeSaleItem?.sales) {
      setError("No se encontró una reserva activa para liberar esta unidad.");
      return;
    }

    const confirmed = window.confirm(
      `¿Liberar ${unit.purchase_items.product_name}, unidad #${unit.unit_number}, de la venta ${activeSaleItem.sales.folio}?\n\nLa unidad volverá a estar disponible, se quitará el cliente y se recalculará la deuda de la cuenta. El historial de la venta y los pagos se conservará.`,
    );
    if (!confirmed) return;

    setReleasingId(unit.id);
    setError("");
    setSuccess("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "release_inventory_unit",
        {
          p_inventory_unit_id: unit.id,
          p_reason: "Liberado desde el módulo de Inventario",
        },
      );
      if (rpcError) throw rpcError;

      const result = data as ReleaseResult;
      if (!result?.success)
        throw new Error("Supabase no confirmó la liberación.");

      const extra =
        Number(result.unapplied_credit_mxn ?? 0) > 0
          ? ` Se generó un saldo a favor de ${money(result.unapplied_credit_mxn)} para el cliente.`
          : "";
      const saleMessage = result.sale_cancelled
        ? ` La venta ${result.folio} quedó cancelada porque ya no conserva productos activos.`
        : ` La venta ${result.folio} conserva sus demás productos.`;
      setSuccess(
        `Unidad liberada correctamente. El inventario y las cuentas del cliente se actualizaron.${saleMessage}${extra}`,
      );
      await loadInventory(true);
    } catch (err) {
      console.error("Error liberando unidad:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo liberar la unidad.",
      );
    } finally {
      setReleasingId(null);
    }
  }

  async function handleUsageStatusChange(unit: InventoryUnit) {
    const targetStatus =
      unit.status === "available" ? "personal_use" : "available";
    const targetLabel =
      targetStatus === "personal_use" ? "Uso personal" : "Disponible";
    const actionText =
      targetStatus === "personal_use"
        ? "marcarse para uso personal"
        : "regresar a unidades disponibles";

    const confirmed = window.confirm(
      `¿Quieres ${actionText} ${unit.purchase_items.product_name}, unidad #${unit.unit_number}?\n\nNo se creará una venta ni se asignará un cliente. Se conservará el costo y se registrará el movimiento en el historial del inventario.`,
    );
    if (!confirmed) return;

    setChangingUsageId(unit.id);
    setError("");
    setSuccess("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "set_inventory_unit_usage_status",
        {
          p_inventory_unit_id: unit.id,
          p_target_status: targetStatus,
          p_reason:
            targetStatus === "personal_use"
              ? "Asignado a uso personal desde el módulo de Inventario"
              : "Regresado a disponibles desde el módulo de Inventario",
        },
      );
      if (rpcError) throw rpcError;

      const result = data as UsageStatusResult;
      if (!result?.success) {
        throw new Error("Supabase no confirmó el cambio de estado.");
      }

      setSuccess(
        `${result.product_name}, unidad #${result.unit_number}: ahora está en estado ${targetLabel}. No se creó ninguna venta ni se asignó un cliente.`,
      );
      await loadInventory(true);
    } catch (err) {
      console.error("Error actualizando el uso de la unidad:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cambiar el estado de la unidad.",
      );
    } finally {
      setChangingUsageId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#FDF9F7] p-4 text-[#0C304F] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#36709E]">
              <Package size={17} /> Operaciones / Inventario
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
            <p className="mt-2 text-sm text-[#78909C]">
              Consulta tus unidades, administra reservas y separa mercancía para
              uso personal sin crear ventas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadInventory(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm font-semibold transition hover:border-[#36709E]/40 disabled:opacity-60"
          >
            {refreshing ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <RefreshCw size={17} />
            )}
            Actualizar inventario
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Cerrar error"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1">{success}</p>
            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Cerrar confirmación"
            >
              ×
            </button>
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Unidades registradas",
              value: counts.total,
              tone: "text-[#0C304F]",
            },
            {
              label: "Disponibles",
              value: counts.available,
              tone: "text-green-700",
            },
            {
              label: "Reservadas",
              value: counts.reserved,
              tone: "text-amber-700",
            },
            {
              label: "Uso personal",
              value: counts.personalUse,
              tone: "text-violet-700",
            },
            {
              label: "Vendidas / entregadas",
              value: counts.sold,
              tone: "text-[#36709E]",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-[#EFE7DE] bg-white px-4 py-3"
            >
              <p className="text-xs text-[#78909C]">{card.label}</p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${card.tone}`}
              >
                {loading ? "—" : card.value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[#EFE7DE] bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-bold">Unidades de inventario</h2>
              <p className="mt-1 text-sm text-[#78909C]">
                Las compras generan unidades disponibles sin cliente. Puedes
                apartarlas para uso personal y regresarlas a disponibles cuando
                lo necesites.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative sm:w-72">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
                />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Buscar producto, cliente o folio..."
                  className={`${inputClass} py-2.5 pl-9`}
                />
              </div>
              <div className="relative sm:w-52">
                <Filter
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as StatusFilter);
                    setCurrentPage(1);
                  }}
                  className={`${inputClass} py-2.5 pl-9`}
                >
                  <option value="all">Todos los estados</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-[#78909C]">
              <LoaderCircle size={22} className="animate-spin" /> Cargando
              inventario...
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-12 text-center">
              <Package size={34} className="mx-auto mb-3 text-[#78909C]" />
              <p className="font-semibold">No encontramos unidades</p>
              <p className="mt-1 text-sm text-[#78909C]">
                Prueba con otro filtro o registra una compra para generar
                inventario.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#78909C]">
                <span>
                  Mostrando {pageStart + 1}–
                  {Math.min(pageStart + pageSize, filteredUnits.length)} de{" "}
                  {filteredUnits.length} unidades
                </span>
                <span>{pageSize} por página</span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {paginatedUnits.map((unit) => {
                  const item = unit.purchase_items;
                  const activeSaleItem = unit.sale_items
                    ?.filter(
                      (saleItem) => !saleItem.released_at && saleItem.sales,
                    )
                    .sort((a, b) =>
                      b.created_at.localeCompare(a.created_at),
                    )[0];
                  const retail =
                    unit.retail_price_mxn ?? item?.suggested_retail_price_mxn;
                  const wholesale =
                    unit.wholesale_price_mxn ?? item?.wholesale_price_mxn;
                  const canRelease =
                    unit.status === "reserved" &&
                    Boolean(activeSaleItem?.sales);
                  const actionDisabled =
                    releasingId !== null || changingUsageId !== null;

                  return (
                    <article
                      key={unit.id}
                      className="flex h-full min-w-0 flex-col rounded-xl border border-[#EFE7DE] bg-white p-3 transition hover:border-[#D8C9BA]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold leading-5">
                            {item?.product_name ?? "Producto sin nombre"}
                          </h3>
                          <p className="mt-0.5 truncate text-[11px] text-[#78909C]">
                            {[item?.brand, item?.model, item?.sku]
                              .filter(Boolean)
                              .join(" · ") || "Sin marca, modelo o SKU"}
                          </p>
                          <p className="mt-1 text-xs font-medium">
                            Unidad #{unit.unit_number}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${statusClasses[unit.status] ?? "bg-slate-100 text-slate-700"}`}
                        >
                          {statusLabels[unit.status] ?? unit.status}
                        </span>
                      </div>

                      {(item?.size || item?.color) && (
                        <p className="mt-1 text-[11px] text-[#78909C]">
                          {[
                            item?.size && `Talla ${item.size}`,
                            item?.color && `Color ${item.color}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-[#FDF9F7] px-2.5 py-2">
                          <p className="text-[10px] text-[#78909C]">
                            Costo original
                          </p>
                          <p className="mt-0.5 font-semibold">
                            {money(item?.unit_cost_mxn)}
                          </p>
                          <p className="text-[10px] text-[#78909C]">
                            {usd(item?.unit_cost_usd)} USD
                          </p>
                        </div>
                        <div className="rounded-lg bg-[#FDF9F7] px-2.5 py-2">
                          <p className="text-[10px] text-[#78909C]">Precios</p>
                          <p className="mt-0.5 truncate font-semibold">
                            Menudeo:{" "}
                            {retail == null ? "Sin precio" : money(retail)}
                          </p>
                          <p className="truncate text-[10px] text-[#78909C]">
                            Mayoreo:{" "}
                            {wholesale == null
                              ? "Sin precio"
                              : money(wholesale)}
                          </p>
                        </div>
                      </div>

                      {unit.status === "reserved" && (
                        <div className="mt-2 flex min-w-0 items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2 text-xs">
                          <UserRound size={14} className="shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-[#0C304F]">
                              {unit.customers?.full_name ??
                                "Cliente no disponible"}
                            </p>
                            {activeSaleItem?.sales ? (
                              <p className="truncate text-[10px] text-[#78909C]">
                                Venta {activeSaleItem.sales.folio} ·{" "}
                                {money(activeSaleItem.sale_price_mxn)}
                              </p>
                            ) : (
                              <p className="text-[10px] text-red-700">
                                Sin línea de venta activa; requiere revisión.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {(unit.status === "available" ||
                        unit.status === "personal_use") && (
                        <p className="mt-2 text-[10px] text-[#78909C]">
                          Sin cliente asignado ·{" "}
                          {unit.status === "available"
                            ? "Disponible para venta"
                            : "Apartado para uso personal"}
                        </p>
                      )}

                      <div className="mt-auto pt-2">
                        {canRelease && (
                          <button
                            type="button"
                            onClick={() => void handleRelease(unit)}
                            disabled={actionDisabled}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#CC6255]/40 px-2.5 py-2 text-xs font-semibold text-[#CC6255] transition hover:bg-[#CC6255] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {releasingId === unit.id ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <UnlockKeyhole size={14} />
                            )}
                            {releasingId === unit.id
                              ? "Liberando..."
                              : "Liberar producto"}
                          </button>
                        )}

                        {unit.status === "available" && (
                          <button
                            type="button"
                            onClick={() => void handleUsageStatusChange(unit)}
                            disabled={actionDisabled}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200 px-2.5 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {changingUsageId === unit.id ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <UserRound size={14} />
                            )}
                            {changingUsageId === unit.id
                              ? "Actualizando..."
                              : "Marcar uso personal"}
                          </button>
                        )}

                        {unit.status === "personal_use" && (
                          <button
                            type="button"
                            onClick={() => void handleUsageStatusChange(unit)}
                            disabled={actionDisabled}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-green-200 px-2.5 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {changingUsageId === unit.id ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <RotateCcw size={14} />
                            )}
                            {changingUsageId === unit.id
                              ? "Actualizando..."
                              : "Regresar a disponibles"}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <nav
                  aria-label="Paginación de inventario"
                  className="mt-5 flex flex-col gap-3 border-t border-[#EFE7DE] pt-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-xs text-[#78909C]">
                    Página {safeCurrentPage} de {totalPages}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((page) => Math.max(1, page - 1))
                      }
                      disabled={safeCurrentPage === 1}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#EFE7DE] px-3 py-2 text-xs font-semibold text-[#0C304F] transition hover:border-[#36709E] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={15} /> Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      disabled={safeCurrentPage === totalPages}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#EFE7DE] px-3 py-2 text-xs font-semibold text-[#0C304F] transition hover:border-[#36709E] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente <ChevronRight size={15} />
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section>

        <p className="mt-5 text-center text-xs text-[#78909C]">
          Las unidades disponibles no tienen cliente. Los cambios a uso personal
          se registran en el historial sin generar ventas ni cuentas por cobrar.
        </p>
      </div>
    </main>
  );
}
