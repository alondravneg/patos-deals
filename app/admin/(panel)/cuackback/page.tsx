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
  Award,
  ChevronRight,
  Download,
  LoaderCircle,
  RefreshCw,
  Search,
  ShoppingCart,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
};

type LoyaltyAccount = {
  customer_id: string;
  current_stamps: number;
};

type LoyaltyReward = {
  id: string;
  customer_id: string;
  cycle_number: number;
  status: "pending" | "redeemed";
  earned_at: string;
  redeemed_at: string | null;
  legacy_imported: boolean;
};

type LoyaltyEvent = {
  id: string;
  customer_id: string;
  event_type:
    | "stamp"
    | "reward_earned"
    | "reward_redeemed"
    | "legacy_import"
    | "manual_adjustment";
  event_date: string;
  cycle_number: number | null;
  stamp_number: number | null;
  period_code: string | null;
  stamp_color: string | null;
  stamp_code: string | null;
  notes: string | null;
};

type StampView = {
  stamp_number: number;
  stamp_color: string;
  stamp_code: string;
  period_code: string;
  isLegacyPlaceholder?: boolean;
};

type LoyaltyCardData = {
  customer: Customer;
  currentStamps: number;
  rewardsPending: number;
  rewardsRedeemed: number;
  currentCycle: number;
  stamps: StampView[];
};

const inputClass =
  "w-full rounded-xl border border-[#EFE7DE] bg-white px-3.5 py-3 text-sm text-[#0C304F] outline-none transition focus:border-[#36709E] focus:ring-2 focus:ring-[#36709E]/10";

const stampPalette = [
  "#D94E9B",
  "#E96767",
  "#FFB847",
  "#FF633D",
  "#F15C91",
  "#347DE0",
  "#31A88B",
  "#8B65C7",
  "#C18A52",
  "#2E9BB5",
  "#A6A83B",
  "#D56B9F",
];

function safeFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "cliente"
  );
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

async function waitForCardAssets(element: HTMLElement) {
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
          /* El SVG puede estar cargado aunque decode rechace. */
        }
      }
    }),
  );
  if ("fonts" in document) await document.fonts.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

