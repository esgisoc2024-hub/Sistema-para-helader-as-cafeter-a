"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { estiloMarca } from "@/lib/color";
import { Fondo } from "@/components/Fondo";
import { ETIQUETA_ESTADO, mensajeError, precio, textoOpciones } from "@/lib/formato";
import type { CartaPublica, EstadoMesaPublico, ProductoPublico } from "@/lib/tipos";
import { ElegirOpciones, Hoja, type OpcionCarrito } from "@/components/ElegirOpciones";

interface LineaCarrito { clave: string; producto: ProductoPublico; cantidad: number; opciones: OpcionCarrito[]; nota: string }
const precioLinea = (l: LineaCarrito) => Number(l.producto.precio) + l.opciones.reduce((s, o) => s + Number(o.extra), 0);

const PASOS = ["nuevo", "preparando", "listo", "entregado"] as const;

export default function CartaQR({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  // ?mozo=1: el mozo carga el pedido a mano desde el panel de mesas.
  const parametros = useSearchParams();
  const esMozo = parametros.get("mozo") === "1";
  // ?demo=1: carta de prueba de la página de inicio. Se puede pedir, pero nada llega a la base.
  const esDemo = parametros.get("demo") === "1";
  const [carta, setCarta] = useState<CartaPublica | null | undefined>(undefined);
  const [estado, setEstado] = useState<EstadoMesaPublico | null>(null);
  const [vista, setVista] = useState<"carta" | "pedido">("carta");
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [eligiendo, setEligiendo] = useState<ProductoPublico | null>(null);
  const [verCarrito, setVerCarrito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargarCarta = useCallback(async () => {
    const { data, error } = await supabase().rpc("carta_mesa", { p_codigo: codigo });
    setCarta(error ? null : (data as CartaPublica | null));
  }, [codigo]);

  const cargarEstado = useCallback(async () => {
    if (esDemo) return; // en la demo el estado vive solo en esta pantalla
    const { data } = await supabase().rpc("estado_mesa", { p_codigo: codigo });
    if (data) setEstado(data as EstadoMesaPublico);
  }, [codigo, esDemo]);

  useEffect(() => {
    cargarCarta();
    cargarEstado();
    const t = setInterval(cargarEstado, 5000);
    return () => clearInterval(t);
  }, [cargarCarta, cargarEstado]);

  // El carrito sobrevive a un refresco de la página.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(`carrito2-${codigo}`);
      if (guardado) setCarrito(JSON.parse(guardado));
    } catch {}
  }, [codigo]);
  useEffect(() => {
    try { localStorage.setItem(`carrito2-${codigo}`, JSON.stringify(carrito)); } catch {}
  }, [carrito, codigo]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const totalCarrito = carrito.reduce((s, l) => s + precioLinea(l) * l.cantidad, 0);
  const unidades = carrito.reduce((s, l) => s + l.cantidad, 0);

  function agregar(producto: ProductoPublico, opciones: OpcionCarrito[], nota: string) {
    const clave = `${producto.id}|${opciones.map((o) => o.id).sort().join(",")}|${nota}`;
    setCarrito((c) => {
      const existe = c.find((l) => l.clave === clave);
      if (existe) return c.map((l) => (l.clave === clave ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...c, { clave, producto, cantidad: 1, opciones, nota }];
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

  // Demo: arma el pedido en pantalla y lo hace avanzar solo (recibido → preparando → listo).
  function enviarDemo() {
    const id = crypto.randomUUID();
    const total = carrito.reduce((s, l) => s + precioLinea(l) * l.cantidad, 0);
    const pedido = {
      id, estado: "nuevo" as const, creado_at: new Date().toISOString(), total,
      items: carrito.map((l) => ({ nombre: l.producto.nombre, cantidad: l.cantidad, opciones: l.opciones })),
    };
    setEstado((e) => {
      const previos = e?.pedidos ?? [];
      return { mesa: carta?.mesa ?? 1, estado_mesa: "ocupada", llamado: false, pedidos: [...previos, pedido],
        total: [...previos, pedido].reduce((s, x) => s + Number(x.total), 0) };
    });
    const avanzar = (estado: "preparando" | "listo", ms: number) => setTimeout(() =>
      setEstado((e) => e && { ...e, pedidos: e.pedidos.map((x) => (x.id === id ? { ...x, estado } : x)) }), ms);
    avanzar("preparando", 3000);
    avanzar("listo", 8000);
    setCarrito([]);
    setVerCarrito(false);
    setVista("pedido");
    setAviso({ tipo: "ok", texto: "¡Pedido enviado a la barra!" });
  }

  async function enviar() {
    if (esDemo) return enviarDemo();
    setEnviando(true);
    const items = carrito.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad, opciones: l.opciones.map((o) => o.id), nota: l.nota }));
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
    if (esDemo) {
      setAviso({ tipo: "ok", texto: motivo === "cuenta" ? "En el local, al mozo le llega: “Mesa 1 pide la cuenta”" : "En el local, al mozo le llega: “Te llaman de la mesa 1”" });
      return;
    }
    const { error } = await supabase().rpc("llamar_desde_mesa", { p_codigo: codigo, p_motivo: motivo });
    setAviso(error
      ? { tipo: "error", texto: mensajeError(error) }
      : { tipo: "ok", texto: motivo === "cuenta" ? "Le avisamos al mozo que querés la cuenta" : "Ya avisamos al mozo" });
    cargarEstado();
  }

  if (carta === undefined) return <Centro>Cargando la carta…</Centro>;
  if (carta === null) return <Centro>Este QR no corresponde a una mesa activa. Avisale al personal.</Centro>;
  if (carta.suspendido) return <Centro>La carta de {carta.negocio} no está disponible por acá en este momento. Pedile al personal.</Centro>;

  const hayPedidos = (estado?.pedidos.length ?? 0) > 0;

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-32" style={estiloMarca(carta.color)}>
      {esMozo && (
        <div className="flex items-center justify-between bg-choco px-4 py-2 text-sm font-semibold text-white">
          <span>Cargando pedido como mozo</span>
          <Link href="/panel/mesas" className="underline">Volver a mesas</Link>
        </div>
      )}
      {esDemo && (
        <div className="flex items-center justify-between gap-3 bg-choco px-4 py-2 text-sm font-semibold text-white">
          <span>Carta de prueba: pedí lo que quieras, no se cobra nada.</span>
          <Link href="/" className="shrink-0 underline">Volver</Link>
        </div>
      )}
      <Fondo url={carta.portada_url} tipo={carta.portada_tipo} />
      <header className="flex items-center gap-3 px-4 pb-1 pt-6">
        {carta.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={carta.logo_url} alt="" className="h-14 w-14 shrink-0 -rotate-3 rounded-2xl bg-papel object-contain shadow-md" />
        )}
        <h1 className="min-w-0 flex-1 sobre-fondo font-titulo text-4xl leading-none">{carta.negocio}</h1>
        <span className="shrink-0 rotate-3 rounded-full bg-choco px-3 py-1.5 text-sm font-extrabold text-white">Mesa {carta.mesa}</span>
      </header>

      <div className="sticky top-0 z-10 px-4 pb-3 pt-3 backdrop-blur-md">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-papel/60 p-1 text-sm font-extrabold">
          {(["carta", "pedido"] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)}
              className={`rounded-full py-2 transition ${vista === v ? "bg-frutilla text-white shadow-sm" : "text-suave"}`}>
              {v === "carta" ? "Carta" : hayPedidos ? `Mi pedido (${estado!.pedidos.length})` : "Mi pedido"}
            </button>
          ))}
        </div>
        {vista === "carta" && (
          <nav aria-label="Categorías" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 text-sm">
            {carta.categorias.filter((c) => c.productos.length).map((c) => (
              <a key={c.id} href={`#cat-${c.id}`} className="shrink-0 rounded-full bg-papel/85 px-3.5 py-1.5 font-bold transition active:scale-90">{c.nombre}</a>
            ))}
          </nav>
        )}
      </div>

      {vista === "carta" ? (
        <div className="space-y-8 px-4 pt-4">
          {carta.categorias.filter((c) => c.productos.length).map((c) => (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32">
              <h2 className="sobre-fondo mb-4 font-titulo text-3xl">{c.nombre}</h2>
              <ul className="grid grid-cols-2 gap-3">
                {c.productos.map((p, i) => (
                  <li key={p.id} className={`animate-entrar ${p.foto_url ? "" : "col-span-2"}`} style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}>
                    <button onClick={() => (p.grupos.length > 0 ? setEligiendo(p) : agregar(p, [], ""))}
                      className={`tarjeta group relative w-full overflow-hidden text-left transition active:scale-[0.97] ${p.foto_url ? "flex h-full flex-col" : "flex items-center gap-3 p-4"}`}>
                      {p.foto_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.foto_url} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                      )}
                      <div className={p.foto_url ? "flex-1 p-3 pr-12" : "min-w-0 flex-1"}>
                        <p className="text-lg font-extrabold leading-snug">{p.nombre}</p>
                        {p.descripcion && <p className="text-sm text-suave">{p.descripcion}</p>}
                        <p className="mt-1 font-extrabold text-frutilla">{precio(p.precio)}</p>
                      </div>
                      <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-frutilla text-2xl font-extrabold text-white transition duration-300 group-active:rotate-180 group-active:scale-125 ${p.foto_url ? "absolute bottom-3 right-3" : ""}`}>+</span>
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
                  p.estado === "listo" ? "animate-latir bg-menta text-white" : p.estado === "entregado" ? "bg-borde" : "bg-limon/30"}`}>
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
                  <li key={j}>{it.cantidad} × {it.nombre}{it.opciones.length > 0 && <span className="text-suave"> ({textoOpciones(it.opciones)})</span>}</li>
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
        <div key={unidades} className="fixed inset-x-0 bottom-0 animate-rebote p-4">
          <button onClick={() => setVerCarrito(true)} className="btn-primario mx-auto flex w-full max-w-xl justify-between py-4 text-lg">
            <span>Ver pedido · {unidades}</span><span>{precio(totalCarrito)}</span>
          </button>
        </div>
      )}

      {eligiendo && (
        <ElegirOpciones producto={eligiendo} onCerrar={() => setEligiendo(null)} onAgregar={agregar} />
      )}

      {verCarrito && (
        <Hoja onCerrar={() => setVerCarrito(false)} titulo="Tu pedido">
          <ul className="divide-y divide-borde">
            {carrito.map((l) => (
              <li key={l.clave} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.producto.nombre}</p>
                  {l.opciones.length > 0 && <p className="text-sm text-suave">{textoOpciones(l.opciones)}</p>}
                  {l.nota && <p className="text-sm italic text-suave">“{l.nota}”</p>}
                  <p className="text-sm">{precio(precioLinea(l) * l.cantidad)}</p>
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
        <div role="status" className={`fixed inset-x-4 top-4 z-50 mx-auto max-w-md animate-bajar rounded-full px-4 py-3 text-center font-extrabold text-white shadow-lg ${
          aviso.tipo === "ok" ? "bg-menta" : "bg-frutilla-osc"}`}>{aviso.texto}</div>
      )}
    </main>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-dvh place-items-center p-8 text-center text-suave">{children}</main>;
}
