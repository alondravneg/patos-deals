"use client";

import { useState } from "react";

const TAX = 1.0825;
const MARGEN_VENTA = 1.4;

const formatoMXN = (valor: number) =>
  valor.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatoUSD = (valor: number) =>
  valor.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function Campo({
  label,
  value,
  onChange,
  placeholder = "0.00",
  suffix,
  required = false,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suffix?: string;
  required?: boolean;
  helper?: string;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-xs font-semibold text-[#0C304F] sm:text-sm">
        {label}
        {required && <span className="ml-1 text-[#CC6255]">*</span>}
      </label>

      <div className="relative">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full rounded-xl border border-[#EFE7DE] bg-[#FDF9F7] px-3 py-3 text-sm text-[#0C304F] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#36709E] focus:bg-white focus:ring-2 focus:ring-[#36709E]/10 sm:text-base ${
            suffix ? "pr-14" : ""
          }`}
        />

        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-[#737373]">
            {suffix}
          </span>
        )}
      </div>

      {helper && (
        <p className="mt-1.5 text-[11px] leading-4 text-[#737373] sm:text-xs">
          {helper}
        </p>
      )}
    </div>
  );
}

function Resultado({
  label,
  valor,
  descripcion,
}: {
  label: string;
  valor: string;
  descripcion?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dotted border-[#0C304F]/10 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#0C304F]">{label}</p>
        {descripcion && (
          <p className="mt-1 text-xs leading-4 text-[#78909C]">{descripcion}</p>
        )}
      </div>

      <p className="shrink-0 text-right text-sm font-bold tabular-nums text-[#0C304F] sm:text-base">
        {valor}
      </p>
    </div>
  );
}

export default function CalculadoraInterna() {
  const [dolar, setDolar] = useState("17.23");
  const [subtotal, setSubtotal] = useState("");
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState("");
  const [descuentoFijo, setDescuentoFijo] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");

  const subtotalNumero = Number(subtotal) || 0;
  const dolarNumero = Number(dolar) || 0;
  const porcentajeNumero = Number(descuentoPorcentaje) || 0;
  const descuentoFijoNumero = Number(descuentoFijo) || 0;
  const precioVentaNumero = Number(precioVenta) || 0;

  // El descuento porcentual o el fijo se aplican al subtotal en USD.
  const total =
    descuentoPorcentaje.trim() !== ""
      ? subtotalNumero * (1 - porcentajeNumero / 100)
      : descuentoFijo.trim() !== ""
        ? subtotalNumero - descuentoFijoNumero
        : subtotalNumero;

  // Conversión a MXN incluyendo el impuesto.
  const costoTotal = dolarNumero * total * TAX;

  // Precio recomendado de venta en MXN.
  const precioRecomendado = costoTotal * MARGEN_VENTA;

  // Análisis opcional del precio de venta manual.
  const ganancia = precioVentaNumero - costoTotal;

  const porcentajeGanancia =
    costoTotal > 0 && precioVenta.trim() !== ""
      ? (ganancia / costoTotal) * 100
      : null;

  const datosValidos =
    subtotal.trim() !== "" &&
    dolar.trim() !== "" &&
    subtotalNumero > 0 &&
    dolarNumero > 0 &&
    total >= 0 &&
    Number.isFinite(precioRecomendado);

  const descuentoValido =
    porcentajeNumero >= 0 &&
    porcentajeNumero <= 100 &&
    descuentoFijoNumero >= 0 &&
    (descuentoFijo.trim() === "" || descuentoFijoNumero <= subtotalNumero);

  const mostrarResultados = datosValidos && descuentoValido;

  const limpiar = () => {
    setSubtotal("");
    setDescuentoPorcentaje("");
    setDescuentoFijo("");
    setPrecioVenta("");
  };

  return (
    <main className="min-h-screen bg-[#FDF9F7] px-4 py-8 text-[#0C304F] sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        {/* Encabezado: misma composición que Mayoristas */}
        <header className="mb-7 text-center">
          <div className="mb-3 flex justify-center">
            <img
              src="/res/img/logo.png"
              alt="Patos Deals"
              className="h-16 w-auto object-contain sm:h-20"
            />
          </div>

          <span className="mb-2 inline-flex rounded-full bg-[#EFE7DE] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#36709E]">
            Uso interno
          </span>

          <h1 className="font-serif text-2xl font-bold text-[#0C304F] sm:text-3xl">
            Calculadora Pato&apos;s Deals
          </h1>

          <p className="mt-2 text-xs text-[#78909C] sm:text-sm">
            Calcula costos y precios sugeridos de venta.
          </p>
        </header>

        {/* Una sola tarjeta principal */}
        <section className="overflow-hidden rounded-[26px] bg-white shadow-[0_16px_45px_rgba(12,48,79,0.09)]">
          <div className="h-1.5 bg-gradient-to-r from-[#0C304F] via-[#36709E] to-[#E2732D]" />

          <div className="p-5 sm:p-7">
            {/* Datos del producto */}
            <section>
              <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-[#0C304F]">
                Datos del producto
              </h2>

              <div className="space-y-4">
                <Campo
                  label="Dólar (MXN por USD)"
                  value={dolar}
                  onChange={setDolar}
                  placeholder="17.23"
                  suffix="MXN"
                  required
                  helper="Tipo de cambio de referencia."
                />

                <Campo
                  label="Precio de etiqueta (USD)"
                  value={subtotal}
                  onChange={setSubtotal}
                  placeholder="Ingresa el subtotal"
                  suffix="USD"
                  required
                  helper="Precio original antes de descuentos."
                />
              </div>
            </section>

            {/* Descuentos adicionales */}
            <section className="mt-6 border-t border-dotted border-[#0C304F]/15 pt-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[#0C304F]">
                  Descuentos adicionales
                </h2>

                <span className="shrink-0 rounded-full bg-[#F8F0E8] px-2.5 py-1 text-[10px] font-semibold text-[#78909C]">
                  USD
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo
                  label="% Descuento"
                  value={descuentoPorcentaje}
                  onChange={(value) => {
                    setDescuentoPorcentaje(value);
                    if (value !== "") setDescuentoFijo("");
                  }}
                  placeholder="Ej. 10"
                  suffix="%"
                />

                <Campo
                  label="$ Descuento fijo"
                  value={descuentoFijo}
                  onChange={(value) => {
                    setDescuentoFijo(value);
                    if (value !== "") setDescuentoPorcentaje("");
                  }}
                  placeholder="Ej. 5"
                  suffix="USD"
                />
              </div>

              <p className="mt-3 text-[11px] leading-4 text-[#78909C]">
                Ingresa uno de los descuentos. Si no hay promociones, deja ambos
                campos vacíos.
              </p>
            </section>

            {/* Desglose de costos */}
            <section className="mt-6 border-t border-dotted border-[#0C304F]/15 pt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="font-serif text-sm font-bold uppercase tracking-[0.08em] text-[#0C304F]">
                  Desglose de costos
                </h2>

                <span className="rounded-full bg-[#F8F0E8] px-2.5 py-1 text-[10px] font-semibold text-[#78909C]">
                  USD · MXN
                </span>
              </div>

              <Resultado
                label="Total"
                valor={mostrarResultados ? formatoUSD(total) : "—"}
                descripcion="Precio después de descuentos."
              />

              <Resultado
                label="Costo total"
                valor={mostrarResultados ? formatoMXN(costoTotal) : "—"}
                descripcion={`Incluye impuesto del 8.25% y dólar a $${dolarNumero.toFixed(2)} MXN.`}
              />
            </section>

            {/* Único bloque destacado: precio recomendado */}
            <section className="relative mt-5 overflow-hidden rounded-2xl bg-[#0C304F] p-5 text-white sm:p-6">
              <div className="pointer-events-none absolute -right-7 -top-9 h-24 w-24 rounded-full border-[12px] border-white/[0.05]" />

              <div className="relative">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E2732D] text-sm font-bold text-white">
                    $
                  </span>

                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
                    Precio recomendado
                  </p>
                </div>

                <p className="text-xs text-white/75">Sugerencia de venta</p>

                <p className="mt-1 break-words text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                  {mostrarResultados ? formatoMXN(precioRecomendado) : "—"}
                </p>

                <div className="mt-4 border-t border-white/15 pt-3">
                  <p className="flex items-start gap-2 text-[10px] leading-4 text-white/70 sm:text-xs">
                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#E2732D]" />
                    Calculado con impuesto del 8.25% y un factor de venta de
                    1.40× sobre el costo total.
                  </p>
                </div>
              </div>
            </section>

            {/* Análisis opcional de venta: sin otra tarjeta */}
            <section className="mt-6 border-t border-dotted border-[#0C304F]/15 pt-5">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#0C304F]">
                Análisis de venta
              </h2>

              <Campo
                label="Si lo vendo en"
                value={precioVenta}
                onChange={setPrecioVenta}
                placeholder="Ingresa el precio de venta"
                suffix="MXN"
              />

              <div className="mt-3">
                <Resultado
                  label="Ganaría"
                  valor={
                    mostrarResultados && precioVenta.trim() !== ""
                      ? formatoMXN(ganancia)
                      : "—"
                  }
                  descripcion="Ganancia estimada en MXN."
                />

                <Resultado
                  label="% de ganancia"
                  valor={
                    mostrarResultados && porcentajeGanancia !== null
                      ? `${porcentajeGanancia.toFixed(2)}%`
                      : "—"
                  }
                  descripcion="Ganancia respecto al costo total."
                />
              </div>
            </section>

            {/* Acciones */}
            <button
              type="button"
              onClick={limpiar}
              className="mt-5 w-full rounded-xl border border-[#0C304F]/15 px-4 py-3 text-xs font-bold text-[#0C304F] transition hover:border-[#E2732D]/50 hover:bg-[#FDF9F7] active:scale-[0.99]"
            >
              Limpiar calculadora
            </button>

            <p className="mt-3 text-center text-[10px] text-[#78909C]">
              Los cálculos se actualizan automáticamente.
            </p>
          </div>
        </section>

        <footer className="mt-6 text-center">
          <p className="font-serif text-sm font-bold text-[#0C304F]">
            ¡A calcular!
          </p>
          <p className="mt-1 text-[10px] text-[#78909C]">
            Herramienta interna · Patos Deals
          </p>
        </footer>
      </div>
    </main>
  );
}
