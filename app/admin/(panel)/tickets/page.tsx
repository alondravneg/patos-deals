"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  LoaderCircle,
  Download,
  RefreshCw,
  Search,
  Share2,
  Wallet,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

type OperationPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
};

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
};

type Sale = {
  id: string;
  folio: string | null;
  customer_id: string;
  operation_period_id: string | null;
  sale_date: string;
  status: string;
};

type SaleItem = {
  id: string;
  sale_id: string;
  inventory_unit_id: string;
  sale_price_mxn: number | string;
  released_at: string | null;
};

type InventoryUnit = {
  id: string;
  unit_number: number;
  purchase_item_id: string;
};

type PurchaseItem = {
  id: string;
  purchase_id: string;
  product_name: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  size: string | null;
  color: string | null;
};

type Purchase = {
  id: string;
  store_id: string;
};

type Store = {
  id: string;
  name: string;
};

type Payment = {
  id: string;
  customer_id: string;
  payment_date: string;
  amount_mxn: number | string;
  payment_method: string;
  reference: string | null;
  status: string;
};

type PaymentAllocation = {
  id: string;
  payment_id: string;
  sale_id: string;
  amount_mxn: number | string;
};

type PaymentRefund = {
  payment_id: string;
  amount_mxn: number | string;
  refund_date: string;
};

type AppliedPayment = {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string | null;
};

type SaleLedger = {
  sale: Sale;
  periodName: string | null;
  total: number;
  paid: number;
  balance: number;
  payments: AppliedPayment[];
};

type TicketProduct = {
  key: string;
  quantity: number;
  storeName: string;
  productName: string;
  unitPrice: number;
  total: number;
};

type TicketPayment = {
  id: string;
  date: string;
  amount: number;
  method: string;
};

type CustomerTicket = {
  customer: Customer;
  previousSales: SaleLedger[];
  previousBalance: number;
  products: TicketProduct[];
  purchasesTotal: number;
  advances: TicketPayment[];
  advancesTotal: number;
  total: number;
  remaining: number;
};

const inputClass =
  "w-full rounded-xl border border-[#EFE7DE] bg-white px-3.5 py-3 text-sm text-[#0C304F] outline-none transition focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10";

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function paymentMethodLabel(value: string) {
  const labels: Record<string, string> = {
    transfer: "Transferencia",
    cash: "Efectivo",
    card: "Tarjeta",
    other: "Otro",
  };
  return labels[value] ?? value;
}

function safeFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || "cliente";
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",");
  const mimeType = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function waitForTicketAssets(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }
      if (
        image.complete &&
        image.naturalWidth > 0 &&
        typeof image.decode === "function"
      ) {
        try {
          await image.decode();
        } catch {
          // La imagen ya puede haberse cargado aunque decode() rechace el SVG.
        }
      }
    }),
  );
  if ("fonts" in document) await document.fonts.ready;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function periodStatusLabel(value: string) {
  const labels: Record<string, string> = {
    planning: "En planeación",
    shopping: "Compras",
    selling: "Abierto",
    settling: "Liquidación",
    finished: "Cerrado",
  };
  return labels[value] ?? value;
}

function isInsideRange(value: string, start: string, end: string) {
  return value >= start && value <= end;
}

