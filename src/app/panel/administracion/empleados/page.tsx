"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";
import { PagarGasto } from "@/components/PagarGasto";
import { TIPOS_COMISION, cuandoVence, type CuentaPagar, type Empleado, type TipoComision } from "@/lib/administracion";

const mesISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const nombreMes = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" });
const moverMes = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + n); return mesISO(d); };

function textoComision(e: Pick<Empleado, "comision_tipo" | "comision_valor">) {
  if (e.comision_tipo === "ninguna") return "Sin comisión";
  if (e.comision_tipo === "fijo") return `Comisión fija de ${precio(e.comision_valor)}`;
  return `${Number(e.comision_valor)}% ${e.comision_tipo === "cobrado" ? "de lo que cobró" : "de las ventas del local"}`;
}

export default function Empleados() {
  const [mes, setMes] = useState(mesISO(new Date()));
  const [lista, setLista] = useState<Empleado[] | null>(null);
  const [editando, setEditando] = useState<Empleado | "nuevo" | null>(null);
  const [liquidando, setLiquidando] = useState<Empleado | null>(null);
  const [pagando, setPagando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const esteMes = mes === mesISO(new Date());

  const cargar = useCallback(async () => {
    const { data, error } = await supabase().rpc("sueldos_del_mes", { p_periodo: mes });
    if (error) setError(mensajeError(error)); else setError("");
    setLista((data ?? []) as Empleado[]);
  }, [mes]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!lista) return <p className="text-suave">Cargando…</p>;

  const activos = lista.filter((e) => e.activo || e.liquidacion);
  const totalMes = activos.reduce((s, e) => s + Number(e.liquidacion?.total ?? e.calculo.total), 0);
  const pagado = activos.reduce((s, e) => s + Number(e.liquidacion?.pagado ?? 0), 0);
  const sinLiquidar = activos.filter((e) => !e.liquidacion && e.activo).length;

  async function anular(e: Empleado) {
    if (!e.liquidacion || !confirm(`¿Anular la liquidación de ${e.nombre}? Se borra también su cuenta por pagar.`)) return;
    const { error } = await supabase().rpc("anular_liquidacion", { p_liquidacion: e.liquidacion.id });
    if (error) setError(mensajeError(error)); else cargar();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="sobre-fondo mr-auto font-titulo text-3xl">Empleados y sueldos</h1>
        <button className="btn-primario" onClick={() => setEditando("nuevo")}>+ Nuevo empleado</button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button aria-label="Mes anterior" className="h-10 w-10 rounded-full bg-papel/85 font-extrabold" onClick={() => setMes(moverMes(mes, -1))}>‹</button>
        <p className="min-w-44 text-center text-lg font-extrabold first-letter:uppercase">{nombreMes(mes)}</p>
        <button aria-label="Mes siguiente" className="h-10 w-10 rounded-full bg-papel/85 font-extrabold disabled:opacity-30" disabled={esteMes}
          onClick={() => setMes(moverMes(mes, 1))}>›</button>
        {esteMes && <span className="text-sm text-suave">(las comisiones siguen sumando hasta fin de mes)</span>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-[24px] bg-choco p-4 text-white">
          <p className="text-sm text-white/80">Sueldos del mes</p>
          <p className="font-titulo text-2xl tabular-nums">{precio(totalMes)}</p>
        </div>
        <div className="tarjeta p-4"><p className="text-sm text-suave">Pagado</p><p className="font-titulo text-2xl tabular-nums text-menta">{precio(pagado)}</p></div>
        <div className="tarjeta p-4"><p className="text-sm text-suave">Sin liquidar</p><p className="font-titulo text-2xl tabular-nums">{sinLiquidar}</p></div>
      </div>

      {error && <p role="alert" className="mt-3 rounded-2xl bg-rubor p-3 text-sm text-frutilla-osc">{error}</p>}
      {lista.length === 0 && <p className="tarjeta mt-4 p-6 text-center text-suave">Cargá a tu equipo con su sueldo y su comisión para calcular los sueldos de cada mes.</p>}

      <ul className="mt-4 space-y-3">
        {activos.map((e, i) => {
          const l = e.liquidacion;
          const c = l ?? e.calculo;
          const saldo = l ? Number(l.total) - Number(l.pagado) : 0;
          return (
            <li key={e.id} className={`tarjeta animate-entrar p-4 ${e.activo ? "" : "opacity-60"}`} style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
              <div className="flex flex-wrap items-start gap-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => setEditando(e)}>
                  <p className="text-lg font-extrabold">{e.nombre}{e.puesto && <span className="font-bold text-suave"> · {e.puesto}</span>}</p>
                  <p className="text-sm text-suave">Sueldo {precio(e.sueldo_base)} · {textoComision(e)}</p>
                  {e.calculo.sin_cuenta && !l && (
                    <p className="text-sm font-bold text-frutilla-osc">Vinculalo con su cuenta del equipo para calcular lo que cobró.</p>
                  )}
                </button>
                <div className="text-right">
                  <p className="font-titulo text-2xl tabular-nums">{precio(c.total)}</p>
                  <p className="text-xs text-suave">
                    {precio(c.sueldo_base)} + comisión {precio(c.comision)}
                    {l && Number(l.adicionales) > 0 && ` + extras ${precio(l.adicionales)}`}
                    {l && Number(l.descuentos) > 0 && ` − ${precio(l.descuentos)}`}
                  </p>
                  {e.comision_tipo !== "ninguna" && e.comision_tipo !== "fijo" && (
                    <p className="text-xs text-suave">sobre {precio(c.base_comision)} {e.comision_tipo === "cobrado" ? "cobrados" : "vendidos"}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {!l ? (
                  e.activo && <button className="btn-primario py-2" onClick={() => setLiquidando(e)}>Liquidar {nombreMes(mes).split(" ")[0]}</button>
                ) : (
                  <>
                    <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${saldo <= 0 ? "bg-menta text-white" : "bg-limon/30"}`}>
                      {saldo <= 0 ? "Pagado" : Number(l.pagado) > 0 ? `Falta pagar ${precio(saldo)}` : `Liquidado${l.vence ? ` · ${cuandoVence(l.vence)}` : ""}`}
                    </span>
                    {saldo > 0 && l.gasto_id && pagando !== e.id && <button className="btn-primario py-2" onClick={() => setPagando(e.id)}>Pagar</button>}
                    {Number(l.pagado) === 0 && <button className="text-suave underline" onClick={() => anular(e)}>Anular liquidación</button>}
                    {l.nota && <span className="text-suave">“{l.nota}”</span>}
                  </>
                )}
              </div>
              {pagando === e.id && l?.gasto_id && (
                <PagarGasto cuenta={{ id: l.gasto_id, saldo } as CuentaPagar}
                  onCancelar={() => setPagando(null)} onPagado={() => { setPagando(null); cargar(); }} />
              )}
            </li>
          );
        })}
      </ul>

      {lista.some((e) => !e.activo && !e.liquidacion) && (
        <p className="mt-6 text-sm text-suave">Dados de baja: {lista.filter((e) => !e.activo && !e.liquidacion).map((e) => e.nombre).join(", ")}</p>
      )}

      {editando && <FichaEmpleado empleado={editando === "nuevo" ? null : editando} onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar(); }} />}
      {liquidando && <Liquidar empleado={liquidando} mes={mes} onCerrar={() => setLiquidando(null)} onListo={() => { setLiquidando(null); cargar(); }} />}
    </div>
  );
}

function Liquidar({ empleado, mes, onCerrar, onListo }: { empleado: Empleado; mes: string; onCerrar: () => void; onListo: () => void }) {
  const [extras, setExtras] = useState("");
  const [descuentos, setDescuentos] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const c = empleado.calculo;
  const total = Number(c.total) + Number(extras || 0) - Number(descuentos || 0);

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-tinta/40 p-4" onClick={onCerrar}>
      <form onClick={(e) => e.stopPropagation()} className="w-full max-w-md animate-entrar rounded-[28px] bg-crema p-5" onSubmit={async (e) => {
        e.preventDefault(); setError("");
        const { error } = await supabase().rpc("liquidar_sueldo", {
          p_empleado: empleado.id, p_periodo: mes, p_adicionales: Number(extras || 0), p_descuentos: Number(descuentos || 0), p_nota: nota,
        });
        if (error) return setError(mensajeError(error));
        onListo();
      }}>
        <h2 className="font-titulo text-2xl">Sueldo de {empleado.nombre}</h2>
        <p className="text-sm text-suave first-letter:uppercase">{nombreMes(mes)}</p>
        <dl className="mt-4 space-y-1.5 text-sm">
          <Fila t="Sueldo base" v={precio(c.sueldo_base)} />
          <Fila t={`Comisión (${textoComision(empleado)})`} v={precio(c.comision)} />
          {empleado.comision_tipo !== "ninguna" && empleado.comision_tipo !== "fijo" && (
            <p className="text-xs text-suave">Calculada sobre {precio(c.base_comision)} {empleado.comision_tipo === "cobrado" ? "que cobró en el mes" : "vendidos en el mes"}.</p>
          )}
        </dl>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col"><span className="etiqueta">+ Extras (horas, bonos)</span>
            <input type="number" min={0} step="1" inputMode="numeric" className="campo" value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="0" /></label>
          <label className="flex flex-col"><span className="etiqueta">− Adelantos o descuentos</span>
            <input type="number" min={0} step="1" inputMode="numeric" className="campo" value={descuentos} onChange={(e) => setDescuentos(e.target.value)} placeholder="0" /></label>
        </div>
        <label className="etiqueta mt-3" htmlFor="l-nota">Nota (opcional)</label>
        <input id="l-nota" className="campo" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: adelanto del día 15" />
        <div className="mt-4 flex items-baseline justify-between rounded-2xl bg-choco px-4 py-3 text-white">
          <span className="font-extrabold">A pagar</span><span className="font-titulo text-3xl tabular-nums">{precio(Math.max(0, total))}</span>
        </div>
        <p className="mt-2 text-xs text-suave">Queda en Cuentas por pagar, con vencimiento el 5 del mes siguiente. Lo podés pagar en partes.</p>
        {error && <p role="alert" className="mt-3 text-sm text-frutilla-osc">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primario" disabled={total < 0}>Confirmar sueldo</button>
        </div>
      </form>
    </div>
  );
}

function FichaEmpleado({ empleado, onCerrar, onGuardado }: { empleado: Empleado | null; onCerrar: () => void; onGuardado: () => void }) {
  const { negocio } = usePanel();
  const [equipo, setEquipo] = useState<{ id: string; nombre: string; rol: string }[]>([]);
  const [nombre, setNombre] = useState(empleado?.nombre ?? "");
  const [puesto, setPuesto] = useState(empleado?.puesto ?? "");
  const [contacto, setContacto] = useState(empleado?.contacto ?? "");
  const [cuenta, setCuenta] = useState(empleado?.usuario_id ?? "");
  const [sueldo, setSueldo] = useState(empleado ? String(Number(empleado.sueldo_base)) : "");
  const [tipo, setTipo] = useState<TipoComision>(empleado?.comision_tipo ?? "ninguna");
  const [valor, setValor] = useState(empleado ? String(Number(empleado.comision_valor)) : "");
  const [ingreso, setIngreso] = useState(empleado?.fecha_ingreso ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase().from("usuarios").select("id, nombre, rol").order("nombre").then(({ data }) => setEquipo(data ?? []));
  }, []);

  const porcentaje = tipo === "cobrado" || tipo === "ventas_total";

  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const datos = {
      nombre: nombre.trim(), puesto: puesto.trim() || null, contacto: contacto.trim() || null, usuario_id: cuenta || null,
      sueldo_base: Number(sueldo || 0), comision_tipo: tipo, comision_valor: tipo === "ninguna" ? 0 : Number(valor || 0),
      fecha_ingreso: ingreso || null,
    };
    const sb = supabase().from("empleados");
    const { error } = empleado ? await sb.update(datos).eq("id", empleado.id) : await sb.insert({ ...datos, negocio_id: negocio.id });
    if (error) return setError(mensajeError(error));
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-tinta/40" onClick={onCerrar}>
      <form onSubmit={guardar} onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-lg animate-entrar space-y-3 overflow-y-auto bg-crema p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-titulo text-3xl">{empleado?.nombre ?? "Nuevo empleado"}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="h-10 w-10 rounded-full border border-borde bg-papel">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col"><span className="etiqueta">Nombre</span>
            <input required maxLength={80} className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <label className="flex flex-col"><span className="etiqueta">Puesto</span>
            <input className="campo" value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Ej: Mozo, Barra" /></label>
          <label className="flex flex-col"><span className="etiqueta">WhatsApp o teléfono</span>
            <input className="campo" value={contacto} onChange={(e) => setContacto(e.target.value)} /></label>
          <label className="flex flex-col"><span className="etiqueta">Ingresó el</span>
            <input type="date" className="campo" value={ingreso} onChange={(e) => setIngreso(e.target.value)} /></label>
        </div>
        <label className="flex flex-col"><span className="etiqueta">Sueldo base por mes ($)</span>
          <input required type="number" min={0} step="1" inputMode="numeric" className="campo" value={sueldo} onChange={(e) => setSueldo(e.target.value)} /></label>

        <fieldset className="tarjeta p-4">
          <legend className="sr-only">Comisión</legend>
          <p className="font-extrabold">Comisión</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(Object.keys(TIPOS_COMISION) as TipoComision[]).map((t) => (
              <button key={t} type="button" onClick={() => setTipo(t)} aria-pressed={tipo === t}
                className={`rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-extrabold ${tipo === t ? "border-frutilla bg-rubor text-frutilla-osc" : "border-borde bg-papel"}`}>
                {TIPOS_COMISION[t]}
              </button>
            ))}
          </div>
          {tipo !== "ninguna" && (
            <label className="mt-3 flex flex-col"><span className="etiqueta">{porcentaje ? "Porcentaje (%)" : "Monto por mes ($)"}</span>
              <input required type="number" min={0} max={porcentaje ? 100 : undefined} step={porcentaje ? "0.5" : "1"} inputMode="decimal"
                className="campo" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
          )}
          {tipo === "cobrado" && (
            <label className="mt-3 flex flex-col"><span className="etiqueta">Su cuenta en el equipo</span>
              <select className="campo" value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
                <option value="">— Elegí su cuenta —</option>
                {equipo.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
              <span className="mt-1 text-xs text-suave">Se suma lo que cobró desde Mesas con esa cuenta. Si no tiene cuenta, sumalo desde Local y QR → Equipo.</span>
            </label>
          )}
        </fieldset>

        {error && <p role="alert" className="text-sm text-frutilla-osc">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario">{empleado ? "Guardar cambios" : "Crear empleado"}</button>
          {empleado && (
            <button type="button" className="btn-secundario" onClick={async () => {
              await supabase().from("empleados").update({ activo: !empleado.activo }).eq("id", empleado.id); onGuardado();
            }}>{empleado.activo ? "Dar de baja" : "Reincorporar"}</button>
          )}
        </div>
        {empleado && <p className="text-xs text-suave">Los cambios de sueldo o comisión se aplican a los meses que todavía no liquidaste.</p>}
      </form>
    </div>
  );
}

function Fila({ t, v }: { t: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-suave">{t}</dt><dd className="font-extrabold tabular-nums">{v}</dd></div>;
}
