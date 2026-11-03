"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Package,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp,
  Wallet,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

type Period = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
};

type Sale = {
  id: string;
  folio: string;
  customer_id: string | null;
  operation_period_id: string | null;
  sale_date: string;
  status: string;
};

type SaleItem = {
  id: string;
  sale_id: string;
  inventory_unit_id: string;
  sale_price_mxn: number | string;
  unit_cost_mxn_snapshot: number | string;
  released_at: string | null;
};

type Purchase = {
  id: string;
  operation_period_id: string;
  store_id: string;
};

type PurchaseItem = {
  id: string;
  purchase_id: string;
  product_name: string;
  brand: string | null;
  model: string | null;
  quantity: number | string;
  unit_cost_mxn: number | string;
};

type InventoryUnit = {
  id: string;
  purchase_item_id: string;
  status: string;
};

type Expense = {
  id: string;
  operation_period_id: string | null;
  amount_mxn: number | string | null;
  amount: number | string;
  currency: "MXN" | "USD";
  exchange_rate: number | string | null;
};

type Customer = {
  id: string;
  full_name: string;
};

type Investor = {
  id: string;
  full_name: string;
};

type InvestmentParticipation = {
  id: string;
  investor_id: string;
  operation_period_id: string;
  participating_capital_mxn: number | string;
  expected_return_rate: number | string;
  expected_return_mxn: number | string;
  validated_return_mxn: number | string | null;
  status: string;
};

type InvestorMovement = {
  id: string;
  investor_id: string;
  participation_id: string | null;
  movement_type:
    | "return_payment"
    | "capital_withdrawal"
    | "reinvestment"
    | "adjustment";
  amount_mxn: number | string;
  movement_date: string;
};

type InvestorSummary = {
  investorId: string;
  name: string;
  capital: number;
  returnRate: number;
  expectedReturn: number;
  paid: number;
  pending: number;
};

type Store = {
  id: string;
  name: string;
};

type SaleSummary = {
  sale: Sale;
  total: number;
  units: number;
  customerName: string;
};

type StoreSummary = {
  storeId: string;
  name: string;
  purchasedUnits: number;
  soldUnits: number;
  personalUseUnits: number;
  personalUseCost: number;
  purchaseCost: number;
};

type ProductSummary = {
  name: string;
  brand: string;
  units: number;
  revenue: number;
};

const supabase = createClient();
const PAGE_COLORS = [
  "#0C304F",
  "#36709E",
  "#E2732D",
  "#CC6255",
  "#6C8B74",
  "#8B78A8",
  "#C49A55",
  "#6B8790",
];

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const numberFormat = (value: number) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(value);

function formatDate(value: string | null) {
  if (!value) return "Sin fecha de cierre";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
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
  if (expense.currency === "MXN") return amount;
  return amount * Number(expense.exchange_rate ?? 0);
}

function periodStatusLabel(status: string) {
  if (status === "planning") return "En planeación";
  if (status === "selling") return "Abierto";
  if (status === "finished") return "Cerrado";
  return status;
}