export default function CuackbackPage() {
  const supabase = useMemo(() => createClient(), []);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [events, setEvents] = useState<LoyaltyEvent[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState("");
  const exportCardRefs = useRef<Record<string, HTMLElement | null>>({});

  const loadData = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const [customersResult, accountsResult, rewardsResult, eventsResult] =
          await Promise.all([
            supabase
              .from("customers")
              .select("id, full_name, phone, email, active")
              .order("full_name"),
            supabase
              .from("loyalty_accounts")
              .select("customer_id, current_stamps"),
            supabase
              .from("loyalty_rewards")
              .select(
                "id, customer_id, cycle_number, status, earned_at, redeemed_at, legacy_imported",
              )
              .order("cycle_number", { ascending: true }),
            supabase
              .from("loyalty_events")
              .select(
                "id, customer_id, event_type, event_date, cycle_number, stamp_number, period_code, stamp_color, stamp_code, notes",
              )
              .eq("event_type", "stamp")
              .order("event_date", { ascending: true }),
          ]);

        const results = [
          customersResult,
          accountsResult,
          rewardsResult,
          eventsResult,
        ];
        const firstError = results.find((result) => result.error)?.error;
        if (firstError) throw firstError;

        const nextCustomers = (customersResult.data ?? []) as Customer[];
        setCustomers(nextCustomers);
        setAccounts((accountsResult.data ?? []) as LoyaltyAccount[]);
        setRewards((rewardsResult.data ?? []) as LoyaltyReward[]);
        setEvents((eventsResult.data ?? []) as LoyaltyEvent[]);

        setSelectedCustomerId(
          (current) => current || nextCustomers[0]?.id || "",
        );
      } catch (err) {
        console.error("Error cargando Cuackback:", err);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la información de Cuackback.",
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

  const accountByCustomer = useMemo(
    () => new Map(accounts.map((account) => [account.customer_id, account])),
    [accounts],
  );
  const customerCards = useMemo<LoyaltyCardData[]>(
    () =>
      customers.map((customer) => {
        const account = accountByCustomer.get(customer.id);
        const customerRewards = rewards.filter(
          (reward) => reward.customer_id === customer.id,
        );
        const customerEvents = events.filter(
          (event) => event.customer_id === customer.id,
        );
        const currentStamps = Number(account?.current_stamps ?? 0);
        const rewardsPending = customerRewards.filter(
          (reward) => reward.status === "pending",
        ).length;
        const rewardsRedeemed = customerRewards.filter(
          (reward) => reward.status === "redeemed",
        ).length;
        const currentCycle =
          Math.max(0, ...customerRewards.map((reward) => reward.cycle_number)) +
          1;
        const currentCycleEvents = customerEvents
          .filter((event) => event.cycle_number === currentCycle)
          .sort(
            (a, b) => Number(a.stamp_number ?? 0) - Number(b.stamp_number ?? 0),
          );

        const stamps: StampView[] = Array.from({ length: 6 }, (_, index) => {
          const actual = currentCycleEvents.find(
            (event) => event.stamp_number === index + 1,
          );
          if (actual) {
            return {
              stamp_number: index + 1,
              stamp_color: actual.stamp_color ?? stampPalette[index],
              stamp_code: actual.stamp_code ?? "",
              period_code: actual.period_code ?? "",
            };
          }
          if (index < currentStamps) {
            // Métrica histórica importada: mostramos el sello sin inventar un código/fecha.
            return {
              stamp_number: index + 1,
              stamp_color: "#B9A99A",
              stamp_code: "IMPORTADO",
              period_code: "LEGACY",
              isLegacyPlaceholder: true,
            };
          }
          return {
            stamp_number: index + 1,
            stamp_color: "#D9D0C6",
            stamp_code: "",
            period_code: "",
          };
        });

        return {
          customer,
          currentStamps,
          rewardsPending,
          rewardsRedeemed,
          currentCycle,
          stamps,
        };
      }),
    [customers, accountByCustomer, rewards, events],
  );

  const filteredCards = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-MX");
    if (!query) return customerCards;
    return customerCards.filter((card) =>
      [
        card.customer.full_name,
        card.customer.phone ?? "",
        card.customer.email ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("es-MX")
        .includes(query),
    );
  }, [customerCards, search]);

  const selectedCard =
    customerCards.find((card) => card.customer.id === selectedCustomerId) ??
    null;
  const selectedCards = customerCards.filter((card) =>
    selectedCustomerIds.includes(card.customer.id),
  );
  const allFilteredSelected =
    filteredCards.length > 0 &&
    filteredCards.every((card) =>
      selectedCustomerIds.includes(card.customer.id),
    );

  const totalPendingRewards = customerCards.reduce(
    (sum, card) => sum + card.rewardsPending,
    0,
  );
  const totalRedeemedRewards = customerCards.reduce(
    (sum, card) => sum + card.rewardsRedeemed,
    0,
  );
  const customersWithStamps = customerCards.filter(
    (card) =>
      card.currentStamps > 0 ||
      card.rewardsPending > 0 ||
      card.rewardsRedeemed > 0,
  ).length;

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
    const visibleIds = filteredCards.map((card) => card.customer.id);
    setSelectedCustomerIds((current) =>
      checked
        ? [...new Set([...current, ...visibleIds])]
        : current.filter((id) => !visibleIds.includes(id)),
    );
  }

  async function handleDownloadSelected() {
    if (selectedCards.length === 0 || isExporting) return;
    setIsExporting(true);
    setExportProgress(0);
    setExportError("");

    try {
      const [{ toPng }, JSZipModule] = await Promise.all([
        import("html-to-image"),
        import("jszip"),
      ]);
      const JSZip = JSZipModule.default;
      const zip = new JSZip();

      for (let index = 0; index < selectedCards.length; index += 1) {
        const card = selectedCards[index];
        const element = exportCardRefs.current[card.customer.id];
        if (!element)
          throw new Error(
            `No se pudo preparar la tarjeta de ${card.customer.full_name}.`,
          );
        await waitForCardAssets(element);
        const dataUrl = await toPng(element, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#F8EBDD",
          width: element.scrollWidth,
          height: element.scrollHeight,
        });
        const fileName = `cuackback-${safeFileName(card.customer.full_name)}.png`;
        if (selectedCards.length === 1)
          downloadBlob(dataUrlToBlob(dataUrl), fileName);
        else zip.file(fileName, dataUrl.split(",")[1], { base64: true });
        setExportProgress(index + 1);
      }

      if (selectedCards.length > 1) {
        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });
        downloadBlob(
          zipBlob,
          `cuackback-tarjetas-${selectedCards.length}-clientes.zip`,
        );
      }
    } catch (err) {
      console.error("Error exportando tarjetas Cuackback:", err);
      setExportError(
        err instanceof Error
          ? err.message
          : "No se pudieron generar las tarjetas.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    if (filteredCards.length === 0) return;
    if (
      !filteredCards.some((card) => card.customer.id === selectedCustomerId)
    ) {
      setSelectedCustomerId(filteredCards[0].customer.id);
    }
  }, [filteredCards, selectedCustomerId]);

  return (
    <main className="min-h-screen bg-[#FDF9F7] p-4 text-[#0C304F] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#36709E]">
              <Award size={17} /> Fidelidad / Cuackback
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Cuackback</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#78909C]">
              Una tarjeta permanente por cliente. Cada compra final de $1,000
              MXN o más suma un sello; seis sellos generan una recompensa del
              10%.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#EFE7DE] bg-white px-4 py-3 text-sm font-semibold transition hover:border-[#36709E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />{" "}
            Actualizar información
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />{" "}
            <span>{error}</span>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <p className="text-sm text-[#78909C]">
              Clientes con actividad loyalty
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {customersWithStamps}
            </p>
          </div>
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <p className="text-sm text-[#78909C]">Recompensas por redimir</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {totalPendingRewards}
            </p>
          </div>
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-5">
            <p className="text-sm text-[#78909C]">
              Recompensas históricas canjeadas
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {totalRedeemedRewards}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="font-bold">Tarjetas de clientes</h2>
              <p className="mt-1 text-xs text-[#78909C]">
                Una tarjeta única que conserva todos sus ciclos.
              </p>
            </div>
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
                placeholder="Buscar cliente por nombre, teléfono o correo..."
                className={`${inputClass} pl-9`}
              />
            </div>

            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-[#78909C]">
                <LoaderCircle size={20} className="animate-spin" /> Cargando
                tarjetas...
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#EFE7DE] px-4 py-10 text-center">
                <Search size={26} className="mx-auto mb-2 text-[#78909C]" />
                <p className="font-semibold">No encontramos clientes</p>
                <p className="mt-1 text-xs text-[#78909C]">
                  Prueba con otro nombre, teléfono o correo.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FDF9F7] px-3 py-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#0C304F]">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(event) =>
                        toggleAllFiltered(event.target.checked)
                      }
                      className="h-4 w-4 rounded accent-[#36709E]"
                    />
                    Seleccionar todos
                  </label>
                  <span className="text-xs text-[#78909C]">
                    {selectedCards.length} seleccionados
                  </span>
                </div>
                <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                  {filteredCards.map((card) => {
                    const active = card.customer.id === selectedCustomerId;
                    const checked = selectedCustomerIds.includes(
                      card.customer.id,
                    );
                    return (
                      <div
                        key={card.customer.id}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${active ? "border-[#36709E] bg-[#36709E]/5" : "border-[#EFE7DE] hover:border-[#B8CBD9]"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          aria-label={`Seleccionar tarjeta de ${card.customer.full_name}`}
                          onChange={(event) =>
                            toggleCustomerSelection(
                              card.customer.id,
                              event.target.checked,
                            )
                          }
                          className="ml-1 h-4 w-4 shrink-0 cursor-pointer rounded accent-[#36709E]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCustomerId(card.customer.id)
                          }
                          className="flex min-w-0 flex-1 items-center justify-between gap-3 px-1 py-1 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {card.customer.full_name}
                            </span>
                            <span className="mt-0.5 block text-xs text-[#78909C]">
                              {card.currentStamps}/6 sellos ·{" "}
                              {card.rewardsPending} por redimir ·{" "}
                              {card.rewardsRedeemed} canjeadas
                            </span>
                          </span>
                          <ChevronRight
                            size={16}
                            className={`shrink-0 ${active ? "text-[#36709E]" : "text-[#78909C]"}`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#EFE7DE] bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-bold">Vista previa de Cuackback</h2>
                <p className="mt-1 text-xs text-[#78909C]">
                  Descarga una tarjeta individual o varias en un ZIP.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerIds([])}
                  disabled={selectedCards.length === 0 || isExporting}
                  className="rounded-xl border border-[#EFE7DE] bg-white px-3 py-2.5 text-xs font-semibold text-[#78909C] transition hover:border-[#36709E] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Limpiar selección
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadSelected()}
                  disabled={selectedCards.length === 0 || isExporting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0C304F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17466B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExporting ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Download size={17} />
                  )}
                  {isExporting
                    ? `Generando ${exportProgress}/${selectedCards.length}...`
                    : `Descargar ${selectedCards.length} ${selectedCards.length === 1 ? "tarjeta" : "tarjetas"}`}
                </button>
              </div>
            </div>
            {exportError && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
              >
                {exportError}
              </div>
            )}
            {selectedCards.length > 0 && (
              <p className="mb-3 text-xs text-[#78909C]">
                {selectedCards.length === 1
                  ? "Se descargará un PNG."
                  : "Se descargará un ZIP con un PNG independiente por cliente."}
              </p>
            )}
            {!selectedCard ? (
              <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-[#EFE7DE] text-sm text-[#78909C]">
                Selecciona un cliente para ver su tarjeta.
              </div>
            ) : (
              <LoyaltyCard card={selectedCard} />
            )}
          </div>
        </section>

        {/* Tarjetas de exportación renderizadas fuera del área visible. */}
        {selectedCards.length > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed left-[-12000px] top-0 z-[-1] w-[1080px]"
          >
            {selectedCards.map((card) => (
              <LoyaltyCard
                key={card.customer.id}
                card={card}
                elementId={`cuackback-export-${card.customer.id}`}
                onElement={(element) => {
                  exportCardRefs.current[card.customer.id] = element;
                }}
              />
            ))}
          </div>
        )}

        <div className="rounded-xl border border-[#EFE7DE] bg-white p-4 text-xs leading-5 text-[#78909C]">
          <p className="font-semibold text-[#0C304F]">
            Reglas activas de Cuackback
          </p>
          <p>
            Compra final ≥ $1,000 MXN = 1 sello. Al llegar a 6 sellos se crea
            una recompensa de 10% y el contador del ciclo vuelve a cero.
          </p>
          <p>
            Las recompensas pendientes se pueden acumular; el cliente puede
            seguir reuniendo sellos mientras conserva recompensas por canjear.
          </p>
          <p>
            El histórico aumenta únicamente cuando la recompensa se utiliza en
            una venta registrada.
          </p>
        </div>
      </div>
    </main>
  );
}

