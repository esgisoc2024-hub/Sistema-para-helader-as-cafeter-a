"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";
import { cuandoVence, fechaCorta, hoyISO, type ItemProveedor, type Proveedor } from "@/lib/administracion";

export default function Proveedores() {
  const [lista, setLista] = useState<Proveedor[] | null>(null);
  const [abierto, setAbierto] = useState<Proveedor | "nuevo" | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const { data, error } = await supabase().rpc("resumen_proveedores");
    if (error) setError(mensajeError(error));
    const l = (data ?? []) as Proveedor[];
    setLista(l);
    setAbierto((a) => (a && a !== "nuevo" ? l.find((p) => p.id === a.id) ?? null : a));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (!lista) return <p className="text-suave">Cargando…</p>;
  const b = busqueda.trim().toLowerCase();
  // Busca por proveedor o por lo que vende ("¿quién me vende la crema?").
  const visibles = lista.filter((p) => !b || p.nombre.toLowerCase().includes(b) || p.items.some((i) => i.nombre.toLowerCase().includes(b)));
  const deudaTotal = lista.reduce((s, p) => s + Math.max(0, Number(p.deuda)), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="sobre-fondo mr-auto font-titulo text-3xl">Proveedores</h1>
        <button className="btn-primario" onClick={() => setAbierto("nuevo")}>+ Nuevo proveedor</button>
      </div>
      {deudaTotal > 0 && (
        <p className="mt-2 text-sm font-bold">
          Les debés en total <span className="text-frutilla-osc">{precio(deudaTotal)}</span> · <Link href="/panel/administracion/pagar" className="underline">ver cuentas por pagar</Link>
        </p>
      )}
      <input className="campo mt-3" placeholder="Buscar proveedor o producto (ej: crema)" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      {error && <p role="alert" className="mt-3 rounded-2xl bg-rubor p-3 text-sm text-frutilla-osc">{error}</p>}

      {lista.length === 0 && (
        <p className="tarjeta mt-4 p-6 text-center text-suave">Cargá a quién le comprás: lácteos, frutas, descartables, café… y qué te vende cada uno.</p>
      )}
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {visibles.map((p, i) => (
          <li key={p.id} className="animate-entrar" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
            <button onClick={() => setAbierto(p)} className={`tarjeta w-full p-4 text-left transition active:scale-[0.98] ${p.activo ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-extrabold">{p.nombre}</p>
                  <p className="truncate text-sm text-suave">
                    {p.plazo_dias ? `Paga a ${p.plazo_dias} días` : "Pago al contado"}{p.contacto && ` · ${p.contacto}`}
                  </p>
                </div>
                {Number(p.deuda) > 0
                  ? <span className="shrink-0 rounded-full bg-frutilla px-3 py-1 text-xs font-extrabold text-white">Le debés {precio(p.deuda)}</span>
                  : <span className="shrink-0 rounded-full bg-menta px-3 py-1 text-xs font-extrabold text-white">Al día</span>}
              </div>
              {p.items.length > 0 && (
                <p className="mt-2 truncate text-sm">{p.items.map((it) => `${it.nombre} ${precio(it.costo)}`).join(" · ")}</p>
              )}
              <p className="mt-2 text-sm text-suave">
                Último pedido: {p.ultima_compra ? fechaCorta(p.ultima_compra) : "—"} · Último pago: {p.ultimo_pago ? fechaCorta(p.ultimo_pago) : "—"}
              </p>
              {p.proximo_vencimiento && (
                <p className={`text-sm font-bold ${p.proximo_vencimiento < hoyISO() ? "text-frutilla-osc" : "text-tinta"}`}>
                  Próximo pago: {cuandoVence(p.proximo_vencimiento)}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>

      {abierto && (
        <Ficha proveedor={abierto === "nuevo" ? null : abierto} onCerrar={() => setAbierto(null)}
          onCambio={cargar} onCreado={() => { setAbierto(null); cargar(); }} />
      )}
    </div>
  );
}

function Ficha({ proveedor, onCerrar, onCambio, onCreado }: {
  proveedor: Proveedor | null; onCerrar: () => void; onCambio: () => void; onCreado: () => void;
}) {
  const { negocio } = usePanel();
  const [nombre, setNombre] = useState(proveedor?.nombre ?? "");
  const [contacto, setContacto] = useState(proveedor?.contacto ?? "");
  const [plazo, setPlazo] = useState(String(proveedor?.plazo_dias ?? 0));
  const [notas, setNotas] = useState(proveedor?.notas ?? "");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault(); setError(""); setAviso("");
    const datos = { nombre: nombre.trim(), contacto: contacto.trim() || null, plazo_dias: Number(plazo || 0), notas: notas.trim() || null };
    const sb = supabase().from("proveedores");
    const { error } = proveedor ? await sb.update(datos).eq("id", proveedor.id) : await sb.insert({ ...datos, negocio_id: negocio.id });
    if (error) return setError(mensajeError(error));
    if (proveedor) { setAviso("Datos guardados."); onCambio(); } else onCreado();
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-tinta/40" onClick={onCerrar}>
      <aside role="dialog" aria-label={proveedor?.nombre ?? "Nuevo proveedor"} onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-lg animate-entrar overflow-y-auto bg-crema p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-titulo text-3xl">{proveedor?.nombre ?? "Nuevo proveedor"}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="h-10 w-10 rounded-full border border-borde bg-papel">✕</button>
        </div>

        {proveedor && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Dato t="Le debés" v={precio(Math.max(0, Number(proveedor.deuda)))} alerta={Number(proveedor.deuda) > 0} />
            <Dato t="Próximo pago" v={proveedor.proximo_vencimiento ? cuandoVence(proveedor.proximo_vencimiento) : "—"} />
            <Dato t="Último pedido" v={proveedor.ultima_compra ? fechaCorta(proveedor.ultima_compra) : "—"} />
            <Dato t="Último pago" v={proveedor.ultimo_pago ? fechaCorta(proveedor.ultimo_pago) : "—"} />
          </div>
        )}

        {proveedor && <RegistrarCompra proveedor={proveedor} onGuardada={(t) => { setAviso(t); onCambio(); }} onError={setError} />}
        {proveedor && <Items proveedor={proveedor} onCambio={onCambio} onError={setError} />}

        <form onSubmit={guardarDatos} className="mt-5 space-y-3">
          <h3 className="font-extrabold">Datos</h3>
          <label className="flex flex-col"><span className="etiqueta">Nombre</span>
            <input required maxLength={80} className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Lácteos del Oeste" /></label>
          <label className="flex flex-col"><span className="etiqueta">WhatsApp, teléfono o email</span>
            <input className="campo" value={contacto} onChange={(e) => setContacto(e.target.value)} /></label>
          <label className="flex flex-col"><span className="etiqueta">Plazo de pago (días)</span>
            <input type="number" min={0} max={180} inputMode="numeric" className="campo" value={plazo} onChange={(e) => setPlazo(e.target.value)} />
            <span className="mt-1 text-xs text-suave">0 = se paga al recibir. Las compras vencen solas según este plazo.</span></label>
          <label className="flex flex-col"><span className="etiqueta">Notas</span>
            <textarea rows={2} className="campo" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: reparte martes y viernes" /></label>
          {error && <p role="alert" className="text-sm text-frutilla-osc">{error}</p>}
          {aviso && <p role="status" className="text-sm font-bold text-menta">{aviso}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primario">{proveedor ? "Guardar datos" : "Crear proveedor"}</button>
            {proveedor && (
              <button type="button" className="btn-secundario" onClick={async () => {
                await supabase().from("proveedores").update({ activo: !proveedor.activo }).eq("id", proveedor.id);
                onCambio();
              }}>{proveedor.activo ? "Ya no le compro" : "Volver a activar"}</button>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
}

function RegistrarCompra({ proveedor, onGuardada, onError }: { proveedor: Proveedor; onGuardada: (t: string) => void; onError: (e: string) => void }) {
  const { negocio } = usePanel();
  const [abierta, setAbierta] = useState(false);
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [fecha, setFecha] = useState(hoyISO());

  if (!abierta) return <button className="btn-primario mt-4 w-full" onClick={() => setAbierta(true)}>Registrar un pedido / compra</button>;
  return (
    <form className="tarjeta mt-4 p-4" onSubmit={async (e) => {
      e.preventDefault(); onError("");
      const { error } = await supabase().from("gastos").insert({
        negocio_id: negocio.id, categoria: "proveedores", concepto: detalle.trim() || "Pedido", monto: Number(monto), fecha, proveedor_id: proveedor.id,
      });
      if (error) return onError(mensajeError(error));
      setAbierta(false); setMonto(""); setDetalle("");
      onGuardada(proveedor.plazo_dias ? `Compra registrada: vence a los ${proveedor.plazo_dias} días.` : "Compra registrada en cuentas por pagar.");
    }}>
      <h3 className="font-extrabold">Nueva compra</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col"><span className="etiqueta">Total de la factura ($)</span>
          <input required type="number" min={1} step="1" inputMode="numeric" className="campo" value={monto} onChange={(e) => setMonto(e.target.value)} /></label>
        <label className="flex flex-col"><span className="etiqueta">Fecha</span>
          <input type="date" className="campo" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <label className="flex flex-col sm:col-span-2"><span className="etiqueta">Qué trajo (opcional)</span>
          <input className="campo" maxLength={110} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej: 20 L de leche, 10 kg de azúcar" /></label>
      </div>
      <p className="mt-2 text-xs text-suave">Queda en cuentas por pagar{proveedor.plazo_dias ? `, con vencimiento a ${proveedor.plazo_dias} días` : ""}. Si la pagás en el momento, pagala desde ahí.</p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-secundario py-2" onClick={() => setAbierta(false)}>Cancelar</button>
        <button className="btn-primario py-2">Guardar compra</button>
      </div>
    </form>
  );
}

function Items({ proveedor, onCambio, onError }: { proveedor: Proveedor; onCambio: () => void; onError: (e: string) => void }) {
  const { negocio } = usePanel();
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState("");
  const [costo, setCosto] = useState("");

  async function actualizarCosto(it: ItemProveedor, valor: string) {
    if (valor === "" || Number(valor) === Number(it.costo)) return;
    const { error } = await supabase().from("proveedor_items").update({ costo: Number(valor), updated_at: new Date().toISOString() }).eq("id", it.id);
    if (error) onError(mensajeError(error)); else onCambio();
  }

  return (
    <section className="mt-5">
      <h3 className="font-extrabold">Qué le comprás y a qué costo</h3>
      <ul className="mt-2 divide-y divide-borde rounded-[20px] bg-papel/80 px-3">
        {proveedor.items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <b>{it.nombre}</b>{it.unidad && <span className="text-suave"> · por {it.unidad}</span>}
              <span className="block text-xs text-suave">Costo actualizado el {fechaCorta(it.updated_at)}</span>
            </span>
            <label className="sr-only" htmlFor={`costo-${it.id}`}>Costo de {it.nombre}</label>
            <input id={`costo-${it.id}`} type="number" min={0} step="1" inputMode="numeric" defaultValue={Number(it.costo)}
              className="w-28 rounded-xl border border-borde bg-papel px-2 py-1.5 text-right font-extrabold"
              onBlur={(e) => actualizarCosto(it, e.target.value)} />
            <button aria-label={`Quitar ${it.nombre}`} className="text-suave" onClick={async () => {
              await supabase().from("proveedor_items").delete().eq("id", it.id); onCambio();
            }}>✕</button>
          </li>
        ))}
        {proveedor.items.length === 0 && <li className="py-3 text-sm text-suave">Todavía no cargaste productos de este proveedor.</li>}
      </ul>
      <form className="mt-2 flex flex-wrap gap-2" onSubmit={async (e) => {
        e.preventDefault(); onError("");
        const { error } = await supabase().from("proveedor_items").insert({
          negocio_id: negocio.id, proveedor_id: proveedor.id, nombre: nombre.trim(), unidad: unidad.trim() || null, costo: Number(costo || 0),
        });
        if (error) return onError(mensajeError(error));
        setNombre(""); setUnidad(""); setCosto(""); onCambio();
      }}>
        <input required aria-label="Producto" className="campo min-w-36 flex-1 py-2 text-sm" placeholder="Producto (ej: Crema)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input aria-label="Unidad" className="campo w-24 py-2 text-sm" placeholder="Unidad" value={unidad} onChange={(e) => setUnidad(e.target.value)} />
        <input aria-label="Costo" type="number" min={0} inputMode="numeric" className="campo w-28 py-2 text-sm" placeholder="Costo $" value={costo} onChange={(e) => setCosto(e.target.value)} />
        <button className="btn-secundario px-4 py-2 text-sm">Agregar</button>
      </form>
      <p className="mt-1 text-xs text-suave">Para cambiar un costo, escribí el nuevo valor y tocá afuera del recuadro.</p>
    </section>
  );
}

function Dato({ t, v, alerta }: { t: string; v: string; alerta?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${alerta ? "bg-frutilla text-white" : "bg-papel/85"}`}>
      <p className={`text-xs ${alerta ? "text-white/85" : "text-suave"}`}>{t}</p>
      <p className="font-extrabold">{v}</p>
    </div>
  );
}
