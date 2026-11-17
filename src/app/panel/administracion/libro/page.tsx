"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hora, mensajeError, precio } from "@/lib/formato";

interface Asiento { fecha: string; tipo: "ingreso" | "egreso"; categoria: string; concepto: string; monto: number; medio: string; origen: string }
interface Dia { dia: string; ingresos: number | null; egresos: number | null; asientos: Asiento[] }
interface Libro { ingresos: number; egresos: number; dias: Dia[] }

const MEDIOS: Record<string, string> = { efectivo: "Efectivo", qr: "QR / MP", tarjeta: "Tarjeta", transferencia: "Transferencia" };

// Fecha local (Argentina) en formato AAAA-MM-DD.
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const RANGOS = {
  hoy: { t: "Hoy", d: () => [iso(new Date()), iso(new Date())] },
  semana: { t: "Últimos 7 días", d: () => [iso(new Date(Date.now() - 6 * 864e5)), iso(new Date())] },
  mes: { t: "Este mes", d: () => { const h = new Date(); return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(h)]; } },
  anterior: { t: "Mes pasado", d: () => { const h = new Date(); return [iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), iso(new Date(h.getFullYear(), h.getMonth(), 0))]; } },
} as const;
type Rango = keyof typeof RANGOS;

const diaLargo = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

export default function LibroDiario() {
  const [rango, setRango] = useState<Rango | "otro">("semana");
  const [desde, setDesde] = useState(RANGOS.semana.d()[0]);
  const [hasta, setHasta] = useState(RANGOS.semana.d()[1]);
  const [libro, setLibro] = useState<Libro | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const { data, error } = await supabase().rpc("libro_diario", { p_desde: desde, p_hasta: hasta });
    if (error) return setError(mensajeError(error));
    setError("");
    setLibro(data as Libro);
  }, [desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  function elegir(r: Rango) {
    const [d, h] = RANGOS[r].d();
    setRango(r); setDesde(d); setHasta(h);
  }

  const saldo = libro ? Number(libro.ingresos) - Number(libro.egresos) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="sobre-fondo mr-auto font-titulo text-3xl">Libro diario</h1>
        {(Object.keys(RANGOS) as Rango[]).map((r) => (
          <button key={r} onClick={() => elegir(r)} aria-pressed={rango === r}
            className={`rounded-full px-3 py-1.5 text-sm font-extrabold ${rango === r ? "bg-choco text-white" : "bg-papel/85"}`}>{RANGOS[r].t}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col"><span className="etiqueta">Desde</span>
          <input type="date" className="campo py-2" value={desde} max={hasta} onChange={(e) => { setRango("otro"); setDesde(e.target.value); }} /></label>
        <label className="flex flex-col"><span className="etiqueta">Hasta</span>
          <input type="date" className="campo py-2" value={hasta} min={desde} onChange={(e) => { setRango("otro"); setHasta(e.target.value); }} /></label>
      </div>

      {error && <p role="alert" className="mt-3 rounded-2xl bg-rubor p-3 text-sm text-frutilla-osc">{error}</p>}
      {!libro ? <p className="mt-4 text-suave">Cargando…</p> : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Total titulo="Entró" valor={libro.ingresos} clase="text-menta" />
            <Total titulo="Salió" valor={libro.egresos} clase="text-frutilla-osc" />
            <Total titulo="Saldo" valor={saldo} clase={saldo >= 0 ? "text-tinta" : "text-frutilla-osc"} />
          </div>

          {libro.dias.length === 0 && <p className="tarjeta mt-4 p-6 text-center text-suave">No hubo movimientos en estas fechas.</p>}
          <ul className="mt-4 space-y-3">
            {libro.dias.map((d) => {
              const ing = Number(d.ingresos ?? 0), egr = Number(d.egresos ?? 0);
              const ver = abierto === d.dia;
              return (
                <li key={d.dia} className="tarjeta overflow-hidden">
                  <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left" aria-expanded={ver}
                    onClick={() => setAbierto(ver ? null : d.dia)}>
                    <span className="mr-auto font-extrabold first-letter:uppercase">{diaLargo(d.dia)}</span>
                    <span className="text-sm text-menta">+{precio(ing)}</span>
                    <span className="text-sm text-frutilla-osc">−{precio(egr)}</span>
                    <span className="w-28 text-right font-extrabold tabular-nums">{precio(ing - egr)}</span>
                    <span aria-hidden className={`transition ${ver ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  {ver && (
                    <table className="w-full animate-entrar text-sm">
                      <thead className="sr-only"><tr><th>Hora</th><th>Concepto</th><th>Medio</th><th>Monto</th></tr></thead>
                      <tbody className="divide-y divide-borde border-t border-borde">
                        {d.asientos.map((a, i) => (
                          <tr key={i}>
                            <td className="w-24 whitespace-nowrap py-2 pl-4 text-suave">{hora(a.fecha)}</td>
                            <td className="py-2">
                              <span className="font-bold">{a.concepto}</span>
                              <span className="text-suave"> · {a.categoria}</span>
                            </td>
                            <td className="hidden py-2 text-suave sm:table-cell">{MEDIOS[a.medio] ?? a.medio}</td>
                            <td className={`py-2 pr-4 text-right font-extrabold tabular-nums ${a.tipo === "egreso" ? "text-frutilla-osc" : "text-menta"}`}>
                              {a.tipo === "egreso" ? "−" : "+"}{precio(a.monto)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Total({ titulo, valor, clase }: { titulo: string; valor: number; clase: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-sm text-suave">{titulo}</p>
      <p className={`font-titulo text-2xl tabular-nums ${clase}`}>{precio(valor)}</p>
    </div>
  );
}
