"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
};

type InventoryProduct = {
  id: string;
  unit_number: number;
  status: string;
  retail_price_mxn: number | null;
  wholesale_price_mxn: number | null;
  purchase_items: {
    product_name: string;
    brand: string | null;
    model: string | null;
    unit_cost_mxn: number | null;
    unit_cost_usd: number | null;
  };
};

type CartItem = {
  inventory_unit_id: string;
  unit_number: number;
  product_name: string;
  brand: string | null;
  model: string | null;
  unit_cost_mxn: number;
  unit_cost_usd: number;
  retail_price_mxn: number | null;
  wholesale_price_mxn: number | null;
  is_wholesale: boolean;
  sale_price_mxn: string;
};

type SaleResult = {
  success: boolean;
  sale_id: string;
  folio: string;
  total_mxn: number;
  paid_mxn: number;
  balance_mxn: number;
  subtotal_mxn?: number;
  discount_type?: string;
  discount_value?: number;
  discount_amount_mxn?: number;
};

type OperationPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: "planning" | "selling" | "finished";
};

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

function parseAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!normalized || normalized === "." || normalized === "-") return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isValidAmountInput(value: string) {
  const normalized = value.trim().replace(/,/g, ".");
  return (
    normalized === "" || /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(normalized)
  );
}

function productGroupKey(productName: string) {
  return productName.trim().toLocaleLowerCase("es-MX");
}

function calculateWholesalePrice(unitCostUsd: number) {
  return (unitCostUsd * 1.0825 * 19 * 1.2).toFixed(2);
}

const inputClass =
  "w-full rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm text-[#0C304F] outline-none transition placeholder:text-[#78909C] focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10";

const labelClass = "mb-2 block text-sm font-semibold text-[#0C304F]";
const PRODUCT_PAGE_SIZE = 12;