export default function FinanzasResultadosPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [participations, setParticipations] = useState<
    InvestmentParticipation[]
  >([]);
  const [investorMovements, setInvestorMovements] = useState<
    InvestorMovement[]
  >([]);
  const [periodId, setPeriodId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [
        periodsResult,
        salesResult,
        customersResult,
        saleItemsResult,
        purchasesResult,
        purchaseItemsResult,
        inventoryResult,
        expensesResult,
        storesResult,
        investorsResult,
        participationsResult,
        investorMovementsResult,
      ] = await Promise.all([
        supabase
          .from("operation_periods")
          .select("id, name, start_date, end_date, status")
          .order("start_date", { ascending: false }),
        supabase
          .from("sales")
          .select(
            "id, folio, customer_id, operation_period_id, sale_date, status",
          )
          .neq("status", "cancelled")
          .order("sale_date", { ascending: false }),
        supabase.from("customers").select("id, full_name").order("full_name"),
        supabase
          .from("sale_items")
          .select(
            "id, sale_id, inventory_unit_id, sale_price_mxn, unit_cost_mxn_snapshot, released_at",
          )
          .is("released_at", null),
        supabase.from("purchases").select("id, operation_period_id, store_id"),
        supabase
          .from("purchase_items")
          .select(
            "id, purchase_id, product_name, brand, model, quantity, unit_cost_mxn",
          ),
        supabase.from("inventory_units").select("id, purchase_item_id, status"),
        supabase
          .from("expenses")
          .select(
            "id, operation_period_id, amount_mxn, amount, currency, exchange_rate",
          ),
        supabase.from("stores").select("id, name").order("name"),
        supabase.from("investors").select("id, full_name").order("full_name"),
        supabase
          .from("investment_participations")
          .select(
            "id, investor_id, operation_period_id, participating_capital_mxn, expected_return_rate, expected_return_mxn, validated_return_mxn, status",
          ),
        supabase
          .from("investor_movements")
          .select(
            "id, investor_id, participation_id, movement_type, amount_mxn, movement_date",
          ),
      ]);

      const results = [
        { label: "periodos de operación", result: periodsResult },
        { label: "ventas", result: salesResult },
        { label: "clientes", result: customersResult },
        { label: "productos vendidos", result: saleItemsResult },
        { label: "compras", result: purchasesResult },
        { label: "líneas de compra", result: purchaseItemsResult },
        { label: "inventario", result: inventoryResult },
        { label: "gastos operativos", result: expensesResult },
        { label: "tiendas", result: storesResult },
        { label: "inversionistas", result: investorsResult },
        {
          label: "participaciones de inversionistas",
          result: participationsResult,
        },
        {
          label: "movimientos de inversionistas",
          result: investorMovementsResult,
        },
      ];
      const failed = results.find(({ result }) => result.error);
      if (failed?.result.error) {
        const dbError = failed.result.error as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };
        const details = [
          dbError.message,
          dbError.details,
          dbError.hint ? `Sugerencia: ${dbError.hint}` : null,
          dbError.code ? `Código: ${dbError.code}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        throw new Error(
          `Error consultando ${failed.label}${details ? `: ${details}` : ". Revisa los nombres de columnas y permisos en Supabase."}`,
        );
      }

      const nextPeriods = (periodsResult.data ?? []) as Period[];
      setPeriods(nextPeriods);
      setSales((salesResult.data ?? []) as Sale[]);
      setCustomers((customersResult.data ?? []) as Customer[]);
      setSaleItems((saleItemsResult.data ?? []) as SaleItem[]);
      setPurchases((purchasesResult.data ?? []) as Purchase[]);
      setPurchaseItems((purchaseItemsResult.data ?? []) as PurchaseItem[]);
      setInventoryUnits((inventoryResult.data ?? []) as InventoryUnit[]);
      setExpenses((expensesResult.data ?? []) as Expense[]);
      setStores((storesResult.data ?? []) as Store[]);
      setInvestors((investorsResult.data ?? []) as Investor[]);
      setParticipations(
        (participationsResult.data ?? []) as InvestmentParticipation[],
      );
      setInvestorMovements(
        (investorMovementsResult.data ?? []) as InvestorMovement[],
      );
      setPeriodId((current) =>
        current && nextPeriods.some((period) => period.id === current)
          ? current
          : (nextPeriods[0]?.id ?? ""),
      );
    } catch (err) {
      const message =
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof err.message === "string"
          ? err.message
          : "No se pudo cargar el estado de resultados. Revisa la conexión y los permisos de Supabase.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const report = useMemo(() => {
    const selectedPeriod =
      periods.find((period) => period.id === periodId) ?? null;
    if (!periodId) return null;

    const storeById = new Map(stores.map((store) => [store.id, store.name]));
    const purchaseById = new Map(
      purchases.map((purchase) => [purchase.id, purchase]),
    );
    const purchaseItemById = new Map(
      purchaseItems.map((item) => [item.id, item]),
    );
    const inventoryUnitById = new Map(
      inventoryUnits.map((unit) => [unit.id, unit]),
    );

    const periodSales = sales.filter(
      (sale) =>
        sale.operation_period_id === periodId && sale.status !== "cancelled",
    );
    const saleIds = new Set(periodSales.map((sale) => sale.id));
    const periodSaleItems = saleItems.filter(
      (item) => saleIds.has(item.sale_id) && !item.released_at,
    );

    const revenue = periodSaleItems.reduce(
      (sum, item) => sum + Number(item.sale_price_mxn),
      0,
    );
    const costOfGoodsSold = periodSaleItems.reduce(
      (sum, item) => sum + Number(item.unit_cost_mxn_snapshot),
      0,
    );
    const grossProfit = revenue - costOfGoodsSold;
    const operatingExpenses = expenses
      .filter((expense) => expense.operation_period_id === periodId)
      .reduce((sum, expense) => sum + expenseAmountMxn(expense), 0);

    // En el esquema actual de Patos Deals, purchases no tiene columna status.
    // Cada registro creado por create_purchase pertenece al periodo asignado.
    const periodPurchases = purchases.filter(
      (purchase) => purchase.operation_period_id === periodId,
    );
    const periodPurchaseIds = new Set(
      periodPurchases.map((purchase) => purchase.id),
    );
    const periodPurchaseItems = purchaseItems.filter((item) =>
      periodPurchaseIds.has(item.purchase_id),
    );
    const purchaseCost = periodPurchaseItems.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unit_cost_mxn),
      0,
    );
    const purchasedUnits = periodPurchaseItems.reduce(
      (sum, item) => sum + Number(item.quantity),
      0,
    );

    const periodPersonalUnits = inventoryUnits.filter((unit) => {
      if (unit.status !== "personal_use") return false;
      const purchaseItem = purchaseItemById.get(unit.purchase_item_id);
      if (!purchaseItem) return false;
      return periodPurchaseIds.has(purchaseItem.purchase_id);
    });
    const personalUseCost = periodPersonalUnits.reduce((sum, unit) => {
      const purchaseItem = purchaseItemById.get(unit.purchase_item_id);
      return sum + Number(purchaseItem?.unit_cost_mxn ?? 0);
    }, 0);
    const personalUseUnits = periodPersonalUnits.length;

    // Cada participación tiene un rendimiento esperado calculado en Supabase.
    // Si el rendimiento fue validado, se usa ese importe; los pagos salen de investor_movements.
    const periodParticipations = participations.filter(
      (item) =>
        item.operation_period_id === periodId && item.status !== "cancelled",
    );
    const participationIds = new Set(
      periodParticipations.map((item) => item.id),
    );
    const investorById = new Map(
      investors.map((investor) => [investor.id, investor.full_name]),
    );
    const paidByParticipation = new Map<string, number>();
    investorMovements.forEach((movement) => {
      if (
        movement.movement_type !== "return_payment" ||
        !movement.participation_id ||
        !participationIds.has(movement.participation_id)
      )
        return;
      paidByParticipation.set(
        movement.participation_id,
        (paidByParticipation.get(movement.participation_id) ?? 0) +
          Number(movement.amount_mxn),
      );
    });

    const investorSummary: InvestorSummary[] = periodParticipations
      .map((participation) => {
        const expectedReturn =
          participation.validated_return_mxn == null
            ? Number(participation.expected_return_mxn)
            : Number(participation.validated_return_mxn);
        const paid = paidByParticipation.get(participation.id) ?? 0;
        return {
          investorId: participation.investor_id,
          name:
            investorById.get(participation.investor_id) ??
            "Inversionista no disponible",
          capital: Number(participation.participating_capital_mxn),
          returnRate: Number(participation.expected_return_rate),
          expectedReturn,
          paid,
          pending: Math.max(expectedReturn - paid, 0),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const investorReturnTotal = investorSummary.reduce(
      (sum, investor) => sum + investor.expectedReturn,
      0,
    );
    const investorReturnPaid = investorSummary.reduce(
      (sum, investor) => sum + investor.paid,
      0,
    );
    const investorReturnPending = investorSummary.reduce(
      (sum, investor) => sum + investor.pending,
      0,
    );

    // El rendimiento total comprometido se resta una sola vez al resultado neto.
    // El capital aportado no es gasto ni se descuenta de la utilidad.
    const netProfit = grossProfit - operatingExpenses - personalUseCost;
    const profitAfterInvestors = netProfit - investorReturnTotal;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const retainedMargin =
      revenue > 0 ? (profitAfterInvestors / revenue) * 100 : 0;

    const customerById = new Map(
      customers.map((customer) => [customer.id, customer.full_name]),
    );
    const saleTotals = new Map<string, number>();
    const saleUnitCounts = new Map<string, number>();
    periodSaleItems.forEach((item) => {
      saleTotals.set(
        item.sale_id,
        (saleTotals.get(item.sale_id) ?? 0) + Number(item.sale_price_mxn),
      );
      saleUnitCounts.set(
        item.sale_id,
        (saleUnitCounts.get(item.sale_id) ?? 0) + 1,
      );
    });
    const saleSummaries: SaleSummary[] = periodSales
      .map((sale) => ({
        sale,
        total: saleTotals.get(sale.id) ?? 0,
        units: saleUnitCounts.get(sale.id) ?? 0,
        customerName: sale.customer_id
          ? (customerById.get(sale.customer_id) ?? "Cliente no disponible")
          : "Venta sin cliente",
      }))
      .filter((item) => item.units > 0)
      .sort((a, b) => b.total - a.total);
    const averageTicket =
      saleSummaries.length > 0
        ? saleSummaries.reduce((sum, item) => sum + item.total, 0) /
          saleSummaries.length
        : 0;
    const highestSale = saleSummaries[0] ?? null;

    const storeMap = new Map<string, StoreSummary>();
    const getStoreSummary = (storeId: string | null | undefined) => {
      const key = storeId || "unknown";
      if (!storeMap.has(key)) {
        storeMap.set(key, {
          storeId: key,
          name:
            key === "unknown"
              ? "Tienda no disponible"
              : (storeById.get(key) ?? "Tienda no disponible"),
          purchasedUnits: 0,
          soldUnits: 0,
          personalUseUnits: 0,
          personalUseCost: 0,
          purchaseCost: 0,
        });
      }
      return storeMap.get(key)!;
    };

    periodPurchaseItems.forEach((item) => {
      const purchase = purchaseById.get(item.purchase_id);
      const store = getStoreSummary(purchase?.store_id);
      const quantity = Number(item.quantity);
      store.purchasedUnits += quantity;
      store.purchaseCost += quantity * Number(item.unit_cost_mxn);
    });

    periodPersonalUnits.forEach((unit) => {
      const purchaseItem = purchaseItemById.get(unit.purchase_item_id);
      const purchase = purchaseItem
        ? purchaseById.get(purchaseItem.purchase_id)
        : null;
      const store = getStoreSummary(purchase?.store_id);
      store.personalUseUnits += 1;
      store.personalUseCost += Number(purchaseItem?.unit_cost_mxn ?? 0);
    });

    const soldByProduct = new Map<string, ProductSummary>();
    let soldUnitsByStore = 0;
    periodSaleItems.forEach((saleItem) => {
      const unit = inventoryUnitById.get(saleItem.inventory_unit_id);
      const purchaseItem = unit
        ? purchaseItemById.get(unit.purchase_item_id)
        : null;
      const purchase = purchaseItem
        ? purchaseById.get(purchaseItem.purchase_id)
        : null;
      const store = getStoreSummary(purchase?.store_id);
      store.soldUnits += 1;
      soldUnitsByStore += 1;

      const productName = purchaseItem?.product_name ?? "Producto sin nombre";
      const brand = purchaseItem?.brand ?? "";
      const productKey = `${productName.trim().toLowerCase()}|${brand.trim().toLowerCase()}`;
      const current = soldByProduct.get(productKey) ?? {
        name: productName,
        brand,
        units: 0,
        revenue: 0,
      };
      current.units += 1;
      current.revenue += Number(saleItem.sale_price_mxn);
      soldByProduct.set(productKey, current);
    });

    const storesSummary = Array.from(storeMap.values()).sort(
      (a, b) =>
        b.purchasedUnits - a.purchasedUnits || a.name.localeCompare(b.name),
    );
    const storeSalesRanking = [...storesSummary].sort(
      (a, b) => b.soldUnits - a.soldUnits || a.name.localeCompare(b.name),
    );
    const topProducts = Array.from(soldByProduct.values())
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 5);

    return {
      selectedPeriod,
      revenue,
      costOfGoodsSold,
      grossProfit,
      operatingExpenses,
      personalUseCost,
      personalUseUnits,
      netProfit,
      netMargin,
      investorReturnTotal,
      investorReturnPaid,
      investorReturnPending,
      investorSummary,
      profitAfterInvestors,
      retainedMargin,
      purchaseCost,
      purchasedUnits,
      saleCount: saleSummaries.length,
      soldUnits: periodSaleItems.length,
      averageTicket,
      highestSale,
      saleSummaries,
      storesSummary,
      storeSalesRanking,
      topProducts,
      soldUnitsByStore,
    };
  }, [
    periods,
    periodId,
    sales,
    customers,
    saleItems,
    purchases,
    purchaseItems,
    inventoryUnits,
    expenses,
    stores,
    investors,
    participations,
    investorMovements,
  ]);

  const pieData = useMemo(() => {
    if (!report)
      return [] as {
        name: string;
        value: number;
        color: string;
        percent: number;
      }[];
    const rows = report.storesSummary
      .filter((store) => store.purchasedUnits > 0)
      .sort((a, b) => b.purchasedUnits - a.purchasedUnits);
    const total = rows.reduce((sum, row) => sum + row.purchasedUnits, 0);
    return rows.map((row, index) => ({
      name: row.name,
      value: row.purchasedUnits,
      color: PAGE_COLORS[index % PAGE_COLORS.length],
      percent: total > 0 ? (row.purchasedUnits / total) * 100 : 0,
    }));
  }, [report]);

  const pieBackground = useMemo(() => {
    if (pieData.length === 0) return "#E9E3DE";
    let cursor = 0;
    const sections = pieData.map((item) => {
      const start = cursor;
      cursor += item.percent;
      return `${item.color} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${sections.join(", ")})`;
  }, [pieData]);

  const maxTopProductUnits = Math.max(
    1,
    ...(report?.topProducts.map((item) => item.units) ?? [1]),
  );

  return (
    <main className="min-h-screen bg-[#FDF9F7] p-4 text-[#0C304F] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link
              href="/admin/finanzas"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#36709E] transition hover:text-[#0C304F]"
            >
              <ArrowLeft size={16} /> Volver a Finanzas
            </Link>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#36709E]">
              <BarChart3 size={17} /> Finanzas / Rentabilidad por periodo
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Resultados por periodo
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#78909C]">
              Ventas, margen, gastos, mercancía de uso personal y comportamiento
              de compra por tienda.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/admin/finanzas/gastos"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm font-semibold transition hover:border-[#36709E]"
            >
              <Wallet size={16} /> Gastos operativos
            </Link>
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0C304F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17466B] disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Actualizar
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
          </div>
        )}

        <section className="rounded-2xl border border-[#EFE7DE] bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label
                htmlFor="result-period"
                className="mb-1.5 block text-sm font-semibold"
              >
                Periodo de operación
              </label>
              <select
                id="result-period"
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
                disabled={loading || periods.length === 0}
                className="w-full min-w-0 rounded-xl border border-[#EFE7DE] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#36709E] sm:min-w-[320px]"
              >
                {periods.length === 0 && (
                  <option value="">No hay periodos registrados</option>
                )}
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} · {periodStatusLabel(period.status)}
                  </option>
                ))}
              </select>
            </div>
            {report?.selectedPeriod && (
              <div className="flex items-center gap-2 text-xs text-[#78909C]">
                <CalendarDays size={15} />
                {formatDate(report.selectedPeriod.start_date)} –{" "}
                {formatDate(report.selectedPeriod.end_date)}
              </div>
            )}
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#78909C]">
            <LoaderCircle size={22} className="animate-spin" /> Calculando
            resultados del periodo...
          </div>
        ) : !periodId || !report ? (
          <div className="rounded-2xl border border-dashed border-[#EFE7DE] bg-white px-4 py-14 text-center">
            <CalendarDays size={34} className="mx-auto mb-3 text-[#78909C]" />
            <p className="font-semibold">
              Todavía no hay periodos para analizar
            </p>
            <p className="mt-1 text-sm text-[#78909C]">
              Crea un periodo de operación y registra compras, ventas y gastos
              para generar el reporte.
            </p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Ventas totales"
                value={money(report.revenue)}
                detail={`${numberFormat(report.saleCount)} ventas · ${numberFormat(report.soldUnits)} artículos`}
                icon={<ShoppingBag size={18} />}
                tone="blue"
              />
              <MetricCard
                label="Utilidad bruta"
                value={money(report.grossProfit)}
                detail={`Ventas menos costo de mercancía vendida (${money(report.costOfGoodsSold)})`}
                icon={<TrendingUp size={18} />}
                tone="green"
              />
              <MetricCard
                label="Gastos operativos"
                value={money(report.operatingExpenses)}
                detail="Gastos asignados a este periodo"
                icon={<Wallet size={18} />}
                tone="orange"
              />
              <MetricCard
                label="Uso personal"
                value={money(report.personalUseCost)}
                detail={`${numberFormat(report.personalUseUnits)} artículos marcados actualmente como uso personal`}
                icon={<Package size={18} />}
                tone="purple"
              />
              <MetricCard
                label="Rendimiento inversionistas"
                value={money(report.investorReturnTotal)}
                detail={`${money(report.investorReturnPaid)} pagado · ${money(report.investorReturnPending)} pendiente`}
                icon={<CircleDollarSign size={18} />}
                tone="orange"
              />
              <div
                className={`rounded-2xl border p-5 ${report.netProfit >= 0 ? "border-green-200 bg-green-50/70" : "border-red-200 bg-red-50/70"}`}
              >
                <div className="mb-3 flex items-center justify-between text-sm text-[#78909C]">
                  <span className="font-semibold">
                    Resultado antes de inversionistas
                  </span>
                  <CircleDollarSign
                    size={19}
                    className={
                      report.netProfit >= 0 ? "text-green-700" : "text-red-700"
                    }
                  />
                </div>
                <p
                  className={`text-2xl font-bold tabular-nums ${report.netProfit >= 0 ? "text-green-800" : "text-red-800"}`}
                >
                  {money(report.netProfit)}
                </p>
                <p className="mt-1 text-xs text-[#78909C]">
                  Margen antes de rendimientos: {report.netMargin.toFixed(1)}%
                </p>
              </div>
              <MetricCard
                label="Compras de inventario"
                value={money(report.purchaseCost)}
                detail={`${numberFormat(report.purchasedUnits)} unidades adquiridas · inversión de inventario, no deducida dos veces`}
                icon={<Store size={18} />}
                tone="slate"
              />
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SmallMetric
                label="Ticket promedio"
                value={money(report.averageTicket)}
                detail="Venta promedio por folio"
                icon={<CircleDollarSign size={17} />}
              />
              <SmallMetric
                label="Venta más alta"
                value={
                  report.highestSale
                    ? money(report.highestSale.total)
                    : money(0)
                }
                detail={
                  report.highestSale
                    ? `${report.highestSale.customerName} · ${formatDate(report.highestSale.sale.sale_date)}`
                    : "Sin ventas registradas"
                }
                icon={<ArrowUpRight size={17} />}
              />
              <SmallMetric
                label="Margen neto"
                value={`${report.netMargin.toFixed(1)}%`}
                detail="Resultado antes de rendimientos sobre ventas"
                icon={<ArrowDownRight size={17} />}
              />
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
                <div className="mb-5">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-[#36709E]/10 p-2 text-[#36709E]">
                      <Store size={19} />
                    </div>
                    <h2 className="font-bold">Unidades compradas por tienda</h2>
                  </div>
                  <p className="mt-2 text-sm text-[#78909C]">
                    Distribución de artículos adquiridos en el periodo
                    seleccionado.
                  </p>
                </div>
                {pieData.length === 0 ? (
                  <div className="flex min-h-48 items-center justify-center rounded-xl bg-[#FDF9F7] px-4 text-center text-sm text-[#78909C]">
                    No hay compras registradas para este periodo.
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                    <div
                      className="relative h-48 w-48 shrink-0 rounded-full"
                      style={{ background: pieBackground }}
                    >
                      <div className="absolute inset-[27%] flex flex-col items-center justify-center rounded-full bg-white text-center">
                        <span className="text-2xl font-bold">
                          {numberFormat(report.purchasedUnits)}
                        </span>
                        <span className="text-[11px] text-[#78909C]">
                          unidades
                        </span>
                      </div>
                    </div>
                    <div className="w-full space-y-3">
                      {pieData.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-sm"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[#526B7C]">
                            {item.name}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {numberFormat(item.value)}
                          </span>
                          <span className="w-12 text-right text-xs text-[#78909C]">
                            {item.percent.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
                <div className="mb-5">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-[#E2732D]/10 p-2 text-[#E2732D]">
                      <TrendingUp size={19} />
                    </div>
                    <h2 className="font-bold">Productos con más movimiento</h2>
                  </div>
                  <p className="mt-2 text-sm text-[#78909C]">
                    Los cinco nombres de producto con más unidades vendidas en
                    este periodo.
                  </p>
                </div>
                {report.topProducts.length === 0 ? (
                  <div className="flex min-h-48 items-center justify-center rounded-xl bg-[#FDF9F7] px-4 text-center text-sm text-[#78909C]">
                    Todavía no hay productos vendidos en este periodo.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {report.topProducts.map((product, index) => (
                      <div key={`${product.name}-${product.brand}`}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <span className="mr-2 text-xs font-bold text-[#9AAEB9]">
                              0{index + 1}
                            </span>
                            <span className="font-semibold">
                              {product.name}
                            </span>
                            {product.brand && (
                              <span className="ml-1 text-xs text-[#78909C]">
                                · {product.brand}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {numberFormat(product.units)} pz
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#F1ECE7]">
                          <div
                            className="h-full rounded-full bg-[#36709E]"
                            style={{
                              width: `${(product.units / maxTopProductUnits) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-right text-xs text-[#78909C]">
                          Ventas: {money(product.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <div className="rounded-xl bg-[#36709E]/10 p-2 text-[#36709E]">
                  <Store size={19} />
                </div>
                <div>
                  <h2 className="font-bold">Desempeño por tienda de origen</h2>
                  <p className="text-sm text-[#78909C]">
                    Compara lo adquirido en el periodo con las unidades vendidas
                    que provienen de cada tienda.
                  </p>
                </div>
              </div>
              {report.storesSummary.length === 0 ? (
                <p className="rounded-xl bg-[#FDF9F7] p-5 text-center text-sm text-[#78909C]">
                  No hay información de tiendas para este periodo.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[660px] text-left text-sm">
                    <thead className="border-b border-[#EFE7DE] text-xs uppercase tracking-wide text-[#78909C]">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Tienda</th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Unidades compradas
                        </th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Unidades vendidas
                        </th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Costo de compra
                        </th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Uso personal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE7DE]">
                      {report.storesSummary.map((store) => (
                        <tr key={store.storeId} className="hover:bg-[#FDF9F7]">
                          <td className="px-3 py-3.5 font-semibold">
                            {store.name}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums">
                            {numberFormat(store.purchasedUnits)}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums">
                            {numberFormat(store.soldUnits)}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums">
                            {money(store.purchaseCost)}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums">
                            {numberFormat(store.personalUseUnits)} ·{" "}
                            {money(store.personalUseCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <div className="rounded-xl bg-[#CC6255]/10 p-2 text-[#CC6255]">
                  <ReceiptIcon />
                </div>
                <div>
                  <h2 className="font-bold">Desglose de rentabilidad</h2>
                  <p className="text-sm text-[#78909C]">
                    La utilidad se calcula con el costo guardado al momento de
                    vender cada unidad.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <ResultRow label="Ventas totales" value={report.revenue} />
                <ResultRow
                  label="(−) Costo de mercancía vendida"
                  value={-report.costOfGoodsSold}
                />
                <div className="rounded-lg bg-[#FDF9F7] px-3 py-3">
                  <ResultRow
                    label="Utilidad bruta"
                    value={report.grossProfit}
                    strong
                  />
                </div>
                <ResultRow
                  label="(−) Gastos operativos"
                  value={-report.operatingExpenses}
                />
                <ResultRow
                  label={`(−) Uso personal · ${numberFormat(report.personalUseUnits)} artículos`}
                  value={-report.personalUseCost}
                />
                <div
                  className={`mt-2 rounded-xl px-4 py-4 ${report.netProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}
                >
                  <ResultRow
                    label="Resultado neto antes de inversionistas"
                    value={report.netProfit}
                    strong
                    tone={report.netProfit >= 0 ? "green" : "red"}
                  />
                </div>
                <ResultRow
                  label="(−) Rendimiento comprometido a inversionistas"
                  value={-report.investorReturnTotal}
                />
                <div
                  className={`mt-2 rounded-xl px-4 py-4 ${report.profitAfterInvestors >= 0 ? "bg-green-50" : "bg-red-50"}`}
                >
                  <ResultRow
                    label="Utilidad disponible para Patos Deals"
                    value={report.profitAfterInvestors}
                    strong
                    tone={report.profitAfterInvestors >= 0 ? "green" : "red"}
                  />
                  <p className="mt-1 text-right text-xs text-[#78909C]">
                    Margen después de inversionistas:{" "}
                    {report.retainedMargin.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-[#EFE7DE] bg-[#FDF9F7] p-4 text-xs leading-relaxed text-[#78909C]">
                <strong className="text-[#0C304F]">Nota contable:</strong> las
                compras para reventa se muestran como inversión en inventario y
                no se restan completas del resultado neto. Su costo se reconoce
                cuando la unidad se vende; las unidades actualmente marcadas
                como uso personal se descuentan por su costo unitario. El
                capital aportado por inversionistas tampoco se resta como gasto:
                únicamente se descuenta el rendimiento pactado del periodo.
              </div>
            </section>

            <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-[#E2732D]/10 p-2 text-[#E2732D]">
                      <CircleDollarSign size={19} />
                    </div>
                    <h2 className="font-bold">Utilidad de inversionistas</h2>
                  </div>
                  <p className="mt-1 text-sm text-[#78909C]">
                    Rendimiento comprometido por inversionista para este
                    periodo, separado entre pagado y pendiente.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs text-[#78909C]">Pendiente por pagar</p>
                  <p className="text-xl font-bold text-[#CC6255]">
                    {money(report.investorReturnPending)}
                  </p>
                </div>
              </div>
              {report.investorSummary.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-9 text-center text-sm text-[#78909C]">
                  No hay participaciones de inversionistas asignadas a este
                  periodo.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-[#EFE7DE] text-xs uppercase tracking-wide text-[#78909C]">
                      <tr>
                        <th className="px-3 py-3 font-semibold">
                          Inversionista
                        </th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Capital participante
                        </th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Rendimiento
                        </th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Utilidad pactada
                        </th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Pagado
                        </th>
                        <th className="px-3 py-3 text-right font-semibold">
                          Pendiente
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE7DE]">
                      {report.investorSummary.map((investor) => (
                        <tr
                          key={investor.investorId}
                          className="hover:bg-[#FDF9F7]"
                        >
                          <td className="px-3 py-3.5 font-semibold">
                            {investor.name}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums">
                            {money(investor.capital)}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums">
                            {(investor.returnRate * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-3.5 text-right font-semibold tabular-nums">
                            {money(investor.expectedReturn)}
                          </td>
                          <td className="px-3 py-3.5 text-right text-green-700 tabular-nums">
                            {money(investor.paid)}
                          </td>
                          <td className="px-3 py-3.5 text-right font-semibold text-[#CC6255] tabular-nums">
                            {money(investor.pending)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-[#EFE7DE] bg-[#FDF9F7]">
                      <tr>
                        <td className="px-3 py-3.5 font-bold">Total</td>
                        <td className="px-3 py-3.5 text-right font-semibold tabular-nums">
                          {money(
                            report.investorSummary.reduce(
                              (sum, investor) => sum + investor.capital,
                              0,
                            ),
                          )}
                        </td>
                        <td className="px-3 py-3.5" />
                        <td className="px-3 py-3.5 text-right font-bold tabular-nums">
                          {money(report.investorReturnTotal)}
                        </td>
                        <td className="px-3 py-3.5 text-right font-bold text-green-700 tabular-nums">
                          {money(report.investorReturnPaid)}
                        </td>
                        <td className="px-3 py-3.5 text-right font-bold text-[#CC6255] tabular-nums">
                          {money(report.investorReturnPending)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <p className="mt-4 rounded-xl bg-[#FDF9F7] p-3 text-xs leading-relaxed text-[#78909C]">
                Los importes se leen de las participaciones guardadas para este
                periodo. El rendimiento validado sustituye al esperado cuando
                existe; los pagos se suman desde los movimientos de tipo{" "}
                <strong className="text-[#0C304F]">return_payment</strong>{" "}
                ligados a la participación. El capital participante se muestra
                como referencia y no se resta de la utilidad.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: "blue" | "green" | "orange" | "purple" | "slate";
}) {
  const tones = {
    blue: "bg-[#36709E]/10 text-[#36709E]",
    green: "bg-green-50 text-green-700",
    orange: "bg-orange-50 text-orange-700",
    purple: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2 text-sm text-[#78909C]">
        <span>{label}</span>
        <span className={`rounded-lg p-2 ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="break-words text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#78909C]">{detail}</p>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#EFE7DE] bg-white p-4">
      <div className="rounded-lg bg-[#FDF9F7] p-2 text-[#36709E]">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#78909C]">{label}</p>
        <p className="mt-1 break-words text-lg font-bold tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 truncate text-xs text-[#78909C]">{detail}</p>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: number;
  strong?: boolean;
  tone?: "green" | "red";
}) {
  const color =
    tone === "green"
      ? "text-green-800"
      : tone === "red"
        ? "text-red-800"
        : "text-[#0C304F]";
  return (
    <div
      className={`flex items-center justify-between gap-4 ${strong ? "font-bold" : "text-sm"}`}
    >
      <span className={strong ? color : "text-[#657E8E]"}>{label}</span>
      <span
        className={`shrink-0 tabular-nums ${strong ? `text-lg ${color}` : value < 0 ? "text-[#CC6255]" : "text-[#0C304F]"}`}
      >
        {money(value)}
      </span>
    </div>
  );
}

function ReceiptIcon() {
  return <Wallet size={19} />;
}
