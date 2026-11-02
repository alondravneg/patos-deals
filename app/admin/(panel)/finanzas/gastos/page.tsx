"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Filter,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Tags,
  X,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

type Period = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  usd_to_mxn: number | null;
};

type Category = {
  id: string;
  name: string;
  active: boolean;
};

type Expense = {
  id: string;
  operation_period_id: string;
  category_id: string;
  description: string;
  expense_date: string;
  amount: number | string;
  currency: "MXN" | "USD";
  exchange_rate: number | string | null;
  amount_mxn: number | string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
};

const inputClass =
  "w-full rounded-xl border border-[#EFE7DE] bg-white px-3.5 py-3 text-sm text-[#0C304F] outline-none transition placeholder:text-[#9AAEB9] focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10 disabled:cursor-not-allowed disabled:bg-[#FDF9F7] disabled:text-[#9AAEB9]";

const labelClass = "mb-1.5 block text-sm font-semibold text-[#0C304F]";

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function moneyUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function localDateValue() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function expenseAmountMxn(expense: Expense) {
  if (expense.amount_mxn !== null && expense.amount_mxn !== undefined) {
    return Number(expense.amount_mxn);
  }

  const amount = Number(expense.amount);

  if (expense.currency === "MXN") {
    return amount;
  }

  return amount * Number(expense.exchange_rate ?? 0);
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    const message = typeof record.message === "string" ? record.message : "";

    const code =
      typeof record.code === "string" ? `Código: ${record.code}` : "";

    const details = typeof record.details === "string" ? record.details : "";

    const hint =
      typeof record.hint === "string" ? `Sugerencia: ${record.hint}` : "";

    const parts = [message, code, details, hint].filter(Boolean);

    if (parts.length) {
      return parts.join(" · ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Supabase devolvió un error que no se pudo interpretar.";
    }
  }

  return typeof error === "string" ? error : "Ocurrió un error inesperado.";
}

