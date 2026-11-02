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
  sale_price_mxn: number;
};

type SaleResult = {
  success: boolean;
  sale_id: string;
  folio: string;
  total_mxn: number;
  paid_mxn: number;
  balance_mxn: number;
};

type OperationPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: "planning" | "open" | "closed";
};

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);

const inputClass =
  "w-full rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm text-[#0C304F] outline-none transition placeholder:text-[#78909C] focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10";

const labelClass = "mb-2 block text-sm font-semibold text-[#0C304F]";

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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  const [initialPayment, setInitialPayment] = useState("0");
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
            .in("status", ["open", "planning"])
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

  const total = cart.reduce((sum, item) => sum + item.sale_price_mxn, 0);

  const paymentAmount = Number(initialPayment || 0);
  const validPayment =
    Number.isFinite(paymentAmount) &&
    paymentAmount >= 0 &&
    paymentAmount <= total;

  const balance = total - (Number.isFinite(paymentAmount) ? paymentAmount : 0);

  const filteredCustomers = customers.filter((customer) =>
    `${customer.full_name} ${customer.phone ?? ""} ${customer.email ?? ""}`
      .toLowerCase()
      .includes(customerSearch.toLowerCase()),
  );

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

    const isWholesale = false;

    setCart((current) => [
      ...current,
      {
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
        sale_price_mxn: 0,
      },
    ]);

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

  function removeFromCart(inventoryUnitId: string) {
    setCart((current) =>
      current.filter((item) => item.inventory_unit_id !== inventoryUnitId),
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
          !Number.isFinite(item.sale_price_mxn) || item.sale_price_mxn <= 0,
      )
    ) {
      setError("Captura un precio de venta mayor que cero para cada producto.");
      return;
    }

    if (!validPayment) {
      setError("El anticipo debe estar entre $0 y el total de la venta.");
      return;
    }

    if (paymentAmount > 0 && !paymentMethod) {
      setError("Selecciona el método de pago.");
      return;
    }

    setSaving(true);

    try {
      const { data, error: rpcError } = await supabase.rpc("create_sale", {
        p_customer_id: selectedCustomer.id,
        p_items: cart.map((item) => ({
          inventory_unit_id: item.inventory_unit_id,
          sale_price_mxn: item.sale_price_mxn,
          is_wholesale: item.is_wholesale,
        })),
        p_initial_payment: paymentAmount,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference.trim() || null,
        p_notes: notes.trim() || null,
        p_operation_period_id: selectedPeriodId,
      });

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
      setInitialPayment("0");
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

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs text-green-800">Total</p>
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
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_390px]">
            {/* Columna izquierda */}
            <div className="space-y-6">
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

                    {filteredCustomers.length > 0 ? (
                      <div className="max-h-56 divide-y divide-[#EFE7DE] overflow-y-auto rounded-xl border border-[#EFE7DE]">
                        {filteredCustomers.slice(0, 8).map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => setSelectedCustomer(customer)}
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
                            <span className="text-sm font-semibold text-[#36709E]">
                              Seleccionar
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-7 text-center">
                        <UserRound
                          className="mx-auto mb-2 text-[#78909C]"
                          size={26}
                        />
                        <p className="text-sm font-medium">
                          {customerSearch
                            ? "No encontramos ese cliente."
                            : "Todavía no hay clientes registrados."}
                        </p>
                        <p className="mt-1 text-xs text-[#78909C]">
                          Puedes crear uno para continuar.
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
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar producto, marca, modelo o número de unidad..."
                    className={`${inputClass} pl-10`}
                  />
                </div>

                {filteredInventory.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {filteredInventory.map((product) => {
                      const item = product.purchase_items;
                      const alreadyAdded = cart.some(
                        (cartItem) => cartItem.inventory_unit_id === product.id,
                      );

                      return (
                        <article
                          key={product.id}
                          className="rounded-xl border border-[#EFE7DE] p-4 transition hover:border-[#36709E]/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold">
                                {item?.product_name || "Producto sin nombre"}
                              </p>
                              <p className="mt-1 text-xs text-[#78909C]">
                                {[item?.brand, item?.model]
                                  .filter(Boolean)
                                  .join(" · ") || "Sin marca o modelo"}
                              </p>
                              <p className="mt-2 text-xs text-[#78909C]">
                                Unidad #{product.unit_number}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-lg bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                              Disponible
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-lg bg-[#FDF9F7] p-2">
                              <p className="text-xs text-[#78909C]">Menudeo</p>
                              <p className="mt-1 font-semibold">
                                {product.retail_price_mxn != null
                                  ? money(Number(product.retail_price_mxn))
                                  : "Sin precio"}
                              </p>
                            </div>
                            <div className="rounded-lg bg-[#FDF9F7] p-2">
                              <p className="text-xs text-[#78909C]">Mayoreo</p>
                              <p className="mt-1 font-semibold">
                                {product.wholesale_price_mxn != null
                                  ? money(Number(product.wholesale_price_mxn))
                                  : "Sin precio"}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={alreadyAdded}
                            onClick={() => addToCart(product)}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#36709E] px-3 py-2.5 text-sm font-semibold text-[#36709E] transition hover:bg-[#36709E] hover:text-white disabled:cursor-not-allowed disabled:border-[#EFE7DE] disabled:bg-[#FDF9F7] disabled:text-[#78909C]"
                          >
                            <Plus size={16} />
                            {alreadyAdded
                              ? "Agregado a la venta"
                              : "Agregar a la venta"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
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

            {/* Resumen de venta */}
            <aside className="space-y-6 xl:sticky xl:top-6">
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
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.inventory_unit_id}
                        className="border-b border-[#EFE7DE] pb-4 last:border-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              {item.product_name}
                            </p>
                            <p className="mt-1 text-xs text-[#78909C]">
                              Unidad #{item.unit_number}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              removeFromCart(item.inventory_unit_id)
                            }
                            className="rounded-lg p-1.5 text-[#78909C] hover:bg-red-50 hover:text-[#CC6255]"
                            aria-label={`Eliminar ${item.product_name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="mt-4 rounded-xl border border-[#EFE7DE] bg-[#FDF9F7] p-3">
                          <label
                            htmlFor={`wholesale-${item.inventory_unit_id}`}
                            className="flex cursor-pointer items-start gap-3"
                          >
                            <input
                              id={`wholesale-${item.inventory_unit_id}`}
                              type="checkbox"
                              checked={item.is_wholesale}
                              onChange={(event) => {
                                const wholesale = event.target.checked;
                                const calculatedPrice = wholesale
                                  ? Number(
                                      (
                                        item.unit_cost_usd *
                                        1.0825 *
                                        19 *
                                        1.2
                                      ).toFixed(2),
                                    )
                                  : item.sale_price_mxn;

                                updateCartItem(item.inventory_unit_id, {
                                  is_wholesale: wholesale,
                                  sale_price_mxn: calculatedPrice,
                                });
                              }}
                              className="mt-0.5 h-4 w-4 accent-[#E2732D]"
                            />
                            <span>
                              <span className="block text-sm font-semibold text-[#0C304F]">
                                Aplicar precio de mayoreo
                              </span>
                              <span className="mt-1 block text-xs leading-relaxed text-[#78909C]">
                                Costo USD × 1.0825 × $19 × 1.20
                              </span>
                            </span>
                          </label>
                        </div>

                        <div className="mt-3">
                          <label
                            className="mb-1.5 block text-xs font-semibold text-[#78909C]"
                            htmlFor={`price-${item.inventory_unit_id}`}
                          >
                            Precio de venta (MXN)
                          </label>
                          <input
                            id={`price-${item.inventory_unit_id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.sale_price_mxn}
                            readOnly={item.is_wholesale}
                            onChange={(event) =>
                              updateCartItem(item.inventory_unit_id, {
                                sale_price_mxn: Number(event.target.value),
                              })
                            }
                            className={`${inputClass} ${item.is_wholesale ? "bg-[#FDF9F7] text-[#78909C]" : ""}`}
                          />
                          <p className="mt-1.5 text-xs text-[#78909C]">
                            {item.is_wholesale
                              ? "Precio calculado automáticamente."
                              : "Captura manualmente el precio de menudeo."}
                          </p>
                        </div>

                        <div className="mt-3 space-y-2 rounded-lg bg-[#FDF9F7] p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#78909C]">
                              Costo original
                            </span>
                            <span className="text-right font-medium">
                              {money(item.unit_cost_mxn)}
                              <span className="ml-1 block text-xs font-normal text-[#78909C]">
                                {new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 2,
                                }).format(item.unit_cost_usd)}{" "}
                                USD
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#78909C]">
                              Utilidad estimada
                            </span>
                            <span
                              className={`font-semibold ${item.sale_price_mxn - item.unit_cost_mxn >= 0 ? "text-green-700" : "text-red-700"}`}
                            >
                              {money(item.sale_price_mxn - item.unit_cost_mxn)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-[#EFE7DE] pt-2">
                            <span className="text-[#78909C]">Importe</span>
                            <span className="font-bold">
                              {money(item.sale_price_mxn)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 border-t border-[#EFE7DE] pt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#78909C]">
                      Total de la venta
                    </span>
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
                    className={inputClass}
                    required
                    disabled={periods.length === 0}
                  >
                    <option value="">Selecciona un periodo</option>

                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name} —{" "}
                        {period.status === "open" ? "Abierto" : "En planeación"}
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
                      type="number"
                      min="0"
                      max={total}
                      step="0.01"
                      value={initialPayment}
                      onChange={(event) =>
                        setInitialPayment(event.target.value)
                      }
                      className={inputClass}
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
                    <span className="text-[#78909C]">Total</span>
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
                        !Number.isFinite(item.sale_price_mxn) ||
                        item.sale_price_mxn <= 0,
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
