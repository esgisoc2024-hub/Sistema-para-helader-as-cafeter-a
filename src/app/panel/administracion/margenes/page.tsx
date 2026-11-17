"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";

interface Fila {
  id: string; nombre: string; precio: number; disponible: boolean; categoria: string;
  costo: number | null; costo_actualizado: string | null; margen: number | null; margen_pct: number | null;
  unidades: number; vendido: number; ganancia: number | null;
  ultimo_cambio_precio: string | null; precio_anterior: number | null;
}

const diasDesde = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);

export default function Margenes() {
  const { negocio } = usePanel();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [minimo, setMinimo] = useState(50);
  const [soloBajos, setSoloBajos] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase().rpc("margenes", { p_dias: 30 });
    if (error) return setError(mensajeError(error));
    const d = data as { margen_minimo: number; productos: Fila[] };
    setMinimo(d.margen_minimo);
    setFilas(d.productos);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardarCosto(f: Fila, valor: string) {
    if (valor === "" || Number(valor) === Number(f.costo)) return;
    setError("");
    const { error } = await supabase().from("producto_costos").upsert({
      producto_id: f.id, negocio_id: negocio.id, costo: Number(valor), updated_at: new Date().toISOString(),
    });
    if (error) return setError(mensajeError(error));
    setGuardado(f.id); cargar();
  }
  async function guardarPrecio(f: Fila, valor: string) {
    if (valor === "" || Number(valor) === Number(f.precio)) return;
    if (!confirm(`¿Cambiar el precio de “${f.nombre}” de ${precio(f.precio)} a ${precio(Number(valor))}? Los clientes lo ven en la carta al instante.`)) return cargar();
    const { error } = await supabase().from("productos").update({ precio: Number(valor) }).eq("id", f.id);
    if (error) return setError(mensajeError(error));
    setGuardado(f.id); cargar();
  }
  async function guardarMinimo(valor: number) {
    setMinimo(valor);
    await supabase().from("negocios").update({ margen_minimo: valor }).eq("id", negocio.id);
  }

  if (!filas) return <p className="text-suave">{error || "Cargando…"}</p>;

  const conCosto = filas.filter((f) => f.costo !== null);
  const bajos = conCosto.filter((f) => Number(f.margen_pct) < minimo);
  const ganancia = conCosto.reduce((s, f) => s + Number(f.ganancia ?? 0), 0);
  const visibles = soloBajos ? bajos : filas;
  const categorias = [...new Set(visibles.map((f) => f.categoria))];

  return (
    <div>
      <h1 className="sobre-fondo font-titulo text-3xl">Precios y márgenes</h1>
      <p className="mt-1 text-suave">Cargá cuánto te cuesta hacer cada producto y mirá cuánto te deja. Solo vos ves los costos.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[24px] bg-choco p-4 text-white">
          <p className="text-sm text-white/80">Ganancia de los últimos 30 días</p>
          <p className="font-titulo text-2xl tabular-nums">{precio(ganancia)}</p>
          <p className="text-xs text-white/80">ventas menos costo, en los {conCosto.length} productos con costo cargado</p>
        </div>
        <button onClick={() => setSoloBajos(!soloBajos)} aria-pressed={soloBajos}
          className={`rounded-[24px] p-4 text-left transition ${bajos.length ? "bg-frutilla text-white" : "tarjeta"} ${soloBajos ? "ring-4 ring-tinta/20" : ""}`}>
          <p className={`text-sm ${bajos.length ? "text-white/85" : "text-suave"}`}>Dejan menos del {minimo}%</p>
          <p className="font-titulo text-2xl">{bajos.length} {bajos.length === 1 ? "producto" : "productos"}</p>
          <p className={`text-xs ${bajos.length ? "text-white/85" : "text-suave"}`}>{soloBajos ? "Tocá para ver todos" : "Tocá para ver solo esos"}</p>
        </button>
        <label className="tarjeta block p-4">
          <span className="text-sm text-suave">Margen mínimo que querés</span>
          <span className="mt-1 flex items-center gap-2">
            <input type="range" min={10} max={90} step={5} value={minimo} className="w-full accent-frutilla"
              onChange={(e) => setMinimo(Number(e.target.value))} onMouseUp={(e) => guardarMinimo(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => guardarMinimo(Number((e.target as HTMLInputElement).value))} onKeyUp={(e) => guardarMinimo(Number((e.target as HTMLInputElement).value))} />
            <span className="font-titulo text-2xl">{minimo}%</span>
          </span>
        </label>
      </div>
      {filas.length - conCosto.length > 0 && (
        <p className="mt-3 text-sm font-bold text-frutilla-osc">Te falta cargar el costo de {filas.length - conCosto.length} {filas.length - conCosto.length === 1 ? "producto" : "productos"}.</p>
      )}
      {error && <p role="alert" className="mt-3 rounded-2xl bg-rubor p-3 text-sm text-frutilla-osc">{error}</p>}

      {categorias.map((cat) => (
        <section key={cat} className="mt-6">
          <h2 className="sobre-fondo font-titulo text-2xl">{cat}</h2>
          <div className="tarjeta mt-2 overflow-x-auto">
            <table className="w-full min-w-[680px] table-fixed text-sm">
              <colgroup><col /><col className="w-28" /><col className="w-28" /><col className="w-36" /><col className="w-32" /><col className="w-40" /></colgroup>
              <thead>
                <tr className="text-left text-xs text-suave">
                  <th className="px-4 py-2 font-bold">Producto</th>
                  <th className="px-2 py-2 text-right font-bold">Precio</th>
                  <th className="px-2 py-2 text-right font-bold">Costo</th>
                  <th className="px-2 py-2 text-right font-bold">Te deja</th>
                  <th className="px-2 py-2 text-right font-bold">Vendidos (30 días)</th>
                  <th className="px-4 py-2 text-right font-bold">Ganancia (30 días)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {visibles.filter((f) => f.categoria === cat).map((f) => {
                  const bajo = f.margen_pct !== null && Number(f.margen_pct) < minimo;
                  return (
                    <tr key={f.id} className={guardado === f.id ? "animate-entrar" : ""}>
                      <td className="px-4 py-2.5">
                        <span className="font-extrabold">{f.nombre}</span>
                        <span className="block text-xs text-suave">
                          {f.ultimo_cambio_precio
                            ? `Antes ${precio(f.precio_anterior ?? 0)} · cambió ${diasDesde(f.ultimo_cambio_precio) === 0 ? "hoy" : `hace ${diasDesde(f.ultimo_cambio_precio)} días`}`
                            : "Sin cambios de precio registrados"}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <label className="sr-only" htmlFor={`p-${f.id}`}>Precio de {f.nombre}</label>
                        <input id={`p-${f.id}`} type="number" min={0} step="1" inputMode="numeric" defaultValue={Number(f.precio)} key={`p${f.precio}`}
                          className="w-24 rounded-xl border border-borde bg-papel px-2 py-1.5 text-right font-extrabold"
                          onBlur={(e) => guardarPrecio(f, e.target.value)} />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <label className="sr-only" htmlFor={`c-${f.id}`}>Costo de {f.nombre}</label>
                        <input id={`c-${f.id}`} type="number" min={0} step="1" inputMode="numeric" defaultValue={f.costo ?? ""} key={`c${f.costo}`}
                          placeholder="Cargar" className={`w-24 rounded-xl border px-2 py-1.5 text-right font-extrabold ${f.costo === null ? "border-frutilla/50 bg-rubor/50" : "border-borde bg-papel"}`}
                          onBlur={(e) => guardarCosto(f, e.target.value)} />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {f.margen_pct === null ? <span className="text-suave">—</span> : (
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-extrabold ${bajo ? "bg-frutilla text-white" : "bg-menta text-white"}`}>
                            {precio(f.margen ?? 0)} · {Number(f.margen_pct)}%
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{f.unidades}</td>
                      <td className="px-4 py-2.5 text-right font-extrabold tabular-nums">{f.ganancia === null ? <span className="text-suave">—</span> : precio(f.ganancia)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="mt-4 text-xs text-suave">
        Para cambiar un precio o un costo, escribí el nuevo valor y tocá afuera del recuadro. El costo es lo que te sale hacer una unidad
        (insumos, vasito, cucharita). Los extras con precio, como la leche de almendras, no se descuentan del costo.
      </p>
    </div>
  );
}
