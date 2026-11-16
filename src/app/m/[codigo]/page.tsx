"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ETIQUETA_ESTADO, mensajeError, precio } from "@/lib/formato";
import type { CartaPublica, EstadoMesaPublico } from "@/lib/tipos";

type ProductoCarta = CartaPublica["categorias"][number]["productos"][number];
interface LineaCarrito { clave: string; producto: ProductoCarta; cantidad: number; sabores: string[]; nota: string }

const PASOS = ["nuevo", "preparando", "listo", "entregado"] as const;

export default function CartaQR({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  // ?mozo=1: el mozo carga el pedido a mano desde el panel de mesas.
  const esMozo = useSearchParams().get("mozo") === "1";
  const [carta, setCarta] = useState<CartaPublica | null | undefined>(undefined);
  const [estado, setEstado] = useState<EstadoMesaPublico | null>(null);
  const [vista, setVista] = useState<"carta" | "pedido">("carta");
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [eligiendo, setEligiendo] = useState<ProductoCarta | null>(null);
  const [verCarrito, setVerCarrito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargarCarta = useCallback(async () => {
    const { data, error } = await supabase().rpc("carta_mesa", { p_codigo: codigo });
    setCarta(error ? null : (data as CartaPublica | null));
  }, [codigo]);

  const cargarEstado = useCallback(async () => {
    const { data } = await supabase().rpc("estado_mesa", { p_codigo: codigo });
    if (data) setEstado(data as EstadoMesaPublico);
  }, [codigo]);

  useEffect(() => {
    cargarCarta();
    cargarEstado();
    const t = setInterval(cargarEstado, 5000);
    return () => clearInterval(t);
  }, [cargarCarta, cargarEstado]);

  // El carrito sobrevive a un refresco de la página.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(`carrito-${codigo}`);
      if (guardado) setCarrito(JSON.parse(guardado));
    } catch {}
  }, [codigo]);
  useEffect(() => {
    try { localStorage.setItem(`carrito-${codigo}`, JSON.stringify(carrito)); } catch {}
  }, [carrito, codigo]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const nombreSabor = useMemo(() => new Map(carta?.sabores.map((s) => [s.id, s.nombre]) ?? []), [carta]);
  const totalCarrito = carrito.reduce((s, l) => s + l.producto.precio * l.cantidad, 0);
  const unidades = carrito.reduce((s, l) => s + l.cantidad, 0);

  function agregar(producto: ProductoCarta, sabores: string[], nota: string) {
    const clave = `${producto.id}|${[...sabores].sort().join(",")}|${nota}`;
    setCarrito((c) => {
      const existe = c.find((l) => l.clave === clave);
      if (existe) return c.map((l) => (l.clave === clave ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...c, { clave, producto, cantidad: 1, sabores, nota }];
    });
    setEligiendo(null);
    setAviso({ tipo: "ok", texto: `${producto.nombre} agregado` });
  }

  function cambiarCantidad(clave: string, delta: number) {
    setCarrito((c) => c.flatMap((l) => {
      if (l.clave !== clave) return [l];
      const cantidad = l.cantidad + delta;
      return cantidad > 0 ? [{ ...l, cantidad }] : [];
    }));
  }

  async function enviar() {
    setEnviando(true);
    const items = carrito.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad, sabores: l.sabores, nota: l.nota }));
    const { error } = await supabase().rpc("crear_pedido", { p_codigo: codigo, p_items: items, p_origen: esMozo ? "mozo" : "qr" });
    setEnviando(false);
    if (error) {
      setAviso({ tipo: "error", texto: mensajeError(error) });
      cargarCarta(); // puede haber cambiado el stock
      return;
    }
    setCarrito([]);
    setVerCarrito(false);
    if (esMozo) { window.location.href = "/panel/mesas"; return; }
    setVista("pedido");
    cargarEstado();
  }

  async function llamar(motivo: "mozo" | "cuenta") {
    const { error } = await supabase().rpc("llamar_desde_mesa", { p_codigo: codigo, p_motivo: motivo });
    setAviso(error
      ? { tipo: "error", texto: mensajeError(error) }
      : { tipo: "ok", texto: motivo === "cuenta" ? "Le avisamos al mozo que querés la cuenta" : "Ya avisamos al mozo" });
    cargarEstado();
  }

  if (carta === undefined) return <Centro>Cargando la carta…</Centro>;
  if (carta === null) return <Centro>Este QR no corresponde a una mesa activa. Avisale al personal.</Centro>;

  const hayPedidos = (estado?.pedidos.length ?? 0) > 0;

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-32">
      {esMozo && (
        <div className="flex items-center justify-between bg-choco px-4 py-2 text-sm font-semibold text-white">
          <span>Cargando pedido como mozo</span>
          <Link href="/panel/mesas" className="underline">Volver a mesas</Link>
        </div>
      )}
      <header className="sticky top-0 z-10 border-b border-borde bg-crema/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <h1 className="font-titulo text-2xl font-bold">{carta.negocio}</h1>
          <span className="rounded-full bg-choco px-3 py-1 text-sm font-semibold text-white">Mesa {carta.mesa}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-borde/60 p-1 text-sm font-semibold">
          {(["carta", "pedido"] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)}
              className={`rounded-full py-2 ${vista === v ? "bg-papel shadow-sm" : "text-suave"}`}>
              {v === "carta" ? "Carta" : `Mi pedido${hayPedidos ? ` · ${estado!.pedidos.length}` : ""}`}
            </button>
          ))}
        </div>
        {vista === "carta" && (
          <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 text-sm">
            {carta.categorias.filter((c) => c.productos.length).map((c) => (
              <a key={c.id} href={`#cat-${c.id}`} className="shrink-0 rounded-full border border-borde bg-papel px-3 py-1.5">{c.nombre}</a>
            ))}
          </nav>
        )}
      </header>

      {vista === "carta" ? (
        <div className="space-y-8 px-4 pt-4">
          {carta.categorias.filter((c) => c.productos.length).map((c) => (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-40">
              <h2 className="mb-3 font-titulo text-xl font-bold">{c.nombre}</h2>
              <ul className="space-y-3">
                {c.productos.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => (p.max_sabores > 0 ? setEligiendo(p) : agregar(p, [], ""))}
                      className="tarjeta flex w-full items-center gap-3 p-3 text-left active:bg-crema">
                      {p.foto_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.foto_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{p.nombre}</p>
                        {p.descripcion && <p className="text-sm text-suave">{p.descripcion}</p>}
                        <p className="mt-1 font-semibold text-frutilla">{precio(p.precio)}</p>
                      </div>
                      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-frutilla text-xl text-white">+</span>
                      <span className="sr-only">Agregar</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-4 px-4 pt-4">
          {!hayPedidos && <p className="tarjeta p-6 text-center text-suave">Todavía no hiciste ningún pedido.</p>}
          {estado?.pedidos.map((p, i) => (
            <article key={p.id} className="tarjeta p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Pedido {i + 1}</p>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  p.estado === "listo" ? "bg-menta text-white" : p.estado === "entregado" ? "bg-borde" : "bg-limon/30"}`}>
                  {ETIQUETA_ESTADO[p.estado]}
                </span>
              </div>
              {p.estado !== "cancelado" && (
                <div className="mt-3 flex gap-1" aria-hidden>
                  {PASOS.map((paso) => (
                    <div key={paso} className={`h-1.5 flex-1 rounded-full ${
                      PASOS.indexOf(paso) <= PASOS.indexOf(p.estado as (typeof PASOS)[number]) ? "bg-menta" : "bg-borde"}`} />
                  ))}
                </div>
              )}
              <ul className="mt-3 space-y-1 text-sm">
                {p.items.map((it, j) => (
                  <li key={j}>{it.cantidad} × {it.nombre}{it.sabores.length > 0 && <span className="text-suave"> ({it.sabores.join(", ")})</span>}</li>
                ))}
              </ul>
            </article>
          ))}
          {hayPedidos && (
            <div className="tarjeta flex items-center justify-between p-4 font-semibold">
              <span>Total de la mesa</span><span>{precio(estado!.total)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-secundario" onClick={() => llamar("mozo")}>Llamar al mozo</button>
            <button className="btn-secundario" onClick={() => llamar("cuenta")} disabled={!hayPedidos || estado?.estado_mesa === "pide_cuenta"}>
              {estado?.estado_mesa === "pide_cuenta" ? "Cuenta pedida" : "Pedir la cuenta"}
            </button>
          </div>
        </div>
      )}

      {unidades > 0 && !verCarrito && (
        <div className="fixed inset-x-0 bottom-0 p-4">
          <button onClick={() => setVerCarrito(true)} className="btn-primario mx-auto flex w-full max-w-xl justify-between shadow-lg">
            <span>Ver pedido · {unidades}</span><span>{precio(totalCarrito)}</span>
          </button>
        </div>
      )}

      {eligiendo && (
        <ElegirSabores producto={eligiendo} sabores={carta.sabores} onCerrar={() => setEligiendo(null)} onAgregar={agregar} />
      )}

      {verCarrito && (
        <Hoja onCerrar={() => setVerCarrito(false)} titulo="Tu pedido">
          <ul className="divide-y divide-borde">
            {carrito.map((l) => (
              <li key={l.clave} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.producto.nombre}</p>
                  {l.sabores.length > 0 && <p className="text-sm text-suave">{l.sabores.map((s) => nombreSabor.get(s) ?? "—").join(", ")}</p>}
                  {l.nota && <p className="text-sm italic text-suave">“{l.nota}”</p>}
                  <p className="text-sm">{precio(l.producto.precio * l.cantidad)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button aria-label="Quitar uno" className="h-9 w-9 rounded-full border border-borde" onClick={() => cambiarCantidad(l.clave, -1)}>−</button>
                  <span className="w-5 text-center font-semibold">{l.cantidad}</span>
                  <button aria-label="Agregar uno" className="h-9 w-9 rounded-full border border-borde" onClick={() => cambiarCantidad(l.clave, 1)}>+</button>
                </div>
              </li>
            ))}
          </ul>
          <button disabled={enviando || !carrito.length} onClick={enviar} className="btn-primario mt-4 flex w-full justify-between">
            <span>{enviando ? "Enviando…" : "Confirmar pedido"}</span><span>{precio(totalCarrito)}</span>
          </button>
          <p className="mt-2 text-center text-xs text-suave">Pagás al final, cuando pidas la cuenta.</p>
        </Hoja>
      )}

      {aviso && (
        <div role="status" className={`fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-xl px-4 py-3 text-center font-medium text-white shadow-lg ${
          aviso.tipo === "ok" ? "bg-menta" : "bg-frutilla-osc"}`}>{aviso.texto}</div>
      )}
    </main>
  );
}

function ElegirSabores({ producto, sabores, onCerrar, onAgregar }: {
  producto: ProductoCarta; sabores: CartaPublica["sabores"];
  onCerrar: () => void; onAgregar: (p: ProductoCarta, sabores: string[], nota: string) => void;
}) {
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [nota, setNota] = useState("");
  const lleno = elegidos.length >= producto.max_sabores;

  function alternar(id: string) {
    setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : lleno ? e : [...e, id]));
  }

  return (
    <Hoja onCerrar={onCerrar} titulo={producto.nombre}>
      <p className="mb-3 text-sm text-suave">Elegí hasta {producto.max_sabores} sabor{producto.max_sabores > 1 ? "es" : ""} · {elegidos.length} elegido{elegidos.length === 1 ? "" : "s"}</p>
      <div className="grid grid-cols-2 gap-2">
        {sabores.map((s) => {
          const activo = elegidos.includes(s.id);
          return (
            <button key={s.id} onClick={() => alternar(s.id)} aria-pressed={activo}
              disabled={!activo && lleno}
              className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition disabled:opacity-40 ${
                activo ? "border-frutilla bg-frutilla/10 text-frutilla-osc" : "border-borde bg-papel"}`}>
              {s.nombre}
            </button>
          );
        })}
      </div>
      {sabores.length === 0 && <p className="text-sm text-suave">No hay sabores disponibles en este momento.</p>}
      <label className="etiqueta mt-4" htmlFor="nota">Aclaración (opcional)</label>
      <input id="nota" className="campo" maxLength={120} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: sin cucurucho bañado" />
      <button className="btn-primario mt-4 w-full" disabled={elegidos.length === 0} onClick={() => onAgregar(producto, elegidos, nota.trim())}>
        Agregar · {precio(producto.precio)}
      </button>
    </Hoja>
  );
}

function Hoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-tinta/40" onClick={onCerrar}>
      <div role="dialog" aria-modal aria-label={titulo} onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-crema p-5 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-titulo text-xl font-bold">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="h-9 w-9 rounded-full border border-borde bg-papel">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-dvh place-items-center p-8 text-center text-suave">{children}</main>;
}
