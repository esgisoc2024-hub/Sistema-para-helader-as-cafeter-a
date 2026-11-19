"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ETIQUETA_ESTADO, hora, mensajeError, minutosDesde, precio, textoOpciones } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";
import type { MedioPago, Mesa, Pedido } from "@/lib/tipos";

const ESTILO_MESA = {
  libre: "border-borde bg-papel text-suave",
  ocupada: "border-limon bg-limon/20",
  pide_cuenta: "border-frutilla bg-frutilla/15",
} as const;

export default function Mesas() {
  const { negocio } = usePanel();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [elegida, setElegida] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [m, c] = await Promise.all([
      sb.from("mesas").select("*").eq("activa", true).order("numero"),
      sb.from("cuentas").select("id").is("cerrada_at", null),
    ]);
    setMesas(m.data ?? []);
    const cuentas = (c.data ?? []).map((x) => x.id);
    if (cuentas.length === 0) return setPedidos([]);
    const p = await sb.from("pedidos").select("*, items_pedido(*)").in("cuenta_id", cuentas).order("creado_at");
    setPedidos((p.data ?? []) as Pedido[]);
  }, []);

  useEffect(() => {
    cargar();
    const sb = supabase();
    const canal = sb.channel(`mesas-${negocio.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mesas", filter: `negocio_id=eq.${negocio.id}` }, () => cargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `negocio_id=eq.${negocio.id}` }, () => cargar())
      .subscribe();
    const respaldo = setInterval(cargar, 20000);
    return () => { sb.removeChannel(canal); clearInterval(respaldo); };
  }, [cargar, negocio.id]);

  const totalMesa = (id: string) => pedidos.filter((p) => p.mesa_id === id && p.estado !== "cancelado").reduce((s, p) => s + Number(p.total), 0);
  const mesa = mesas.find((m) => m.id === elegida) ?? null;
  const llamando = mesas.filter((m) => m.llamado_at);
  const ocupadas = mesas.filter((m) => m.estado !== "libre").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="font-titulo text-2xl">Mesas</h1>
        <span className="text-sm text-suave">{ocupadas} ocupadas de {mesas.length}</span>
      </div>

      {llamando.length > 0 && (
        <div role="alert" className="mb-4 rounded-2xl bg-frutilla px-4 py-3 font-semibold text-white">
          Te llaman: {llamando.map((m) => `Mesa ${m.numero}${m.estado === "pide_cuenta" ? " (cuenta)" : ""}`).join(" · ")}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {mesas.map((m) => (
          <button key={m.id} onClick={() => setElegida(m.id)}
            className={`relative aspect-square rounded-2xl border-2 p-3 text-left transition active:scale-95 ${ESTILO_MESA[m.estado]} ${elegida === m.id ? "ring-4 ring-choco/30" : ""}`}>
            <span className="font-titulo text-3xl text-tinta">{m.numero}</span>
            <span className="absolute bottom-3 left-3 right-3 text-sm font-semibold">
              {m.estado === "libre" ? "Libre" : precio(totalMesa(m.id))}
              {m.estado === "pide_cuenta" && <span className="block text-xs text-frutilla-osc">Pide la cuenta</span>}
            </span>
            {m.llamado_at && <span className="absolute right-2 top-2 h-3 w-3 animate-ping rounded-full bg-frutilla" aria-label="Llamando" />}
          </button>
        ))}
      </div>
      {mesas.length === 0 && <p className="tarjeta p-6 text-center text-suave">No hay mesas. El dueño las crea en “Local y QR”.</p>}

      {mesa && (
        <DetalleMesa mesa={mesa} pedidos={pedidos.filter((p) => p.mesa_id === mesa.id)} total={totalMesa(mesa.id)}
          onCerrar={() => setElegida(null)} onCambio={cargar} />
      )}
    </div>
  );
}

function DetalleMesa({ mesa, pedidos, total, onCerrar, onCambio }: {
  mesa: Mesa; pedidos: Pedido[]; total: number; onCerrar: () => void; onCambio: () => void;
}) {
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState("");

  async function atendido() {
    await supabase().from("mesas").update({ llamado_at: null }).eq("id", mesa.id);
    onCambio();
  }

  // Las mesas se cobran en el momento: el fiado se sacó porque hoy los locales no fían.
  async function cobrar(medio: MedioPago) {
    setError("");
    const { error } = await supabase().rpc("cerrar_mesa", {
      p_mesa: mesa.id, p_medio: medio, p_deudor: null, p_nuevo_deudor: null,
    });
    if (error) return setError(mensajeError(error));
    setCobrando(false);
    onCambio();
    onCerrar();
  }

  async function cancelar(p: Pedido) {
    if (!confirm(`¿Cancelar el pedido de las ${hora(p.creado_at)}? No se cobra.`)) return;
    await supabase().from("pedidos").update({ estado: "cancelado" }).eq("id", p.id);
    onCambio();
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-tinta/30" onClick={onCerrar}>
      <aside role="dialog" aria-label={`Mesa ${mesa.numero}`} onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-crema p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-titulo text-3xl">Mesa {mesa.numero}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="h-10 w-10 rounded-full border border-borde bg-papel">✕</button>
        </div>

        {mesa.llamado_at && (
          <button className="btn-primario mt-4 w-full" onClick={atendido}>
            Ya atendí el llamado ({minutosDesde(mesa.llamado_at)} min)
          </button>
        )}

        <div className="mt-4 flex-1 space-y-3">
          {pedidos.length === 0 && <p className="tarjeta p-5 text-center text-suave">Mesa sin pedidos.</p>}
          {pedidos.map((p) => (
            <article key={p.id} className={`tarjeta p-4 ${p.estado === "cancelado" ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-suave">{hora(p.creado_at)}{p.origen === "mozo" ? " · mozo" : " · QR"}</span>
                <span className="font-semibold">{ETIQUETA_ESTADO[p.estado]}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {p.items_pedido?.map((it) => (
                  <li key={it.id} className="flex justify-between gap-3">
                    <span>{it.cantidad} × {it.nombre_producto}{it.opciones.length > 0 && <span className="text-sm text-suave"> ({textoOpciones(it.opciones)})</span>}</span>
                    <span className="shrink-0">{precio(it.cantidad * it.precio_unitario)}</span>
                  </li>
                ))}
              </ul>
              {p.estado !== "cancelado" && p.estado !== "entregado" && (
                <button className="mt-2 text-sm text-frutilla-osc underline" onClick={() => cancelar(p)}>Cancelar pedido</button>
              )}
            </article>
          ))}
        </div>

        <div className="sticky bottom-0 -mx-5 mt-4 border-t border-borde bg-crema px-5 pt-4">
          <div className="flex justify-between font-titulo text-2xl"><span>Total</span><span>{precio(total)}</span></div>
          {error && <p role="alert" className="mt-2 text-sm text-frutilla-osc">{error}</p>}
          {cobrando ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["efectivo", "qr", "tarjeta"] as const).map((m) => (
                <button key={m} className="btn-primario px-2 capitalize" onClick={() => cobrar(m)}>{m === "qr" ? "QR / MP" : m}</button>
              ))}
              <button className="col-span-3 text-sm text-suave underline" onClick={() => setCobrando(false)}>Volver</button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href={`/m/${mesa.codigo}?mozo=1`} className="btn-secundario">Cargar pedido</Link>
              <button className="btn-primario" disabled={mesa.estado === "libre"} onClick={() => setCobrando(true)}>
                Cobrar y cerrar
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
