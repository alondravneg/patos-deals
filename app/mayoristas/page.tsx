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

  // Cálculos
  const costoPatosMXN = precioNumero / MARGEN_VENTA;
  const costoUSD = costoPatosMXN / DOLAR_REAL / TAX;
  const costoTotalUSD = costoUSD * TAX;
  const costoTotalMXN =
    costoTotalUSD * DOLAR_MAYORISTA * MARGEN_VENTA_MAYORISTA;
  const sugerenciaVenta = costoTotalMXN * MARGEN_VENTA;

  return (
    <main className="min-h-screen bg-[#f8f5f1] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-2">
          <img
            src="/res/img/logo.png"
            alt="Patos Deals"
            className="h-20 object-contain"
          />
        </div>

        <p className="text-xl font-bold text-center mb-8">Calculadora Mayorista</p>

        {/* INPUT */}
        <div className="mb-8">
          <label className="text-sm text-gray-600">Precio en Patos</label>

          <input
            type="number"
            placeholder="Ingresa aquí el precio del grupo"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="text-sm w-full mt-1 rounded-xl border border-gray-200 p-3 outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* RESULTADOS */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex justify-between">
            <span className="text-gray-500">Costo USD (sin tax)</span>

            <span className="font-medium">${costoUSD.toFixed(2)} USD</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Costo total USD</span>

            <span className="font-medium">${costoTotalUSD.toFixed(2)} USD</span>
          </div>

          <div className="flex justify-between">
            <div>
              <p className="text-gray-500">Costo total MXN</p>
              <p className="text-xs text-gray-400">
                Costo total considerando <br /> dólar a $19 y margen de venta al
                20%
              </p>
            </div>
            <span className="font-medium">${costoTotalMXN.toFixed(2)} MXN</span>
          </div>

          <div className="flex justify-between items-start text-lg pt-2 border-t">
            <div>
              <p className="font-semibold">Sugerencia de venta</p>
              <p className="text-xs text-gray-400">
                Precio sugerido considerando <br /> margen de ganancia al 40%
              </p>
            </div>

            <span className="font-bold text-right">
              ${sugerenciaVenta.toFixed(2)} MXN
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
