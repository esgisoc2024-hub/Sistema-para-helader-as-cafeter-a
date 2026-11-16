"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { precio } from "@/lib/formato";

interface Reporte {
  ventas: number; por_medio: Record<string, number>; pedidos: number;
  espera_promedio_min: number | null; espera_max_min: number | null;
  productos: { nombre: string; unidades: number; importe: number }[];
  sabores: { sabor: string; veces: number }[];
}

const RANGOS = { hoy: "Hoy", ayer: "Ayer", semana: "Últimos 7 días", mes: "Últimos 30 días" } as const;
type Rango = keyof typeof RANGOS;

function limites(r: Rango): [Date, Date] {
  const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0);
  const dia = 86400000;
  if (r === "hoy") return [inicioHoy, new Date()];
  if (r === "ayer") return [new Date(inicioHoy.getTime() - dia), inicioHoy];
  return [new Date(inicioHoy.getTime() - (r === "semana" ? 6 : 29) * dia), new Date()];
}

export default function Reportes() {
  const [rango, setRango] = useState<Rango>("hoy");
  const [rep, setRep] = useState<Reporte | null>(null);

  const cargar = useCallback(async () => {
    const [desde, hasta] = limites(rango);
    const { data } = await supabase().rpc("reporte", { p_desde: desde.toISOString(), p_hasta: hasta.toISOString() });
    setRep(data as Reporte);
  }, [rango]);
  useEffect(() => { cargar(); }, [cargar]);

  const maxProd = Math.max(1, ...(rep?.productos.map((p) => Number(p.unidades)) ?? []));
  const maxSab = Math.max(1, ...(rep?.sabores.map((s) => Number(s.veces)) ?? []));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-titulo text-2xl font-bold">Reportes</h1>
        {(Object.keys(RANGOS) as Rango[]).map((r) => (
          <button key={r} onClick={() => setRango(r)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${rango === r ? "bg-choco text-white" : "border border-borde bg-papel"}`}>{RANGOS[r]}</button>
        ))}
      </div>

      {!rep ? <p className="text-suave">Cargando…</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Dato titulo="Cobrado" valor={precio(rep.ventas)} detalle={Object.entries(rep.por_medio).map(([m, v]) => `${m === "qr" ? "QR" : m}: ${precio(v)}`).join(" · ") || "—"} />
            <Dato titulo="Pedidos" valor={String(rep.pedidos)} />
            <Dato titulo="Espera promedio" valor={rep.espera_promedio_min != null ? `${rep.espera_promedio_min} min` : "—"} detalle="del pedido a “listo”" />
            <Dato titulo="Espera más larga" valor={rep.espera_max_min != null ? `${rep.espera_max_min} min` : "—"} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Ranking titulo="Productos más vendidos" filas={rep.productos.map((p) => ({ nombre: p.nombre, valor: Number(p.unidades), extra: precio(p.importe) }))} max={maxProd} />
            <Ranking titulo="Sabores más pedidos" filas={rep.sabores.map((s) => ({ nombre: s.sabor, valor: Number(s.veces) }))} max={maxSab}
              vacio="Todavía no hay sabores pedidos en este período." />
          </div>
        </>
      )}
    </div>
  );
}

function Dato({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-sm text-suave">{titulo}</p>
      <p className="mt-1 font-titulo text-2xl font-bold tabular-nums">{valor}</p>
      {detalle && <p className="mt-1 text-xs capitalize text-suave">{detalle}</p>}
    </div>
  );
}

function Ranking({ titulo, filas, max, vacio = "Sin ventas en este período." }: {
  titulo: string; filas: { nombre: string; valor: number; extra?: string }[]; max: number; vacio?: string;
}) {
  return (
    <section className="tarjeta p-5">
      <h2 className="mb-3 font-titulo text-lg font-bold">{titulo}</h2>
      {filas.length === 0 ? <p className="text-sm text-suave">{vacio}</p> : (
        <ol className="space-y-2.5">
          {filas.slice(0, 15).map((f) => (
            <li key={f.nombre}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-medium">{f.nombre}</span>
                <span className="tabular-nums text-suave">{f.valor}{f.extra && ` · ${f.extra}`}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-borde/60">
                <div className="h-2 rounded-full bg-frutilla" style={{ width: `${(f.valor / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
