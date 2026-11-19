"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";
import { MEDIOS_PAGO, fechaCorta, hoyISO, type Deudor } from "@/lib/administracion";

const FILTROS = { deben: "Me deben", todos: "Todos los clientes" } as const;
type Filtro = keyof typeof FILTROS;

export default function CuentasPorCobrar() {
  const [lista, setLista] = useState<Deudor[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("deben");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<string | "nuevo" | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const { data, error } = await supabase().rpc("cuentas_por_cobrar");
    if (error) setError(mensajeError(error));
    setLista((data ?? []) as Deudor[]);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (!lista) return <p className="text-suave">Cargando…</p>;

  const deben = lista.filter((d) => Number(d.saldo) > 0);
  const total = deben.reduce((s, d) => s + Number(d.saldo), 0);
  const b = busqueda.trim().toLowerCase();
  const visibles = (filtro === "deben" ? deben : lista).filter((d) => !b || d.nombre.toLowerCase().includes(b));
  const elegido = abierto && abierto !== "nuevo" ? lista.find((d) => d.id === abierto) ?? null : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="sobre-fondo mr-auto font-titulo text-3xl">Cuentas por cobrar</h1>
        <button className="btn-primario" onClick={() => setAbierto("nuevo")}>+ Anotar una deuda</button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className={`rounded-[24px] p-4 ${total > 0 ? "bg-choco text-white" : "tarjeta"}`}>
          <p className={`text-sm ${total > 0 ? "text-white/80" : "text-suave"}`}>Te deben en total</p>
          <p className="font-titulo text-3xl tabular-nums">{precio(total)}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-sm text-suave">Clientes con deuda</p>
          <p className="font-titulo text-3xl tabular-nums">{deben.length}</p>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 rounded-2xl bg-rubor p-3 text-sm text-frutilla-osc">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(Object.keys(FILTROS) as Filtro[]).map((f) => (
          <button key={f} onClick={() => setFiltro(f)} aria-pressed={filtro === f}
            className={`rounded-full px-4 py-2 text-sm font-extrabold ${filtro === f ? "bg-choco text-white" : "bg-papel/85"}`}>{FILTROS[f]}</button>
        ))}
        <input className="campo ml-auto max-w-xs py-2" placeholder="Buscar cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {visibles.length === 0 && (
        <p className="tarjeta mt-4 p-6 text-center text-suave">
          {filtro === "deben" && !b ? "Nadie te debe plata. 🎉 Las deudas que anotes aparecen acá." : "No hay clientes en esta vista."}
        </p>
      )}
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {visibles.map((d, i) => (
          <li key={d.id} className="animate-entrar" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
            <button onClick={() => setAbierto(d.id)} className="tarjeta w-full p-4 text-left transition active:scale-[0.98]">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-extrabold">{d.nombre}</p>
                  <p className="truncate text-sm text-suave">{d.contacto ?? "Sin contacto"}</p>
                </div>
                {Number(d.saldo) > 0
                  ? <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold text-white ${d.vencido ? "bg-frutilla" : "bg-choco"}`}>Debe {precio(d.saldo)}</span>
                  : <span className="shrink-0 rounded-full bg-menta px-3 py-1 text-xs font-extrabold text-white">Al día</span>}
              </div>
              <p className="mt-2 text-sm text-suave">
                Última deuda: {d.ultima_deuda ? fechaCorta(d.ultima_deuda) : "—"} · Último pago: {d.ultimo_cobro ? fechaCorta(d.ultimo_cobro) : "—"}
              </p>
              {d.vencido && <p className="text-sm font-bold text-frutilla-osc">Tiene deudas vencidas</p>}
            </button>
          </li>
        ))}
      </ul>

      {abierto === "nuevo" && <NuevaDeuda clientes={lista} onCerrar={() => setAbierto(null)} onGuardada={() => { setAbierto(null); cargar(); }} />}
      {elegido && <FichaCliente cliente={elegido} onCerrar={() => setAbierto(null)} onCambio={cargar} />}
    </div>
  );
}

function NuevaDeuda({ clientes, onCerrar, onGuardada }: { clientes: Deudor[]; onCerrar: () => void; onGuardada: () => void }) {
  const { negocio } = usePanel();
  const [cliente, setCliente] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [vence, setVence] = useState("");
  const [error, setError] = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const sb = supabase();
    let id = cliente;
    if (!id) {
      const r = await sb.from("deudores").insert({ negocio_id: negocio.id, nombre: nuevo.trim() }).select("id").single();
      if (r.error || !r.data) return setError(mensajeError(r.error));
      id = r.data.id as string;
    }
    const { error } = await sb.from("deudas").insert({
      negocio_id: negocio.id, deudor_id: id, concepto: concepto.trim(), monto: Number(monto), fecha, vence: vence || null,
    });
    if (error) return setError(mensajeError(error));
    onGuardada();
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-tinta/40 p-4" onClick={onCerrar}>
      <form onSubmit={guardar} onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-md animate-entrar overflow-y-auto rounded-[28px] bg-crema p-5">
        <h2 className="font-titulo text-2xl">Anotar una deuda</h2>
        <p className="mt-1 text-sm text-suave">Para lo que no pasó por una mesa: un encargo, una torta, una compra por mayor.</p>
        <label className="etiqueta mt-4" htmlFor="d-cliente">Cliente</label>
        <select id="d-cliente" className="campo" value={cliente} onChange={(e) => setCliente(e.target.value)}>
          <option value="">Cliente nuevo…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {!cliente && (
          <input required aria-label="Nombre del cliente nuevo" className="campo mt-2" maxLength={80} placeholder="Nombre" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
        )}
        <label className="etiqueta mt-3" htmlFor="d-concepto">Concepto</label>
        <input id="d-concepto" required maxLength={120} className="campo" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Torta de cumpleaños" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col"><span className="etiqueta">Monto ($)</span>
            <input required type="number" min={1} step="1" inputMode="numeric" className="campo" value={monto} onChange={(e) => setMonto(e.target.value)} /></label>
          <label className="flex flex-col"><span className="etiqueta">Fecha</span>
            <input type="date" className="campo" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
          <label className="col-span-2 flex flex-col"><span className="etiqueta">Paga hasta (opcional)</span>
            <input type="date" className="campo" value={vence} onChange={(e) => setVence(e.target.value)} /></label>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-frutilla-osc">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primario">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function FichaCliente({ cliente, onCerrar, onCambio }: { cliente: Deudor; onCerrar: () => void; onCambio: () => void }) {
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState("efectivo");
  const [contacto, setContacto] = useState(cliente.contacto ?? "");
  const [notas, setNotas] = useState(cliente.notas ?? "");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const saldo = Number(cliente.saldo);

  async function cobrar(e: React.FormEvent) {
    e.preventDefault(); setError(""); setAviso("");
    const { error } = await supabase().rpc("cobrar_deuda", { p_deudor: cliente.id, p_monto: Number(monto), p_medio: medio });
    if (error) return setError(mensajeError(error));
    setAviso(Number(monto) >= saldo ? "¡Cobrado! El cliente quedó al día." : `Cobrado. Todavía debe ${precio(saldo - Number(monto))}.`);
    setMonto("");
    onCambio();
  }
  async function anular(id: string) {
    if (!confirm("¿Anular este cobro? La deuda vuelve a quedar pendiente.")) return;
    const { error } = await supabase().rpc("borrar_movimiento", { p_id: id });
    if (error) setError(mensajeError(error)); else onCambio();
  }
  async function borrarDeuda(id: string) {
    if (!confirm("¿Borrar esta deuda?")) return;
    const { error } = await supabase().from("deudas").delete().eq("id", id);
    if (error) setError(mensajeError(error)); else onCambio();
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-tinta/40" onClick={onCerrar}>
      <aside role="dialog" aria-label={cliente.nombre} onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-lg animate-entrar overflow-y-auto bg-crema p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-titulo text-3xl">{cliente.nombre}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="h-10 w-10 rounded-full border border-borde bg-papel">✕</button>
        </div>
        <div className={`mt-3 rounded-[22px] p-4 ${saldo > 0 ? "bg-choco text-white" : "bg-menta text-white"}`}>
          <p className="text-sm text-white/80">{saldo > 0 ? "Debe" : "Está al día"}</p>
          <p className="font-titulo text-4xl tabular-nums">{precio(saldo)}</p>
        </div>

        {saldo > 0 && (
          <form onSubmit={cobrar} className="tarjeta mt-4 p-4">
            <p className="font-extrabold">Registrar un pago</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="flex min-w-32 flex-1 flex-col"><span className="etiqueta">Monto ($)</span>
                <input required type="number" min={1} max={saldo} step="1" inputMode="numeric" className="campo py-2" value={monto} onChange={(e) => setMonto(e.target.value)} /></label>
              <label className="flex flex-col"><span className="etiqueta">Medio</span>
                <select className="campo py-2" value={medio} onChange={(e) => setMedio(e.target.value)}>
                  {Object.entries(MEDIOS_PAGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select></label>
              <button type="button" className="btn-secundario py-2" onClick={() => setMonto(String(saldo))}>Todo</button>
              <button className="btn-primario py-2">Cobrar</button>
            </div>
            <p className="mt-2 text-xs text-suave">Se descuenta de las deudas más viejas primero. En efectivo y con la caja abierta, entra a la caja.</p>
          </form>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-frutilla-osc">{error}</p>}
        {aviso && <p role="status" className="mt-3 animate-rebote text-sm font-extrabold text-menta">{aviso}</p>}

        <h3 className="mt-6 font-extrabold">Deudas</h3>
        <ul className="mt-2 space-y-2">
          {cliente.deudas.map((d) => (
            <li key={d.id} className="rounded-[20px] bg-papel/85 p-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  <b>{d.concepto}</b>{d.de_mesa && <span className="text-suave"> · fiado en el salón</span>}
                  <span className="block text-xs text-suave">{fechaCorta(d.fecha)}{d.vence && ` · paga hasta el ${fechaCorta(d.vence)}`}</span>
                </span>
                <span className="text-right">
                  <span className="block font-extrabold tabular-nums">{precio(d.monto)}</span>
                  <span className={`text-xs font-bold ${Number(d.saldo) > 0 ? "text-frutilla-osc" : "text-menta"}`}>
                    {Number(d.saldo) > 0 ? `falta ${precio(d.saldo)}` : "pagada"}
                  </span>
                </span>
              </div>
              {d.cobros.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-borde pt-2 text-xs">
                  {d.cobros.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="flex-1 text-suave">Pagó {precio(c.monto)} el {fechaCorta(c.fecha)} · {MEDIOS_PAGO[c.medio] ?? c.medio}</span>
                      {c.borrable ? <button className="text-suave underline" onClick={() => anular(c.id)}>Anular</button> : <span className="text-suave">caja cerrada</span>}
                    </li>
                  ))}
                </ul>
              )}
              {d.cobros.length === 0 && !d.de_mesa && (
                <button className="mt-1 text-xs text-suave underline" onClick={() => borrarDeuda(d.id)}>Borrar</button>
              )}
            </li>
          ))}
        </ul>

        <form className="mt-6 space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setError(""); setAviso("");
          const { error } = await supabase().from("deudores").update({ contacto: contacto.trim() || null, notas: notas.trim() || null }).eq("id", cliente.id);
          if (error) setError(mensajeError(error)); else { setAviso("Datos guardados."); onCambio(); }
        }}>
          <h3 className="font-extrabold">Datos del cliente</h3>
          <label className="flex flex-col"><span className="etiqueta">WhatsApp o teléfono</span>
            <input className="campo" value={contacto} onChange={(e) => setContacto(e.target.value)} /></label>
          <label className="flex flex-col"><span className="etiqueta">Notas</span>
            <textarea rows={2} className="campo" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: paga los viernes" /></label>
          <button className="btn-secundario">Guardar datos</button>
        </form>
      </aside>
    </div>
  );
}