export default function GastosOperativosPage() {
  const supabase = useMemo(() => createClient(), []);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [periodId, setPeriodId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(localDateValue);
  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // --------------------------------------------------
  // CARGAR PERIODOS, TIPOS DE CAMBIO, CATEGORÍAS Y GASTOS
  // --------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [periodsResult, categoriesResult, expensesResult] =
        await Promise.all([
          supabase
            .from("operation_periods")
            .select("id, name, start_date, end_date, status")
            .order("start_date", { ascending: false }),

          supabase
            .from("expense_categories")
            .select("id, name, active")
            .order("name", { ascending: true }),

          supabase
            .from("expenses")
            .select(
              "id, operation_period_id, category_id, description, expense_date, amount, currency, exchange_rate, amount_mxn, notes, created_at, updated_at",
            )
            .order("expense_date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

      const failed = [periodsResult, categoriesResult, expensesResult].find(
        (result) => result.error,
      );

      if (failed?.error) {
        throw failed.error;
      }

      const rawPeriods = periodsResult.data ?? [];
      const periodIds = rawPeriods.map((period) => period.id);

      let rates: Array<{
        id: string;
        operation_period_id: string;
        usd_to_mxn: number | string;
        rate_date: string;
        created_at: string;
      }> = [];

      // Consultar los tipos de cambio registrados por periodo.
      if (periodIds.length > 0) {
        const ratesResult = await supabase
          .from("exchange_rates")
          .select("id, operation_period_id, usd_to_mxn, rate_date, created_at")
          .in("operation_period_id", periodIds)
          .order("rate_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (ratesResult.error) {
          throw ratesResult.error;
        }

        rates = ratesResult.data ?? [];
      }

      // Cada periodo utiliza su tipo de cambio más reciente.
      const nextPeriods: Period[] = rawPeriods.map((period) => {
        const rate = rates.find(
          (item) => item.operation_period_id === period.id,
        );

        return {
          ...period,
          usd_to_mxn: rate ? Number(rate.usd_to_mxn) : null,
        };
      });

      const nextCategories = (categoriesResult.data ?? []) as Category[];

      setPeriods(nextPeriods);
      setCategories(nextCategories);
      setExpenses((expensesResult.data ?? []) as Expense[]);

      setPeriodId((current) =>
        current && nextPeriods.some((period) => period.id === current)
          ? current
          : (nextPeriods[0]?.id ?? ""),
      );

      setCategoryId((current) =>
        current &&
        nextCategories.some(
          (category) => category.id === current && category.active,
        )
          ? current
          : (nextCategories.find((category) => category.active)?.id ?? ""),
      );
    } catch (err) {
      console.error("Error cargando gastos operativos:", err);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // --------------------------------------------------
  // DATOS DERIVADOS
  // --------------------------------------------------

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );

  const periodById = useMemo(
    () => new Map(periods.map((period) => [period.id, period])),
    [periods],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  // Periodo seleccionado y tipo de cambio automático.
  const selectedPeriod =
    periods.find((period) => period.id === periodId) ?? null;

  const periodExchangeRate = Number(selectedPeriod?.usd_to_mxn ?? 0);

  const amountNumber = Number(amount || 0);

  const validAmount = Number.isFinite(amountNumber) && amountNumber > 0;

  const validExchangeRate =
    currency === "MXN" ||
    (Number.isFinite(periodExchangeRate) && periodExchangeRate > 0);

  // No se agregan impuestos: el importe capturado ya es el total final.
  const amountMxnPreview =
    currency === "MXN" ? amountNumber : amountNumber * periodExchangeRate;

  // --------------------------------------------------
  // FILTROS E INDICADORES
  // --------------------------------------------------

  const visibleExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const categoryName = categoryById.get(expense.category_id)?.name ?? "";

      const periodName =
        periodById.get(expense.operation_period_id)?.name ?? "";

      const matchesSearch =
        !term ||
        `${expense.description} ${
          expense.notes ?? ""
        } ${categoryName} ${periodName}`
          .toLowerCase()
          .includes(term);

      const matchesPeriod =
        periodFilter === "all" || expense.operation_period_id === periodFilter;

      const matchesCategory =
        categoryFilter === "all" || expense.category_id === categoryFilter;

      return matchesSearch && matchesPeriod && matchesCategory;
    });
  }, [
    expenses,
    search,
    periodFilter,
    categoryFilter,
    categoryById,
    periodById,
  ]);

  const totalMxn = visibleExpenses.reduce(
    (sum, expense) => sum + expenseAmountMxn(expense),
    0,
  );

  const totalUsdOriginal = visibleExpenses
    .filter((expense) => expense.currency === "USD")
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  // --------------------------------------------------
  // CREAR CATEGORÍA
  // --------------------------------------------------

  async function handleCreateCategory() {
    setError("");
    setSuccess("");

    const name = newCategoryName.trim();

    if (!name) {
      setError("Escribe el nombre de la categoría.");
      return;
    }

    if (
      categories.some(
        (category) => category.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("Esa categoría ya existe.");
      return;
    }

    setSavingCategory(true);

    try {
      const { data, error: insertError } = await supabase
        .from("expense_categories")
        .insert({
          name,
          active: true,
        })
        .select("id, name, active")
        .single();

      if (insertError) {
        throw insertError;
      }

      const category = data as Category;

      setCategories((current) =>
        [...current, category].sort((a, b) => a.name.localeCompare(b.name)),
      );

      setCategoryId(category.id);
      setNewCategoryName("");
      setShowCategoryForm(false);

      setSuccess(`Categoría “${category.name}” creada correctamente.`);
    } catch (err) {
      console.error("Error creando categoría:", err);
      setError(errorMessage(err));
    } finally {
      setSavingCategory(false);
    }
  }

  // --------------------------------------------------
  // REGISTRAR GASTO
  // --------------------------------------------------

  async function handleCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!periodId) {
      setError("Selecciona un periodo de operación.");
      return;
    }

    if (!categoryId) {
      setError("Selecciona una categoría.");
      return;
    }

    if (!description.trim()) {
      setError("Escribe una descripción para el gasto.");
      return;
    }

    if (!validAmount) {
      setError("El importe debe ser mayor que cero.");
      return;
    }

    if (!validExchangeRate) {
      setError(
        "El periodo seleccionado no tiene un tipo de cambio USD/MXN registrado. Configúralo en Periodos antes de registrar un gasto en dólares.",
      );
      return;
    }

    // MXN no requiere conversión.
    // USD utiliza el tipo de cambio del periodo seleccionado.
    const rate = currency === "USD" ? periodExchangeRate : null;

    const mxn = currency === "MXN" ? amountNumber : amountNumber * Number(rate);

    if (!Number.isFinite(mxn) || mxn <= 0) {
      setError("No se pudo calcular el importe equivalente en MXN.");
      return;
    }

    setSaving(true);

    try {
      // Obtener el usuario responsable del registro.
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      }

      const { error: insertError } = await supabase.from("expenses").insert({
        operation_period_id: periodId,
        category_id: categoryId,
        description: description.trim(),
        expense_date: expenseDate,
        amount: Number(amountNumber.toFixed(2)),
        currency,

        // amount_mxn es una columna GENERATED.
        // PostgreSQL calcula su valor automáticamente.
        // No debe enviarse en el INSERT.

        exchange_rate: rate === null ? null : Number(rate.toFixed(6)),

        notes: notes.trim() || null,
        created_by: authData.user.id,
      });

      if (insertError) {
        throw insertError;
      }

      setSuccess(`Gasto registrado correctamente por ${money(mxn)}.`);

      setDescription("");
      setAmount("");
      setCurrency("MXN");
      setExpenseDate(localDateValue());
      setNotes("");

      await loadData();
    } catch (err) {
      console.warn("No se pudo registrar el gasto:", {
        message: errorMessage(err),
      });

      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // INTERFAZ
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-[#FDF9F7] p-4 text-[#0C304F] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        {/* Encabezado */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/admin/finanzas"
              className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-[#36709E] transition hover:text-[#0C304F]"
            >
              <ArrowLeft size={16} />
              Volver a Finanzas
            </Link>

            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-[#36709E]">
              <ReceiptText size={17} />
              Operaciones / Finanzas / Gastos
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Gastos operativos
            </h1>

            <p className="mt-2 text-sm text-[#78909C]">
              Registra y consulta los gastos asociados a cada periodo de
              operación.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm font-semibold transition hover:border-[#36709E] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Actualizar gastos
          </button>
        </header>

        {/* Mensajes */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <X size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Indicadores */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <p className="text-sm font-medium text-[#78909C]">
              Gastos en la vista actual
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight">
              {money(totalMxn)}
            </p>

            <p className="mt-1 text-xs text-[#78909C]">
              Importe convertido a MXN
            </p>
          </article>

          <article className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <p className="text-sm font-medium text-[#78909C]">Registros</p>

            <p className="mt-3 text-3xl font-bold tracking-tight">
              {visibleExpenses.length}
            </p>

            <p className="mt-1 text-xs text-[#78909C]">Gastos encontrados</p>
          </article>

          <article className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <p className="text-sm font-medium text-[#78909C]">
              Importe original en USD
            </p>

            <p className="mt-3 text-3xl font-bold tracking-tight">
              {moneyUSD(totalUsdOriginal)}
            </p>

            <p className="mt-1 text-xs text-[#78909C]">Antes de conversión</p>
          </article>
        </section>

        {/* Categorías */}
        <section className="rounded-2xl border border-[#EFE7DE] bg-white p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#36709E]/10 p-2.5 text-[#36709E]">
                <Tags size={20} />
              </div>

              <div>
                <h2 className="font-bold">Categorías de gastos</h2>

                <p className="text-sm text-[#78909C]">
                  {activeCategories.length} categoría(s) activa(s)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCategoryForm((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#EFE7DE] px-4 py-2.5 text-sm font-semibold text-[#36709E] transition hover:border-[#36709E]"
            >
              <Plus size={16} />
              Nueva categoría
            </button>
          </div>

          {showCategoryForm && (
            <div className="mt-4 flex flex-col gap-2 rounded-xl bg-[#FDF9F7] p-4 sm:flex-row">
              <input
                className={inputClass}
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Ej. Gasolina, hospedaje, estacionamiento"
                maxLength={80}
              />

              <button
                type="button"
                onClick={() => void handleCreateCategory()}
                disabled={savingCategory}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0C304F] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus size={16} />
                {savingCategory ? "Guardando..." : "Agregar categoría"}
              </button>
            </div>
          )}
        </section>

        {/* Formulario de gastos */}
        <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-[#E2732D]/10 p-2.5 text-[#E2732D]">
              <CircleDollarSign size={21} />
            </div>

            <div>
              <h2 className="font-bold">Registrar gasto</h2>

              <p className="text-sm text-[#78909C]">
                Cada gasto debe pertenecer a un periodo y una categoría.
              </p>
            </div>
          </div>

          {periods.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No hay periodos de operación registrados. Crea primero un periodo
              para poder asociar gastos.
            </div>
          ) : activeCategories.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Primero crea una categoría de gasto para habilitar el registro.
            </div>
          ) : (
            <form onSubmit={handleCreateExpense} className="space-y-5">
              {/* Periodo y categoría */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="expense-period">
                    Periodo de operación *
                  </label>

                  <select
                    id="expense-period"
                    className={inputClass}
                    value={periodId}
                    onChange={(event) => setPeriodId(event.target.value)}
                    required
                  >
                    <option value="">Selecciona un periodo</option>

                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name} · {period.status}
                      </option>
                    ))}
                  </select>

                  {currency === "USD" && periodId && !validExchangeRate && (
                    <p className="mt-1.5 text-xs text-[#CC6255]">
                      Registra primero el tipo de cambio USD/MXN en este
                      periodo.
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass} htmlFor="expense-category">
                    Categoría *
                  </label>

                  <select
                    id="expense-category"
                    className={inputClass}
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    required
                  >
                    <option value="">Selecciona una categoría</option>

                    {activeCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className={labelClass} htmlFor="expense-description">
                  Descripción *
                </label>

                <input
                  id="expense-description"
                  className={inputClass}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ej. Gasolina para traslado a McAllen"
                  maxLength={180}
                  required
                />
              </div>

              {/* Fecha, moneda e importe */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={labelClass} htmlFor="expense-date">
                    Fecha del gasto *
                  </label>

                  <input
                    id="expense-date"
                    type="date"
                    className={inputClass}
                    value={expenseDate}
                    onChange={(event) => setExpenseDate(event.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="expense-currency">
                    Moneda *
                  </label>

                  <select
                    id="expense-currency"
                    className={inputClass}
                    value={currency}
                    onChange={(event) =>
                      setCurrency(event.target.value as "MXN" | "USD")
                    }
                  >
                    <option value="MXN">MXN · Pesos mexicanos</option>

                    <option value="USD">USD · Dólares</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="expense-amount">
                    Importe ({currency}) *
                  </label>

                  <input
                    id="expense-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    className={inputClass}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    required
                  />

                  <p className="mt-1.5 text-xs text-[#78909C]">
                    Captura el total final, incluyendo taxes. No se agregan
                    impuestos adicionales.
                  </p>
                </div>
              </div>

              {/* Tipo de cambio y conversión automática */}
              {currency === "USD" && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[#EFE7DE] bg-[#FDF9F7] p-4">
                    <p className="text-xs font-medium text-[#78909C]">
                      Tipo de cambio del periodo
                    </p>

                    {validExchangeRate ? (
                      <p className="mt-1 text-xl font-bold text-[#0C304F]">
                        {periodExchangeRate.toLocaleString("es-MX", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        })}{" "}
                        MXN/USD
                      </p>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-[#CC6255]">
                        Este periodo no tiene tipo de cambio registrado.
                      </p>
                    )}

                    <p className="mt-1 text-xs text-[#78909C]">
                      Se toma automáticamente del periodo seleccionado.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#EFE7DE] bg-[#FDF9F7] p-4">
                    <p className="text-xs font-medium text-[#78909C]">
                      Equivalente estimado en MXN
                    </p>

                    <p className="mt-1 text-xl font-bold text-[#0C304F]">
                      {money(
                        Number.isFinite(amountMxnPreview)
                          ? amountMxnPreview
                          : 0,
                      )}
                    </p>
                  </div>
                </div>
              )}

              {currency === "MXN" && (
                <div className="rounded-xl border border-[#EFE7DE] bg-[#FDF9F7] p-4">
                  <p className="text-xs font-medium text-[#78909C]">
                    Importe que se registrará en MXN
                  </p>

                  <p className="mt-1 text-lg font-bold text-[#0C304F]">
                    {money(
                      Number.isFinite(amountMxnPreview) ? amountMxnPreview : 0,
                    )}
                  </p>
                </div>
              )}

              {/* Notas */}
              <div>
                <label className={labelClass} htmlFor="expense-notes">
                  Notas (opcional)
                </label>

                <textarea
                  id="expense-notes"
                  className={inputClass}
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Detalles adicionales, referencia o comprobante..."
                />
              </div>

              {/* Guardar */}
              <div className="flex flex-col-reverse justify-between gap-3 border-t border-[#EFE7DE] pt-5 sm:flex-row sm:items-center">
                <p className="text-xs leading-5 text-[#78909C]">
                  Los gastos se reportan por separado del costo individual de
                  los productos.
                </p>

                <button
                  type="submit"
                  disabled={
                    saving || loading || !validAmount || !validExchangeRate
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E2732D] px-5 py-3 font-semibold text-white transition hover:bg-[#CC6255] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={17} />
                  {saving ? "Registrando..." : "Registrar gasto"}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Historial de gastos */}
        <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#36709E]/10 p-2.5 text-[#36709E]">
                <ReceiptText size={21} />
              </div>

              <div>
                <h2 className="font-bold">Historial de gastos</h2>

                <p className="text-sm text-[#78909C]">
                  Consulta los gastos registrados en Supabase.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="relative sm:col-span-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
                />

                <input
                  className={`${inputClass} pl-9`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar gasto..."
                />
              </div>

              <div className="relative">
                <Filter
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
                />

                <select
                  aria-label="Filtrar por periodo"
                  className={`${inputClass} pl-9`}
                  value={periodFilter}
                  onChange={(event) => setPeriodFilter(event.target.value)}
                >
                  <option value="all">Todos los periodos</option>

                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Tags
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
                />

                <select
                  aria-label="Filtrar por categoría"
                  className={`${inputClass} pl-9`}
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">Todas las categorías</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-[#78909C]">
              <RefreshCw size={17} className="animate-spin" />
              Cargando gastos...
            </div>
          ) : visibleExpenses.length === 0 ? (
            <div className="rounded-xl bg-[#FDF9F7] px-4 py-10 text-center">
              <ReceiptText size={28} className="mx-auto mb-2 text-[#9AAEB9]" />

              <p className="font-semibold">No hay gastos para mostrar</p>

              <p className="mt-1 text-sm text-[#78909C]">
                Registra un gasto o cambia los filtros.
              </p>
            </div>
          ) : (
            <>
              {/* Tabla escritorio */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#EFE7DE] text-xs uppercase tracking-wide text-[#78909C]">
                    <tr>
                      <th className="px-3 py-3 font-semibold">Fecha</th>

                      <th className="px-3 py-3 font-semibold">Descripción</th>

                      <th className="px-3 py-3 font-semibold">Categoría</th>

                      <th className="px-3 py-3 font-semibold">Periodo</th>

                      <th className="px-3 py-3 text-right font-semibold">
                        Importe original
                      </th>

                      <th className="px-3 py-3 text-right font-semibold">
                        Total MXN
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#EFE7DE]">
                    {visibleExpenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-[#FDF9F7]/70">
                        <td className="whitespace-nowrap px-3 py-4 text-[#78909C]">
                          {formatDate(expense.expense_date)}
                        </td>

                        <td className="min-w-48 px-3 py-4">
                          <p className="font-semibold">{expense.description}</p>

                          {expense.notes && (
                            <p
                              className="mt-1 max-w-xs truncate text-xs text-[#78909C]"
                              title={expense.notes}
                            >
                              {expense.notes}
                            </p>
                          )}
                        </td>

                        <td className="px-3 py-4">
                          {categoryById.get(expense.category_id)?.name ??
                            "Categoría no disponible"}
                        </td>

                        <td className="px-3 py-4">
                          {periodById.get(expense.operation_period_id)?.name ??
                            "Periodo no disponible"}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 text-right tabular-nums">
                          {expense.currency === "USD"
                            ? moneyUSD(Number(expense.amount))
                            : money(Number(expense.amount))}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 text-right font-bold tabular-nums">
                          {money(expenseAmountMxn(expense))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tarjetas móvil */}
              <div className="space-y-3 md:hidden">
                {visibleExpenses.map((expense) => (
                  <article
                    key={expense.id}
                    className="rounded-xl border border-[#EFE7DE] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{expense.description}</p>

                        <p className="mt-1 text-xs text-[#78909C]">
                          {formatDate(expense.expense_date)} ·{" "}
                          {categoryById.get(expense.category_id)?.name ??
                            "Sin categoría"}
                        </p>
                      </div>

                      <p className="shrink-0 font-bold">
                        {money(expenseAmountMxn(expense))}
                      </p>
                    </div>

                    <p className="mt-2 text-xs text-[#78909C]">
                      {periodById.get(expense.operation_period_id)?.name ??
                        "Periodo no disponible"}
                    </p>

                    <p className="mt-1 text-xs text-[#78909C]">
                      Original:{" "}
                      {expense.currency === "USD"
                        ? moneyUSD(Number(expense.amount))
                        : money(Number(expense.amount))}
                    </p>

                    {expense.notes && (
                      <p className="mt-2 text-sm text-[#78909C]">
                        {expense.notes}
                      </p>
                    )}
                  </article>
                ))}
              </div>

              <div className="mt-4 flex flex-col justify-between gap-2 border-t border-[#EFE7DE] pt-4 text-sm sm:flex-row sm:items-center">
                <span className="text-[#78909C]">
                  {visibleExpenses.length} gasto(s) en la vista actual
                </span>

                <span className="font-bold text-[#0C304F]">
                  Total: {money(totalMxn)}
                </span>
              </div>
            </>
          )}
        </section>

        <footer className="pb-2 text-center text-xs text-[#78909C]">
          Los importes se calculan en MXN y se conservan también en su moneda
          original. Los gastos se mantienen separados de las ventas y de los
          pagos de clientes.
        </footer>
      </div>
    </main>
  );
}
