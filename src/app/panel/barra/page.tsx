"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hora, minutosDesde, textoOpciones } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";
import { StockRapido } from "@/components/StockRapido";
import type { EstadoPedido, Pedido } from "@/lib/tipos";

const COLUMNAS: { estado: EstadoPedido; titulo: string; siguiente: EstadoPedido; accion: string }[] = [
  { estado: "nuevo", titulo: "Nuevos", siguiente: "preparando", accion: "Empezar" },
  { estado: "preparando", titulo: "Preparando", siguiente: "listo", accion: "Listo" },
  { estado: "listo", titulo: "Para entregar", siguiente: "entregado", accion: "Entregado" },
];

export default function Barra() {
  const { negocio } = usePanel();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ahora, setAhora] = useState(Date.now());
  const [verStock, setVerStock] = useState(false);
  const [sonido, setSonido] = useState(false);
  const conocidos = useRef<Set<string> | null>(null);

  const cargar = useCallback(async () => {
    const desde = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { data } = await supabase()
      .from("pedidos").select("*, items_pedido(*)")
      .in("estado", ["nuevo", "preparando", "listo"]).gte("creado_at", desde)
      .order("creado_at");
    const lista = (data ?? []) as Pedido[];
    // Aviso sonoro cuando entra un pedido nuevo.
    if (conocidos.current && sonido && lista.some((p) => !conocidos.current!.has(p.id))) beep();
    conocidos.current = new Set(lista.map((p) => p.id));
    setPedidos(lista);
  }, [sonido]);

  useEffect(() => {
    cargar();
    const canal = supabase()
      .channel(`barra-${negocio.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `negocio_id=eq.${negocio.id}` }, () => cargar())
      .subscribe();
    const respaldo = setInterval(cargar, 20000); // por si se corta el tiempo real
    const reloj = setInterval(() => setAhora(Date.now()), 30000);
    return () => { supabase().removeChannel(canal); clearInterval(respaldo); clearInterval(reloj); };
  }, [cargar, negocio.id]);

  async function avanzar(p: Pedido, estado: EstadoPedido) {
    setPedidos((l) => l.map((x) => (x.id === p.id ? { ...x, estado } : x)).filter((x) => x.estado !== "entregado" && x.estado !== "cancelado"));
    await supabase().from("pedidos").update({ estado }).eq("id", p.id);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-titulo text-2xl font-medium">Comandas</h1>
        <span className="text-sm text-suave">{pedidos.length} en curso</span>
        <div className="ml-auto flex gap-2">
          <button className="btn-secundario py-2 text-sm" onClick={() => setSonido(!sonido)} aria-pressed={sonido}>
            {sonido ? "🔔 Sonido activado" : "🔕 Activar sonido"}
          </button>
          <button className="btn-secundario py-2 text-sm" onClick={() => setVerStock(!verStock)}>
            {verStock ? "Volver a comandas" : "Sin stock"}
          </button>
        </div>
      </div>

      {verStock ? <StockRapido /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNAS.map((col) => {
            const lista = pedidos.filter((p) => p.estado === col.estado);
            return (
              <section key={col.estado} className="rounded-2xl bg-borde/40 p-3">
                <h2 className="mb-3 flex items-center justify-between px-1 font-semibold">
                  {col.titulo}<span className="rounded-full bg-papel px-2 text-sm">{lista.length}</span>
                </h2>
                <ul className="space-y-3">
                  {lista.map((p) => {
                    const espera = minutosDesde(p.creado_at, ahora);
                    const demora = col.estado !== "listo" && espera >= 10;
                    return (
                      <li key={p.id} className={`tarjeta p-3 ${demora ? "border-frutilla ring-2 ring-frutilla/30" : ""}`}>
                        <div className="flex items-baseline justify-between">
                          <p className="font-titulo text-2xl font-medium">Mesa {p.numero_mesa}</p>
                          <p className={`text-sm font-semibold ${demora ? "text-frutilla-osc" : "text-suave"}`}>
                            {espera} min · {hora(p.creado_at)}
                          </p>
                        </div>
                        {p.origen === "mozo" && <p className="text-xs font-semibold uppercase text-suave">cargado por el mozo</p>}
                        <ul className="mt-2 space-y-1.5">
                          {p.items_pedido?.map((it) => (
                            <li key={it.id} className="leading-snug">
                              <span className="font-semibold">{it.cantidad} × {it.nombre_producto}</span>
                              {it.opciones.length > 0 && <span className="block text-sm text-choco">{textoOpciones(it.opciones)}</span>}
                              {it.nota && <span className="block text-sm italic text-frutilla-osc">“{it.nota}”</span>}
                            </li>
                          ))}
                        </ul>
                        <button className="btn-primario mt-3 w-full py-2.5" onClick={() => avanzar(p, col.siguiente)}>{col.accion}</button>
                      </li>
                    );
                  })}
                  {lista.length === 0 && <li className="px-1 py-4 text-center text-sm text-suave">—</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
  } catch {}
}
