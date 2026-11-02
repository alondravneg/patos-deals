"use client";

import { createClient } from "@/app/lib/supabase";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

type Period = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  exchange_rate_id: string;
  usd_to_mxn: number;
};

type Store = {
  id: string;
  name: string;
  active: boolean;
};

type ProductRow = {
  rowId: string;
  product_name: string;
  brand: string;
  model: string;
  sku: string;
  size: string;
  color: string;
  quantity: string;
  unit_cost_usd: string;
};

const TAX_RATE = 0.0825;

const money = (value: number, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

function formatDate(date: string | null) {
  if (!date) return "Sin fecha de fin";

  const [year, month, day] = date.split("-").map(Number);

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function newProduct(): ProductRow {
  return {
    rowId: crypto.randomUUID(),
    product_name: "",
    brand: "",
    model: "",
    sku: "",
    size: "",
    color: "",
    quantity: "1",
    unit_cost_usd: "",
  };
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "Ocurrió un error inesperado.";
}

export default function ComprasPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  const [periodId, setPeriodId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([newProduct()]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [savingStore, setSavingStore] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const selectedPeriod = periods.find((period) => period.id === periodId);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [periodsResult, storesResult] = await Promise.all([
        supabase
          .from("operation_periods")
          .select("id, name, start_date, end_date, status")
          .order("start_date", { ascending: false }),

        supabase
          .from("stores")
          .select("id, name, active")
          .eq("active", true)
          .order("name", { ascending: true }),
      ]);

      if (periodsResult.error) throw periodsResult.error;
      if (storesResult.error) throw storesResult.error;

      const allPeriods = periodsResult.data ?? [];
      const activeStores = storesResult.data ?? [];

      const periodIds = allPeriods.map((period) => period.id);

      let rates: {
        id: string;
        operation_period_id: string;
        usd_to_mxn: number;
        rate_date: string;
        created_at: string;
      }[] = [];

      if (periodIds.length > 0) {
        const ratesResult = await supabase
          .from("exchange_rates")
          .select("id, operation_period_id, usd_to_mxn, rate_date, created_at")
          .in("operation_period_id", periodIds)
          .order("rate_date", { ascending: true })
          .order("created_at", { ascending: true });

        if (ratesResult.error) throw ratesResult.error;
        rates = ratesResult.data ?? [];
      }

      const mappedPeriods: Period[] = allPeriods
        .map((period) => {
          const rate = rates.find(
            (item) => item.operation_period_id === period.id,
          );

          if (!rate) return null;

          return {
            ...period,
            exchange_rate_id: rate.id,
            usd_to_mxn: Number(rate.usd_to_mxn),
          };
        })
        .filter((period): period is Period => period !== null)
        .filter((period) => period.status !== "closed");

      setPeriods(mappedPeriods);
      setStores(activeStores);

      setPeriodId((current) =>
        mappedPeriods.some((period) => period.id === current)
          ? current
          : (mappedPeriods[0]?.id ?? ""),
      );
    } catch (err) {
      setError(
        `No pudimos cargar los periodos y las tiendas. ${getErrorMessage(err)}`,
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const productTotals = useMemo(() => {
    const rows = products.map((product) => {
      const quantity = Number(product.quantity);
      const price = Number(product.unit_cost_usd);

      const validQuantity =
        product.quantity.trim() !== "" &&
        Number.isInteger(quantity) &&
        quantity > 0;

      const validPrice =
        product.unit_cost_usd.trim() !== "" &&
        Number.isFinite(price) &&
        price > 0;

      const valid = validQuantity && validPrice;

      const unitCostMxn =
        valid && selectedPeriod
          ? price * (1 + TAX_RATE) * selectedPeriod.usd_to_mxn
          : 0;

      const totalMxn = valid && unitCostMxn > 0 ? unitCostMxn * quantity : 0;

      return {
        rowId: product.rowId,
        valid,
        unitCostMxn,
        totalMxn,
        subtotalUsd: valid ? price * quantity : 0,
        taxUsd: valid ? price * quantity * TAX_RATE : 0,
      };
    });

    return {
      rows,
      subtotalUsd: rows.reduce((sum, row) => sum + row.subtotalUsd, 0),
      taxUsd: rows.reduce((sum, row) => sum + row.taxUsd, 0),
      totalMxn: rows.reduce((sum, row) => sum + row.totalMxn, 0),
    };
  }, [products, selectedPeriod]);

  function updateProduct(
    rowId: string,
    field: keyof Omit<ProductRow, "rowId">,
    value: string,
  ) {
    setProducts((current) =>
      current.map((product) =>
        product.rowId === rowId ? { ...product, [field]: value } : product,
      ),
    );
  }

  function addProduct() {
    setProducts((current) => [...current, newProduct()]);
  }

  function removeProduct(rowId: string) {
    setProducts((current) => {
      if (current.length === 1) return current;

      return current.filter((product) => product.rowId !== rowId);
    });
  }

  async function handleCreateStore() {
    const name = newStoreName.trim();

    if (!name) {
      setError("Escribe el nombre de la tienda.");
      return;
    }

    setSavingStore(true);
    setError("");
    setSuccess("");

    try {
      const existingStore = stores.find(
        (store) => store.name.toLowerCase() === name.toLowerCase(),
      );

      if (existingStore) {
        setStoreId(existingStore.id);
        setNewStoreName("");
        setShowStoreForm(false);
        setSuccess("La tienda ya existía y quedó seleccionada.");
        return;
      }
      console.log("Intentando guardar tienda:", name);

      const { data, error: insertError } = await supabase
        .from("stores")
        .insert({ name, active: true })
        .select("id, name, active")
        .single();

      console.log("Respuesta de Supabase:", {
        data,
        error: insertError,
      });

      if (insertError) throw insertError;

      setStores((current) =>
        [...current, data].sort((a, b) => a.name.localeCompare(b.name)),
      );

      setStoreId(data.id);
      setNewStoreName("");
      setShowStoreForm(false);
      setSuccess(`La tienda "${data.name}" se agregó correctamente.`);
    } catch (err) {
      setError(`No pudimos guardar la tienda. ${getErrorMessage(err)}`);
    } finally {
      setSavingStore(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!periodId || !selectedPeriod) {
      setError("Primero debes seleccionar un periodo con tipo de cambio.");
      return;
    }

    if (!storeId) {
      setError("Selecciona una tienda.");
      return;
    }

    if (products.some((product) => !product.product_name.trim())) {
      setError("Todos los productos deben tener nombre.");
      return;
    }

    if (
      products.some(
        (product) =>
          product.quantity.trim() === "" ||
          !Number.isInteger(Number(product.quantity)) ||
          Number(product.quantity) <= 0,
      )
    ) {
      setError("Cada producto debe tener una cantidad entera mayor que cero.");
      return;
    }

    if (
      products.some(
        (product) =>
          product.unit_cost_usd.trim() === "" ||
          !Number.isFinite(Number(product.unit_cost_usd)) ||
          Number(product.unit_cost_usd) <= 0,
      )
    ) {
      setError("Cada producto debe tener un precio en USD mayor que cero.");
      return;
    }

    setSaving(true);

    try {
      const items = products.map((product) => ({
        product_name: product.product_name.trim(),
        brand: product.brand.trim() || null,
        model: product.model.trim() || null,
        sku: product.sku.trim() || null,
        size: product.size.trim() || null,
        color: product.color.trim() || null,
        quantity: Number(product.quantity),
        unit_cost_usd: Number(product.unit_cost_usd),
      }));

      const { data, error: rpcError } = await supabase.rpc("create_purchase", {
        p_operation_period_id: periodId,
        p_store_id: storeId,
        p_items: items,
        p_notes: notes.trim() || null,
      });

      if (rpcError) throw rpcError;

      const result = data as {
        success: boolean;
        purchase_id: string;
        ticket_number: string;
        exchange_rate: number;
        purchase_date: string;
        items_count: number;
      };

      setSuccess(
        `¡Compra ${result.ticket_number} registrada correctamente! ` +
          `${result.items_count} producto(s). Total: ${money(productTotals.totalMxn)}.`,
      );

      setProducts([newProduct()]);
      setNotes("");

      await loadData();
    } catch (err) {
      setError(`No pudimos registrar la compra. ${getErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#CC6255]">
            Operación
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#0C304F] sm:text-4xl">
            Registrar compra
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C] sm:text-base">
            Registra un ticket completo, agrega sus productos y calcula
            automáticamente el costo de compra en pesos mexicanos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading || saving}
          className="rounded-xl border border-[#EFE7DE] bg-white px-4 py-2.5 text-sm font-semibold text-[#0C304F] transition hover:bg-[#FDF9F7] disabled:opacity-50"
        >
          {loading ? "Actualizando..." : "Actualizar datos"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {success}
        </div>
      )}

      {!loading && periods.length === 0 && (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">
            No hay periodos disponibles
          </h2>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            Crea un periodo en la sección Periodos y registra su tipo de cambio
            antes de registrar una compra.
          </p>
          <a
            href="/admin/periodos"
            className="mt-3 inline-flex rounded-lg bg-[#0C304F] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Ir a periodos
          </a>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-[#0C304F]">
              Datos de la compra
            </h2>
            <p className="mt-1 text-sm text-[#78909C]">
              Selecciona el periodo y la tienda del ticket.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="period"
                className="mb-2 block text-sm font-semibold text-[#0C304F]"
              >
                Periodo de operación *
              </label>

              <select
                id="period"
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
                disabled={loading || saving || periods.length === 0}
                required
                className="w-full rounded-xl border border-[#E4DDD6] bg-white px-3.5 py-3 text-sm text-[#0C304F] outline-none transition focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15 disabled:bg-gray-50"
              >
                <option value="">Selecciona un periodo</option>

                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} · {formatDate(period.start_date)}
                  </option>
                ))}
              </select>

              {selectedPeriod && (
                <p className="mt-2 text-xs leading-5 text-[#78909C]">
                  Inicio: {formatDate(selectedPeriod.start_date)}
                  {selectedPeriod.end_date
                    ? ` · Fin: ${formatDate(selectedPeriod.end_date)}`
                    : ""}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="store"
                className="mb-2 block text-sm font-semibold text-[#0C304F]"
              >
                Tienda *
              </label>

              <div className="flex gap-2">
                <select
                  id="store"
                  value={storeId}
                  onChange={(event) => setStoreId(event.target.value)}
                  disabled={loading || saving}
                  required
                  className="min-w-0 flex-1 rounded-xl border border-[#E4DDD6] bg-white px-3.5 py-3 text-sm text-[#0C304F] outline-none transition focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15 disabled:bg-gray-50"
                >
                  <option value="">Selecciona una tienda</option>

                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setShowStoreForm((current) => !current);
                  }}
                  disabled={saving || savingStore}
                  className="shrink-0 rounded-xl bg-[#0C304F] px-3.5 py-3 text-sm font-semibold text-white transition hover:bg-[#17466C] disabled:opacity-50"
                >
                  + Agregar
                </button>
              </div>

              {stores.length === 0 && (
                <p className="mt-2 text-xs text-[#78909C]">
                  Todavía no hay tiendas. Agrega la primera desde aquí.
                </p>
              )}
            </div>
          </div>

          {showStoreForm && (
            <div className="mt-5 rounded-xl border border-[#D9E5EC] bg-[#F7FAFC] p-4 sm:p-5">
              <h3 className="font-semibold text-[#0C304F]">
                Agregar nueva tienda
              </h3>

              <p className="mt-1 text-sm text-[#78909C]">
                Solo necesitas el nombre. Quedará disponible para futuras
                compras.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={newStoreName}
                  onChange={(event) => setNewStoreName(event.target.value)}
                  placeholder="Nombre de la tienda"
                  maxLength={120}
                  required
                  autoFocus
                  className="min-w-0 flex-1 rounded-xl border border-[#E4DDD6] bg-white px-3.5 py-3 text-sm text-[#0C304F] outline-none focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
                />

                <button
                  type="button"
                  onClick={handleCreateStore}
                  disabled={savingStore || !newStoreName.trim()}
                  className="rounded-xl bg-[#CC6255] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#B84F43] disabled:opacity-50"
                >
                  {savingStore ? "Guardando..." : "Guardar tienda"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowStoreForm(false);
                    setNewStoreName("");
                  }}
                  className="rounded-xl border border-[#E4DDD6] bg-white px-4 py-3 text-sm font-semibold text-[#0C304F] hover:bg-[#FDF9F7]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[#FDF9F7] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#78909C]">
                Tipo de cambio
              </p>
              <p className="mt-1 text-2xl font-bold text-[#0C304F]">
                {selectedPeriod
                  ? `${money(selectedPeriod.usd_to_mxn)} MXN`
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-[#78909C]">
                Por cada dólar estadounidense.
              </p>
            </div>

            <div className="rounded-xl bg-[#FDF9F7] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#78909C]">
                Fecha de compra
              </p>
              <p className="mt-1 text-2xl font-bold text-[#0C304F]">
                {selectedPeriod ? formatDate(selectedPeriod.start_date) : "—"}
              </p>
              <p className="mt-1 text-xs text-[#78909C]">
                Se toma del inicio del periodo.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="notes"
              className="mb-2 block text-sm font-semibold text-[#0C304F]"
            >
              Notas de la compra (opcional)
            </label>

            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Observaciones generales del ticket..."
              className="w-full resize-y rounded-xl border border-[#E4DDD6] px-3.5 py-3 text-sm text-[#0C304F] outline-none transition focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#EFE7DE] bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-[#EFE7DE] p-5 sm:flex-row sm:items-center sm:p-7">
            <div>
              <h2 className="text-xl font-bold text-[#0C304F]">
                Productos del ticket
              </h2>
              <p className="mt-1 text-sm text-[#78909C]">
                Captura los precios originales en USD. El sistema calculará los
                costos en MXN.
              </p>
            </div>

            <button
              type="button"
              onClick={addProduct}
              disabled={saving}
              className="rounded-xl border border-[#D9E5EC] bg-[#F7FAFC] px-4 py-2.5 text-sm font-semibold text-[#0C304F] transition hover:bg-[#EDF4F8] disabled:opacity-50"
            >
              + Agregar producto
            </button>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            {products.map((product, index) => {
              const totals = productTotals.rows.find(
                (row) => row.rowId === product.rowId,
              );

              return (
                <article
                  key={product.rowId}
                  className="rounded-xl border border-[#EFE7DE] p-4 sm:p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-[#0C304F]">
                      Producto {index + 1}
                    </h3>

                    <button
                      type="button"
                      onClick={() => removeProduct(product.rowId)}
                      disabled={products.length === 1 || saving}
                      className="text-sm font-medium text-[#CC6255] hover:underline disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Eliminar
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="mb-1.5 block text-sm font-medium text-[#0C304F]">
                        Nombre del producto *
                      </label>
                      <input
                        value={product.product_name}
                        onChange={(event) =>
                          updateProduct(
                            product.rowId,
                            "product_name",
                            event.target.value,
                          )
                        }
                        required
                        maxLength={200}
                        placeholder="Ej. Tenis modelo A"
                        className="w-full rounded-lg border border-[#E4DDD6] px-3 py-2.5 text-sm outline-none focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
                      />
                    </div>

                    {(
                      [
                        ["brand", "Marca", "Ej. Nike"],
                        ["model", "Modelo", "Ej. Air Max"],
                        ["sku", "SKU", "Código opcional"],
                        ["size", "Talla", "Ej. 8 US"],
                        ["color", "Color", "Ej. Negro"],
                      ] as const
                    ).map(([field, label, placeholder]) => (
                      <div key={field}>
                        <label className="mb-1.5 block text-sm font-medium text-[#0C304F]">
                          {label}
                        </label>
                        <input
                          value={product[field]}
                          onChange={(event) =>
                            updateProduct(
                              product.rowId,
                              field,
                              event.target.value,
                            )
                          }
                          maxLength={120}
                          placeholder={placeholder}
                          className="w-full rounded-lg border border-[#E4DDD6] px-3 py-2.5 text-sm outline-none focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
                        />
                      </div>
                    ))}

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#0C304F]">
                        Cantidad *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={product.quantity}
                        onChange={(event) =>
                          updateProduct(
                            product.rowId,
                            "quantity",
                            event.target.value,
                          )
                        }
                        required
                        className="w-full rounded-lg border border-[#E4DDD6] px-3 py-2.5 text-sm outline-none focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#0C304F]">
                        Precio unitario (USD) *
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={product.unit_cost_usd}
                        onChange={(event) =>
                          updateProduct(
                            product.rowId,
                            "unit_cost_usd",
                            event.target.value,
                          )
                        }
                        required
                        placeholder="0.00"
                        className="w-full rounded-lg border border-[#E4DDD6] px-3 py-2.5 text-sm outline-none focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#0C304F]">
                        Costo unitario (MXN)
                      </label>
                      <div className="rounded-lg bg-[#F7FAFC] px-3 py-2.5 text-sm font-semibold text-[#0C304F]">
                        {selectedPeriod && totals?.valid
                          ? money(totals.unitCostMxn)
                          : "—"}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[#0C304F]">
                        Total del producto (MXN)
                      </label>
                      <div className="rounded-lg bg-[#F7FAFC] px-3 py-2.5 text-sm font-bold text-[#0C304F]">
                        {selectedPeriod && totals?.valid
                          ? money(totals.totalMxn)
                          : "—"}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="border-t border-[#EFE7DE] bg-[#FDF9F7] p-5 sm:p-7">
            <div className="ml-auto max-w-md space-y-3">
              <div className="flex items-center justify-between gap-4 text-sm text-[#78909C]">
                <span>Subtotal de productos (USD)</span>
                <span className="font-medium text-[#0C304F]">
                  {money(productTotals.subtotalUsd, "USD")}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm text-[#78909C]">
                <span>Impuesto estimado (8.25 % USD)</span>
                <span className="font-medium text-[#0C304F]">
                  {money(productTotals.taxUsd, "USD")}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-[#E4DDD6] pt-3">
                <span className="font-semibold text-[#0C304F]">
                  Costo total de compra (MXN)
                </span>
                <span className="text-2xl font-bold text-[#CC6255]">
                  {money(productTotals.totalMxn)}
                </span>
              </div>

              <p className="text-xs leading-5 text-[#78909C]">
                El costo incluye el impuesto del 8.25 % y el tipo de cambio del
                periodo. Los gastos operativos se registrarán por separado.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setProducts([newProduct()]);
              setNotes("");
              setError("");
              setSuccess("");
            }}
            disabled={saving}
            className="rounded-xl border border-[#EFE7DE] bg-white px-5 py-3 text-sm font-semibold text-[#0C304F] transition hover:bg-[#FDF9F7] disabled:opacity-50"
          >
            Limpiar productos
          </button>

          <button
            type="submit"
            disabled={
              loading ||
              saving ||
              !periodId ||
              !storeId ||
              products.length === 0
            }
            className="rounded-xl bg-[#0C304F] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#17466C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando compra..." : "Guardar compra"}
          </button>
        </div>
      </form>
    </main>
  );
}
