"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  HandCoins,
  LoaderCircle,
  Plus,
  RefreshCw,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

type Investor = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
};

type OperationPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
};

type Contribution = {
  id: string;
  investor_id: string;
  operation_period_id: string | null;
  movement_type: "contribution" | "capital_return" | "reinvestment";
  amount_mxn: number | string;
  movement_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

type Participation = {
  id: string;
  investor_id: string;
  operation_period_id: string;
  participating_capital_mxn: number | string;
  expected_return_rate: number | string;
  expected_return_mxn: number | string | null;
  validated_return_mxn: number | string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type InvestorMovement = {
  id: string;
  investor_id: string;
  participation_id: string | null;
  contribution_id: string | null;
  movement_type:
    | "return_payment"
    | "capital_withdrawal"
    | "reinvestment"
    | "adjustment";
  amount_mxn: number | string;
  movement_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

type Tab = "investors" | "participations" | "movements";
type Modal = "investor" | "contribution" | "participation" | "payment" | null;

const inputClass =
  "w-full rounded-xl border border-[#EFE7DE] bg-white px-3.5 py-2.5 text-sm text-[#0C304F] outline-none transition placeholder:text-[#9AAAB1] focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#0C304F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17496F] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#EFE7DE] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0C304F] transition hover:border-[#36709E]/50 disabled:cursor-not-allowed disabled:opacity-50";

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(numeric(value));
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

const contributionLabels: Record<Contribution["movement_type"], string> = {
  contribution: "Aportación",
  capital_return: "Devolución de capital",
  reinvestment: "Reinversión",
};

const statusLabels: Record<string, string> = {
  planned: "Planeada",
  participating: "Participando",
  pending_validation: "Por validar",
  validated: "Rendimiento validado",
  partially_paid: "Pago parcial",
  paid: "Pagada",
  cancelled: "Cancelada",
};

const statusClasses: Record<string, string> = {
  planned: "bg-slate-100 text-slate-700",
  participating: "bg-blue-50 text-blue-700",
  pending_validation: "bg-amber-50 text-amber-800",
  validated: "bg-violet-50 text-violet-700",
  partially_paid: "bg-orange-50 text-orange-800",
  paid: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
};

export default function InversionistasPage() {
  const supabase = useMemo(() => createClient(), []);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [periods, setPeriods] = useState<OperationPeriod[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [movements, setMovements] = useState<InvestorMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<Tab>("investors");
  const [modal, setModal] = useState<Modal>(null);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [activeParticipationId, setActiveParticipationId] = useState("");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");

  const [investorForm, setInvestorForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    notes: "",
    active: true,
  });
  const [contributionForm, setContributionForm] = useState({
    investor_id: "",
    movement_type: "contribution" as Contribution["movement_type"],
    amount_mxn: "",
    movement_date: localDate(),
    operation_period_id: "",
    reference: "",
    notes: "",
  });
  const [participationForm, setParticipationForm] = useState({
    investor_id: "",
    operation_period_id: "",
    participating_capital_mxn: "",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount_mxn: "",
    movement_date: localDate(),
    reference: "",
    notes: "",
  });

  const loadData = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const [
          investorResult,
          periodResult,
          contributionResult,
          participationResult,
          movementResult,
        ] = await Promise.all([
          supabase
            .from("investors")
            .select("id, full_name, phone, email, active, notes, created_at")
            .order("full_name"),
          supabase
            .from("operation_periods")
            .select("id, name, start_date, end_date, status")
            .order("start_date", { ascending: false }),
          supabase
            .from("investor_contributions")
            .select(
              "id, investor_id, operation_period_id, movement_type, amount_mxn, movement_date, reference, notes, created_at",
            )
            .order("movement_date", { ascending: false }),
          supabase
            .from("investment_participations")
            .select(
              "id, investor_id, operation_period_id, participating_capital_mxn, expected_return_rate, expected_return_mxn, validated_return_mxn, status, notes, created_at",
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("investor_movements")
            .select(
              "id, investor_id, participation_id, contribution_id, movement_type, amount_mxn, movement_date, reference, notes, created_at",
            )
            .order("movement_date", { ascending: false }),
        ]);

        const firstError =
          investorResult.error ||
          periodResult.error ||
          contributionResult.error ||
          participationResult.error ||
          movementResult.error;
        if (firstError) throw firstError;
        setInvestors((investorResult.data ?? []) as Investor[]);
        setPeriods((periodResult.data ?? []) as OperationPeriod[]);
        setContributions((contributionResult.data ?? []) as Contribution[]);
        setParticipations((participationResult.data ?? []) as Participation[]);
        setMovements((movementResult.data ?? []) as InvestorMovement[]);
      } catch (err) {
        console.error("Error cargando módulo de inversionistas:", err);
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar la información de inversionistas.",
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

  const investorById = useMemo(
    () => new Map(investors.map((investor) => [investor.id, investor])),
    [investors],
  );
  const periodById = useMemo(
    () => new Map(periods.map((period) => [period.id, period])),
    [periods],
  );

  const paidByParticipation = useMemo(() => {
    const totals = new Map<string, number>();
    movements
      .filter(
        (movement) =>
          movement.movement_type === "return_payment" &&
          movement.participation_id,
      )
      .forEach((movement) => {
        const id = movement.participation_id as string;
        totals.set(id, (totals.get(id) ?? 0) + numeric(movement.amount_mxn));
      });
    return totals;
  }, [movements]);

  const participationFinancials = useMemo(() => {
    return participations.map((participation) => {
      const targetReturn =
        participation.validated_return_mxn == null
          ? numeric(participation.expected_return_mxn)
          : numeric(participation.validated_return_mxn);
      const paid = paidByParticipation.get(participation.id) ?? 0;
      const pending = Math.max(0, targetReturn - paid);
      const derivedStatus =
        participation.status === "cancelled"
          ? "cancelled"
          : targetReturn > 0 && paid >= targetReturn
            ? "paid"
            : paid > 0
              ? "partially_paid"
              : participation.status;
      return { ...participation, targetReturn, paid, pending, derivedStatus };
    });
  }, [participations, paidByParticipation]);

  const filteredInvestors = useMemo(() => {
    const term = search.trim().toLowerCase();
    return investors.filter((investor) => {
      if (!term) return true;
      return [investor.full_name, investor.phone, investor.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [investors, search]);

  const filteredParticipations = useMemo(
    () =>
      participationFinancials.filter(
        (participation) =>
          periodFilter === "all" ||
          participation.operation_period_id === periodFilter,
      ),
    [participationFinancials, periodFilter],
  );

  const filteredContributions = useMemo(
    () =>
      contributions.filter(
        (contribution) =>
          periodFilter === "all" ||
          contribution.operation_period_id === periodFilter,
      ),
    [contributions, periodFilter],
  );

  const totals = useMemo(() => {
    const expectedCapital = filteredParticipations
      .filter((item) => item.status !== "cancelled")
      .reduce((sum, item) => sum + numeric(item.participating_capital_mxn), 0);
    const expectedReturn = filteredParticipations
      .filter((item) => item.status !== "cancelled")
      .reduce((sum, item) => sum + item.targetReturn, 0);
    const paidReturn = filteredParticipations.reduce(
      (sum, item) => sum + item.paid,
      0,
    );
    const contributionTotal = filteredContributions
      .filter((item) => item.movement_type === "contribution")
      .reduce((sum, item) => sum + numeric(item.amount_mxn), 0);
    return {
      activeInvestors: investors.filter((item) => item.active).length,
      contributionTotal,
      expectedCapital,
      expectedReturn,
      paidReturn,
      pendingReturn: Math.max(0, expectedReturn - paidReturn),
    };
  }, [investors, filteredContributions, filteredParticipations]);

  function openNewInvestor() {
    setEditingInvestor(null);
    setInvestorForm({
      full_name: "",
      phone: "",
      email: "",
      notes: "",
      active: true,
    });
    setModal("investor");
  }

  function openEditInvestor(investor: Investor) {
    setEditingInvestor(investor);
    setInvestorForm({
      full_name: investor.full_name,
      phone: investor.phone ?? "",
      email: investor.email ?? "",
      notes: investor.notes ?? "",
      active: investor.active,
    });
    setModal("investor");
  }

  function openContribution(investorId = "") {
    setContributionForm({
      investor_id: investorId,
      movement_type: "contribution",
      amount_mxn: "",
      movement_date: localDate(),
      operation_period_id: "",
      reference: "",
      notes: "",
    });
    setModal("contribution");
  }

  function openParticipation(investorId = "") {
    setParticipationForm({
      investor_id: investorId,
      operation_period_id: "",
      participating_capital_mxn: "",
      notes: "",
    });
    setModal("participation");
  }

  function openPayment(participationId: string) {
    setActiveParticipationId(participationId);
    setPaymentForm({
      amount_mxn: "",
      movement_date: localDate(),
      reference: "",
      notes: "",
    });
    setModal("payment");
  }

  function closeModal() {
    if (saving) return;
    setModal(null);
    setEditingInvestor(null);
    setActiveParticipationId("");
  }

  async function getCreatedBy() {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }

  async function handleInvestorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!investorForm.full_name.trim()) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        full_name: investorForm.full_name.trim(),
        phone: investorForm.phone.trim() || null,
        email: investorForm.email.trim() || null,
        notes: investorForm.notes.trim() || null,
        active: investorForm.active,
      };
      const result = editingInvestor
        ? await supabase
            .from("investors")
            .update(payload)
            .eq("id", editingInvestor.id)
        : await supabase.from("investors").insert(payload);
      if (result.error) throw result.error;
      setSuccess(
        editingInvestor
          ? "Datos del inversionista actualizados."
          : "Inversionista registrado correctamente.",
      );
      setModal(null);
      setEditingInvestor(null);
      await loadData(true);
    } catch (err) {
      console.error("Error guardando inversionista:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el inversionista.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleContributionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(contributionForm.amount_mxn);
    if (
      !contributionForm.investor_id ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
      return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const createdBy = await getCreatedBy();
      const { error: insertError } = await supabase
        .from("investor_contributions")
        .insert({
          investor_id: contributionForm.investor_id,
          operation_period_id: contributionForm.operation_period_id || null,
          movement_type: contributionForm.movement_type,
          amount_mxn: amount,
          movement_date: contributionForm.movement_date,
          reference: contributionForm.reference.trim() || null,
          notes: contributionForm.notes.trim() || null,
          created_by: createdBy,
        });
      if (insertError) throw insertError;
      setSuccess("Movimiento de capital registrado.");
      setModal(null);
      await loadData(true);
    } catch (err) {
      console.error("Error registrando movimiento de capital:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar el movimiento de capital.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleParticipationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(participationForm.participating_capital_mxn);
    if (
      !participationForm.investor_id ||
      !participationForm.operation_period_id ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
      return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const createdBy = await getCreatedBy();
      const { error: insertError } = await supabase
        .from("investment_participations")
        .insert({
          investor_id: participationForm.investor_id,
          operation_period_id: participationForm.operation_period_id,
          participating_capital_mxn: amount,
          expected_return_rate: 0.2,
          status: "participating",
          notes: participationForm.notes.trim() || null,
          created_by: createdBy,
        });
      if (insertError) throw insertError;
      setSuccess(
        "Participación registrada. El rendimiento esperado se calcula automáticamente al 20%.",
      );
      setModal(null);
      await loadData(true);
    } catch (err) {
      console.error("Error registrando participación:", err);
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo registrar la participación.";
      setError(
        message.includes("duplicate") || message.includes("unique")
          ? "Este inversionista ya tiene una participación registrada en ese periodo. La base de datos permite una sola por inversionista y periodo."
          : message,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(paymentForm.amount_mxn);
    const participation = participationFinancials.find(
      (item) => item.id === activeParticipationId,
    );
    if (!participation || !Number.isFinite(amount) || amount <= 0) return;
    if (amount > participation.pending + 0.001) {
      setError(
        `El pago no puede superar el saldo pendiente de ${money(participation.pending)}.`,
      );
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const createdBy = await getCreatedBy();
      const { error: insertError } = await supabase
        .from("investor_movements")
        .insert({
          investor_id: participation.investor_id,
          participation_id: participation.id,
          contribution_id: null,
          movement_type: "return_payment",
          amount_mxn: amount,
          movement_date: paymentForm.movement_date,
          reference: paymentForm.reference.trim() || null,
          notes: paymentForm.notes.trim() || null,
          created_by: createdBy,
        });
      if (insertError) throw insertError;
      setSuccess(
        "Pago de rendimiento registrado y vinculado a la participación.",
      );
      setModal(null);
      await loadData(true);
    } catch (err) {
      console.error("Error registrando pago de rendimiento:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo registrar el pago.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(
    participation: Participation,
    status: string,
  ) {
    setError("");
    setSuccess("");
    try {
      const payload: { status: string; validated_return_mxn?: number | null } =
        { status };
      if (
        status === "validated" &&
        participation.validated_return_mxn == null
      ) {
        const defaultAmount = numeric(
          participation.expected_return_mxn,
        ).toFixed(2);
        const entered = window.prompt(
          "Confirma el rendimiento validado en MXN:",
          defaultAmount,
        );
        if (entered === null) return;
        const validatedAmount = Number(entered);
        if (!Number.isFinite(validatedAmount) || validatedAmount < 0) {
          setError(
            "El rendimiento validado debe ser un importe igual o mayor a cero.",
          );
          return;
        }
        payload.validated_return_mxn = validatedAmount;
      }
      const { error: updateError } = await supabase
        .from("investment_participations")
        .update(payload)
        .eq("id", participation.id);
      if (updateError) throw updateError;
      setSuccess(
        status === "validated"
          ? "Rendimiento validado y guardado."
          : "Estado de participación actualizado.",
      );
      await loadData(true);
    } catch (err) {
      console.error("Error actualizando estado de participación:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar el estado.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#FDF9F7] p-4 text-[#0C304F] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-[#36709E]">
              <Users size={17} /> Finanzas / Inversionistas
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Inversionistas
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C]">
              Administra inversionistas, registra movimientos de capital y
              controla las participaciones y rendimientos por periodo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing || loading}
            className={secondaryButton}
          >
            {refreshing ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}{" "}
            Actualizar
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Cerrar error"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {success && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-900"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1">{success}</p>
            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Cerrar confirmación"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric
            label="Inversionistas activos"
            value={loading ? "—" : numberFormat(totals.activeInvestors)}
            icon={<Users size={18} />}
          />
          <Metric
            label="Aportaciones registradas"
            value={loading ? "—" : money(totals.contributionTotal)}
            icon={<ArrowDownLeft size={18} />}
          />
          <Metric
            label="Capital asignado a periodos"
            value={loading ? "—" : money(totals.expectedCapital)}
            icon={<Wallet size={18} />}
          />
          <Metric
            label="Rendimiento esperado / validado"
            value={loading ? "—" : money(totals.expectedReturn)}
            icon={<CircleDollarSign size={18} />}
          />
          <Metric
            label="Rendimiento pagado"
            value={loading ? "—" : money(totals.paidReturn)}
            icon={<ArrowDownLeft size={18} />}
          />
          <Metric
            label="Rendimiento pendiente estimado"
            value={loading ? "—" : money(totals.pendingReturn)}
            icon={<Clock3 size={18} />}
            accent
          />
        </section>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <TabButton
              active={tab === "investors"}
              onClick={() => setTab("investors")}
            >
              Inversionistas
            </TabButton>
            <TabButton
              active={tab === "participations"}
              onClick={() => setTab("participations")}
            >
              Participaciones
            </TabButton>
            <TabButton
              active={tab === "movements"}
              onClick={() => setTab("movements")}
            >
              Movimientos
            </TabButton>
          </div>
          {tab === "investors" && (
            <button
              type="button"
              onClick={openNewInvestor}
              className={primaryButton}
            >
              <Plus size={16} /> Nuevo inversionista
            </button>
          )}
          {tab === "participations" && (
            <button
              type="button"
              onClick={() => openParticipation()}
              className={primaryButton}
            >
              <Plus size={16} /> Nueva participación
            </button>
          )}
          {tab === "movements" && (
            <button
              type="button"
              onClick={() => openContribution()}
              className={primaryButton}
            >
              <Plus size={16} /> Registrar movimiento
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-[#EFE7DE] bg-white text-sm text-[#78909C]">
            <LoaderCircle size={22} className="animate-spin" /> Cargando
            información...
          </div>
        ) : (
          <>
            {tab === "investors" && (
              <section className="rounded-2xl border border-[#EFE7DE] bg-white p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-bold">Directorio de inversionistas</h2>
                    <p className="mt-1 text-xs text-[#78909C]">
                      Datos de contacto y acceso rápido a sus registros.
                    </p>
                  </div>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar nombre, teléfono o correo..."
                    className={`${inputClass} sm:max-w-xs`}
                  />
                </div>
                {filteredInvestors.length === 0 ? (
                  <EmptyState
                    title="No hay inversionistas"
                    detail="Agrega el primer inversionista para comenzar a registrar participaciones."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b border-[#EFE7DE] text-xs text-[#78909C]">
                        <tr>
                          <th className="px-3 py-3 font-semibold">
                            Inversionista
                          </th>
                          <th className="px-3 py-3 font-semibold">Contacto</th>
                          <th className="px-3 py-3 font-semibold">
                            Participaciones
                          </th>
                          <th className="px-3 py-3 font-semibold">Estado</th>
                          <th className="px-3 py-3 text-right font-semibold">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFE7DE]">
                        {filteredInvestors.map((investor) => {
                          const investorParticipations =
                            participationFinancials.filter(
                              (item) =>
                                item.investor_id === investor.id &&
                                item.status !== "cancelled",
                            );
                          const capital = investorParticipations.reduce(
                            (sum, item) =>
                              sum + numeric(item.participating_capital_mxn),
                            0,
                          );
                          return (
                            <tr
                              key={investor.id}
                              className="align-top hover:bg-[#FDF9F7]/70"
                            >
                              <td className="px-3 py-3.5">
                                <p className="font-semibold">
                                  {investor.full_name}
                                </p>
                                {investor.notes && (
                                  <p className="mt-1 max-w-xs text-xs text-[#78909C]">
                                    {investor.notes}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-3.5 text-xs text-[#526C7C]">
                                <p>{investor.phone || "Sin teléfono"}</p>
                                <p className="mt-1">
                                  {investor.email || "Sin correo"}
                                </p>
                              </td>
                              <td className="px-3 py-3.5">
                                <p className="font-semibold tabular-nums">
                                  {investorParticipations.length}
                                </p>
                                <p className="mt-1 text-xs text-[#78909C]">
                                  {money(capital)} asignados
                                </p>
                              </td>
                              <td className="px-3 py-3.5">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${investor.active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}
                                >
                                  {investor.active ? "Activo" : "Inactivo"}
                                </span>
                              </td>
                              <td className="px-3 py-3.5">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditInvestor(investor)}
                                    className="rounded-lg border border-[#EFE7DE] px-2.5 py-1.5 text-xs font-semibold hover:border-[#36709E]"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openContribution(investor.id)
                                    }
                                    className="rounded-lg border border-[#EFE7DE] px-2.5 py-1.5 text-xs font-semibold hover:border-[#36709E]"
                                  >
                                    Movimiento
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openParticipation(investor.id)
                                    }
                                    className="rounded-lg bg-[#0C304F] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#17496F]"
                                  >
                                    Participación
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {tab === "participations" && (
              <section className="rounded-2xl border border-[#EFE7DE] bg-white p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-bold">Participaciones por periodo</h2>
                    <p className="mt-1 text-xs text-[#78909C]">
                      El rendimiento pactado se calcula al 20% del capital
                      participante de cada periodo. Aquí registras cada pago que
                      ya realizaste.
                    </p>
                  </div>
                  <select
                    value={periodFilter}
                    onChange={(event) => setPeriodFilter(event.target.value)}
                    className={`${inputClass} sm:max-w-xs`}
                  >
                    <option value="all">Todos los periodos</option>
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#DCE7ED] bg-[#F5F9FB] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="rounded-lg bg-white p-2 text-[#36709E]">
                      <HandCoins size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0C304F]">
                        ¿Ya le pagaste el rendimiento a un inversionista?
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#617B8A]">
                        Busca su participación y pulsa{" "}
                        <strong>Registrar pago</strong>. Puedes capturar pagos
                        parciales o liquidar el total. El pago quedará guardado
                        en el historial de Movimientos.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("movements")}
                    className={`${secondaryButton} shrink-0`}
                  >
                    Ver historial de pagos
                  </button>
                </div>
                {filteredParticipations.length === 0 ? (
                  <EmptyState
                    title="No hay participaciones registradas"
                    detail="Registra una participación para asociar capital a un periodo. Después, desde esta misma tabla podrás registrar los pagos de rendimiento."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[950px] text-left text-sm">
                      <thead className="border-b border-[#EFE7DE] text-xs text-[#78909C]">
                        <tr>
                          <th className="px-3 py-3 font-semibold">
                            Inversionista / periodo
                          </th>
                          <th className="px-3 py-3 text-right font-semibold">
                            Capital participante
                          </th>
                          <th className="px-3 py-3 text-right font-semibold">
                            Rendimiento esperado
                          </th>
                          <th className="px-3 py-3 text-right font-semibold">
                            Pagado
                          </th>
                          <th className="px-3 py-3 text-right font-semibold">
                            Pendiente
                          </th>
                          <th className="px-3 py-3 font-semibold">Estado</th>
                          <th className="px-3 py-3 text-right font-semibold">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFE7DE]">
                        {filteredParticipations.map((item) => {
                          const investor = investorById.get(item.investor_id);
                          const period = periodById.get(
                            item.operation_period_id,
                          );
                          return (
                            <tr key={item.id} className="hover:bg-[#FDF9F7]/70">
                              <td className="px-3 py-3.5">
                                <p className="font-semibold">
                                  {investor?.full_name ?? "Inversionista"}
                                </p>
                                <p className="mt-1 text-xs text-[#78909C]">
                                  {period?.name ?? "Periodo no disponible"}
                                </p>
                              </td>
                              <td className="px-3 py-3.5 text-right tabular-nums">
                                {money(item.participating_capital_mxn)}
                              </td>
                              <td className="px-3 py-3.5 text-right">
                                <p className="font-semibold tabular-nums">
                                  {money(item.targetReturn)}
                                </p>
                                <p className="text-[10px] text-[#78909C]">
                                  {(
                                    numeric(item.expected_return_rate) * 100
                                  ).toFixed(0)}
                                  %
                                  {item.validated_return_mxn != null
                                    ? " · validado"
                                    : " · calculado"}
                                </p>
                              </td>
                              <td className="px-3 py-3.5 text-right tabular-nums">
                                {money(item.paid)}
                              </td>
                              <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-[#CC6255]">
                                {money(item.pending)}
                              </td>
                              <td className="px-3 py-3.5">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[item.derivedStatus] ?? "bg-slate-100 text-slate-700"}`}
                                >
                                  {statusLabels[item.derivedStatus] ??
                                    item.derivedStatus}
                                </span>
                                <select
                                  aria-label={`Cambiar estado de ${investor?.full_name ?? "participación"}`}
                                  value={item.status}
                                  onChange={(event) =>
                                    void handleStatusChange(
                                      item,
                                      event.target.value,
                                    )
                                  }
                                  className="mt-2 block w-full max-w-[170px] rounded-lg border border-[#EFE7DE] bg-white px-2 py-1.5 text-[11px]"
                                >
                                  <option value="planned">Planeada</option>
                                  <option value="participating">
                                    Participando
                                  </option>
                                  <option value="pending_validation">
                                    Por validar
                                  </option>
                                  <option value="validated">
                                    Rendimiento validado
                                  </option>
                                  <option value="partially_paid" disabled>
                                    Pago parcial (automático)
                                  </option>
                                  <option value="paid" disabled>
                                    Pagada (automático)
                                  </option>
                                  <option value="cancelled">Cancelada</option>
                                </select>
                              </td>
                              <td className="px-3 py-3.5 text-right">
                                {item.derivedStatus !== "cancelled" &&
                                item.pending > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => openPayment(item.id)}
                                    className="rounded-lg bg-[#0C304F] px-3 py-2 text-xs font-semibold text-white hover:bg-[#17496F]"
                                  >
                                    Registrar pago
                                  </button>
                                ) : (
                                  <span className="text-xs text-[#78909C]">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-4 rounded-xl bg-[#FDF9F7] p-3 text-xs leading-5 text-[#78909C]">
                  Cuando hay pagos vinculados, la etiqueta prioriza el importe
                  efectivamente registrado. El selector modifica únicamente el
                  estado operativo; no crea pagos ni modifica importes.
                </p>
              </section>
            )}

            {tab === "movements" && (
              <section className="rounded-2xl border border-[#EFE7DE] bg-white p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-bold">
                      Historial de movimientos y pagos
                    </h2>
                    <p className="mt-1 text-xs text-[#78909C]">
                      Aquí aparecen las aportaciones, devoluciones de capital,
                      reinversiones y pagos de rendimiento que hayas registrado.
                    </p>
                  </div>
                  <select
                    value={periodFilter}
                    onChange={(event) => setPeriodFilter(event.target.value)}
                    className={`${inputClass} sm:max-w-xs`}
                  >
                    <option value="all">Todos los periodos</option>
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name}
                      </option>
                    ))}
                  </select>
                </div>
                {contributions.length === 0 && movements.length === 0 ? (
                  <EmptyState
                    title="Sin movimientos registrados"
                    detail="Registra una aportación, devolución de capital o reinversión para comenzar el historial."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left text-sm">
                      <thead className="border-b border-[#EFE7DE] text-xs text-[#78909C]">
                        <tr>
                          <th className="px-3 py-3 font-semibold">Fecha</th>
                          <th className="px-3 py-3 font-semibold">
                            Inversionista
                          </th>
                          <th className="px-3 py-3 font-semibold">
                            Movimiento
                          </th>
                          <th className="px-3 py-3 font-semibold">
                            Periodo / referencia
                          </th>
                          <th className="px-3 py-3 text-right font-semibold">
                            Importe
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFE7DE]">
                        {[
                          ...contributions.map((item) => ({
                            id: `c-${item.id}`,
                            date: item.movement_date,
                            investorId: item.investor_id,
                            label: contributionLabels[item.movement_type],
                            periodId: item.operation_period_id,
                            detail:
                              [
                                item.operation_period_id
                                  ? periodById.get(item.operation_period_id)
                                      ?.name
                                  : null,
                                item.reference,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—",
                            amount: numeric(item.amount_mxn),
                          })),
                          ...movements
                            .filter(
                              (item) =>
                                item.movement_type === "return_payment" ||
                                item.movement_type === "capital_withdrawal" ||
                                item.movement_type === "reinvestment" ||
                                item.movement_type === "adjustment",
                            )
                            .map((item) => {
                              const participation = item.participation_id
                                ? participations.find(
                                    (p) => p.id === item.participation_id,
                                  )
                                : null;
                              const contribution = item.contribution_id
                                ? contributions.find(
                                    (c) => c.id === item.contribution_id,
                                  )
                                : null;
                              const relatedPeriod =
                                participation?.operation_period_id ??
                                contribution?.operation_period_id ??
                                null;
                              const labels: Record<
                                InvestorMovement["movement_type"],
                                string
                              > = {
                                return_payment: "Pago de rendimiento",
                                capital_withdrawal: "Retiro de capital",
                                reinvestment: "Reinversión",
                                adjustment: "Ajuste",
                              };
                              return {
                                id: `m-${item.id}`,
                                date: item.movement_date,
                                investorId: item.investor_id,
                                label: labels[item.movement_type],
                                periodId: relatedPeriod,
                                detail:
                                  [
                                    relatedPeriod
                                      ? periodById.get(relatedPeriod)?.name
                                      : null,
                                    item.reference,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "—",
                                amount: numeric(item.amount_mxn),
                              };
                            }),
                        ]
                          .filter(
                            (row) =>
                              periodFilter === "all" ||
                              row.periodId === periodFilter,
                          )
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((row) => (
                            <tr key={row.id} className="hover:bg-[#FDF9F7]/70">
                              <td className="px-3 py-3.5 text-xs text-[#78909C]">
                                {formatDate(row.date)}
                              </td>
                              <td className="px-3 py-3.5 font-semibold">
                                {investorById.get(row.investorId)?.full_name ??
                                  "Inversionista"}
                              </td>
                              <td className="px-3 py-3.5">{row.label}</td>
                              <td className="px-3 py-3.5 text-xs text-[#78909C]">
                                {row.detail}
                              </td>
                              <td className="px-3 py-3.5 text-right font-semibold tabular-nums">
                                {money(row.amount)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-4 text-xs leading-5 text-[#78909C]">
                  Este historial conserva los importes como valores positivos y
                  muestra el tipo de movimiento por separado. No interpreta el
                  saldo de capital disponible.
                </p>
              </section>
            )}
          </>
        )}

        <p className="mt-5 text-center text-xs leading-5 text-[#9AAAB1]">
          Rendimiento pactado: 20% por participación y por periodo. Las
          reinversiones se registran como movimientos independientes; no se
          reinvierten automáticamente.
        </p>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0C304F]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {modal === "investor"
                    ? editingInvestor
                      ? "Editar inversionista"
                      : "Nuevo inversionista"
                    : modal === "contribution"
                      ? "Registrar movimiento de capital"
                      : modal === "participation"
                        ? "Nueva participación"
                        : "Registrar pago de rendimiento"}
                </h2>
                <p className="mt-1 text-xs text-[#78909C]">
                  {modal === "participation"
                    ? "Se aplicará el rendimiento fijo del 20% para este periodo."
                    : modal === "payment"
                      ? "El pago quedará ligado a la participación seleccionada."
                      : "Los cambios se guardarán en Supabase."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Cerrar"
                className="rounded-lg p-2 text-[#78909C] hover:bg-[#FDF9F7]"
              >
                <X size={18} />
              </button>
            </div>

            {modal === "investor" && (
              <form onSubmit={handleInvestorSubmit} className="space-y-4">
                <Field label="Nombre completo" required>
                  <input
                    required
                    autoFocus
                    value={investorForm.full_name}
                    onChange={(event) =>
                      setInvestorForm({
                        ...investorForm,
                        full_name: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Nombre del inversionista"
                  />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Teléfono">
                    <input
                      value={investorForm.phone}
                      onChange={(event) =>
                        setInvestorForm({
                          ...investorForm,
                          phone: event.target.value,
                        })
                      }
                      className={inputClass}
                      placeholder="Teléfono"
                    />
                  </Field>
                  <Field label="Correo electrónico">
                    <input
                      type="email"
                      value={investorForm.email}
                      onChange={(event) =>
                        setInvestorForm({
                          ...investorForm,
                          email: event.target.value,
                        })
                      }
                      className={inputClass}
                      placeholder="correo@ejemplo.com"
                    />
                  </Field>
                </div>
                <Field label="Notas">
                  <textarea
                    value={investorForm.notes}
                    onChange={(event) =>
                      setInvestorForm({
                        ...investorForm,
                        notes: event.target.value,
                      })
                    }
                    className={inputClass}
                    rows={3}
                    placeholder="Notas internas (opcional)"
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={investorForm.active}
                    onChange={(event) =>
                      setInvestorForm({
                        ...investorForm,
                        active: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-[#D8DDE0] accent-[#0C304F]"
                  />{" "}
                  Inversionista activo
                </label>
                <ModalActions
                  saving={saving}
                  onCancel={closeModal}
                  submitLabel={
                    editingInvestor ? "Guardar cambios" : "Crear inversionista"
                  }
                />
              </form>
            )}

            {modal === "contribution" && (
              <form onSubmit={handleContributionSubmit} className="space-y-4">
                <Field label="Inversionista" required>
                  <select
                    required
                    value={contributionForm.investor_id}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        investor_id: event.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">Selecciona un inversionista</option>
                    {investors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipo de movimiento" required>
                  <select
                    value={contributionForm.movement_type}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        movement_type: event.target
                          .value as Contribution["movement_type"],
                      })
                    }
                    className={inputClass}
                  >
                    <option value="contribution">Aportación</option>
                    <option value="capital_return">
                      Devolución de capital
                    </option>
                    <option value="reinvestment">Reinversión</option>
                  </select>
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Importe (MXN)" required>
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={contributionForm.amount_mxn}
                      onChange={(event) =>
                        setContributionForm({
                          ...contributionForm,
                          amount_mxn: event.target.value,
                        })
                      }
                      className={inputClass}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Fecha" required>
                    <input
                      required
                      type="date"
                      value={contributionForm.movement_date}
                      onChange={(event) =>
                        setContributionForm({
                          ...contributionForm,
                          movement_date: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="Periodo (opcional)">
                  <select
                    value={contributionForm.operation_period_id}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        operation_period_id: event.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">Sin periodo asociado</option>
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Referencia">
                  <input
                    value={contributionForm.reference}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        reference: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Transferencia, folio, etc."
                  />
                </Field>
                <Field label="Notas">
                  <textarea
                    rows={2}
                    value={contributionForm.notes}
                    onChange={(event) =>
                      setContributionForm({
                        ...contributionForm,
                        notes: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Detalle opcional"
                  />
                </Field>
                <p className="rounded-xl bg-[#FDF9F7] p-3 text-xs leading-5 text-[#78909C]">
                  El movimiento se guarda en el historial con el importe
                  indicado. No se calcula automáticamente el capital disponible.
                </p>
                <ModalActions
                  saving={saving}
                  onCancel={closeModal}
                  submitLabel="Registrar movimiento"
                />
              </form>
            )}

            {modal === "participation" && (
              <form onSubmit={handleParticipationSubmit} className="space-y-4">
                <Field label="Inversionista" required>
                  <select
                    required
                    value={participationForm.investor_id}
                    onChange={(event) =>
                      setParticipationForm({
                        ...participationForm,
                        investor_id: event.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">Selecciona un inversionista</option>
                    {investors
                      .filter((item) => item.active)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.full_name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Periodo de operación" required>
                  <select
                    required
                    value={participationForm.operation_period_id}
                    onChange={(event) =>
                      setParticipationForm({
                        ...participationForm,
                        operation_period_id: event.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">Selecciona un periodo</option>
                    {periods
                      .filter((item) => item.status !== "finished")
                      .map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Capital participante (MXN)" required>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={participationForm.participating_capital_mxn}
                    onChange={(event) =>
                      setParticipationForm({
                        ...participationForm,
                        participating_capital_mxn: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="0.00"
                  />
                </Field>
                <div className="rounded-xl border border-[#EFE7DE] bg-[#FDF9F7] p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#78909C]">Rendimiento pactado</span>
                    <strong>20%</strong>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-[#78909C]">Rendimiento estimado</span>
                    <strong className="text-[#36709E]">
                      {money(
                        numeric(participationForm.participating_capital_mxn) *
                          0.2,
                      )}
                    </strong>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-[#78909C]">
                    El importe esperado lo genera la columna calculada de
                    Supabase. Solo se envía capital y tasa.
                  </p>
                </div>
                <Field label="Notas">
                  <textarea
                    rows={2}
                    value={participationForm.notes}
                    onChange={(event) =>
                      setParticipationForm({
                        ...participationForm,
                        notes: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Notas opcionales"
                  />
                </Field>
                <ModalActions
                  saving={saving}
                  onCancel={closeModal}
                  submitLabel="Crear participación"
                />
              </form>
            )}

            {modal === "payment" &&
              (() => {
                const item = participationFinancials.find(
                  (row) => row.id === activeParticipationId,
                );
                return (
                  <form onSubmit={handlePaymentSubmit} className="space-y-4">
                    {item && (
                      <div className="rounded-xl bg-[#FDF9F7] p-3 text-sm">
                        <p className="font-semibold">
                          {investorById.get(item.investor_id)?.full_name ??
                            "Inversionista"}
                        </p>
                        <p className="mt-1 text-xs text-[#78909C]">
                          {periodById.get(item.operation_period_id)?.name ??
                            "Periodo"}
                        </p>
                        <div className="mt-3 flex justify-between">
                          <span className="text-[#78909C]">Pendiente</span>
                          <strong className="text-[#CC6255]">
                            {money(item.pending)}
                          </strong>
                        </div>
                      </div>
                    )}
                    <Field label="Importe del pago (MXN)" required>
                      <input
                        required
                        autoFocus
                        type="number"
                        min="0.01"
                        max={item?.pending ?? undefined}
                        step="0.01"
                        value={paymentForm.amount_mxn}
                        onChange={(event) =>
                          setPaymentForm({
                            ...paymentForm,
                            amount_mxn: event.target.value,
                          })
                        }
                        className={inputClass}
                        placeholder="0.00"
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Fecha" required>
                        <input
                          required
                          type="date"
                          value={paymentForm.movement_date}
                          onChange={(event) =>
                            setPaymentForm({
                              ...paymentForm,
                              movement_date: event.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Referencia">
                        <input
                          value={paymentForm.reference}
                          onChange={(event) =>
                            setPaymentForm({
                              ...paymentForm,
                              reference: event.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Transferencia / folio"
                        />
                      </Field>
                    </div>
                    <Field label="Notas">
                      <textarea
                        rows={2}
                        value={paymentForm.notes}
                        onChange={(event) =>
                          setPaymentForm({
                            ...paymentForm,
                            notes: event.target.value,
                          })
                        }
                        className={inputClass}
                        placeholder="Detalle opcional"
                      />
                    </Field>
                    <p className="rounded-xl bg-[#FDF9F7] p-3 text-xs leading-5 text-[#78909C]">
                      El pago se registra como <strong>return_payment</strong> y
                      queda relacionado con esta participación. No se modificará
                      el capital participante.
                    </p>
                    <ModalActions
                      saving={saving}
                      onCancel={closeModal}
                      submitLabel="Guardar pago"
                    />
                  </form>
                );
              })()}
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white px-4 py-3.5 ${accent ? "border-[#CC6255]/25" : "border-[#EFE7DE]"}`}
    >
      <div className="flex items-center justify-between gap-2 text-[#78909C]">
        <p className="text-xs">{label}</p>
        <span className={accent ? "text-[#CC6255]" : "text-[#36709E]"}>
          {icon}
        </span>
      </div>
      <p
        className={`mt-2 text-xl font-bold tabular-nums ${accent ? "text-[#CC6255]" : "text-[#0C304F]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${active ? "bg-[#0C304F] text-white" : "border border-[#EFE7DE] bg-white text-[#526C7C] hover:border-[#36709E]/50"}`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold text-[#526C7C]">
        {label}
        {required && <span className="ml-1 text-[#CC6255]">*</span>}
      </span>
      {children}
    </label>
  );
}

function ModalActions({
  saving,
  onCancel,
  submitLabel,
}: {
  saving: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-[#EFE7DE] pt-4 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className={secondaryButton}
      >
        Cancelar
      </button>
      <button type="submit" disabled={saving} className={primaryButton}>
        {saving ? (
          <LoaderCircle size={16} className="animate-spin" />
        ) : (
          <CheckCircle2 size={16} />
        )}
        {saving ? "Guardando..." : submitLabel}
      </button>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-12 text-center">
      <HandCoins size={30} className="mx-auto mb-3 text-[#9AAAB1]" />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[#78909C]">{detail}</p>
    </div>
  );
}
