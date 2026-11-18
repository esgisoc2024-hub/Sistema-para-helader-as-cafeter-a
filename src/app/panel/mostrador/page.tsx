"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio, textoOpciones } from "@/lib/formato";
import { ElegirOpciones, type OpcionCarrito } from "@/components/ElegirOpciones";
import type { CartaMostrador, MedioPago, ProductoPublico } from "@/lib/tipos";

/* Venta por mostrador / para llevar: se arma el pedido, se cobra y listo.
 * Si "Lo prepara la barra" está activo, el pedido entra a las comandas con su número de ticket del día;
 * si no (un cucurucho que se sirve en el momento), queda como entregado. En los dos casos entra a la caja y a los reportes. */

interface Linea { clave: string; producto: ProductoPublico; cantidad: number; opciones: OpcionCarrito[]; nota: string }
const precioLinea = (l: Linea) => Number(l.producto.precio) + l.opciones.reduce((s, o) => s + Number(o.extra), 0);
const MEDIOS: { id: MedioPago; texto: string }[] = [
  { id: "efectivo", texto: "Efectivo" }, { id: "qr", texto: "QR / MP" }, { id: "tarjeta", texto: "Tarjeta" },
];

export default function Mostrador() {
  const [carta, setCarta] = useState<CartaMostrador | null>(null);
  const [error, setError] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [eligiendo, setEligiendo] = useState<ProductoPublico | null>(null);
  const [medio, setMedio] = useState<MedioPago | null>(null);
  const [pagaCon, setPagaCon] = useState("");
  const [aBarra, setABarra] = useState(true);
  const [cobrando, setCobrando] = useState(false);
  const [listo, setListo] = useState<{ ticket: number; total: number; medio: MedioPago; aBarra: boolean; vuelto: number | null } | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase().rpc("carta_mostrador");
    if (error) return setError(mensajeError(error));
    const c = data as CartaMostrador;
    setCarta(c);
    setCategoria((actual) => actual ?? c.categorias.find((x) => x.productos.length)?.id ?? null);
  }, []);

  useEffect(() => {
    cargar();
    // La barra puede marcar algo "sin stock" mientras tanto: la carta se refresca sola.
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar]);

  // Recuerda si este mostrador suele mandar los pedidos a la barra.
  useEffect(() => {
    try { if (localStorage.getItem("mostrador-a-barra") === "no") setABarra(false); } catch {}
  }, []);
  function cambiarABarra(v: boolean) {
    setABarra(v);
    try { localStorage.setItem("mostrador-a-barra", v ? "si" : "no"); } catch {}
  }

  const total = lineas.reduce((s, l) => s + precioLinea(l) * l.cantidad, 0);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const montoPagaCon = Number(pagaCon.replace(/\D/g, "")) || 0;
  const vuelto = medio === "efectivo" && montoPagaCon > 0 ? montoPagaCon - total : null;

  function agregar(producto: ProductoPublico, opciones: OpcionCarrito[], nota: string) {
    const clave = `${producto.id}|${opciones.map((o) => o.id).sort().join(",")}|${nota}`;
    setLineas((ls) => {
      const existe = ls.find((l) => l.clave === clave);
      if (existe) return ls.map((l) => (l.clave === clave ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...ls, { clave, producto, cantidad: 1, opciones, nota }];
    });
    setEligiendo(null);
    setError("");
  }

  function cambiarCantidad(clave: string, delta: number) {
    setLineas((ls) => ls.flatMap((l) => {
      if (l.clave !== clave) return [l];
      const cantidad = l.cantidad + delta;
      return cantidad > 0 ? [{ ...l, cantidad }] : [];
    }));
  }

  function limpiar() {
    setLineas([]); setMedio(null); setPagaCon(""); setError("");
  }

  async function cobrar() {
    if (!medio || lineas.length === 0 || cobrando) return;
    setCobrando(true);
    setError("");
    const items = lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad, opciones: l.opciones.map((o) => o.id), nota: l.nota }));
    const { data, error } = await supabase().rpc("venta_mostrador", { p_items: items, p_medio: medio, p_a_barra: aBarra });
    setCobrando(false);
    if (error) {
      setError(mensajeError(error));
      cargar(); // puede haberse agotado algo
      return;
    }
    const r = data as { ticket: number; total: number };
    setListo({ ticket: r.ticket, total: Number(r.total), medio, aBarra, vuelto });
    limpiar();
  }

  if (!carta) {
    return <p className="tarjeta p-6 text-center text-suave">{error || "Cargando la carta…"}</p>;
  }

  const categorias = carta.categorias.filter((c) => c.productos.length);
  const productos = categorias.find((c) => c.id === categoria)?.productos ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="font-titulo text-2xl">Mostrador</h1>
        <span className="text-sm text-suave">Para llevar o para pedir y pagar en el mostrador</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Carta */}
        <section aria-label="Productos">
          <nav aria-label="Categorías" className="mb-3 flex flex-wrap gap-2">
            {categorias.map((c) => (
              <button key={c.id} onClick={() => setCategoria(c.id)} aria-pressed={categoria === c.id}
                className={`rounded-full border px-4 py-2 text-sm font-bold ${categoria === c.id ? "border-choco bg-choco text-white" : "border-borde bg-papel"}`}>
                {c.nombre}
              </button>
            ))}
          </nav>
          {categorias.length === 0 && <p className="tarjeta p-6 text-center text-suave">No hay productos disponibles. Cargalos en “Carta”.</p>}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {productos.map((p) => (
              <li key={p.id}>
                <button onClick={() => (p.grupos.length > 0 ? setEligiendo(p) : agregar(p, [], ""))}
                  className="tarjeta flex h-full min-h-24 w-full flex-col justify-between p-3 text-left transition active:scale-95">
                  <span className="font-extrabold leading-snug">{p.nombre}</span>
                  {p.descripcion && <span className="text-xs text-suave">{p.descripcion}</span>}
                  <span className="mt-1 font-extrabold text-frutilla">{precio(p.precio)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Ticket */}
        <aside aria-label="Venta actual" className="tarjeta flex flex-col p-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)]">
          <div className="flex items-center justify-between">
            <h2 className="font-titulo text-xl">Venta{unidades > 0 && ` · ${unidades}`}</h2>
            {lineas.length > 0 && <button className="text-sm text-suave underline" onClick={limpiar}>Vaciar</button>}
          </div>

          <ul className="mt-2 flex-1 divide-y divide-borde overflow-y-auto">
            {lineas.length === 0 && <li className="py-6 text-center text-sm text-suave">Tocá un producto para sumarlo.</li>}
            {lineas.map((l) => (
              <li key={l.clave} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{l.producto.nombre}</p>
                  {l.opciones.length > 0 && <p className="text-sm text-choco">{textoOpciones(l.opciones)}</p>}
                  {l.nota && <p className="text-sm italic text-suave">“{l.nota}”</p>}
                  <p className="text-sm">{precio(precioLinea(l) * l.cantidad)}</p>
                </div>
                <button aria-label="Quitar uno" className="h-9 w-9 rounded-full border border-borde" onClick={() => cambiarCantidad(l.clave, -1)}>−</button>
                <span className="w-5 text-center font-semibold">{l.cantidad}</span>
                <button aria-label="Agregar uno" className="h-9 w-9 rounded-full border border-borde" onClick={() => cambiarCantidad(l.clave, 1)}>+</button>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-borde pt-3">
            <div className="flex justify-between font-titulo text-2xl"><span>Total</span><span>{precio(total)}</span></div>

            <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-current" checked={aBarra} onChange={(e) => cambiarABarra(e.target.checked)} />
              Lo prepara la barra (se llama por número)
            </label>

            <p className="etiqueta mt-3">¿Cómo paga?</p>
            <div className="grid grid-cols-3 gap-2">
              {MEDIOS.map((m) => (
                <button key={m.id} onClick={() => setMedio(m.id)} aria-pressed={medio === m.id} disabled={lineas.length === 0}
                  className={`rounded-xl border px-2 py-3 text-sm font-bold disabled:opacity-40 ${medio === m.id ? "border-frutilla bg-rubor text-frutilla-osc" : "border-borde bg-papel"}`}>
                  {m.texto}
                </button>
              ))}
            </div>

            {medio === "efectivo" && (
              <div className="mt-3 flex items-center gap-3">
                <label htmlFor="paga-con" className="shrink-0 text-sm font-semibold">Paga con</label>
                <input id="paga-con" inputMode="numeric" className="campo py-2" placeholder="Opcional, para el vuelto"
                  value={pagaCon} onChange={(e) => setPagaCon(e.target.value)} />
              </div>
            )}
            {vuelto !== null && (
              <p className={`mt-2 text-sm font-bold ${vuelto < 0 ? "text-frutilla-osc" : "text-menta"}`}>
                {vuelto < 0 ? `Faltan ${precio(-vuelto)}` : `Vuelto: ${precio(vuelto)}`}
              </p>
            )}

            {error && <p role="alert" className="mt-2 text-sm text-frutilla-osc">{error}</p>}
            <button className="btn-primario mt-3 flex w-full justify-between py-4 text-lg"
              disabled={!medio || lineas.length === 0 || cobrando || (vuelto !== null && vuelto < 0)} onClick={cobrar}>
              <span>{cobrando ? "Cobrando…" : "Cobrar"}</span><span>{precio(total)}</span>
            </button>
          </div>
        </aside>
      </div>

      {eligiendo && <ElegirOpciones producto={eligiendo} onCerrar={() => setEligiendo(null)} onAgregar={agregar} />}

      {listo && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-tinta/40 p-4" onClick={() => setListo(null)}>
          <div role="dialog" aria-modal aria-label="Venta cobrada" onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm animate-entrar rounded-[32px] bg-crema p-6 text-center">
            <p className="text-sm font-semibold uppercase text-suave">Cobrado en {MEDIOS.find((m) => m.id === listo.medio)?.texto}</p>
            <p className="mt-1 font-titulo text-3xl">{precio(listo.total)}</p>
            {listo.vuelto !== null && listo.vuelto > 0 && <p className="mt-1 font-bold text-menta">Vuelto: {precio(listo.vuelto)}</p>}
            <p className="mt-4 text-sm text-suave">Número para el cliente</p>
            <p className="font-titulo text-7xl leading-none text-frutilla">{listo.ticket}</p>
            <p className="mt-3 text-sm text-suave">{listo.aBarra ? "La comanda ya está en la barra." : "Entregado en el momento."}</p>
            <button className="btn-primario mt-5 w-full" autoFocus onClick={() => setListo(null)}>Nueva venta</button>
          </div>
        </div>
      )}
    </div>
  );
}
