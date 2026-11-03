"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabase";
import Link from "next/link";
import {
  CalendarDays,
  Plus,
  RefreshCw,
  CircleDollarSign,
  Clock3,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Truck,
} from "lucide-react";

type OperationPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type ExchangeRate = {
  id: string;
  operation_period_id: string;
  rate_date: string;
  usd_to_mxn: number;
};

type PeriodWithRate = OperationPeriod & {
  exchangeRate: number | null;
};

const supabase = createClient();

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);

const dateFormat = (value: string | null) => {
  if (!value) return "Sin fecha de cierre";

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
};

const statusInfo: Record<string, { label: string; className: string }> = {
  planning: {
    label: "En planeación",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  shopping: {
    label: "En compras",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  selling: {
    label: "Abierto",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  settling: {
    label: "En liquidación",
    className: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  finished: {
    label: "Cerrado",
    className: "bg-stone-100 text-stone-600 ring-stone-200",
  },
};

export default function PeriodosPage() {
  const [periods, setPeriods] = useState<PeriodWithRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [notes, setNotes] = useState("");

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [periodResult, rateResult] = await Promise.all([
        supabase
          .from("operation_periods")
          .select("id, name, start_date, end_date, status, notes, created_at")
          .order("start_date", { ascending: false }),
        supabase
          .from("exchange_rates")
          .select("id, operation_period_id, rate_date, usd_to_mxn")
          .order("rate_date", { ascending: false }),
      ]);

      if (periodResult.error) throw periodResult.error;
      if (rateResult.error) throw rateResult.error;

      const rates = (rateResult.data ?? []) as ExchangeRate[];

      const result: PeriodWithRate[] = (
        (periodResult.data ?? []) as OperationPeriod[]
      ).map((period) => {
        const rate = rates.find(
          (item) => item.operation_period_id === period.id,
        );

        return {
          ...period,
          exchangeRate: rate ? Number(rate.usd_to_mxn) : null,
        };
      });

      setPeriods(result);
    } catch (err) {
      console.error("Error cargando periodos:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible cargar los periodos.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  const resetForm = () => {
    setName("");
    setStartDate("");
    setEndDate("");
    setExchangeRate("");
    setNotes("");
    setError("");
    setShowForm(false);
  };

  const handleCreatePeriod = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const parsedRate = Number(exchangeRate);

    if (!name.trim()) {
      setError("Escribe el nombre del periodo.");
      return;
    }

    if (!startDate) {
      setError("Selecciona la fecha de inicio.");
      return;
    }

    if (endDate && endDate < startDate) {
      setError("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }

    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setError("Ingresa un tipo de cambio válido mayor que cero.");
      return;
    }

    setSaving(true);

    try {
      const { error: rpcError } = await supabase.rpc(
        "create_operation_period",
        {
          p_name: name.trim(),
          p_start_date: startDate,
          p_end_date: endDate || null,
          p_usd_to_mxn: parsedRate,
          p_notes: notes.trim() || null,
        },
      );

      if (rpcError) throw rpcError;

      resetForm();
      setSuccess("¡Periodo creado correctamente!");
      await loadPeriods();
    } catch (err: unknown) {
      console.error("Error creando periodo:", err);

      let message = "No fue posible crear el periodo.";

      if (err && typeof err === "object") {
        const supabaseError = err as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };

        console.error("Detalles del error:", {
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
          code: supabaseError.code,
        });

        message =
          [
            supabaseError.message,
            supabaseError.details,
            supabaseError.hint ? `Sugerencia: ${supabaseError.hint}` : null,
            supabaseError.code ? `Código: ${supabaseError.code}` : null,
          ]
            .filter(Boolean)
            .join(" | ") || message;
      } else if (typeof err === "string") {
        message = err;
      }

      setError(message);
    } finally {
      setSaving(false);
    }
  };
  const planningCount = periods.filter(
    (period) => period.status === "planning",
  ).length;

  const sellingCount = periods.filter(
    (period) => period.status === "selling",
  ).length;

  const finishedCount = periods.filter(
    (period) => period.status === "finished",
  ).length;

  return (
    <main className="min-h-screen bg-[#FDF9F7] px-4 py-6 text-[#0C304F] sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Encabezado */}
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#CC6255]">
              <CalendarDays size={17} />
              OPERACIÓN
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Periodos de operación
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C] sm:text-base">
              Organiza tus fines de semana de compras, registra el tipo de
              cambio y mantén separados los costos de cada operación.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/entregas"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#DDD4CD] bg-white px-5 py-3 text-sm font-semibold text-[#0C304F] transition hover:bg-[#F3F7FA]"
            >
              <Truck size={18} />
              Entregas
            </Link>
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setShowForm(true);
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0C304F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#17466B]"
            >
              <Plus size={19} />
              Nuevo periodo
            </button>
          </div>
        </header>

        {/* Mensajes */}
        {success && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 size={20} className="shrink-0" />
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess("")}
              className="ml-auto"
              aria-label="Cerrar mensaje"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {error && !showForm && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {/* Indicadores */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            title="En planeación"
            value={String(planningCount)}
            description="Periodos por preparar"
            icon={<Clock3 size={21} />}
          />

          <SummaryCard
            title="Abiertos"
            value={String(sellingCount)}
            description="Periodos con ventas"
            icon={<CalendarDays size={21} />}
          />

          <SummaryCard
            title="Cerrados"
            value={String(finishedCount)}
            description="Periodos con entregas completas"
            icon={<CheckCircle2 size={21} />}
          />
        </section>

        {/* Formulario */}
        {showForm && (
          <section className="mb-8 overflow-hidden rounded-2xl border border-[#E5DCD5] bg-white shadow-sm">
            <div className="flex items-start justify-between gap-4 border-b border-[#EFE7DE] px-5 py-5 sm:px-7">
              <div>
                <h2 className="text-xl font-bold">Crear nuevo periodo</h2>
                <p className="mt-1 text-sm text-[#78909C]">
                  Configura las fechas y el tipo de cambio inicial.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg p-2 text-[#78909C] transition hover:bg-[#FDF9F7] hover:text-[#0C304F]"
                aria-label="Cerrar formulario"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="p-5 sm:p-7">
              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertCircle size={19} className="mt-0.5 shrink-0" />
                  <span className="break-words">{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label
                    htmlFor="period-name"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Nombre del periodo *
                  </label>

                  <input
                    id="period-name"
                    type="text"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ej. Compras del 7 y 8 de noviembre"
                    className="w-full rounded-xl border border-[#DDD4CD] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#A6B0B5] focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="period-start"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Fecha de inicio *
                  </label>

                  <input
                    id="period-start"
                    type="date"
                    required
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-xl border border-[#DDD4CD] bg-white px-4 py-3 text-sm outline-none focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="period-end"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Fecha de fin
                  </label>

                  <input
                    id="period-end"
                    type="date"
                    min={startDate || undefined}
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-xl border border-[#DDD4CD] bg-white px-4 py-3 text-sm outline-none focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
                  />

                  <p className="mt-1.5 text-xs text-[#78909C]">
                    Puedes dejarla vacía si aún no defines el cierre.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="exchange-rate"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Tipo de cambio USD → MXN *
                  </label>

                  <div className="relative">
                    <CircleDollarSign
                      size={19}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#36709E]"
                    />

                    <input
                      id="exchange-rate"
                      type="number"
                      required
                      min="0.000001"
                      step="0.000001"
                      value={exchangeRate}
                      onChange={(event) => setExchangeRate(event.target.value)}
                      placeholder="Ej. 18.50"
                      className="w-full rounded-xl border border-[#DDD4CD] bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#A6B0B5] focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
                    />
                  </div>

                  <p className="mt-2 text-xs leading-5 text-[#78909C]">
                    Esta tasa se registrará como la tasa inicial del periodo.
                    Las compras de este periodo utilizarán su tasa
                    correspondiente.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="period-notes"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Notas{" "}
                    <span className="font-normal text-[#78909C]">
                      (opcional)
                    </span>
                  </label>

                  <textarea
                    id="period-notes"
                    rows={3}
                    maxLength={1000}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Información adicional sobre este periodo..."
                    className="w-full resize-y rounded-xl border border-[#DDD4CD] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#A6B0B5] focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/15"
                  />
                </div>
              </div>

              {/* Resumen de costo */}
              {exchangeRate && Number(exchangeRate) > 0 && (
                <div className="mt-6 rounded-xl border border-[#DCE7F0] bg-[#F3F7FA] p-4 sm:p-5">
                  <p className="text-sm font-semibold text-[#0C304F]">
                    Vista previa del costo de compra
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#78909C]">
                    Con este tipo de cambio, un producto de USD $100 tendría el
                    siguiente costo estimado, incluyendo el impuesto fijo del
                    8.25 %:
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-lg bg-white px-3 py-2 text-[#78909C]">
                      USD $100
                    </span>
                    <ArrowRight size={16} className="text-[#36709E]" />
                    <span className="rounded-lg bg-white px-3 py-2 font-semibold text-[#0C304F]">
                      {money(100 * 1.0825 * Number(exchangeRate))}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-[#78909C]">
                    Fórmula: precio USD × 1.0825 × tipo de cambio.
                  </p>
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#EFE7DE] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border border-[#DDD4CD] px-5 py-3 text-sm font-semibold transition hover:bg-[#FDF9F7] disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#CC6255] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#B94F43] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Crear periodo
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Tabla de periodos */}
        <section className="overflow-hidden rounded-2xl border border-[#E5DCD5] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#EFE7DE] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-bold">Historial de periodos</h2>
              <p className="mt-1 text-sm text-[#78909C]">
                Consulta las fechas, estados y tasas registradas.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadPeriods()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-[#DDD4CD] px-3 py-2 text-sm font-medium transition hover:bg-[#FDF9F7] disabled:opacity-50 sm:self-auto"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-[#78909C]">
              <RefreshCw size={20} className="animate-spin" />
              Cargando periodos...
            </div>
          ) : periods.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3F7FA] text-[#36709E]">
                <CalendarDays size={27} />
              </div>

              <h3 className="text-base font-bold">
                Todavía no tienes periodos
              </h3>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#78909C]">
                Crea tu primer periodo para registrar las compras de un fin de
                semana y establecer el tipo de cambio correspondiente.
              </p>

              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0C304F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17466B]"
              >
                <Plus size={18} />
                Crear primer periodo
              </button>
            </div>
          ) : (
            <>
              {/* Vista móvil */}
              <div className="divide-y divide-[#EFE7DE] md:hidden">
                {periods.map((period) => {
                  const status = statusInfo[period.status] ?? {
                    label: period.status,
                    className: "bg-stone-100 text-stone-600 ring-stone-200",
                  };

                  return (
                    <article key={period.id} className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold leading-5">{period.name}</h3>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="text-sm text-[#78909C]">
                        <p>
                          <span className="font-medium text-[#0C304F]">
                            Inicio:
                          </span>{" "}
                          {dateFormat(period.start_date)}
                        </p>
                        <p className="mt-1">
                          <span className="font-medium text-[#0C304F]">
                            Fin:
                          </span>{" "}
                          {dateFormat(period.end_date)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between rounded-xl bg-[#F3F7FA] p-3">
                        <span className="text-xs font-medium text-[#78909C]">
                          Tipo de cambio
                        </span>
                        <span className="font-bold text-[#0C304F]">
                          {period.exchangeRate !== null
                            ? `${period.exchangeRate.toLocaleString("es-MX", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })} MXN`
                            : "Sin registrar"}
                        </span>
                      </div>

                      {period.notes && (
                        <p className="text-sm leading-5 text-[#78909C]">
                          {period.notes}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Vista escritorio */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#FDF9F7] text-xs uppercase tracking-wide text-[#78909C]">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Periodo</th>
                      <th className="px-6 py-4 font-semibold">Inicio</th>
                      <th className="px-6 py-4 font-semibold">Fin</th>
                      <th className="px-6 py-4 font-semibold">
                        Tipo de cambio
                      </th>
                      <th className="px-6 py-4 font-semibold">Estado</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#EFE7DE]">
                    {periods.map((period) => {
                      const status = statusInfo[period.status] ?? {
                        label: period.status,
                        className: "bg-stone-100 text-stone-600 ring-stone-200",
                      };

                      return (
                        <tr
                          key={period.id}
                          className="transition hover:bg-[#FDF9F7]/70"
                        >
                          <td className="max-w-xs px-6 py-5">
                            <p className="font-semibold text-[#0C304F]">
                              {period.name}
                            </p>

                            {period.notes && (
                              <p className="mt-1 truncate text-xs text-[#78909C]">
                                {period.notes}
                              </p>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-[#526B7A]">
                            {dateFormat(period.start_date)}
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-[#526B7A]">
                            {dateFormat(period.end_date)}
                          </td>

                          <td className="whitespace-nowrap px-6 py-5">
                            {period.exchangeRate !== null ? (
                              <span className="font-semibold text-[#0C304F]">
                                {period.exchangeRate.toLocaleString("es-MX", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 6,
                                })}{" "}
                                MXN
                              </span>
                            ) : (
                              <span className="text-xs text-[#78909C]">
                                Sin registrar
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-6 py-5">
                            <span
                              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-[#EFE7DE] px-5 py-4 text-xs text-[#78909C] sm:px-6">
                {periods.length}{" "}
                {periods.length === 1
                  ? "periodo registrado"
                  : "periodos registrados"}
              </div>
            </>
          )}
        </section>

        {/* Nota de operación */}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#E5DCD5] bg-white p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8E9E5] text-[#CC6255]">
            <CircleDollarSign size={21} />
          </div>

          <div>
            <h3 className="text-sm font-bold">
              ¿Cómo se calculará el costo de los productos?
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#78909C]">
              Precio en USD × 1.0825 × tipo de cambio del periodo. Los gastos
              operativos se registrarán por separado y se incluirán en el
              reporte de cierre, no en el costo individual del producto.
            </p>
          </div>
        </div>
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
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[#E5DCD5] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#78909C]">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-[#78909C]">{description}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3F7FA] text-[#36709E]">
          {icon}
        </div>
      </div>
    </article>
  );
}
