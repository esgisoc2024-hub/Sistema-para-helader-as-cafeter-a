"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";
import { PagarGasto } from "@/components/PagarGasto";
import {
  CATEGORIAS_GASTO, ESTADO_CUENTA, MEDIOS_PAGO, cuandoVence, fechaCorta, hoyISO, nombreCategoria,
  type CategoriaGasto, type CuentaPagar,
} from "@/lib/administracion";

interface GastoFijo { id: string; categoria: CategoriaGasto; concepto: string; monto: number; dia_vencimiento: number; activo: boolean }
interface ProveedorMin { id: string; nombre: string; plazo_dias: number }

const cuentasTexto = (n: number) => (n === 1 ? "1 cuenta" : `${n} cuentas`);

const FILTROS = { pendientes: "Por pagar", vencidos: "Vencidas", pagados: "Pagadas", todos: "Todas" } as const;
type Filtro = keyof typeof FILTROS;

export default function CuentasPorPagar() {
  const [cuentas, setCuentas] = useState<CuentaPagar[] | null>(null);
  const [fijos, setFijos] = useState<GastoFijo[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorMin[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [nuevo, setNuevo] = useState(false);
  const [pagando, setPagando] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const sb = supabase();
    await sb.rpc("generar_gastos_fijos"); // crea los gastos fijos del mes si faltan
    const [c, f, p] = await Promise.all([
      sb.rpc("cuentas_por_pagar"),
      sb.from("gastos_fijos").select("*").order("dia_vencimiento"),
      sb.from("proveedores").select("id, nombre, plazo_dias").eq("activo", true).order("nombre"),
    ]);
    if (c.error) setError(mensajeError(c.error));
    setCuentas((c.data ?? []) as CuentaPagar[]);
    setFijos((f.data ?? []) as GastoFijo[]);
    setProveedores((p.data ?? []) as ProveedorMin[]);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (!cuentas) return <p className="text-suave">Cargando…</p>;

  const pendientes = cuentas.filter((c) => c.estado !== "pagado");
  const suma = (l: CuentaPagar[]) => l.reduce((s, c) => s + Number(c.saldo), 0);
  const vencidas = pendientes.filter((c) => c.estado === "vencido");
  const semana = pendientes.filter((c) => c.estado === "por_vencer");
  const visibles = cuentas.filter((c) =>
    filtro === "todos" || (filtro === "pendientes" && c.estado !== "pagado")
    || (filtro === "vencidos" && c.estado === "vencido") || (filtro === "pagados" && c.estado === "pagado"));

  async function borrarGasto(c: CuentaPagar) {
    if (!confirm(`¿Borrar “${c.concepto}”?`)) return;
    const { error } = await supabase().from("gastos").delete().eq("id", c.id);
    if (error) setError(mensajeError(error)); else cargar();
  }
  async function anularPago(id: string) {
    if (!confirm("¿Anular este pago? La cuenta vuelve a quedar pendiente.")) return;
    const { error } = await supabase().rpc("borrar_movimiento", { p_id: id });
    if (error) setError(mensajeError(error)); else cargar();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="sobre-fondo mr-auto font-titulo text-3xl">Cuentas por pagar</h1>
        <button className="btn-primario" onClick={() => setNuevo(!nuevo)}>{nuevo ? "Cerrar" : "+ Nuevo gasto"}</button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Total titulo="Vencido" valor={suma(vencidas)} detalle={cuentasTexto(vencidas.length)} alerta={vencidas.length > 0} />
        <Total titulo="Vence esta semana" valor={suma(semana)} detalle={cuentasTexto(semana.length)} />
        <Total titulo="Total por pagar" valor={suma(pendientes)} detalle={cuentasTexto(pendientes.length)} />
      </div>

      {error && <p role="alert" className="mt-3 rounded-2xl bg-rubor p-3 text-sm text-frutilla-osc">{error}</p>}
      {nuevo && <NuevoGasto proveedores={proveedores} onGuardado={() => { setNuevo(false); cargar(); }} onError={setError} />}

      <div className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(FILTROS) as Filtro[]).map((f) => (
          <button key={f} onClick={() => setFiltro(f)} aria-pressed={filtro === f}
            className={`rounded-full px-4 py-2 text-sm font-extrabold ${filtro === f ? "bg-choco text-white" : "bg-papel/85"}`}>{FILTROS[f]}</button>
        ))}
      </div>

      {visibles.length === 0 && (
        <p className="tarjeta mt-4 p-6 text-center text-suave">
          {filtro === "pendientes" ? "No tenés nada por pagar. 🎉" : "No hay cuentas en esta vista."}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {visibles.map((c) => (
          <li key={c.id} className="tarjeta p-4">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-extrabold">{c.proveedor ? `${c.proveedor}: ` : ""}{c.concepto}</p>
                <p className="text-sm text-suave">
                  {nombreCategoria(c.categoria)}{c.fijo_id && " · fijo mensual"} · {c.estado === "pagado" ? `venció el ${fechaCorta(c.vence)}` : cuandoVence(c.vence)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-titulo text-2xl tabular-nums">{precio(c.estado === "pagado" ? c.monto : c.saldo)}</p>
                {Number(c.pagado) > 0 && c.estado !== "pagado" && <p className="text-xs text-suave">de {precio(c.monto)} · pagado {precio(c.pagado)}</p>}
              </div>
              <span className={`self-center rounded-full px-3 py-1 text-xs font-extrabold ${ESTADO_CUENTA[c.estado].clase}`}>{ESTADO_CUENTA[c.estado].texto}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {c.estado !== "pagado" && pagando !== c.id && <button className="btn-primario py-2" onClick={() => setPagando(c.id)}>Pagar</button>}
              {c.pagos.length > 0 && (
                <button className="font-bold text-suave underline" onClick={() => setAbierta(abierta === c.id ? null : c.id)}>
                  {abierta === c.id ? "Ocultar pagos" : `Ver pagos (${c.pagos.length})`}
                </button>
              )}
              {c.pagos.length === 0 && <button className="text-suave underline" onClick={() => borrarGasto(c)}>Borrar</button>}
            </div>
            {pagando === c.id && <PagarGasto cuenta={c} onCancelar={() => setPagando(null)} onPagado={() => { setPagando(null); cargar(); }} />}
            {abierta === c.id && (
              <ul className="mt-3 divide-y divide-borde rounded-2xl bg-crema/70 px-3 text-sm">
                {c.pagos.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1">{fechaCorta(p.fecha)} · {MEDIOS_PAGO[p.medio] ?? p.medio}</span>
                    <span className="font-extrabold tabular-nums">{precio(p.monto)}</span>
                    {p.borrable
                      ? <button className="text-suave underline" onClick={() => anularPago(p.id)}>Anular</button>
                      : <span className="text-xs text-suave" title="Es de una caja ya cerrada">caja cerrada</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <GastosFijos fijos={fijos} onCambio={cargar} onError={setError} />
    </div>
  );
}

function NuevoGasto({ proveedores, onGuardado, onError }: { proveedores: ProveedorMin[]; onGuardado: () => void; onError: (e: string) => void }) {
  const { negocio } = usePanel();
  const [categoria, setCategoria] = useState<CategoriaGasto>("servicios");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [vence, setVence] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [fijo, setFijo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const plazo = proveedores.find((p) => p.id === proveedor)?.plazo_dias;

  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setEnviando(true); onError("");
    const sb = supabase();
    let r;
    if (fijo) {
      // Gasto fijo: se guarda la plantilla y el sistema crea el de este mes (y los siguientes).
      const dia = Number((vence || fecha).slice(8, 10));
      r = await sb.from("gastos_fijos").insert({
        negocio_id: negocio.id, categoria, concepto: concepto.trim(), monto: Number(monto),
        dia_vencimiento: Math.min(28, Math.max(1, dia)), proveedor_id: proveedor || null,
      });
      if (!r.error) await sb.rpc("generar_gastos_fijos");
    } else {
      r = await sb.from("gastos").insert({
        negocio_id: negocio.id, categoria, concepto: concepto.trim(), monto: Number(monto), fecha,
        vence: vence || null, proveedor_id: proveedor || null,
      });
    }
    setEnviando(false);
    if (r.error) return onError(mensajeError(r.error));
    onGuardado();
  }

  return (
    <form onSubmit={guardar} className="tarjeta mt-4 animate-entrar p-5">
      <h2 className="font-titulo text-2xl">Nuevo gasto</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col"><span className="etiqueta">Categoría</span>
          <select className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}>
            {Object.entries(CATEGORIAS_GASTO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select></label>
        <label className="flex flex-col"><span className="etiqueta">Concepto</span>
          <input required maxLength={120} className="campo" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Luz de noviembre" /></label>
        <label className="flex flex-col"><span className="etiqueta">Monto ($)</span>
          <input required type="number" min={1} step="1" inputMode="numeric" className="campo" value={monto} onChange={(e) => setMonto(e.target.value)} /></label>
        <label className="flex flex-col"><span className="etiqueta">Proveedor (opcional)</span>
          <select className="campo" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
            <option value="">—</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select></label>
        {!fijo && (
          <label className="flex flex-col"><span className="etiqueta">Fecha</span>
            <input type="date" className="campo" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        )}
        <label className="flex flex-col"><span className="etiqueta">{fijo ? "Vence el día (de cada mes)" : "Vence"}</span>
          <input type="date" className="campo" value={vence} onChange={(e) => setVence(e.target.value)} required={fijo} />
          {!fijo && !vence && <span className="mt-1 text-xs text-suave">{plazo ? `Si lo dejás vacío: ${plazo} días (plazo del proveedor).` : "Si lo dejás vacío, vence en la fecha del gasto."}</span>}
        </label>
      </div>
      <label className="mt-4 flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-frutilla" checked={fijo} onChange={(e) => setFijo(e.target.checked)} />
        <span><b>Se repite todos los meses</b> (alquiler, internet, abonos). Se crea solo cada mes con el mismo monto; si cambia, lo editás ese mes.</span>
      </label>
      <div className="mt-4 flex justify-end">
        <button className="btn-primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar gasto"}</button>
      </div>
    </form>
  );
}

function GastosFijos({ fijos, onCambio, onError }: { fijos: GastoFijo[]; onCambio: () => void; onError: (e: string) => void }) {
  if (fijos.length === 0) return null;
  async function alternar(f: GastoFijo) {
    const { error } = await supabase().from("gastos_fijos").update({ activo: !f.activo }).eq("id", f.id);
    if (error) onError(mensajeError(error)); else onCambio();
  }
  return (
    <section className="mt-8">
      <h2 className="sobre-fondo font-titulo text-2xl">Gastos fijos de cada mes</h2>
      <ul className="tarjeta mt-3 divide-y divide-borde px-4">
        {fijos.map((f) => (
          <li key={f.id} className={`flex flex-wrap items-center gap-3 py-3 ${f.activo ? "" : "opacity-50"}`}>
            <span className="min-w-0 flex-1"><b>{f.concepto}</b> <span className="text-sm text-suave">· {nombreCategoria(f.categoria)} · vence el {f.dia_vencimiento}</span></span>
            <span className="font-extrabold tabular-nums">{precio(f.monto)}</span>
            <button className="text-sm text-suave underline" onClick={() => alternar(f)}>{f.activo ? "Pausar" : "Reanudar"}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Total({ titulo, valor, detalle, alerta }: { titulo: string; valor: number; detalle: string; alerta?: boolean }) {
  return (
    <div className={`rounded-[24px] p-4 ${alerta ? "bg-frutilla text-white" : "tarjeta"}`}>
      <p className={`text-sm ${alerta ? "text-white/85" : "text-suave"}`}>{titulo}</p>
      <p className="font-titulo text-2xl tabular-nums">{precio(valor)}</p>
      <p className={`text-xs ${alerta ? "text-white/85" : "text-suave"}`}>{detalle}</p>
    </div>
  );
}