export default function TicketsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [periods, setPeriods] = useState<OperationPeriod[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [refunds, setRefunds] = useState<PaymentRefund[]>([]);

  const [periodId, setPeriodId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState("");
  const [preparedShareFiles, setPreparedShareFiles] = useState<File[]>([]);
  const [shareMode, setShareMode] = useState<"all" | "individual" | null>(null);
  const [shareIndex, setShareIndex] = useState(0);
  const [shareNotice, setShareNotice] = useState("");
  const exportTicketRefs = useRef<Record<string, HTMLElement | null>>({});

  // Una selección o periodo nuevo invalida los archivos preparados anteriormente.
  useEffect(() => {
    setPreparedShareFiles([]);
    setShareMode(null);
    setShareIndex(0);
    setShareNotice("");
  }, [periodId, selectedCustomerIds]);

  const loadData = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const [
          periodsResult,
          customersResult,
          salesResult,
          saleItemsResult,
          paymentsResult,
          allocationsResult,
          refundsResult,
        ] = await Promise.all([
          supabase
            .from("operation_periods")
            .select("id, name, start_date, end_date, status")
            .order("start_date", { ascending: false }),
          supabase
            .from("customers")
            .select("id, full_name, phone, email")
            .order("full_name"),
          supabase
            .from("sales")
            .select(
              "id, folio, customer_id, operation_period_id, sale_date, status",
            )
            .neq("status", "cancelled")
            .order("sale_date", { ascending: false }),
          supabase
            .from("sale_items")
            .select(
              "id, sale_id, inventory_unit_id, sale_price_mxn, released_at",
            )
            .is("released_at", null),
          supabase
            .from("payments")
            .select(
              "id, customer_id, payment_date, amount_mxn, payment_method, reference, status",
            )
            .order("payment_date", { ascending: false }),
          supabase
            .from("payment_allocations")
            .select("id, payment_id, sale_id, amount_mxn")
            .is("superseded_at", null),
          supabase
            .from("payment_refunds")
            .select("payment_id, amount_mxn, refund_date"),
        ]);

        const initialResults = [
          periodsResult,
          customersResult,
          salesResult,
          saleItemsResult,
          paymentsResult,
          allocationsResult,
          refundsResult,
        ];
        const initialError = initialResults.find(
          (result) => result.error,
        )?.error;
        if (initialError) throw initialError;

        const nextSaleItems = (saleItemsResult.data ?? []) as SaleItem[];
        const inventoryIds = [
          ...new Set(nextSaleItems.map((item) => item.inventory_unit_id)),
        ];

        let nextInventoryUnits: InventoryUnit[] = [];
        let nextPurchaseItems: PurchaseItem[] = [];
        let nextPurchases: Purchase[] = [];
        let nextStores: Store[] = [];

        if (inventoryIds.length > 0) {
          const { data, error: queryError } = await supabase
            .from("inventory_units")
            .select("id, unit_number, purchase_item_id")
            .in("id", inventoryIds);
          if (queryError) throw queryError;
          nextInventoryUnits = (data ?? []) as InventoryUnit[];
        }

        const purchaseItemIds = [
          ...new Set(nextInventoryUnits.map((unit) => unit.purchase_item_id)),
        ];
        if (purchaseItemIds.length > 0) {
          const { data, error: queryError } = await supabase
            .from("purchase_items")
            .select(
              "id, purchase_id, product_name, brand, model, sku, size, color",
            )
            .in("id", purchaseItemIds);
          if (queryError) throw queryError;
          nextPurchaseItems = (data ?? []) as PurchaseItem[];
        }

        const purchaseIds = [
          ...new Set(nextPurchaseItems.map((item) => item.purchase_id)),
        ];
        if (purchaseIds.length > 0) {
          const { data, error: queryError } = await supabase
            .from("purchases")
            .select("id, store_id")
            .in("id", purchaseIds);
          if (queryError) throw queryError;
          nextPurchases = (data ?? []) as Purchase[];
        }

        const storeIds = [
          ...new Set(nextPurchases.map((purchase) => purchase.store_id)),
        ];
        if (storeIds.length > 0) {
          const { data, error: queryError } = await supabase
            .from("stores")
            .select("id, name")
            .in("id", storeIds);
          if (queryError) throw queryError;
          nextStores = (data ?? []) as Store[];
        }

        setPeriods((periodsResult.data ?? []) as OperationPeriod[]);
        setCustomers((customersResult.data ?? []) as Customer[]);
        setSales((salesResult.data ?? []) as Sale[]);
        setSaleItems(nextSaleItems);
        setInventoryUnits(nextInventoryUnits);
        setPurchaseItems(nextPurchaseItems);
        setPurchases(nextPurchases);
        setStores(nextStores);
        setPayments((paymentsResult.data ?? []) as Payment[]);
        setAllocations((allocationsResult.data ?? []) as PaymentAllocation[]);
        setRefunds((refundsResult.data ?? []) as PaymentRefund[]);
      } catch (err) {
        console.error("Error cargando tickets:", err);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los datos para generar tickets.",
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

  useEffect(() => {
    if (periodId || periods.length === 0) return;
    const defaultPeriod =
      periods.find((item) => item.status === "selling") ??
      periods.find((item) => item.status === "settling") ??
      periods[0];
    setPeriodId(defaultPeriod.id);
  }, [periodId, periods]);

  const period = useMemo(
    () => periods.find((item) => item.id === periodId) ?? null,
    [periods, periodId],
  );

  const tickets = useMemo<CustomerTicket[]>(() => {
    if (!period) return [];

    // El ticket representa el estado de cuenta actual, no una fotografía al cierre programado.
    // Las ventas vinculadas al periodo se incluyen por operation_period_id aunque sale_date
    // sea posterior a end_date (por ejemplo, cuando se sigue registrando una venta tardía).
    // Los pagos y reembolsos se consideran hasta hoy para mostrar el saldo verdaderamente vigente.
    const cutoffDate = todayLocal();
    const customerById = new Map(
      customers.map((customer) => [customer.id, customer]),
    );
    const periodById = new Map(periods.map((item) => [item.id, item]));
    const paymentById = new Map(
      payments.map((payment) => [payment.id, payment]),
    );
    const refundByPayment = new Map<string, number>();
    refunds.forEach((refund) => {
      if (refund.refund_date > cutoffDate) return;
      refundByPayment.set(
        refund.payment_id,
        (refundByPayment.get(refund.payment_id) ?? 0) +
          Number(refund.amount_mxn),
      );
    });

    const inventoryById = new Map(
      inventoryUnits.map((unit) => [unit.id, unit]),
    );
    const purchaseItemById = new Map(
      purchaseItems.map((item) => [item.id, item]),
    );
    const purchaseById = new Map(purchases.map((item) => [item.id, item]));
    const storeById = new Map(stores.map((item) => [item.id, item.name]));

    const itemsBySale = new Map<string, SaleItem[]>();
    saleItems.forEach((item) => {
      const current = itemsBySale.get(item.sale_id) ?? [];
      current.push(item);
      itemsBySale.set(item.sale_id, current);
    });

    // Primero se identifican las ventas de la operación seleccionada por su relación directa.
    // Solo para registros antiguos sin operation_period_id usamos el rango de fechas.
    const currentPeriodSales = sales.filter((sale) => {
      if (sale.operation_period_id)
        return sale.operation_period_id === period.id;
      return isInsideRange(
        sale.sale_date,
        period.start_date,
        period.end_date ?? cutoffDate,
      );
    });
    const currentPeriodSaleIds = new Set(
      currentPeriodSales.map((sale) => sale.id),
    );

    // Los adeudos anteriores se determinan primero por el periodo al que pertenece la venta,
    // no solamente por sale_date. Esto evita perder adeudos de operaciones anteriores cuando
    // una venta se capturó tarde o su fecha no coincide con el rango del periodo.
    // Para ventas antiguas sin periodo (o con un periodo que ya no está visible), se usa la fecha.
    const previousSales = sales.filter((sale) => {
      if (currentPeriodSaleIds.has(sale.id) || sale.sale_date > cutoffDate)
        return false;

      if (sale.operation_period_id) {
        const salePeriod = periodById.get(sale.operation_period_id);
        if (salePeriod) return salePeriod.start_date < period.start_date;
      }

      return sale.sale_date < period.start_date;
    });

    const relevantSales = [...previousSales, ...currentPeriodSales];
    const activeSaleIds = new Set(relevantSales.map((sale) => sale.id));
    const totalsBySale = new Map<string, number>();
    relevantSales.forEach((sale) => {
      const total = (itemsBySale.get(sale.id) ?? []).reduce(
        (sum, item) => sum + Number(item.sale_price_mxn),
        0,
      );
      totalsBySale.set(sale.id, total);
    });

    const paymentsBySale = new Map<string, AppliedPayment[]>();
    allocations.forEach((allocation) => {
      if (!activeSaleIds.has(allocation.sale_id)) return;
      const payment = paymentById.get(allocation.payment_id);
      if (!payment || payment.payment_date > cutoffDate) return;
      if (payment.status === "cancelled" || payment.status === "refunded")
        return;

      const paymentTotal = Number(payment.amount_mxn);
      if (paymentTotal <= 0) return;
      const refunded = Math.min(
        refundByPayment.get(payment.id) ?? 0,
        paymentTotal,
      );
      const netRatio = Math.max(paymentTotal - refunded, 0) / paymentTotal;
      const netAmount = Number(allocation.amount_mxn) * netRatio;
      if (netAmount <= 0.009) return;

      const current = paymentsBySale.get(allocation.sale_id) ?? [];
      current.push({
        id: payment.id,
        date: payment.payment_date,
        amount: netAmount,
        method: paymentMethodLabel(payment.payment_method),
        reference: payment.reference,
      });
      paymentsBySale.set(allocation.sale_id, current);
    });

    const ledgerBySale = new Map<string, SaleLedger>();
    relevantSales.forEach((sale) => {
      const total = totalsBySale.get(sale.id) ?? 0;
      const salePayments = paymentsBySale.get(sale.id) ?? [];
      const paid = salePayments.reduce((sum, item) => sum + item.amount, 0);
      ledgerBySale.set(sale.id, {
        sale,
        periodName: sale.operation_period_id
          ? (periodById.get(sale.operation_period_id)?.name ?? null)
          : null,
        total,
        paid,
        balance: Math.max(total - paid, 0),
        payments: [...salePayments].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      });
    });

    const ticketByCustomer = new Map<
      string,
      {
        customer: Customer;
        previousSales: SaleLedger[];
        products: TicketProduct[];
        purchasesTotal: number;
        advances: Map<string, TicketPayment>;
        advancesTotal: number;
      }
    >();

    const ensureCustomerTicket = (customerId: string) => {
      let ticket = ticketByCustomer.get(customerId);
      if (!ticket) {
        const customer = customerById.get(customerId);
        if (!customer) return null;
        ticket = {
          customer,
          previousSales: [],
          products: [],
          purchasesTotal: 0,
          advances: new Map<string, TicketPayment>(),
          advancesTotal: 0,
        };
        ticketByCustomer.set(customerId, ticket);
      }
      return ticket;
    };

    previousSales.forEach((sale) => {
      const ledger = ledgerBySale.get(sale.id);
      if (!ledger || ledger.balance <= 0.009) return;
      const ticket = ensureCustomerTicket(sale.customer_id);
      if (!ticket) return;
      ticket.previousSales.push(ledger);
    });

    currentPeriodSales.forEach((sale) => {
      const ticket = ensureCustomerTicket(sale.customer_id);
      if (!ticket) return;
      const saleTotal = totalsBySale.get(sale.id) ?? 0;
      ticket.purchasesTotal += saleTotal;

      const ledger = ledgerBySale.get(sale.id);
      (ledger?.payments ?? []).forEach((applied) => {
        const payment = paymentById.get(applied.id);
        if (!payment) return;
        const current = ticket.advances.get(applied.id);
        if (current) current.amount += applied.amount;
        else {
          ticket.advances.set(applied.id, {
            id: applied.id,
            date: applied.date,
            amount: applied.amount,
            method: applied.method,
          });
        }
      });
    });

    const productGroups = new Map<string, Map<string, TicketProduct>>();
    currentPeriodSales.forEach((sale) => {
      const ticket = ticketByCustomer.get(sale.customer_id);
      if (!ticket) return;
      const rows = itemsBySale.get(sale.id) ?? [];
      rows.forEach((saleItem) => {
        const unit = inventoryById.get(saleItem.inventory_unit_id);
        const purchaseItem = unit
          ? purchaseItemById.get(unit.purchase_item_id)
          : null;
        if (!unit || !purchaseItem) return;
        const purchase = purchaseById.get(purchaseItem.purchase_id);
        const storeName = purchase
          ? (storeById.get(purchase.store_id) ?? "Tienda no disponible")
          : "Tienda no disponible";
        const productName = [
          purchaseItem.product_name,
          purchaseItem.brand,
          purchaseItem.model,
          purchaseItem.size ? `Talla ${purchaseItem.size}` : null,
          purchaseItem.color ? `Color ${purchaseItem.color}` : null,
          purchaseItem.sku ? `SKU ${purchaseItem.sku}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        const unitPrice = Number(saleItem.sale_price_mxn);
        const key = [storeName, productName, unitPrice.toFixed(2)].join("::");
        let customerGroups = productGroups.get(sale.customer_id);
        if (!customerGroups) {
          customerGroups = new Map<string, TicketProduct>();
          productGroups.set(sale.customer_id, customerGroups);
        }
        const existing = customerGroups.get(key);
        if (existing) {
          existing.quantity += 1;
          existing.total += unitPrice;
        } else {
          customerGroups.set(key, {
            key,
            quantity: 1,
            storeName,
            productName,
            unitPrice,
            total: unitPrice,
          });
        }
      });
    });

    productGroups.forEach((groups, customerId) => {
      const ticket = ticketByCustomer.get(customerId);
      if (ticket) {
        ticket.products = [...groups.values()].sort(
          (a, b) =>
            a.storeName.localeCompare(b.storeName, "es") ||
            a.productName.localeCompare(b.productName, "es"),
        );
      }
    });

    const result: CustomerTicket[] = [];
    ticketByCustomer.forEach((draft) => {
      draft.previousSales.sort((a, b) =>
        a.sale.sale_date.localeCompare(b.sale.sale_date),
      );
      const previousBalance = draft.previousSales.reduce(
        (sum, item) => sum + item.balance,
        0,
      );
      const advances = [...draft.advances.values()].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      const advancesTotal = advances.reduce(
        (sum, item) => sum + item.amount,
        0,
      );
      const total = previousBalance + draft.purchasesTotal;
      const remaining = Math.max(total - advancesTotal, 0);
      if (remaining <= 0.009) return;

      result.push({
        customer: draft.customer,
        previousSales: draft.previousSales,
        previousBalance,
        products: draft.products,
        purchasesTotal: draft.purchasesTotal,
        advances,
        advancesTotal,
        total,
        remaining,
      });
    });

    return result.sort(
      (a, b) =>
        b.remaining - a.remaining ||
        a.customer.full_name.localeCompare(b.customer.full_name, "es"),
    );
  }, [
    period,
    periods,
    customers,
    sales,
    saleItems,
    inventoryUnits,
    purchaseItems,
    purchases,
    stores,
    payments,
    allocations,
    refunds,
  ]);

  const ticketDiagnostics = useMemo(() => {
    if (!period) return { periodSales: 0, productLines: 0, previousSales: 0 };
    const periodSaleIds = new Set(
      sales
        .filter((sale) => {
          if (sale.operation_period_id)
            return sale.operation_period_id === period.id;
          return isInsideRange(
            sale.sale_date,
            period.start_date,
            period.end_date ?? todayLocal(),
          );
        })
        .map((sale) => sale.id),
    );
    const periodById = new Map(periods.map((item) => [item.id, item]));
    const previousSaleIds = new Set(
      sales
        .filter((sale) => {
          if (periodSaleIds.has(sale.id) || sale.sale_date > todayLocal())
            return false;
          if (sale.operation_period_id) {
            const salePeriod = periodById.get(sale.operation_period_id);
            if (salePeriod) return salePeriod.start_date < period.start_date;
          }
          return sale.sale_date < period.start_date;
        })
        .map((sale) => sale.id),
    );
    return {
      periodSales: periodSaleIds.size,
      productLines: saleItems.filter((item) => periodSaleIds.has(item.sale_id))
        .length,
      previousSales: previousSaleIds.size,
    };
  }, [period, periods, sales, saleItems]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((ticket) =>
      [
        ticket.customer.full_name,
        ticket.customer.phone ?? "",
        ticket.customer.email ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [tickets, search]);

  const selectedTickets = useMemo(
    () =>
      tickets.filter((ticket) =>
        selectedCustomerIds.includes(ticket.customer.id),
      ),
    [tickets, selectedCustomerIds],
  );
  const allFilteredSelected =
    filteredTickets.length > 0 &&
    filteredTickets.every((ticket) =>
      selectedCustomerIds.includes(ticket.customer.id),
    );

  function toggleCustomerSelection(customerId: string, checked: boolean) {
    setSelectedCustomerIds((current) =>
      checked
        ? current.includes(customerId)
          ? current
          : [...current, customerId]
        : current.filter((id) => id !== customerId),
    );
  }

  function toggleAllFiltered(checked: boolean) {
    const visibleIds = filteredTickets.map((ticket) => ticket.customer.id);
    setSelectedCustomerIds((current) => {
      if (checked) return [...new Set([...current, ...visibleIds])];
      return current.filter((id) => !visibleIds.includes(id));
    });
  }

  async function handleDownloadSelected() {
    if (selectedTickets.length === 0 || isExporting) return;
    setIsExporting(true);
    setExportProgress(0);
    setExportError("");

    try {
      // Se cargan dinámicamente para no añadir peso al primer render de la pantalla.
      const [{ toPng }, JSZipModule] = await Promise.all([
        import("html-to-image"),
        import("jszip"),
      ]);
      const JSZip = JSZipModule.default;
      const zip = new JSZip();

      for (let index = 0; index < selectedTickets.length; index += 1) {
        const ticket = selectedTickets[index];
        const element = exportTicketRefs.current[ticket.customer.id];
        if (!element) {
          throw new Error(
            `No se pudo preparar el ticket de ${ticket.customer.full_name}.`,
          );
        }

        await waitForTicketAssets(element);
        const dataUrl = await toPng(element, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#f0e1cd",
          width: element.scrollWidth,
          height: element.scrollHeight,
        });
        const fileName = `ticket-${safeFileName(ticket.customer.full_name)}.png`;

        if (selectedTickets.length === 1) {
          downloadBlob(dataUrlToBlob(dataUrl), fileName);
        } else {
          zip.file(fileName, dataUrl.split(",")[1], { base64: true });
        }
        setExportProgress(index + 1);
      }

      if (selectedTickets.length > 1) {
        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });
        downloadBlob(
          zipBlob,
          `tickets-${safeFileName(period?.name ?? "patos-deals")}.zip`,
        );
      }
    } catch (err) {
      console.error("Error generando imágenes de tickets:", err);
      setExportError(
        err instanceof Error
          ? err.message
          : "No se pudieron generar las imágenes. Revisa las dependencias e inténtalo nuevamente.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handlePrepareShareSelected() {
    if (selectedTickets.length === 0 || isExporting) return;
    setIsExporting(true);
    setExportProgress(0);
    setExportError("");
    setShareNotice("");
    setPreparedShareFiles([]);
    setShareMode(null);
    setShareIndex(0);

    try {
      const { toPng } = await import("html-to-image");
      const files: File[] = [];

      for (let index = 0; index < selectedTickets.length; index += 1) {
        const ticket = selectedTickets[index];
        const element = exportTicketRefs.current[ticket.customer.id];
        if (!element) {
          throw new Error(
            `No se pudo preparar el ticket de ${ticket.customer.full_name}.`,
          );
        }

        await waitForTicketAssets(element);
        const dataUrl = await toPng(element, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#f0e1cd",
          width: element.scrollWidth,
          height: element.scrollHeight,
        });
        const blob = dataUrlToBlob(dataUrl);
        const fileName = `ticket-${safeFileName(ticket.customer.full_name)}.png`;
        files.push(
          new File([blob], fileName, {
            type: "image/png",
            lastModified: Date.now(),
          }),
        );
        setExportProgress(index + 1);
      }

      const shareNavigator = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data?: ShareData) => boolean;
      };
      const supportsShare = typeof shareNavigator.share === "function";
      const supportsAllFiles =
        supportsShare &&
        (typeof shareNavigator.canShare !== "function" ||
          shareNavigator.canShare({ files }));
      const supportsSingleFile =
        supportsShare &&
        (typeof shareNavigator.canShare !== "function" ||
          shareNavigator.canShare({ files: [files[0]] }));

      setPreparedShareFiles(files);
      if (supportsAllFiles) {
        setShareMode("all");
        setShareNotice(
          files.length === 1
            ? "Tu imagen está lista. Pulsa Compartir / Guardar para abrir el menú de tu teléfono."
            : "Tus imágenes están listas para compartir juntas. En iPhone puedes elegir Guardar imágenes en el menú de compartir.",
        );
      } else if (supportsSingleFile) {
        setShareMode("individual");
        setShareNotice(
          "Este navegador comparte las imágenes de una en una. Pulsa el botón para compartir cada ticket.",
        );
      } else {
        setShareNotice(
          "Este navegador no ofrece compartir archivos directamente. Puedes usar Descargar PNG / ZIP.",
        );
      }
    } catch (err) {
      console.error("Error preparando imágenes para compartir:", err);
      setExportError(
        err instanceof Error
          ? err.message
          : "No se pudieron preparar las imágenes. Revisa que los logos carguen correctamente.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSharePrepared() {
    if (preparedShareFiles.length === 0) return;
    const shareNavigator = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data?: ShareData) => boolean;
    };

    if (typeof shareNavigator.share !== "function") {
      setShareNotice(
        "Tu navegador no permite compartir archivos directamente. Usa Descargar PNG / ZIP.",
      );
      return;
    }

    const filesToShare =
      shareMode === "individual"
        ? [preparedShareFiles[shareIndex]]
        : preparedShareFiles;
    if (filesToShare.some((file) => !file)) return;

    try {
      // La llamada ocurre directamente desde este clic para conservar la activación
      // del usuario que Safari y otros navegadores móviles exigen.
      await shareNavigator.share({
        files: filesToShare,
        title: "Tickets Patos Deals",
        text: period?.name
          ? `Estado de cuenta · ${period.name}`
          : "Estado de cuenta Patos Deals",
      });

      if (shareMode === "individual") {
        const nextIndex = shareIndex + 1;
        setShareIndex(nextIndex);
        setShareNotice(
          nextIndex >= preparedShareFiles.length
            ? "¡Listo! Ya compartiste todos los tickets seleccionados."
            : `Ticket compartido. Ahora puedes compartir el siguiente (${nextIndex + 1} de ${preparedShareFiles.length}).`,
        );
      } else {
        setShareNotice(
          "Menú de compartir completado. Puedes volver a abrirlo para compartir las imágenes otra vez.",
        );
      }
    } catch (err) {
      const error = err as DOMException;
      if (error?.name === "AbortError") return;
      console.error("Error compartiendo tickets:", err);
      setShareNotice(
        "No se pudo abrir el menú de compartir. Prueba Descargar PNG / ZIP.",
      );
    }
  }

  useEffect(() => {
    if (filteredTickets.length === 0) {
      setSelectedCustomerId("");
      return;
    }
    if (
      !filteredTickets.some(
        (ticket) => ticket.customer.id === selectedCustomerId,
      )
    ) {
      setSelectedCustomerId(filteredTickets[0].customer.id);
    }
  }, [filteredTickets, selectedCustomerId]);

  const selectedTicket = useMemo(
    () =>
      tickets.find((ticket) => ticket.customer.id === selectedCustomerId) ??
      null,
    [tickets, selectedCustomerId],
  );

  const totalReceivable = tickets.reduce(
    (sum, ticket) => sum + ticket.remaining,
    0,
  );
  const selectedPeriodLabel = period
    ? `${formatDate(period.start_date)}${period.end_date ? ` – ${formatDate(period.end_date)}` : ""}`
    : "Selecciona un periodo";

  return (
    <main className="min-h-screen bg-[#FDF9F7] p-4 text-[#0C304F] sm:p-6 lg:p-8">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 7mm;
        }

        .ticket-frame {
          background-color: #f0e1cd;
          background-image:
            repeating-linear-gradient(
              90deg,
              rgba(133, 98, 61, 0.045) 0,
              rgba(133, 98, 61, 0.045) 1px,
              transparent 1px,
              transparent 9px
            ),
            radial-gradient(
              ellipse at 12% 12%,
              rgba(255, 255, 255, 0.7),
              transparent 44%
            ),
            radial-gradient(
              ellipse at 90% 84%,
              rgba(177, 137, 91, 0.13),
              transparent 42%
            ),
            linear-gradient(130deg, #ead8bf 0%, #f7eddf 48%, #e7d3b9 100%);
        }
        .ticket-sheet {
          position: relative;
          isolation: isolate;
        }
        .ticket-sheet::before,
        .ticket-sheet::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: 11px;
          z-index: 2;
          pointer-events: none;
          background-size: 20px 11px;
          background-repeat: repeat-x;
        }
        .ticket-sheet::before {
          top: 0;
          background-image: radial-gradient(
            circle at 10px 0,
            #f0e1cd 8px,
            transparent 8.6px
          );
        }
        .ticket-sheet::after {
          bottom: 0;
          background-image: radial-gradient(
            circle at 10px 11px,
            #f0e1cd 8px,
            transparent 8.6px
          );
        }
        .ticket-watermark {
          position: absolute;
          width: min(78%, 360px);
          height: auto;
          left: 50%;
          top: 52%;
          transform: translate(-50%, -50%);
          z-index: 0;
          pointer-events: none;
          mix-blend-mode: multiply;
        }
        .ticket-content {
          position: relative;
          z-index: 1;
        }
        .ticket-clip {
          position: absolute;
          z-index: 5;
          left: 50%;
          top: 6px;
          transform: translateX(-50%);
          width: 82px;
          height: 26px;
          border: 3px solid #a78243;
          border-top: 0;
          border-radius: 0 0 9px 9px;
          background: linear-gradient(180deg, #ead49b, #b28e50);
          box-shadow: 0 3px 5px rgba(71, 52, 26, 0.2);
        }
        .ticket-clip::before {
          content: "";
          position: absolute;
          width: 32px;
          height: 28px;
          left: 22px;
          top: -22px;
          border: 4px solid #b18d4d;
          border-radius: 50%;
          background: transparent;
          box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.22);
        }

        @media print {
          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #ticket-print-area,
          #ticket-print-area * {
            visibility: visible !important;
          }
          #ticket-print-area {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 282mm !important;
            margin: 0 !important;
            padding: 5mm !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .ticket-sheet {
            min-height: 270mm !important;
            padding: 12mm 10mm 8mm !important;
            box-shadow: none !important;
          }
          .ticket-clip {
            top: 0 !important;
          }
          .ticket-watermark {
            opacity: 0.17 !important;
          }
          .no-print {
            display: none !important;
          }
          .ticket-table {
            page-break-inside: auto;
          }
          .ticket-table tr {
            page-break-inside: avoid;
          }
          .ticket-paper-section {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6">
        <header className="no-print flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#36709E]">
              <FileText size={17} /> Operaciones / Tickets
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Tickets de clientes
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#78909C]">
              Genera estados de cuenta por cliente con adeudos de periodos
              anteriores, compras actuales y abonos aplicados.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm font-semibold transition hover:border-[#36709E] disabled:opacity-50"
          >
            {refreshing ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <RefreshCw size={17} />
            )}
            Actualizar información
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="no-print flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="no-print grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <div className="mb-2 flex items-center justify-between text-sm text-[#78909C]">
              Tickets pendientes{" "}
              <FileText size={18} className="text-[#36709E]" />
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {loading ? "—" : numberFormat(tickets.length)}
            </p>
            <p className="mt-1 text-xs text-[#78909C]">
              Solo clientes con saldo por pagar
            </p>
          </div>
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <div className="mb-2 flex items-center justify-between text-sm text-[#78909C]">
              Saldo pendiente total{" "}
              <Wallet size={18} className="text-[#CC6255]" />
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {loading ? "—" : money(totalReceivable)}
            </p>
            <p className="mt-1 text-xs text-[#78909C]">
              Del periodo seleccionado y adeudos anteriores
            </p>
          </div>
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <div className="mb-2 flex items-center justify-between text-sm text-[#78909C]">
              Periodo <CalendarDays size={18} className="text-[#36709E]" />
            </div>
            <p className="truncate text-lg font-bold">
              {period?.name ?? (loading ? "Cargando..." : "Sin periodo")}
            </p>
            <p className="mt-1 text-xs text-[#78909C]">{selectedPeriodLabel}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)]">
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="font-bold">Clientes con saldo pendiente</h2>
              <p className="mt-1 text-xs text-[#78909C]">
                Los clientes sin adeudo no aparecen en esta lista.
              </p>
            </div>

            <label
              className="mb-1.5 block text-xs font-semibold text-[#0C304F]"
              htmlFor="ticket-period"
            >
              Periodo de operación
            </label>
            <select
              id="ticket-period"
              value={periodId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                setPeriodId(event.target.value);
                setSelectedCustomerIds([]);
                setExportError("");
              }}
              className={`${inputClass} mb-3`}
              disabled={loading || periods.length === 0}
            >
              {periods.length === 0 && (
                <option value="">No hay periodos registrados</option>
              )}
              {periods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {periodStatusLabel(item.status)}
                </option>
              ))}
            </select>

            <div className="relative mb-3">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
              />
              <input
                value={search}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar cliente..."
                className={`${inputClass} pl-9`}
              />
            </div>

            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[#78909C]">
                <LoaderCircle size={20} className="animate-spin" /> Cargando
                clientes...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-10 text-center">
                <CheckCircle2
                  size={28}
                  className="mx-auto mb-2 text-green-700"
                />
                <p className="font-semibold">No hay tickets pendientes</p>
                <p className="mt-1 text-xs leading-5 text-[#78909C]">
                  No hay clientes con saldo por pagar en este periodo. Los
                  clientes liquidados no se muestran.
                </p>
                <div className="mx-auto mt-4 max-w-sm rounded-lg bg-[#FDF9F7] px-3 py-2 text-left text-[11px] leading-5 text-[#78909C]">
                  <p>
                    <strong className="text-[#0C304F]">
                      Comprobación de datos:
                    </strong>
                  </p>
                  <p>
                    Ventas vinculadas al periodo:{" "}
                    {ticketDiagnostics.periodSales}
                  </p>
                  <p>
                    Productos en esas ventas: {ticketDiagnostics.productLines}
                  </p>
                  <p>
                    Ventas anteriores revisadas:{" "}
                    {ticketDiagnostics.previousSales}
                  </p>
                  {ticketDiagnostics.periodSales === 0 &&
                  ticketDiagnostics.previousSales === 0 ? (
                    <p className="mt-1">
                      No se encontraron ventas asociadas a este periodo ni
                      ventas anteriores por fecha. Revisa que las ventas estén
                      vinculadas al periodo correcto.
                    </p>
                  ) : ticketDiagnostics.periodSales > 0 &&
                    ticketDiagnostics.productLines === 0 ? (
                    <p className="mt-1">
                      Hay ventas del periodo, pero sus productos no tienen
                      líneas activas. Revisa si sus productos fueron liberados.
                    </p>
                  ) : (
                    <p className="mt-1">
                      Hay ventas registradas, pero el cálculo no detecta saldo
                      pendiente después de aplicar los abonos.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FDF9F7] px-3 py-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#0C304F]">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        toggleAllFiltered(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-[#B8CBD9] accent-[#36709E]"
                    />
                    Seleccionar todos
                  </label>
                  <span className="text-xs text-[#78909C]">
                    {selectedTickets.length} seleccionados
                  </span>
                </div>
                {filteredTickets.map((ticket) => {
                  const active = ticket.customer.id === selectedCustomerId;
                  const checked = selectedCustomerIds.includes(
                    ticket.customer.id,
                  );
                  return (
                    <div
                      key={ticket.customer.id}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${active ? "border-[#36709E] bg-[#36709E]/5" : "border-[#EFE7DE] hover:border-[#B8CBD9]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        aria-label={`Seleccionar ticket de ${ticket.customer.full_name}`}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          toggleCustomerSelection(
                            ticket.customer.id,
                            event.target.checked,
                          )
                        }
                        className="ml-1 h-4 w-4 shrink-0 cursor-pointer rounded border-[#B8CBD9] accent-[#36709E]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCustomerId(ticket.customer.id)
                        }
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-1 py-1 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {ticket.customer.full_name}
                          </span>
                          <span className="mt-0.5 block text-xs text-[#78909C]">
                            {ticket.products.length}{" "}
                            {ticket.products.length === 1
                              ? "producto"
                              : "productos"}{" "}
                            en este periodo
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold tabular-nums text-[#CC6255]">
                            {money(ticket.remaining)}
                          </span>
                          <ChevronRight
                            size={15}
                            className={`ml-auto mt-1 ${active ? "text-[#36709E]" : "text-[#78909C]"}`}
                          />
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-bold">Vista previa del ticket</h2>
                <p className="mt-1 text-xs text-[#78909C]">
                  Selecciona uno o varios clientes para descargar sus tickets
                  como imágenes PNG.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerIds([])}
                  disabled={selectedTickets.length === 0 || isExporting}
                  className="w-full rounded-xl border border-[#EFE7DE] bg-white px-3 py-3 text-xs font-semibold text-[#78909C] transition hover:border-[#36709E] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  Limpiar selección
                </button>
                <button
                  type="button"
                  onClick={() => void handlePrepareShareSelected()}
                  disabled={selectedTickets.length === 0 || isExporting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#36709E] bg-white px-4 py-3 text-sm font-semibold text-[#0C304F] transition hover:bg-[#F4F8FB] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isExporting ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Share2 size={17} />
                  )}
                  {isExporting
                    ? `Preparando ${exportProgress}/${selectedTickets.length}...`
                    : "Preparar para compartir"}
                </button>
                {shareMode && preparedShareFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleSharePrepared()}
                    disabled={
                      isExporting ||
                      (shareMode === "individual" &&
                        shareIndex >= preparedShareFiles.length)
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0C304F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17466B] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    <Share2 size={17} />
                    {shareMode === "individual"
                      ? `Compartir ticket ${Math.min(shareIndex + 1, preparedShareFiles.length)}/${preparedShareFiles.length}`
                      : "Compartir / Guardar fotos"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDownloadSelected()}
                  disabled={selectedTickets.length === 0 || isExporting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm font-semibold text-[#0C304F] transition hover:border-[#36709E] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <Download size={17} />
                  {`Descargar ${selectedTickets.length === 1 ? "PNG" : "ZIP"}`}
                </button>
              </div>
            </div>
            {exportError && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
              >
                {exportError}
                <span className="mt-1 block">
                  Verifica que las dependencias estén instaladas y que los logos
                  de public carguen correctamente.
                </span>
              </div>
            )}
            {selectedTickets.length > 0 && (
              <p className="mb-3 text-xs text-[#78909C]">
                {selectedTickets.length === 1
                  ? "Puedes compartir el PNG desde el menú de tu teléfono o descargarlo directamente."
                  : "Puedes compartir los tickets juntos o descargarlos en un ZIP con un PNG independiente por cliente."}
              </p>
            )}
            {shareNotice && (
              <div
                role="status"
                className="mb-3 rounded-xl border border-[#D9E7F1] bg-[#F4F8FB] px-3 py-2.5 text-xs leading-relaxed text-[#0C304F]"
              >
                {shareNotice}
              </div>
            )}
            {!selectedTicket ? (
              <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-[#EFE7DE] text-sm text-[#78909C]">
                Selecciona un cliente con saldo pendiente.
              </div>
            ) : (
              <TicketPaper ticket={selectedTicket} period={period} />
            )}
          </div>
        </section>

        {/* Tickets renderizados fuera del área visible para convertir cada comprobante a PNG. */}
        {selectedTickets.length > 0 && period && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed left-[-12000px] top-0 z-[-1] w-[590px]"
          >
            {selectedTickets.map((ticket) => (
              <TicketPaper
                key={ticket.customer.id}
                ticket={ticket}
                period={period}
                elementId={`ticket-export-${ticket.customer.id}`}
                onElement={(element) => {
                  exportTicketRefs.current[ticket.customer.id] = element;
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TicketPaper({
  ticket,
  period,
  elementId,
  onElement,
}: {
  ticket: CustomerTicket;
  period: OperationPeriod | null;
  elementId?: string;
  onElement?: (element: HTMLElement | null) => void;
}) {
  const currentDate = todayLocal();
  // Si logo-bg.svg no existe o no se puede cargar, usa el logo principal como marca de agua.
  const [watermarkSrc, setWatermarkSrc] = useState("/res/img/logo-bg.svg");

  return (
    <article
      id={elementId ?? "ticket-print-area"}
      ref={onElement}
      className="ticket-paper ticket-frame relative mx-auto w-full max-w-[590px] rounded-[26px] border border-[#e2cfb4] p-3 pt-12 text-[#172D3E] shadow-[0_18px_45px_rgba(89,65,38,0.14)] sm:p-5 sm:pt-14"
    >
      <div className="ticket-clip" aria-hidden="true" />

      <div className="ticket-sheet overflow-hidden bg-[#fffefa] px-4 pb-6 pt-7 shadow-[0_4px_18px_rgba(71,52,26,0.10)] sm:px-7 sm:pb-8 sm:pt-9">
        {watermarkSrc ? (
          <img
            src={watermarkSrc}
            alt=""
            aria-hidden="true"
            className="ticket-watermark"
            onError={() => {
              setWatermarkSrc((current) =>
                current === "/res/img/logo-bg.svg"
                  ? "/res/img/logo-top.svg"
                  : "",
              );
            }}
          />
        ) : null}

        <div className="ticket-content">
          <header className="ticket-paper-section border-b-2 border-dotted border-[#bdb8b1] pb-4 text-center">
            <img
              src="/res/img/logo-top.svg"
              alt="Patos Deals · Tus compras"
              className="mx-auto mb-2 h-auto max-h-[126px] w-[min(76%,290px)] object-contain"
            />
            <div className="mx-auto flex max-w-[390px] items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9b9995]">
              <span className="h-px flex-1 border-t border-dotted border-[#aaa7a1]" />
              <span>Estado de cuenta</span>
              <span className="h-px flex-1 border-t border-dotted border-[#aaa7a1]" />
            </div>
            <p className="mt-2 text-base font-bold tracking-wide text-[#262626] sm:text-lg">
              {period?.name ?? "Estado de cuenta"}
            </p>
            <p className="mt-0.5 text-xs font-medium text-[#6f6b66]">
              {period
                ? `${formatDate(period.start_date)}${period.end_date ? ` – ${formatDate(period.end_date)}` : ""}`
                : ""}
            </p>
          </header>

          <section className="ticket-paper-section flex flex-col gap-3 border-b border-dotted border-[#bdb8b1] py-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#918a82]">
                Cliente
              </p>
              <h3 className="mt-1 break-words text-lg font-extrabold leading-tight text-[#0C304F] sm:text-xl">
                {ticket.customer.full_name}
              </h3>
              {ticket.customer.phone && (
                <p className="mt-1 text-xs text-[#77736d]">
                  {ticket.customer.phone}
                </p>
              )}
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#918a82]">
                Fecha de emisión
              </p>
              <p className="mt-1 text-xs font-semibold text-[#36322e]">
                {formatDate(currentDate)}
              </p>
            </div>
          </section>

          {ticket.previousSales.length > 0 && (
            <section className="ticket-paper-section border-b border-dotted border-[#bdb8b1] py-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#0C304F]">
                  Adeudos de periodos anteriores
                </h4>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-[#CC6255]">
                  {money(ticket.previousBalance)}
                </span>
              </div>

              <div className="overflow-hidden border border-dotted border-[#b8b5b0] bg-white/85 text-xs">
                {ticket.previousSales.map((sale, saleIndex) => (
                  <div
                    key={sale.sale.id}
                    className={
                      saleIndex > 0
                        ? "border-t border-dotted border-[#c6c2bc]"
                        : ""
                    }
                  >
                    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-bold text-[#34312e]">
                          {sale.periodName ?? "Venta anterior"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[#8b8781]">
                          {formatDate(sale.sale.sale_date) ??
                            "Operación anterior"}{" "}
                          · Importe original
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-[#8b8781]">
                        {money(sale.total)}
                      </span>
                    </div>

                    {sale.payments.map((payment, index) => (
                      <div
                        key={`${sale.sale.id}-${payment.id}-${index}`}
                        className="flex items-center justify-between gap-3 border-t border-dotted border-[#dedbd6] bg-[#fbfaf8] px-3 py-2 text-[11px] text-[#18804a]"
                      >
                        <span>
                          Abono {formatDate(payment.date)}
                          {payment.method ? ` · ${payment.method}` : ""}
                        </span>
                        <span className="shrink-0 font-bold tabular-nums">
                          − {money(payment.amount)}
                        </span>
                      </div>
                    ))}

                    <div className="flex items-center justify-between gap-3 border-t border-dotted border-[#c6c2bc] px-3 py-2 font-bold">
                      <span>Saldo pendiente de esta venta</span>
                      <span className="tabular-nums">
                        {money(sale.balance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="ticket-paper-section py-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#0C304F]">
                Productos de este periodo
              </h4>
              <span className="text-[10px] font-semibold text-[#8b8781]">
                {ticket.products.reduce(
                  (sum, product) => sum + product.quantity,
                  0,
                )}{" "}
                pz.
              </span>
            </div>

            {ticket.products.length === 0 ? (
              <p className="border border-dotted border-[#c6c2bc] bg-white/80 px-3 py-4 text-center text-xs text-[#77736d]">
                No hay productos nuevos registrados en este periodo. El importe
                pendiente corresponde a adeudos anteriores.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="ticket-table w-full min-w-[440px] border-collapse text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="bg-[#e9e8e6] text-[#CC6255]">
                      <th className="border border-dotted border-[#aaa7a1] px-2 py-2 text-center font-bold">
                        Pz.
                      </th>
                      <th className="border border-dotted border-[#aaa7a1] px-2 py-2 font-bold">
                        Tienda
                      </th>
                      <th className="border border-dotted border-[#aaa7a1] px-2 py-2 font-bold">
                        Producto
                      </th>
                      <th className="border border-dotted border-[#aaa7a1] px-2 py-2 text-right font-bold">
                        Precio
                        <br />
                        unitario
                      </th>
                      <th className="border border-dotted border-[#aaa7a1] px-2 py-2 text-right font-bold">
                        Precio
                        <br />
                        total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.products.map((product) => (
                      <tr key={product.key} className="bg-white/75">
                        <td className="border border-dotted border-[#b8b5b0] px-2 py-2.5 text-center tabular-nums">
                          {product.quantity}
                        </td>
                        <td className="border border-dotted border-[#b8b5b0] px-2 py-2.5">
                          {product.storeName}
                        </td>
                        <td className="border border-dotted border-[#b8b5b0] px-2 py-2.5 font-semibold">
                          {product.productName}
                        </td>
                        <td className="border border-dotted border-[#b8b5b0] px-2 py-2.5 text-right tabular-nums">
                          {money(product.unitPrice)}
                        </td>
                        <td className="border border-dotted border-[#b8b5b0] px-2 py-2.5 text-right font-bold tabular-nums">
                          {money(product.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f7f5f2] font-bold">
                      <td
                        colSpan={4}
                        className="border border-dotted border-[#b8b5b0] px-2 py-2.5 text-right"
                      >
                        Total compras del periodo
                      </td>
                      <td className="border border-dotted border-[#b8b5b0] px-2 py-2.5 text-right tabular-nums">
                        {money(ticket.purchasesTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {ticket.advances.length > 0 && (
            <section className="ticket-paper-section border-t border-dotted border-[#bdb8b1] py-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs font-extrabold">
                <span className="uppercase tracking-wide text-[#0C304F]">
                  Anticipos / abonos
                </span>
                <span className="shrink-0 tabular-nums text-[#18804a]">
                  {money(ticket.advancesTotal)}
                </span>
              </div>
              <div className="space-y-1.5">
                {ticket.advances.map((advance) => (
                  <div
                    key={advance.id}
                    className="flex justify-between gap-3 text-xs text-[#18804a]"
                  >
                    <span>
                      Abono {formatDate(advance.date)} · {advance.method}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">
                      − {money(advance.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="ticket-paper-section ml-auto mt-3 w-full max-w-[315px] border border-dotted border-[#aaa7a1] bg-white/90 text-xs sm:text-sm">
            {ticket.previousBalance > 0.009 && (
              <div className="flex justify-between gap-4 border-b border-dotted border-[#aaa7a1] px-3 py-2.5">
                <span className="font-bold tracking-wide">
                  ADEUDOS ANTERIORES
                </span>
                <span className="tabular-nums">
                  {money(ticket.previousBalance)}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-4 border-b border-dotted border-[#aaa7a1] px-3 py-2.5">
              <span className="font-bold tracking-wide">
                COMPRAS DEL PERIODO
              </span>
              <span className="tabular-nums">
                {money(ticket.purchasesTotal)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-dotted border-[#aaa7a1] bg-[#f7f5f2] px-3 py-2.5">
              <span className="font-extrabold tracking-wide">TOTAL</span>
              <span className="font-semibold tabular-nums">
                {money(ticket.total)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-dotted border-[#aaa7a1] px-3 py-2.5">
              <span className="font-extrabold tracking-wide">
                ANTICIPOS / ABONOS
              </span>
              <span className="tabular-nums text-[#18804a]">
                − {money(ticket.advancesTotal)}
              </span>
            </div>
            <div className="flex justify-between gap-4 bg-[#f8eee9] px-3 py-3 text-sm sm:text-base">
              <span className="font-black tracking-wide text-[#0C304F]">
                RESTANTE
              </span>
              <span className="font-black tabular-nums text-[#CC6255]">
                {money(ticket.remaining)}
              </span>
            </div>
          </section>

          <footer className="ticket-paper-section mt-7 border-t-2 border-dotted border-[#aaa7a1] pt-4 text-center">
            <p className="font-serif text-xl font-black uppercase tracking-wide text-[#0C304F] sm:text-2xl">
              ¡Gracias por tu confianza!
            </p>
            <p className="mt-1 text-[10px] font-semibold text-[#0C304F] sm:text-xs">
              * Los precios escritos se encuentran en moneda nacional (MXN)
            </p>
          </footer>
        </div>
      </div>
    </article>
  );
}