export default function VentasPage() {
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SaleResult | null>(null);

  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  const [initialPayment, setInitialPayment] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    "percentage",
  );
  const [discountValue, setDiscountValue] = useState("");
  const [separatePrices, setSeparatePrices] = useState<Record<string, boolean>>(
    {},
  );
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [periods, setPeriods] = useState<OperationPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [customersResult, periodsResult, inventoryResult] =
        await Promise.all([
          supabase
            .from("customers")
            .select("id, full_name, phone, email, active")
            .eq("active", true)
            .order("full_name"),

          supabase
            .from("operation_periods")
            .select("id, name, start_date, end_date, status")
            .in("status", ["planning", "selling"])
            .order("start_date", { ascending: false }),

          supabase
            .from("inventory_units")
            .select(
              `
              id,
              unit_number,
              status,
              retail_price_mxn,
              wholesale_price_mxn,
              purchase_items!inner (
                product_name,
                brand,
                model,
                unit_cost_mxn,
                unit_cost_usd
              )
            `,
            )
            .eq("status", "available")
            .order("unit_number"),
        ]);

      if (customersResult.error) throw customersResult.error;
      if (periodsResult.error) throw periodsResult.error;
      if (inventoryResult.error) throw inventoryResult.error;

      setCustomers((customersResult.data ?? []) as Customer[]);
      setPeriods((periodsResult.data ?? []) as OperationPeriod[]);
      setInventory(
        (inventoryResult.data ?? []) as unknown as InventoryProduct[],
      );
      setCurrentProductPage(1);
    } catch (err) {
      console.error("Error cargando ventas:", err);
      setError(
        err instanceof Error ? err.message : "No se pudieron cargar los datos.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const subtotal =
    Math.round(
      cart.reduce((sum, item) => sum + parseAmount(item.sale_price_mxn), 0) *
        100,
    ) / 100;
  const discountValueNumber = parseAmount(discountValue);
  const discountAmount = Math.min(
    subtotal,
    Math.round(
      (discountType === "percentage"
        ? (subtotal * discountValueNumber) / 100
        : discountValueNumber) * 100,
    ) / 100,
  );
  const discountValid =
    isValidAmountInput(discountValue) &&
    discountValueNumber >= 0 &&
    (discountValueNumber === 0 ||
      (discountType === "percentage"
        ? discountValueNumber < 100
        : discountValueNumber < subtotal));
  const total = Math.max(
    Math.round((subtotal - discountAmount) * 100) / 100,
    0,
  );

  const paymentAmount = parseAmount(initialPayment);
  const validPayment =
    discountValid &&
    isValidAmountInput(initialPayment) &&
    Number.isFinite(paymentAmount) &&
    paymentAmount >= 0 &&
    paymentAmount <= total;

  const balance = Math.max(
    Math.round(
      (total - (Number.isFinite(paymentAmount) ? paymentAmount : 0)) * 100,
    ) / 100,
    0,
  );

  const customerSearchTerm = customerSearch.trim().toLocaleLowerCase("es-MX");
  const canSearchCustomers = customerSearchTerm.length >= 2;
  const filteredCustomers = canSearchCustomers
    ? customers.filter((customer) =>
        `${customer.full_name} ${customer.phone ?? ""} ${customer.email ?? ""}`
          .toLocaleLowerCase("es-MX")
          .includes(customerSearchTerm),
      )
    : [];

  const filteredInventory = inventory.filter((product) => {
    const item = product.purchase_items;

    const searchable = [
      item?.product_name,
      item?.brand,
      item?.model,
      String(product.unit_number),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(productSearch.toLowerCase());
  });

  const totalProductPages = Math.max(
    1,
    Math.ceil(filteredInventory.length / PRODUCT_PAGE_SIZE),
  );
  const safeProductPage = Math.min(currentProductPage, totalProductPages);
  const productPageStart = (safeProductPage - 1) * PRODUCT_PAGE_SIZE;
  const paginatedInventory = filteredInventory.slice(
    productPageStart,
    productPageStart + PRODUCT_PAGE_SIZE,
  );
  const visibleProductPages = Array.from(
    { length: Math.min(totalProductPages, 5) },
    (_, index) => {
      const firstVisiblePage = Math.min(
        Math.max(safeProductPage - 2, 1),
        Math.max(totalProductPages - 4, 1),
      );
      return firstVisiblePage + index;
    },
  );

  const cartGroups = useMemo(() => {
    const groups = new Map<string, CartItem[]>();

    cart.forEach((item) => {
      const key = productGroupKey(item.product_name);
      const current = groups.get(key) ?? [];
      current.push(item);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
  }, [cart]);

  function addToCart(product: InventoryProduct) {
    if (cart.some((item) => item.inventory_unit_id === product.id)) {
      setError("Este producto ya está agregado a la venta.");
      return;
    }

    const item = product.purchase_items;

    if (item?.unit_cost_mxn == null || item?.unit_cost_usd == null) {
      setError(
        `La unidad #${product.unit_number} no tiene registrado su costo original en USD y/o su costo en MXN. Completa esos datos antes de venderla.`,
      );
      return;
    }

    const groupKey = productGroupKey(item.product_name);
    const splitPrice = separatePrices[groupKey] ?? false;

    setCart((current) => {
      const existingGroup = current.filter(
        (cartItem) => productGroupKey(cartItem.product_name) === groupKey,
      );
      const inherited = !splitPrice ? existingGroup[0] : undefined;
      const isWholesale = inherited?.is_wholesale ?? false;

      const newItem: CartItem = {
        inventory_unit_id: product.id,
        unit_number: product.unit_number,
        product_name: item.product_name,
        brand: item.brand,
        model: item.model,
        unit_cost_mxn: Number(item.unit_cost_mxn),
        unit_cost_usd: Number(item.unit_cost_usd),
        retail_price_mxn: product.retail_price_mxn,
        wholesale_price_mxn: product.wholesale_price_mxn,
        is_wholesale: isWholesale,
        sale_price_mxn: isWholesale
          ? calculateWholesalePrice(Number(item.unit_cost_usd))
          : (inherited?.sale_price_mxn ?? ""),
      };

      return [...current, newItem];
    });

    setError("");
  }

  function updateCartItem(inventoryUnitId: string, changes: Partial<CartItem>) {
    setCart((current) =>
      current.map((item) =>
        item.inventory_unit_id === inventoryUnitId
          ? { ...item, ...changes }
          : item,
      ),
    );
  }

  function updateGroupSalePrice(groupKey: string, value: string) {
    setCart((current) =>
      current.map((item) =>
        productGroupKey(item.product_name) === groupKey
          ? { ...item, is_wholesale: false, sale_price_mxn: value }
          : item,
      ),
    );
  }

  function updateGroupWholesale(groupKey: string, wholesale: boolean) {
    setCart((current) =>
      current.map((item) =>
        productGroupKey(item.product_name) === groupKey
          ? {
              ...item,
              is_wholesale: wholesale,
              sale_price_mxn: wholesale
                ? calculateWholesalePrice(item.unit_cost_usd)
                : "",
            }
          : item,
      ),
    );
  }

  function toggleSeparatePrices(groupKey: string, split: boolean) {
    if (!split) {
      setCart((current) => {
        const groupItems = current.filter(
          (item) => productGroupKey(item.product_name) === groupKey,
        );
        const first = groupItems[0];
        if (!first) return current;

        return current.map((item) => {
          if (productGroupKey(item.product_name) !== groupKey) return item;
          return {
            ...item,
            is_wholesale: first.is_wholesale,
            sale_price_mxn: first.is_wholesale
              ? calculateWholesalePrice(item.unit_cost_usd)
              : first.sale_price_mxn,
          };
        });
      });
    }

    setSeparatePrices((current) => ({ ...current, [groupKey]: split }));
  }

  function removeFromCart(inventoryUnitId: string) {
    setCart((current) =>
      current.filter((item) => item.inventory_unit_id !== inventoryUnitId),
    );
  }

  function removeCartGroup(groupKey: string) {
    setCart((current) =>
      current.filter((item) => productGroupKey(item.product_name) !== groupKey),
    );
  }

  async function handleCreateCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!newCustomerName.trim()) {
      setError("Escribe el nombre del cliente.");
      return;
    }

    setCreatingCustomer(true);

    try {
      const { data, error: insertError } = await supabase
        .from("customers")
        .insert({
          full_name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          email: newCustomerEmail.trim() || null,
          active: true,
        })
        .select("id, full_name, phone, email, active")
        .single();

      if (insertError) throw insertError;

      const customer = data as Customer;

      setCustomers((current) =>
        [...current, customer].sort((a, b) =>
          a.full_name.localeCompare(b.full_name),
        ),
      );

      setSelectedCustomer(customer);
      setCustomerSearch("");
      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
    } catch (err) {
      console.error("Error creando cliente:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo registrar el cliente.",
      );
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function handleCreateSale() {
    setError("");
    setSuccess(null);

    if (!selectedCustomer) {
      setError("Selecciona un cliente antes de continuar.");
      return;
    }

    if (!selectedPeriodId) {
      setError("Selecciona un periodo de operación.");
      return;
    }

    if (cart.length === 0) {
      setError("Agrega al menos un producto a la venta.");
      return;
    }

    if (
      cart.some(
        (item) =>
          !item.sale_price_mxn.trim() || parseAmount(item.sale_price_mxn) <= 0,
      )
    ) {
      setError("Captura un precio de venta mayor que cero para cada producto.");
      return;
    }

    if (!discountValid) {
      setError(
        discountType === "percentage"
          ? "El descuento porcentual debe ser mayor o igual a 0 y menor a 100%."
          : "El descuento fijo debe ser mayor o igual a 0 y menor que el subtotal.",
      );
      return;
    }

    if (!validPayment) {
      setError("El anticipo debe estar entre $0 y el total final de la venta.");
      return;
    }

    if (paymentAmount > 0 && !paymentMethod) {
      setError("Selecciona el método de pago.");
      return;
    }

    setSaving(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "create_sale_with_discount",
        {
          p_customer_id: selectedCustomer.id,
          p_items: cart.map((item) => ({
            inventory_unit_id: item.inventory_unit_id,
            sale_price_mxn: parseAmount(item.sale_price_mxn),
            is_wholesale: item.is_wholesale,
          })),
          p_initial_payment: paymentAmount,
          p_payment_method: paymentMethod,
          p_payment_reference: paymentReference.trim() || null,
          p_notes: notes.trim() || null,
          p_operation_period_id: selectedPeriodId,
          p_discount_type: discountValueNumber > 0 ? discountType : "none",
          p_discount_value: discountValueNumber,
        },
      );

      if (rpcError) throw rpcError;

      const result = data as SaleResult;

      if (!result?.success || !result?.sale_id) {
        throw new Error("Supabase no confirmó el registro de la venta.");
      }

      setSuccess(result);
      setCart([]);
      setSelectedCustomer(null);
      setCustomerSearch("");
      setProductSearch("");
      setInitialPayment("");
      setDiscountType("percentage");
      setDiscountValue("");
      setSeparatePrices({});
      setPaymentMethod("transfer");
      setPaymentReference("");
      setNotes("");
      setSelectedPeriodId("");

      await loadData();
    } catch (err) {
      console.error("Error registrando venta:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar la venta. Intenta nuevamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FDF9F7] p-4 text-[#0C304F] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Encabezado */}
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#36709E]">
              <ShoppingCart size={17} />
              Operaciones / Ventas
            </div>

            <h1 className="text-3xl font-bold tracking-tight">Nueva venta</h1>

            <p className="mt-2 text-sm text-[#78909C]">
              Registra productos, anticipos y ventas de tus clientes.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#EFE7DE] bg-white px-4 py-3">
            <div className="rounded-xl bg-[#36709E]/10 p-2 text-[#36709E]">
              <Package size={22} />
            </div>
            <div>
              <p className="text-xs text-[#78909C]">Unidades disponibles</p>
              <p className="text-xl font-bold">{inventory.length}</p>
            </div>
          </div>
        </header>

        {/* Mensajes */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p className="min-w-0 flex-1 break-words">{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Cerrar mensaje"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-1 shrink-0 text-green-700"
                size={24}
              />
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-green-900">
                  ¡Venta registrada correctamente!
                </h2>
                <p className="mt-1 text-sm text-green-800">
                  Folio: <strong>{success.folio}</strong>
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs text-green-800">Subtotal</p>
                    <p className="mt-1 font-bold">
                      {money(Number(success.subtotal_mxn ?? success.total_mxn))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs text-green-800">Descuento</p>
                    <p className="mt-1 font-bold">
                      {money(Number(success.discount_amount_mxn ?? 0))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs text-green-800">Total final</p>
                    <p className="mt-1 font-bold">
                      {money(Number(success.total_mxn))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs text-green-800">Anticipo</p>
                    <p className="mt-1 font-bold">
                      {money(Number(success.paid_mxn))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs text-green-800">Saldo pendiente</p>
                    <p className="mt-1 font-bold">
                      {money(Number(success.balance_mxn))}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSuccess(null)}
                aria-label="Cerrar confirmación"
                className="text-green-800"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-[#78909C]">
            <LoaderCircle className="animate-spin" size={24} />
            Cargando clientes e inventario...
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 xl:h-[calc(100vh-17rem)] xl:min-h-[720px] xl:grid-cols-[minmax(0,1fr)_390px] xl:items-stretch xl:overflow-hidden">
            {/* Columna izquierda: su scroll no mueve el resumen */}
            <div className="min-h-0 space-y-6 xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-2">
              {/* Cliente */}
              <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[#36709E]/10 p-2.5 text-[#36709E]">
                      <UserRound size={21} />
                    </div>
                    <div>
                      <h2 className="font-bold">Cliente</h2>
                      <p className="text-sm text-[#78909C]">
                        ¿A quién se le registrará la venta?
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNewCustomer((value) => !value)}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0C304F] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#36709E]"
                  >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Nuevo cliente</span>
                    <span className="sm:hidden">Nuevo</span>
                  </button>
                </div>

                {selectedCustomer ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#36709E]/20 bg-[#36709E]/5 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {selectedCustomer.full_name}
                      </p>
                      <p className="mt-1 text-sm text-[#78909C]">
                        {selectedCustomer.phone || "Sin teléfono"}
                        {selectedCustomer.email
                          ? ` · ${selectedCustomer.email}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="rounded-lg p-2 text-[#78909C] hover:bg-white hover:text-[#CC6255]"
                      aria-label="Cambiar cliente"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-3">
                      <Search
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
                      />
                      <input
                        value={customerSearch}
                        onChange={(event) =>
                          setCustomerSearch(event.target.value)
                        }
                        placeholder="Buscar cliente por nombre, teléfono o correo..."
                        className={`${inputClass} pl-10`}
                      />
                    </div>

                    {!canSearchCustomers ? (
                      <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-6 text-center">
                        <Search
                          className="mx-auto mb-2 text-[#78909C]"
                          size={24}
                        />
                        <p className="text-sm font-medium">
                          {customerSearchTerm.length === 1
                            ? "Escribe al menos 2 caracteres para buscar."
                            : "Busca un cliente para comenzar."}
                        </p>
                        <p className="mt-1 text-xs text-[#78909C]">
                          Puedes buscar por nombre, teléfono o correo
                          electrónico.
                        </p>
                      </div>
                    ) : filteredCustomers.length > 0 ? (
                      <>
                        <p className="mb-2 text-xs text-[#78909C]">
                          {filteredCustomers.length}{" "}
                          {filteredCustomers.length === 1
                            ? "coincidencia"
                            : "coincidencias"}
                        </p>
                        <div className="max-h-56 divide-y divide-[#EFE7DE] overflow-y-auto rounded-xl border border-[#EFE7DE]">
                          {filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setCustomerSearch("");
                              }}
                              className="flex w-full items-center justify-between gap-3 p-3 text-left transition hover:bg-[#FDF9F7]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                  {customer.full_name}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-[#78909C]">
                                  {customer.phone ||
                                    customer.email ||
                                    "Sin datos de contacto"}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-semibold text-[#36709E]">
                                Seleccionar
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-7 text-center">
                        <UserRound
                          className="mx-auto mb-2 text-[#78909C]"
                          size={26}
                        />
                        <p className="text-sm font-medium">
                          No encontramos ese cliente.
                        </p>
                        <p className="mt-1 text-xs text-[#78909C]">
                          Intenta con otro nombre, teléfono o correo. También
                          puedes registrar un cliente nuevo.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {showNewCustomer && (
                  <form
                    onSubmit={handleCreateCustomer}
                    className="mt-5 space-y-4 rounded-xl border border-[#EFE7DE] bg-[#FDF9F7] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold">Registrar cliente</h3>
                      <button
                        type="button"
                        onClick={() => setShowNewCustomer(false)}
                        aria-label="Cerrar formulario"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div>
                      <label className={labelClass}>Nombre completo *</label>
                      <input
                        required
                        value={newCustomerName}
                        onChange={(event) =>
                          setNewCustomerName(event.target.value)
                        }
                        className={inputClass}
                        placeholder="Nombre del cliente"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>Teléfono</label>
                        <input
                          value={newCustomerPhone}
                          onChange={(event) =>
                            setNewCustomerPhone(event.target.value)
                          }
                          className={inputClass}
                          placeholder="10 dígitos"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Correo electrónico</label>
                        <input
                          type="email"
                          value={newCustomerEmail}
                          onChange={(event) =>
                            setNewCustomerEmail(event.target.value)
                          }
                          className={inputClass}
                          placeholder="correo@ejemplo.com"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={creatingCustomer}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0C304F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#36709E] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {creatingCustomer && (
                        <LoaderCircle className="animate-spin" size={17} />
                      )}
                      {creatingCustomer
                        ? "Guardando..."
                        : "Guardar y seleccionar cliente"}
                    </button>
                  </form>
                )}
              </section>

              {/* Productos */}
              <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-[#E2732D]/10 p-2.5 text-[#E2732D]">
                    <Package size={21} />
                  </div>
                  <div>
                    <h2 className="font-bold">Productos disponibles</h2>
                    <p className="text-sm text-[#78909C]">
                      Selecciona las unidades que incluirás en la venta.
                    </p>
                  </div>
                </div>

                <div className="relative mb-4">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78909C]"
                  />
                  <input
                    value={productSearch}
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      setCurrentProductPage(1);
                    }}
                    placeholder="Buscar producto, marca, modelo o número de unidad..."
                    className={`${inputClass} pl-10`}
                  />
                </div>

                {filteredInventory.length > 0 ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#78909C]">
                      <span>
                        Mostrando {productPageStart + 1}–
                        {Math.min(
                          productPageStart + PRODUCT_PAGE_SIZE,
                          filteredInventory.length,
                        )}{" "}
                        de {filteredInventory.length} unidades
                      </span>
                      <span>{PRODUCT_PAGE_SIZE} por página</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {paginatedInventory.map((product) => {
                        const item = product.purchase_items;
                        const alreadyAdded = cart.some(
                          (cartItem) =>
                            cartItem.inventory_unit_id === product.id,
                        );

                        return (
                          <article
                            key={product.id}
                            className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#EFE7DE] bg-white p-3 transition hover:border-[#36709E]/40"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold leading-5">
                                {item?.product_name || "Producto sin nombre"}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-[#78909C]">
                                {[item?.brand, item?.model]
                                  .filter(Boolean)
                                  .join(" · ") || "Sin marca o modelo"}
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="text-[11px] text-[#78909C]">
                                  Unidad #{product.unit_number}
                                </span>
                                <span className="rounded-md bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                                  Disponible
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => addToCart(product)}
                              aria-label={
                                alreadyAdded
                                  ? `${item?.product_name ?? "Producto"} agregado a la venta`
                                  : `Agregar ${item?.product_name ?? "producto"} a la venta`
                              }
                              title={
                                alreadyAdded
                                  ? "Agregado a la venta"
                                  : "Agregar a la venta"
                              }
                              className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#36709E] px-2.5 py-2 text-xs font-semibold text-[#36709E] transition hover:bg-[#36709E] hover:text-white disabled:cursor-not-allowed disabled:border-[#EFE7DE] disabled:bg-[#FDF9F7] disabled:text-[#78909C]"
                            >
                              <Plus size={14} />
                              <span className="hidden 2xl:inline">
                                {alreadyAdded ? "Agregado" : "Agregar"}
                              </span>
                            </button>
                          </article>
                        );
                      })}
                    </div>

                    {totalProductPages > 1 && (
                      <nav
                        aria-label="Paginación de productos"
                        className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EFE7DE] pt-4"
                      >
                        <p className="text-xs text-[#78909C]">
                          Página {safeProductPage} de {totalProductPages}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentProductPage((page) =>
                                Math.max(1, page - 1),
                              )
                            }
                            disabled={safeProductPage === 1}
                            className="rounded-lg border border-[#EFE7DE] px-3 py-2 text-xs font-semibold text-[#36709E] transition hover:bg-[#FDF9F7] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Anterior
                          </button>
                          {visibleProductPages.map((page) => (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setCurrentProductPage(page)}
                              aria-current={
                                safeProductPage === page ? "page" : undefined
                              }
                              className={`min-w-8 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                                safeProductPage === page
                                  ? "border-[#36709E] bg-[#36709E] text-white"
                                  : "border-[#EFE7DE] text-[#36709E] hover:bg-[#FDF9F7]"
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentProductPage((page) =>
                                Math.min(totalProductPages, page + 1),
                              )
                            }
                            disabled={safeProductPage === totalProductPages}
                            className="rounded-lg border border-[#EFE7DE] px-3 py-2 text-xs font-semibold text-[#36709E] transition hover:bg-[#FDF9F7] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Siguiente
                          </button>
                        </div>
                      </nav>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-10 text-center">
                    <Package
                      className="mx-auto mb-3 text-[#78909C]"
                      size={32}
                    />
                    <p className="font-semibold">
                      {productSearch
                        ? "No encontramos productos."
                        : "No hay unidades disponibles todavía."}
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-[#78909C]">
                      {productSearch
                        ? "Prueba con otro nombre, marca o modelo."
                        : "Cuando registres compras y sus unidades de inventario, aparecerán aquí para agregarlas a una venta."}
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* Resumen de venta: scroll independiente */}
            <aside className="min-h-0 space-y-6 xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-2">
              <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[#CC6255]/10 p-2.5 text-[#CC6255]">
                      <ShoppingCart size={21} />
                    </div>
                    <div>
                      <h2 className="font-bold">Resumen de venta</h2>
                      <p className="text-sm text-[#78909C]">
                        {cart.length}{" "}
                        {cart.length === 1 ? "unidad" : "unidades"}
                      </p>
                    </div>
                  </div>
                </div>

                {cart.length === 0 ? (
                  <div className="rounded-xl bg-[#FDF9F7] px-4 py-8 text-center">
                    <ShoppingCart
                      className="mx-auto mb-2 text-[#78909C]"
                      size={28}
                    />
                    <p className="text-sm font-medium">
                      Tu carrito está vacío.
                    </p>
                    <p className="mt-1 text-xs text-[#78909C]">
                      Agrega productos para comenzar.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cartGroups.map(({ key, items }) => {
                      const first = items[0];
                      const splitPrice = separatePrices[key] ?? false;
                      const groupWholesale = items.every(
                        (item) => item.is_wholesale,
                      );
                      const groupCost = items.reduce(
                        (sum, item) => sum + item.unit_cost_mxn,
                        0,
                      );
                      const groupSale = items.reduce(
                        (sum, item) => sum + parseAmount(item.sale_price_mxn),
                        0,
                      );
                      const groupHasPrices = items.every(
                        (item) => parseAmount(item.sale_price_mxn) > 0,
                      );
                      const groupProfit = groupHasPrices
                        ? groupSale - groupCost
                        : null;

                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-[#EFE7DE] p-3 sm:p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold">
                                  {first.product_name}
                                </p>
                                <span className="rounded-full bg-[#36709E]/10 px-2 py-0.5 text-[11px] font-semibold text-[#36709E]">
                                  {items.length}{" "}
                                  {items.length === 1 ? "unidad" : "unidades"}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#78909C]">
                                {[first.brand, first.model]
                                  .filter(Boolean)
                                  .join(" · ") || "Sin marca o modelo"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCartGroup(key)}
                              className="shrink-0 rounded-lg p-1.5 text-[#78909C] transition hover:bg-red-50 hover:text-[#CC6255]"
                              aria-label={`Eliminar ${first.product_name} del carrito`}
                              title="Eliminar todas las unidades de este grupo"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {items.map((item) => (
                              <span
                                key={item.inventory_unit_id}
                                className="inline-flex items-center gap-1 rounded-md bg-[#FDF9F7] px-2 py-1 text-[11px] text-[#78909C]"
                              >
                                Unidad #{item.unit_number}
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeFromCart(item.inventory_unit_id)
                                  }
                                  className="rounded p-0.5 hover:bg-red-50 hover:text-[#CC6255]"
                                  aria-label={`Quitar unidad ${item.unit_number}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>

                          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg bg-[#FDF9F7] px-3 py-2 text-xs text-[#0C304F]">
                            <input
                              type="checkbox"
                              checked={splitPrice}
                              onChange={(event) =>
                                toggleSeparatePrices(key, event.target.checked)
                              }
                              className="h-4 w-4 accent-[#E2732D]"
                            />
                            <span className="font-semibold">
                              Separar precios por unidad
                            </span>
                          </label>
                          <p className="mt-1 text-[11px] leading-relaxed text-[#78909C]">
                            {splitPrice
                              ? "Cada unidad puede llevar un precio distinto."
                              : "Por defecto, todas las unidades con este nombre comparten el mismo precio."}
                          </p>

                          {!splitPrice ? (
                            <>
                              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-[#EFE7DE] p-2.5">
                                <input
                                  type="checkbox"
                                  checked={groupWholesale}
                                  onChange={(event) =>
                                    updateGroupWholesale(
                                      key,
                                      event.target.checked,
                                    )
                                  }
                                  className="mt-0.5 h-4 w-4 accent-[#E2732D]"
                                />
                                <span>
                                  <span className="block text-xs font-semibold text-[#0C304F]">
                                    Aplicar precio de mayoreo a todo el grupo
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-[#78909C]">
                                    Costo USD × 1.0825 × $19 × 1.20, calculado
                                    por unidad
                                  </span>
                                </span>
                              </label>

                              {groupWholesale ? (
                                <div className="mt-3 space-y-1.5 rounded-lg bg-[#FDF9F7] p-3">
                                  <p className="text-xs font-semibold text-[#78909C]">
                                    Mayoreo calculado por unidad
                                  </p>
                                  {items.map((item) => (
                                    <div
                                      key={item.inventory_unit_id}
                                      className="flex items-center justify-between gap-3 text-xs"
                                    >
                                      <span className="text-[#78909C]">
                                        Unidad #{item.unit_number}
                                      </span>
                                      <span className="font-semibold">
                                        {money(
                                          parseAmount(item.sale_price_mxn),
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-3">
                                  <label
                                    htmlFor={`shared-price-${key}`}
                                    className="mb-1.5 block text-xs font-semibold text-[#78909C]"
                                  >
                                    Precio unitario compartido (MXN)
                                  </label>
                                  <input
                                    id={`shared-price-${key}`}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={first.sale_price_mxn}
                                    onChange={(event) =>
                                      updateGroupSalePrice(
                                        key,
                                        event.target.value,
                                      )
                                    }
                                    className={inputClass}
                                    placeholder="Ej. 450"
                                  />
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {items.map((item) => (
                                <div
                                  key={item.inventory_unit_id}
                                  className="rounded-lg border border-[#EFE7DE] p-3"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-semibold">
                                      Unidad #{item.unit_number}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeFromCart(item.inventory_unit_id)
                                      }
                                      className="rounded p-1 text-[#78909C] hover:bg-red-50 hover:text-[#CC6255]"
                                      aria-label={`Quitar unidad ${item.unit_number}`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={item.is_wholesale}
                                      onChange={(event) => {
                                        const wholesale = event.target.checked;
                                        updateCartItem(item.inventory_unit_id, {
                                          is_wholesale: wholesale,
                                          sale_price_mxn: wholesale
                                            ? calculateWholesalePrice(
                                                item.unit_cost_usd,
                                              )
                                            : "",
                                        });
                                      }}
                                      className="h-4 w-4 accent-[#E2732D]"
                                    />
                                    Aplicar precio de mayoreo
                                  </label>
                                  <label
                                    htmlFor={`price-${item.inventory_unit_id}`}
                                    className="mb-1 mt-2 block text-xs font-semibold text-[#78909C]"
                                  >
                                    Precio de venta (MXN)
                                  </label>
                                  <input
                                    id={`price-${item.inventory_unit_id}`}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={item.sale_price_mxn}
                                    readOnly={item.is_wholesale}
                                    onChange={(event) =>
                                      updateCartItem(item.inventory_unit_id, {
                                        sale_price_mxn: event.target.value,
                                      })
                                    }
                                    className={`${inputClass} py-2.5 ${item.is_wholesale ? "bg-[#FDF9F7] text-[#78909C]" : ""}`}
                                    placeholder="Ej. 450"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-[#FDF9F7] p-2.5 text-xs">
                            <div>
                              <p className="text-[#78909C]">Costo</p>
                              <p className="mt-0.5 font-semibold">
                                {money(groupCost)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[#78909C]">Utilidad est.</p>
                              <p
                                className={`mt-0.5 font-semibold ${groupProfit === null ? "text-[#78909C]" : groupProfit >= 0 ? "text-green-700" : "text-red-700"}`}
                              >
                                {groupProfit === null
                                  ? "Pendiente"
                                  : money(groupProfit)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[#78909C]">Importe</p>
                              <p className="mt-0.5 font-bold">
                                {money(groupSale)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 space-y-4 border-t border-[#EFE7DE] pt-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#78909C]">Subtotal</span>
                    <span className="font-semibold">{money(subtotal)}</span>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(120px,0.85fr)] gap-3">
                    <div>
                      <label htmlFor="discount-type" className={labelClass}>
                        Descuento sobre la venta
                      </label>
                      <select
                        id="discount-type"
                        value={discountType}
                        onChange={(event) =>
                          setDiscountType(
                            event.target.value as "percentage" | "fixed",
                          )
                        }
                        className={inputClass}
                        disabled={saving || cart.length === 0}
                      >
                        <option value="percentage">Porcentaje (%)</option>
                        <option value="fixed">Cantidad fija (MXN)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="discount-value" className={labelClass}>
                        {discountType === "percentage"
                          ? "Porcentaje"
                          : "Importe (MXN)"}
                      </label>
                      <input
                        id="discount-value"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={discountValue}
                        onChange={(event) => {
                          if (isValidAmountInput(event.target.value)) {
                            setDiscountValue(event.target.value);
                          }
                        }}
                        className={inputClass}
                        placeholder="0"
                        disabled={saving || cart.length === 0}
                      />
                    </div>
                  </div>

                  {!discountValid && (
                    <p className="text-xs text-red-700">
                      {discountType === "percentage"
                        ? "Usa un porcentaje menor a 100%."
                        : "El descuento debe ser menor que el subtotal."}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#78909C]">Descuento aplicado</span>
                    <span className="font-semibold text-[#CC6255]">
                      − {money(discountAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#EFE7DE] pt-3">
                    <span className="font-semibold">Total de la venta</span>
                    <span className="text-2xl font-bold">{money(total)}</span>
                  </div>
                </div>
              </section>

              {/* Anticipo */}
              <section className="rounded-2xl border border-[#EFE7DE] bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-[#E2732D]/10 p-2.5 text-[#E2732D]">
                    <CircleDollarSign size={21} />
                  </div>
                  <div>
                    <h2 className="font-bold">Pago inicial</h2>
                    <p className="text-sm text-[#78909C]">
                      Registra un anticipo si corresponde.
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="operation-period" className={labelClass}>
                    Periodo de operación *
                  </label>

                  <select
                    id="operation-period"
                    value={selectedPeriodId}
                    onChange={(event) =>
                      setSelectedPeriodId(event.target.value)
                    }
                    className={`${inputClass} cursor-pointer disabled:cursor-not-allowed`}
                    required
                    disabled={periods.length === 0}
                  >
                    <option value="">Selecciona un periodo</option>

                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name} —
                        {period.status === "selling"
                          ? "Abierto"
                          : "En planeación"}
                      </option>
                    ))}
                  </select>

                  {periods.length === 0 && (
                    <p className="mt-2 text-xs text-[#CC6255]">
                      No hay periodos abiertos o en planeación.
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Anticipo (MXN)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={initialPayment}
                      onChange={(event) =>
                        setInitialPayment(event.target.value)
                      }
                      className={inputClass}
                      placeholder="0.00"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setInitialPayment("0")}
                        className="rounded-lg border border-[#EFE7DE] px-3 py-1.5 text-xs font-semibold hover:bg-[#FDF9F7]"
                      >
                        Sin anticipo
                      </button>
                      <button
                        type="button"
                        onClick={() => setInitialPayment(String(total / 2))}
                        disabled={total <= 0}
                        className="rounded-lg border border-[#EFE7DE] px-3 py-1.5 text-xs font-semibold hover:bg-[#FDF9F7] disabled:opacity-50"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => setInitialPayment(String(total))}
                        disabled={total <= 0}
                        className="rounded-lg border border-[#EFE7DE] px-3 py-1.5 text-xs font-semibold hover:bg-[#FDF9F7] disabled:opacity-50"
                      >
                        Pago completo
                      </button>
                    </div>
                  </div>

                  {paymentAmount > 0 && (
                    <>
                      <div>
                        <label className={labelClass}>Método de pago</label>
                        <select
                          value={paymentMethod}
                          onChange={(event) =>
                            setPaymentMethod(event.target.value)
                          }
                          className={inputClass}
                        >
                          <option value="transfer">Transferencia</option>
                          <option value="cash">Efectivo</option>
                          <option value="card">Tarjeta</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>

                      <div>
                        <label className={labelClass}>
                          Referencia del pago
                        </label>
                        <input
                          value={paymentReference}
                          onChange={(event) =>
                            setPaymentReference(event.target.value)
                          }
                          className={inputClass}
                          placeholder="Folio, autorización o referencia"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className={labelClass}>Notas de la venta</label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className={inputClass}
                      placeholder="Detalles adicionales (opcional)"
                    />
                  </div>
                </div>

                <div className="mt-5 space-y-3 rounded-xl bg-[#FDF9F7] p-4">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[#78909C]">Subtotal</span>
                    <span className="font-semibold">{money(subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[#78909C]">Descuento</span>
                    <span className="font-semibold text-[#CC6255]">
                      − {money(discountAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[#78909C]">Total final</span>
                    <span className="font-semibold">{money(total)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[#78909C]">Anticipo</span>
                    <span className="font-semibold">
                      {money(
                        Number.isFinite(paymentAmount) ? paymentAmount : 0,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-[#EFE7DE] pt-3">
                    <span className="font-semibold">Saldo pendiente</span>
                    <span className="text-lg font-bold text-[#CC6255]">
                      {money(balance)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateSale}
                  disabled={
                    saving ||
                    loading ||
                    !selectedCustomer ||
                    !selectedPeriodId ||
                    cart.length === 0 ||
                    !validPayment ||
                    cart.some(
                      (item) =>
                        !item.sale_price_mxn.trim() ||
                        parseAmount(item.sale_price_mxn) <= 0,
                    )
                  }
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2732D] px-4 py-3.5 font-bold text-white transition hover:bg-[#CC6255] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <LoaderCircle className="animate-spin" size={19} />
                      Registrando venta...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={19} />
                      Confirmar venta
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-xs leading-relaxed text-[#78909C]">
                  Al confirmar, se registrará la venta y se reservarán las
                  unidades seleccionadas.
                </p>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