function LoyaltyCard({
  card,
  elementId,
  onElement,
}: {
  card: LoyaltyCardData;
  elementId?: string;
  onElement?: (element: HTMLElement | null) => void;
}) {
  return (
    <article
      id={elementId ?? "cuackback-card-preview"}
      ref={onElement}
      className="relative mx-auto w-full max-w-[900px] overflow-hidden border border-[#E3D1BD] bg-[#F8EBDD] p-5 text-[#282624] shadow-[0_18px_45px_rgba(89,65,38,0.14)] sm:p-7"
      style={{
        aspectRatio: "1.78 / 1",
        minHeight: 470,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 20% 20%, rgba(255,255,255,.85), transparent 45%), radial-gradient(ellipse at 90% 80%, rgba(185,137,91,.20), transparent 42%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.09]">
        <div className="rotate-[-20deg] text-center font-serif text-[94px] font-black tracking-[0.08em] text-[#8E745F]">
          PATOS DEALS
          <div className="text-[48px] tracking-[0.18em]">SHOPPERS</div>
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[38%] h-[46%] w-[36%] -translate-x-1/2 opacity-[0.11]">
        <img
          src="/logo-bg.svg"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
        />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-start justify-between gap-5">
          <div className="font-serif text-[clamp(48px,7vw,84px)] leading-[0.85] tracking-[-0.08em]">
            <span className="font-normal">Cuack</span>
            <span className="italic font-bold">Back</span>
          </div>
          <div className="max-w-[44%] pt-1 text-right text-[clamp(14px,2vw,24px)] font-medium uppercase leading-tight tracking-[-0.035em]">
            GANA 1 SELLO COMPRANDO +<div>$1,000 MXN EN UN SHOPPING DAY</div>
          </div>
        </header>

        <section className="mt-5 grid flex-1 grid-cols-4 items-center gap-x-3 gap-y-2 px-1 sm:mt-6 sm:gap-x-5">
          {card.stamps.map((stamp) => {
            const filled = stamp.stamp_number <= card.currentStamps;
            const ring = filled ? stamp.stamp_color : "#CFC5BA";
            return (
              <div
                key={stamp.stamp_number}
                className="flex min-w-0 flex-col items-center justify-center"
              >
                <div className="flex h-[clamp(72px,10vw,124px)] w-[clamp(72px,10vw,124px)] items-center justify-center rounded-full border-[4px] border-[#282624] bg-[#F8EBDD]/70 p-2">
                  <div
                    className="flex h-full w-full flex-col items-center justify-center rounded-full border-[3px] bg-transparent"
                    style={{ borderColor: ring, color: ring }}
                  >
                    <ShoppingCart size={34} strokeWidth={1.5} />
                    <span className="mt-1 max-w-full truncate px-1 text-[9px] font-black uppercase tracking-tight">
                      {filled ? stamp.period_code : "PATOS DEALS"}
                    </span>
                  </div>
                </div>
                <span
                  className="mt-1.5 text-[10px] font-semibold"
                  style={{ color: filled ? ring : "#9B8F84" }}
                >
                  {filled ? stamp.stamp_code : `SELLO ${stamp.stamp_number}`}
                </span>
              </div>
            );
          })}

          <div className="flex flex-col items-center justify-center">
            <div
              className={`flex h-[clamp(72px,10vw,124px)] w-[clamp(72px,10vw,124px)] flex-col items-center justify-center rounded-full border-[4px] border-[#282624] text-center ${card.rewardsPending > 0 ? "bg-[#FFF6E8]" : "bg-[#F8EBDD]/70 opacity-65"}`}
            >
              <span className="font-serif text-[clamp(18px,2.8vw,30px)] font-black leading-none">
                10%
              </span>
              <span className="mt-1 text-[clamp(10px,1.4vw,14px)] font-black">
                OFF
              </span>
            </div>
            <span className="mt-1.5 text-[10px] font-semibold text-[#8B6F58]">
              {card.rewardsPending > 0
                ? `${card.rewardsPending} POR REDIMIR`
                : "RECOMPENSA"}
            </span>
          </div>
        </section>

        <footer className="relative z-10 mt-4 border-b-[3px] border-[#282624] pb-2">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[clamp(18px,3vw,36px)] uppercase leading-none tracking-[-0.04em]">
            <span className="font-light">NOMBRE</span>
            <span className="font-black">{card.customer.full_name}</span>
          </div>
          {card.customer.phone && (
            <p className="mt-1 text-[10px] tracking-wide">
              {card.customer.phone}
            </p>
          )}
        </footer>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[9px] leading-tight text-[#5E5044]">
          <span>
            Canjeable por 10% OFF en una compra. Una recompensa por venta; no
            acumulable con otros descuentos.
          </span>
          <span>
            Sellos: {card.currentStamps}/6 · Histórico: {card.rewardsRedeemed}
          </span>
        </div>
      </div>
    </article>
  );
}
