"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
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
};

type Payment = {
  id: string;
  customer_id: string;
  payment_date: string;
  amount_mxn: number | string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type PaymentAllocation = {
  payment_id: string;
  sale_id: string;
  amount_mxn: number | string;
};

type PaymentRefund = {
  payment_id: string;
  amount_mxn: number | string;
  refund_date: string;
  reason: string;
};

type SaleBalance = {
  sale: Sale;
  customerName: string;
  total: number;
  received: number;
  balance: number;
};

const inputClass =
  "w-full rounded-xl border border-[#EFE7DE] bg-white px-3.5 py-3 text-sm text-[#0C304F] outline-none transition focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10 disabled:bg-[#FDF9F7] disabled:text-[#78909C]";
const labelClass = "mb-1.5 block text-sm font-semibold text-[#0C304F]";

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function localDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    transfer: "Transferencia",
    cash: "Efectivo",
    card: "Tarjeta",
    other: "Otro",
  };
  return labels[method] ?? method;
}

export default function FinanzasPage() {
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [refunds, setRefunds] = useState<PaymentRefund[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"receivables" | "payments">(
    "receivables",
  );

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentDate, setPaymentDate] = useState(localDateValue);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        customersResult,
        salesResult,
        itemsResult,
        paymentsResult,
        allocationsResult,
        refundsResult,
      ] = await Promise.all([
        supabase
          .from("customers")
          .select("id, full_name, phone, email")
          .eq("active", true)
          .order("full_name"),
        supabase
          .from("sales")
          .select("id, folio, customer_id, sale_date, status")
          .neq("status", "cancelled")
          .order("sale_date", { ascending: false }),
        supabase
          .from("sale_items")
          .select("sale_id, sale_price_mxn")
          .is("released_at", null),
        supabase
          .from("payments")
          .select(
            "id, customer_id, payment_date, amount_mxn, payment_method, reference, notes, status, created_at",
          )
          .order("payment_date", { ascending: false }),
        supabase
          .from("payment_allocations")
          .select("payment_id, sale_id, amount_mxn")
          .is("superseded_at", null),
        supabase
          .from("payment_refunds")
          .select("payment_id, amount_mxn, refund_date, reason"),
      ]);

      const results = [
        customersResult,
        salesResult,
        itemsResult,
        paymentsResult,
        allocationsResult,
        refundsResult,
      ];
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      setCustomers((customersResult.data ?? []) as Customer[]);
      setSales((salesResult.data ?? []) as Sale[]);
      setSaleItems((itemsResult.data ?? []) as SaleItem[]);
      setPayments((paymentsResult.data ?? []) as Payment[]);
      setAllocations((allocationsResult.data ?? []) as PaymentAllocation[]);
      setRefunds((refundsResult.data ?? []) as PaymentRefund[]);
    } catch (err) {
      console.error("Error cargando Finanzas:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los datos financieros.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const paymentById = useMemo(
    () => new Map(payments.map((payment) => [payment.id, payment])),
    [payments],
  );

  const refundByPayment = useMemo(() => {
    const totals = new Map<string, number>();
    refunds.forEach((refund) => {
      totals.set(
        refund.payment_id,
        (totals.get(refund.payment_id) ?? 0) + Number(refund.amount_mxn),
      );
    });
    return totals;
  }, [refunds]);

  const saleBalances = useMemo<SaleBalance[]>(() => {
    const totalsBySale = new Map<string, number>();
    saleItems.forEach((item) => {
      totalsBySale.set(
        item.sale_id,
        (totalsBySale.get(item.sale_id) ?? 0) + Number(item.sale_price_mxn),
      );
    });

    const receivedBySale = new Map<string, number>();
    allocations.forEach((allocation) => {
      const payment = paymentById.get(allocation.payment_id);
      if (
        !payment ||
        payment.status === "cancelled" ||
        payment.status === "refunded"
      )
        return;

      const paymentTotal = Number(payment.amount_mxn);
      if (paymentTotal <= 0) return;

      const refunded = Math.min(
        refundByPayment.get(payment.id) ?? 0,
        paymentTotal,
      );
      const netRatio = Math.max(paymentTotal - refunded, 0) / paymentTotal;
      const netAllocation = Number(allocation.amount_mxn) * netRatio;
      receivedBySale.set(
        allocation.sale_id,
        (receivedBySale.get(allocation.sale_id) ?? 0) + netAllocation,
      );
    });

    return sales.map((sale) => {
      const total = totalsBySale.get(sale.id) ?? 0;
      const received = receivedBySale.get(sale.id) ?? 0;
      return {
        sale,
        customerName:
          customerById.get(sale.customer_id)?.full_name ??
          "Cliente no disponible",
        total,
        received,
        balance: Math.max(total - received, 0),
      };
    });
  }, [
    sales,
    saleItems,
    allocations,
    paymentById,
    refundByPayment,
    customerById,
  ]);

  const totalSold = saleBalances.reduce((sum, item) => sum + item.total, 0);
  const totalReceivable = saleBalances.reduce(
    (sum, item) => sum + item.balance,
    0,
  );
  const totalReceived = payments.reduce((sum, payment) => {
    if (payment.status === "cancelled" || payment.status === "refunded")
      return sum;
    const amount = Number(payment.amount_mxn);
    return (
      sum +
      Math.max(
        amount - Math.min(refundByPayment.get(payment.id) ?? 0, amount),
        0,
      )
    );
  }, 0);

  const filteredSales = saleBalances.filter((item) => {
    const query = search.trim().toLowerCase();
    return (
      item.balance > 0.009 &&
      `${item.sale.folio} ${item.customerName}`.toLowerCase().includes(query)
    );
  });

  // Las cuentas se ordenan de la más antigua a la más reciente.
  // Si tienen la misma fecha, el folio funciona como desempate.
  const customerOpenSales = useMemo(
    () =>
      saleBalances
        .filter(
          (item) =>
            item.sale.customer_id === selectedCustomerId &&
            item.balance > 0.009,
        )
        .sort(
          (a, b) =>
            a.sale.sale_date.localeCompare(b.sale.sale_date) ||
            a.sale.folio.localeCompare(b.sale.folio),
        ),
    [saleBalances, selectedCustomerId],
  );

  const customerDebt = customerOpenSales.reduce(
    (sum, item) => sum + item.balance,
    0,
  );
  const paymentAmountNumber = Number(paymentAmount || 0);

  // Distribución automática tipo FIFO: primero se cubren las cuentas más antiguas.
  const automaticAllocations = useMemo(() => {
    let remainingCents = Number.isFinite(paymentAmountNumber)
      ? Math.max(Math.round(paymentAmountNumber * 100), 0)
      : 0;

    return customerOpenSales
      .map((item) => {
        const balanceCents = Math.max(Math.round(item.balance * 100), 0);
        const appliedCents = Math.min(balanceCents, remainingCents);
        remainingCents -= appliedCents;

        return {
          sale_id: item.sale.id,
          folio: item.sale.folio,
          balance: item.balance,
          amount_mxn: appliedCents / 100,
        };
      })
      .filter((item) => item.amount_mxn > 0);
  }, [customerOpenSales, paymentAmountNumber]);

  const allocationTotal = automaticAllocations.reduce(
    (sum, item) => sum + item.amount_mxn,
    0,
  );
  const paymentExceedsDebt = paymentAmountNumber > customerDebt + 0.009;

  const paymentHistory = useMemo(() => {
    return payments.map((payment) => {
      const relatedAllocations = allocations.filter(
        (allocation) => allocation.payment_id === payment.id,
      );
      const allocatedTotal = relatedAllocations.reduce(
        (sum, allocation) => sum + Number(allocation.amount_mxn),
        0,
      );
      const refundTotal = refundByPayment.get(payment.id) ?? 0;
      const folios = relatedAllocations
        .map(
          (allocation) =>
            sales.find((sale) => sale.id === allocation.sale_id)?.folio,
        )
        .filter(Boolean);
      return {
        payment,
        refundTotal,
        allocatedTotal,
        folios: folios.join(", ") || "Sin asignación",
      };
    });
  }, [payments, allocations, refundByPayment, sales]);

  async function handleRegisterPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedCustomerId) {
      setError("Selecciona un cliente.");
      return;
    }

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Captura un importe recibido mayor que cero.");
      return;
    }

    if (amount > customerDebt + 0.009) {
      setError(
        `El importe supera la deuda total del cliente (${money(customerDebt)}).`,
      );
      return;
    }

    const selectedAllocations = automaticAllocations.map(
      ({ sale_id, amount_mxn }) => ({
        sale_id,
        amount_mxn: Number(amount_mxn.toFixed(2)),
      }),
    );

    if (
      selectedAllocations.length === 0 ||
      Math.abs(allocationTotal - amount) > 0.009
    ) {
      setError(
        "No fue posible distribuir el pago entre las cuentas pendientes del cliente.",
      );
      return;
    }

    setSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("register_payment", {
        p_customer_id: selectedCustomerId,
        p_amount_mxn: amount,
        p_payment_method: paymentMethod,
        p_allocations: selectedAllocations.map(({ sale_id, amount_mxn }) => ({
          sale_id,
          amount_mxn: Number(amount_mxn.toFixed(2)),
        })),
        p_payment_date: paymentDate,
        p_reference: reference.trim() || null,
        p_notes: notes.trim() || null,
      });

      if (rpcError) throw rpcError;
      const result = data as { success?: boolean; payment_id?: string };
      if (!result?.success || !result.payment_id) {
        throw new Error("Supabase no confirmó el registro del pago.");
      }

      setSuccess(
        `Pago registrado correctamente. Importe: ${money(amount)}. Se distribuyó automáticamente entre ${selectedAllocations.length} venta(s), comenzando por la cuenta más antigua.`,
      );
      setPaymentAmount("");
      setSelectedCustomerId("");
      setPaymentMethod("transfer");
      setPaymentDate(localDateValue());
      setReference("");
      setNotes("");
      await loadData();
    } catch (err) {
      console.error("Error registrando pago:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo registrar el pago.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FDF9F7] p-4 text-[#0C304F] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#36709E]">
              <Wallet size={17} /> Operaciones / Finanzas
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
            <p className="mt-2 text-sm text-[#78909C]">
              Consulta cuentas por cobrar, registra abonos y revisa los pagos
              recibidos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm font-semibold transition hover:border-[#36709E] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Actualizar información
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <div className="mb-3 flex items-center justify-between text-sm text-[#78909C]">
              Total vendido <ReceiptText size={18} className="text-[#36709E]" />
            </div>
            <p className="text-2xl font-bold">
              {loading ? "—" : money(totalSold)}
            </p>
            <p className="mt-1 text-xs text-[#78909C]">Ventas no canceladas</p>
          </div>
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <div className="mb-3 flex items-center justify-between text-sm text-[#78909C]">
              Dinero recibido{" "}
              <ArrowDownToLine size={18} className="text-green-700" />
            </div>
            <p className="text-2xl font-bold">
              {loading ? "—" : money(totalReceived)}
            </p>
            <p className="mt-1 text-xs text-[#78909C]">
              Menos devoluciones registradas
            </p>
          </div>
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <div className="mb-3 flex items-center justify-between text-sm text-[#78909C]">
              Por cobrar{" "}
              <CircleDollarSign size={18} className="text-[#CC6255]" />
            </div>
            <p className="text-2xl font-bold">
              {loading ? "—" : money(totalReceivable)}
            </p>
            <p className="mt-1 text-xs text-[#78909C]">
              Saldo pendiente de ventas
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-[#36709E]/10 p-2.5 text-[#36709E]">
              <ClipboardList size={21} />
            </div>
            <div>
              <h2 className="font-bold">Cuentas por cobrar</h2>
              <p className="text-sm text-[#78909C]">
                Ventas con saldo pendiente.
              </p>
            </div>
          </div>

          <div className="relative mb-4 max-w-md">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por folio o cliente..."
              className={`${inputClass} pl-10`}
            />
          </div>

          {loading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-[#78909C]">
              <LoaderCircle className="animate-spin" size={20} /> Cargando
              información...
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-10 text-center">
              <CheckCircle2 className="mx-auto mb-2 text-green-700" size={28} />
              <p className="font-semibold">No hay saldos pendientes</p>
              <p className="mt-1 text-sm text-[#78909C]">
                No encontramos ventas pendientes con esa búsqueda.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-[#EFE7DE] text-xs uppercase tracking-wide text-[#78909C]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Venta</th>
                    <th className="px-3 py-3 font-semibold">Cliente</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Total
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Recibido
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE7DE]">
                  {filteredSales.map((item) => (
                    <tr key={item.sale.id} className="hover:bg-[#FDF9F7]">
                      <td className="px-3 py-3.5">
                        <p className="font-semibold">{item.sale.folio}</p>
                        <p className="mt-0.5 text-xs text-[#78909C]">
                          {item.sale.sale_date}
                        </p>
                      </td>
                      <td className="px-3 py-3.5">{item.customerName}</td>
                      <td className="px-3 py-3.5 text-right">
                        {money(item.total)}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        {money(item.received)}
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-[#CC6255]">
                        {money(item.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-[#E2732D]/10 p-2.5 text-[#E2732D]">
              <CircleDollarSign size={21} />
            </div>
            <div>
              <h2 className="font-bold">Registrar pago o abono</h2>
              <p className="text-sm text-[#78909C]">
                Un pago puede distribuirse entre varias ventas del mismo
                cliente.
              </p>
            </div>
          </div>

          <form onSubmit={handleRegisterPayment} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="payment-customer" className={labelClass}>
                  Cliente *
                </label>
                <select
                  id="payment-customer"
                  required
                  value={selectedCustomerId}
                  onChange={(event) => {
                    setSelectedCustomerId(event.target.value);
                    setPaymentAmount("");
                  }}
                  className={inputClass}
                  disabled={saving}
                >
                  <option value="">Selecciona un cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="payment-amount" className={labelClass}>
                  Importe recibido (MXN) *
                </label>
                <input
                  id="payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={customerDebt || undefined}
                  required
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                  disabled={
                    saving ||
                    !selectedCustomerId ||
                    customerOpenSales.length === 0
                  }
                />
                {selectedCustomerId && (
                  <p className="mt-1 text-xs text-[#78909C]">
                    Deuda total pendiente: {money(customerDebt)}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="payment-method" className={labelClass}>
                  Método de pago *
                </label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className={inputClass}
                  disabled={saving}
                >
                  <option value="transfer">Transferencia</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label htmlFor="payment-date" className={labelClass}>
                  Fecha de pago *
                </label>
                <div className="relative">
                  <CalendarDays
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
                  />
                  <input
                    id="payment-date"
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    className={`${inputClass} pl-10`}
                    disabled={saving}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="payment-reference" className={labelClass}>
                  Referencia (opcional)
                </label>
                <input
                  id="payment-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className={inputClass}
                  placeholder="Folio o autorización"
                  disabled={saving}
                />
              </div>
            </div>

            {selectedCustomerId && (
              <div className="rounded-xl border border-[#EFE7DE] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">
                      Distribución automática del abono
                    </h3>
                    <p className="text-xs text-[#78909C]">
                      El sistema aplica el pago a las cuentas más antiguas
                      primero. No necesitas elegir folios.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#78909C]">Abono a registrar</p>
                    <p className="text-lg font-bold">
                      {money(
                        Number.isFinite(paymentAmountNumber)
                          ? paymentAmountNumber
                          : 0,
                      )}
                    </p>
                  </div>
                </div>

                {customerOpenSales.length === 0 ? (
                  <p className="rounded-lg bg-[#FDF9F7] p-4 text-sm text-[#78909C]">
                    Este cliente no tiene ventas con saldo pendiente.
                  </p>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between rounded-lg bg-[#FDF9F7] p-3">
                      <span className="text-sm text-[#78909C]">
                        Deuda total del cliente
                      </span>
                      <span className="font-bold">{money(customerDebt)}</span>
                    </div>

                    {paymentExceedsDebt && (
                      <p
                        role="alert"
                        className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                      >
                        El abono no puede superar la deuda total de{" "}
                        {money(customerDebt)}.
                      </p>
                    )}

                    <div className="space-y-2">
                      {customerOpenSales.map((item) => {
                        const applied =
                          automaticAllocations.find(
                            (allocation) => allocation.sale_id === item.sale.id,
                          )?.amount_mxn ?? 0;

                        return (
                          <div
                            key={item.sale.id}
                            className="grid grid-cols-1 items-center gap-2 rounded-lg bg-[#FDF9F7] p-3 sm:grid-cols-[1fr_auto]"
                          >
                            <div>
                              <p className="text-sm font-semibold">
                                {item.sale.folio}
                              </p>
                              <p className="text-xs text-[#78909C]">
                                Saldo pendiente: {money(item.balance)}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-xs text-[#78909C]">
                                Abono aplicado
                              </p>
                              <p className="font-semibold">{money(applied)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[#EFE7DE] pt-3">
                      <span className="text-sm font-semibold">
                        Total distribuido
                      </span>
                      <span className="text-lg font-bold text-[#36709E]">
                        {money(allocationTotal)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div>
              <label htmlFor="payment-notes" className={labelClass}>
                Notas (opcional)
              </label>
              <textarea
                id="payment-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={inputClass}
                placeholder="Detalles adicionales del pago"
                disabled={saving}
              />
            </div>

            <div className="flex flex-col items-stretch justify-between gap-3 border-t border-[#EFE7DE] pt-4 sm:flex-row sm:items-center">
              <p className="text-xs text-[#78909C]">
                El pago se distribuirá automáticamente entre las cuentas
                pendientes más antiguas.
              </p>
              <button
                type="submit"
                disabled={
                  saving ||
                  loading ||
                  !selectedCustomerId ||
                  customerOpenSales.length === 0 ||
                  !Number.isFinite(paymentAmountNumber) ||
                  paymentAmountNumber <= 0 ||
                  paymentExceedsDebt ||
                  Math.abs(allocationTotal - paymentAmountNumber) > 0.009
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-[#E2732D] px-5 py-3 font-bold text-white transition hover:bg-[#CC6255] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {saving
                  ? "Registrando pago..."
                  : `Registrar pago ${paymentAmountNumber > 0 ? money(paymentAmountNumber) : ""}`}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#36709E]/10 p-2.5 text-[#36709E]">
                <ReceiptText size={21} />
              </div>
              <div>
                <h2 className="font-bold">Historial de pagos</h2>
                <p className="text-sm text-[#78909C]">
                  Pagos registrados y ventas a las que fueron asignados.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("receivables")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === "receivables" ? "bg-[#0C304F] text-white" : "bg-[#FDF9F7] text-[#78909C]"}`}
              >
                Cuentas por cobrar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("payments")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === "payments" ? "bg-[#0C304F] text-white" : "bg-[#FDF9F7] text-[#78909C]"}`}
              >
                Pagos
              </button>
            </div>
          </div>

          {activeTab === "payments" &&
            (paymentHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-9 text-center text-sm text-[#78909C]">
                Todavía no hay pagos registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-[#EFE7DE] text-xs uppercase tracking-wide text-[#78909C]">
                    <tr>
                      <th className="px-3 py-3 font-semibold">Fecha</th>
                      <th className="px-3 py-3 font-semibold">Cliente</th>
                      <th className="px-3 py-3 font-semibold">
                        Ventas relacionadas
                      </th>
                      <th className="px-3 py-3 text-right font-semibold">
                        Pago
                      </th>
                      <th className="px-3 py-3 text-right font-semibold">
                        Devolución
                      </th>
                      <th className="px-3 py-3 font-semibold">Método</th>
                      <th className="px-3 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE7DE]">
                    {paymentHistory.map(({ payment, refundTotal, folios }) => (
                      <tr key={payment.id} className="hover:bg-[#FDF9F7]">
                        <td className="px-3 py-3.5">{payment.payment_date}</td>
                        <td className="px-3 py-3.5">
                          {customerById.get(payment.customer_id)?.full_name ??
                            "Cliente no disponible"}
                        </td>
                        <td className="px-3 py-3.5">{folios}</td>
                        <td className="px-3 py-3.5 text-right font-semibold">
                          {money(Number(payment.amount_mxn))}
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          {money(refundTotal)}
                        </td>
                        <td className="px-3 py-3.5">
                          {paymentMethodLabel(payment.payment_method)}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="rounded-lg bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                            {payment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          {activeTab === "receivables" && (
            <p className="rounded-lg bg-[#FDF9F7] p-4 text-sm text-[#78909C]">
              La tabla de cuentas por cobrar está disponible arriba. Aquí puedes
              cambiar a Pagos para consultar el historial.
            </p>
          )}
        </section>

        <p className="text-center text-xs text-[#78909C]">
          Los importes se calculan a partir de ventas, asignaciones y
          devoluciones registradas en Supabase.
        </p>
      </div>
    </main>
  );
}
