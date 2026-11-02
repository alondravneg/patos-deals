"use client";

import { useState } from "react";
import {
  DOLAR_MAYORISTA,
  DOLAR_REAL,
  MARGEN_VENTA,
  MARGEN_VENTA_MAYORISTA,
  TAX,
} from "../lib/constants";

export default function Home() {
  const [precio, setPrecio] = useState("");

  const precioNumero = Number(precio) || 0;

  // Cálculos originales
  const costoPatosMXN = precioNumero / MARGEN_VENTA;
  const costoUSD = costoPatosMXN / DOLAR_REAL / TAX;
  const costoTotalUSD = costoUSD * TAX;
  const costoTotalMXN =
    costoTotalUSD * DOLAR_MAYORISTA * MARGEN_VENTA_MAYORISTA;
  const sugerenciaVenta = costoTotalMXN * MARGEN_VENTA;

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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FDF9F7] px-4 py-8 text-[#0C304F] sm:px-6 sm:py-12">
      {/* Elementos decorativos */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#F3E7D8]/70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#CC6255]/10 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-xl">
        {/* Encabezado */}
        <header className="mb-6 text-center sm:mb-10">
          <div className="mb-5 flex justify-center">
            <img
              src="/res/img/patos-deals.svg"
              alt="Patos Deals"
              className="h-20 w-auto object-contain sm:h-28"
            />
          </div>

          <span className="inline-flex items-center rounded-full border border-[#0C304F]/10 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#36709E]">
            Herramienta para distribuidores
          </span>

          <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-[#0C304F] sm:text-4xl">
            Calculadora mayorista
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#133842]/75 sm:text-base">
            Calcula tus costos y consulta el precio de venta sugerido para tus
            productos.
          </p>
        </header>

        {/* Calculadora */}
        <section className="overflow-hidden rounded-[2rem] border border-[#0C304F]/10 bg-white shadow-[0_18px_60px_rgba(12,48,79,0.09)]">
          {/* Franja de marca */}
          <div className="h-2 bg-gradient-to-r from-[#0C304F] via-[#36709E] to-[#E2732D]" />

          <div className="p-6 sm:p-9">
            <div className="mb-6">
              <label
                htmlFor="precio"
                className="mb-2 block text-sm font-bold text-[#0C304F]"
              >
                Precio en Patos (MXN)
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-semibold text-[#36709E]">
                  $
                </span>

                <input
                  id="precio"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  enterKeyHint="done"
                  placeholder="Ingresa el precio del grupo"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  className="w-full rounded-2xl border border-[#0C304F]/15 bg-[#FDF9F7] py-4 pl-9 pr-4 text-base font-medium text-[#0C304F] outline-none transition placeholder:font-normal placeholder:text-[#0C304F]/40 focus:border-[#E2732D] focus:bg-white focus:ring-4 focus:ring-[#E2732D]/15"
                />
              </div>

              <p className="mt-2 text-xs leading-5 text-[#133842]/60">
                Introduce el precio del grupo para consultar los costos
                calculados.
              </p>
            </div>

            {/* Resultados */}
            <div className="border-t border-dashed border-[#0C304F]/15 pt-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#0C304F]">
                  Desglose de costos
                </h2>

                <span className="rounded-full bg-[#F3E7D8]/70 px-3 py-1 text-xs font-semibold text-[#0C304F]/70">
                  USD · MXN
                </span>
              </div>

              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#0C304F]">
                      Costo USD
                    </p>
                    <p className="mt-1 text-xs text-[#133842]/60">
                      Sin impuestos
                    </p>
                  </div>

                  <p className="text-right text-base font-semibold tabular-nums text-[#0C304F]">
                    {formatoUSD(costoUSD)}
                  </p>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#0C304F]">
                      Costo total USD
                    </p>
                    <p className="mt-1 text-xs text-[#133842]/60">
                      Incluye impuestos
                    </p>
                  </div>

                  <p className="text-right text-base font-semibold tabular-nums text-[#0C304F]">
                    {formatoUSD(costoTotalUSD)}
                  </p>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0C304F]">
                      Costo total MXN
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#133842]/60">
                      Dólar a ${DOLAR_MAYORISTA.toFixed(2)} y margen mayorista
                      del {((MARGEN_VENTA_MAYORISTA - 1) * 100).toFixed(0)}%
                    </p>
                  </div>

                  <p className="min-w-0 max-w-[48%] break-words text-right text-sm font-semibold tabular-nums text-[#0C304F] sm:text-base">
                    {formatoMXN(costoTotalMXN)}
                  </p>
                </div>
              </div>
            </div>

            {/* Precio sugerido */}
            <div className="relative mt-7 overflow-hidden rounded-2xl bg-[#0C304F] p-5 text-white sm:p-6">
              <div
                aria-hidden="true"
                className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-white/5"
              />

              <div className="relative">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E2732D] text-lg font-bold text-white">
                    $
                  </span>

                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-white/75">
                    Precio recomendado
                  </span>
                </div>

                <p className="text-sm font-medium text-white/80">
                  Sugerencia de venta
                </p>

                <p className="mt-1 break-words text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                  {formatoMXN(sugerenciaVenta)}
                </p>

                <div className="mt-4 flex items-center gap-2 border-t border-white/15 pt-4">
                  <span className="h-2 w-2 rounded-full bg-[#E2732D]" />
                  <p className="text-xs leading-5 text-white/75">
                    Calculado con un factor de venta de{" "}
                    {MARGEN_VENTA.toFixed(2)}× sobre el costo total mayorista.
                  </p>
                </div>
              </div>
            </div>

            {/* Restablecer */}
            {precio !== "" && (
              <button
                type="button"
                onClick={() => setPrecio("")}
                className="mt-5 w-full rounded-xl border border-[#0C304F]/15 px-4 py-3 text-sm font-semibold text-[#0C304F] transition hover:border-[#E2732D]/50 hover:bg-[#FDF9F7]"
              >
                Limpiar calculadora
              </button>
            )}
          </div>
        </section>

        {/* Pie de página */}
        <footer className="mt-7 text-center">
          <p className="font-serif text-lg font-bold text-[#0C304F]">
            ¡Gracias por comprar en Patos Deals!
          </p>

          <p className="mt-1 text-xs text-[#133842]/55">
            Herramienta de consulta para distribuidores · Patos Deals
          </p>
        </footer>
      </div>
    </main>
  );
}
