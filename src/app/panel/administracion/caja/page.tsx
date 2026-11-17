"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hora, mensajeError, precio } from "@/lib/formato";

interface Movimiento { id: string; fecha: string; tipo: "ingreso" | "egreso"; concepto: string; categoria: string; monto: number; medio: string }
interface Resumen {
  id: string; abierta_at: string; cerrada_at: string | null; abierta_por: string | null; cerrada_por: string | null;
  monto_inicial: number; ventas: Record<string, number>; ventas_total: number; mesas_cobradas: number;
  ingresos: number; egresos: number; efectivo_esperado: number; efectivo_contado: number | null; notas: string | null;
  movimientos: Movimiento[];
}
interface CajaCerrada {
  id: string; abierta_at: string; cerrada_at: string; monto_inicial: number;
  efectivo_esperado: number; efectivo_contado: number; diferencia: number; ventas: number;
}

const MEDIOS: Record<string, string> = { efectivo: "Efectivo", qr: "QR / MP", tarjeta: "Tarjeta", transferencia: "Transferencia", fiado: "Fiado" };
const CATEGORIAS_EGRESO = ["Compras chicas", "Retiro del dueño", "Proveedor", "Limpieza", "Otros"];
const CATEGORIAS_INGRESO = ["Otros ingresos", "Aporte de cambio", "Encargo"];

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

export default function Caja() {
  const [caja, setCaja] = useState<Resumen | null | undefined>(undefined);
  const [historial, setHistorial] = useState<CajaCerrada[]>([]);
  const [error, setError] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [cerrada, setCerrada] = useState<Resumen | null>(null);

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [r, h] = await Promise.all([sb.rpc("resumen_caja"), sb.rpc("historial_cajas")]);
    if (r.error) setError(mensajeError(r.error));
    setCaja((r.data as Resumen | null) ?? null);
    setHistorial((h.data ?? []) as CajaCerrada[]);
  }, []);

  useEffect(() => {
    cargar();
    // Las mesas que se cobran entran solas: se refresca cada 20 segundos.
    const t = setInterval(cargar, 20000);
    return () => clearInterval(t);
  }, [cargar]);

  if (caja === undefined) return <p className="text-suave">Cargando…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        {error && <p role="alert" className="mb-3 rounded-2xl bg-rubor p-3 text-sm text-frutilla-osc">{error}</p>}
        {cerrada ? (
          <CierreHecho caja={cerrada} onListo={() => { setCerrada(null); cargar(); }} />
        ) : caja ? (
          <>
            <CajaAbierta caja={caja} onCambio={cargar} onError={setError} />
            {cerrando ? (
              <CerrarCaja caja={caja} onCancelar={() => setCerrando(false)}
                onCerrada={(r) => { setCerrando(false); setCerrada(r); }} onError={setError} />
            ) : (
              <button className="btn-primario mt-4 w-full py-4 text-lg" onClick={() => setCerrando(true)}>Cerrar caja</button>
            )}
          </>
        ) : (
          <AbrirCaja onAbierta={cargar} onError={setError} />
        )}
      </div>

      <aside>
        <h2 className="sobre-fondo mb-3 font-titulo text-2xl">Cajas anteriores</h2>
        {historial.length === 0 && <p className="tarjeta p-4 text-sm text-suave">Todavía no cerraste ninguna caja.</p>}
        <ul className="space-y-2">
          {historial.map((c) => (
            <li key={c.id} className="tarjeta p-3 text-sm">
              <p className="font-extrabold first-letter:uppercase">{fechaLarga(c.abierta_at)}</p>
              <p className="text-suave">{hora(c.abierta_at)} a {hora(c.cerrada_at)} · vendido {precio(c.ventas)}</p>
              <p className={Number(c.diferencia) === 0 ? "text-menta" : "font-bold text-frutilla-osc"}>
                {Number(c.diferencia) === 0 ? "Cerró justa"
                  : Number(c.diferencia) > 0 ? `Sobraron ${precio(c.diferencia)}` : `Faltaron ${precio(-c.diferencia)}`}
              </p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function AbrirCaja({ onAbierta, onError }: { onAbierta: () => void; onError: (e: string) => void }) {
  const [monto, setMonto] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <form className="tarjeta animate-entrar p-6" onSubmit={async (e) => {
      e.preventDefault(); setEnviando(true); onError("");
      const { error } = await supabase().rpc("abrir_caja", { p_monto_inicial: Number(monto || 0) });
      setEnviando(false);
      if (error) return onError(mensajeError(error));
      onAbierta();
    }}>
      <h1 className="font-titulo text-3xl">La caja está cerrada</h1>
      <p className="mt-1 text-suave">Para empezar el día, contá el efectivo que hay en la caja (el cambio) y abrila.</p>
      <label className="etiqueta mt-5" htmlFor="c-inicial">Efectivo inicial ($)</label>
      <input id="c-inicial" type="number" min={0} step="1" inputMode="numeric" required className="campo text-2xl font-extrabold"
        value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
      <button className="btn-primario mt-5 w-full py-4 text-lg" disabled={enviando}>{enviando ? "Abriendo…" : "Abrir caja"}</button>
    </form>
  );
}

function CajaAbierta({ caja, onCambio, onError }: { caja: Resumen; onCambio: () => void; onError: (e: string) => void }) {
  const [nuevo, setNuevo] = useState<"ingreso" | "egreso" | null>(null);
  const ventasEf = Number(caja.ventas.efectivo ?? 0);
  const otrosMedios = Object.entries(caja.ventas).filter(([m]) => m !== "efectivo");

  return (
    <section className="tarjeta animate-entrar p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-titulo text-3xl">Caja abierta</h1>
        <p className="text-sm text-suave">Desde las {hora(caja.abierta_at)}{caja.abierta_por && ` · ${caja.abierta_por}`}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Cifra titulo="Vendido" valor={precio(caja.ventas_total)} detalle={`${caja.mesas_cobradas} mesas cobradas`} />
        <Cifra titulo="Efectivo en caja" valor={precio(caja.efectivo_esperado)} detalle="lo que debería haber" destacada />
        <Cifra titulo="Salidas" valor={precio(caja.egresos)} detalle={caja.ingresos > 0 ? `Otros ingresos: ${precio(caja.ingresos)}` : "gastos y retiros"} />
      </div>

      <h2 className="mt-6 text-sm font-extrabold text-suave">Cómo se armó el efectivo</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <Linea t="Efectivo inicial" v={caja.monto_inicial} />
        <Linea t="Ventas en efectivo" v={ventasEf} signo="+" />
        {caja.movimientos.filter((m) => m.medio === "efectivo").map((m) => (
          <Linea key={m.id} t={m.concepto} v={m.monto} signo={m.tipo === "ingreso" ? "+" : "−"} />
        ))}
      </dl>
      {otrosMedios.length > 0 && (
        <p className="mt-3 text-sm text-suave">
          Cobrado por otros medios (no está en la caja): {otrosMedios.map(([m, v]) => `${MEDIOS[m] ?? m} ${precio(v)}`).join(" · ")}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button className="btn-secundario" onClick={() => setNuevo("egreso")}>− Salida de dinero</button>
        <button className="btn-secundario" onClick={() => setNuevo("ingreso")}>+ Entrada de dinero</button>
      </div>
      {nuevo && <NuevoMovimiento tipo={nuevo} onCerrar={() => setNuevo(null)} onGuardado={() => { setNuevo(null); onCambio(); }} onError={onError} />}

      {caja.movimientos.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-extrabold text-suave">Movimientos cargados</h2>
          <ul className="mt-2 divide-y divide-borde">
            {caja.movimientos.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="shrink-0 whitespace-nowrap text-suave">{hora(m.fecha)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{m.concepto}</span>
                  <span className="text-suave"> · {m.categoria} · {MEDIOS[m.medio] ?? m.medio}</span>
                </span>
                <span className={`shrink-0 font-extrabold ${m.tipo === "egreso" ? "text-frutilla-osc" : "text-menta"}`}>
                  {m.tipo === "egreso" ? "−" : "+"}{precio(m.monto)}
                </span>
                <button aria-label={`Borrar ${m.concepto}`} className="text-suave" onClick={async () => {
                  if (!confirm(`¿Borrar “${m.concepto}”?`)) return;
                  const { error } = await supabase().rpc("borrar_movimiento", { p_id: m.id });
                  if (error) onError(mensajeError(error)); else onCambio();
                }}>✕</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function NuevoMovimiento({ tipo, onCerrar, onGuardado, onError }: {
  tipo: "ingreso" | "egreso"; onCerrar: () => void; onGuardado: () => void; onError: (e: string) => void;
}) {
  const categorias = tipo === "egreso" ? CATEGORIAS_EGRESO : CATEGORIAS_INGRESO;
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState("efectivo");
  const [categoria, setCategoria] = useState(categorias[0]);
  const [enviando, setEnviando] = useState(false);

  return (
    <form className="mt-4 animate-entrar rounded-[22px] bg-crema/90 p-4" onSubmit={async (e) => {
      e.preventDefault(); setEnviando(true); onError("");
      const { error } = await supabase().rpc("registrar_movimiento", {
        p_tipo: tipo, p_concepto: concepto, p_monto: Number(monto), p_medio: medio, p_categoria: categoria,
      });
      setEnviando(false);
      if (error) return onError(mensajeError(error));
      onGuardado();
    }}>
      <p className="font-extrabold">{tipo === "egreso" ? "Salida de dinero" : "Entrada de dinero"}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="etiqueta" htmlFor="m-concepto">Concepto</label>
          <input id="m-concepto" required maxLength={120} className="campo" value={concepto} onChange={(e) => setConcepto(e.target.value)}
            placeholder={tipo === "egreso" ? "Ej: bolsa de hielo" : "Ej: torta por encargo"} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="m-monto">Monto ($)</label>
          <input id="m-monto" required type="number" min={1} step="1" inputMode="numeric" className="campo" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="m-medio">Medio</label>
          <select id="m-medio" className="campo" value={medio} onChange={(e) => setMedio(e.target.value)}>
            {Object.entries(MEDIOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="etiqueta" htmlFor="m-cat">Categoría</label>
          <select id="m-cat" className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
        <button className="btn-primario" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
      </div>
    </form>
  );
}

function CerrarCaja({ caja, onCancelar, onCerrada, onError }: {
  caja: Resumen; onCancelar: () => void; onCerrada: (r: Resumen) => void; onError: (e: string) => void;
}) {
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const diferencia = contado === "" ? null : Number(contado) - Number(caja.efectivo_esperado);

  return (
    <form className="tarjeta mt-4 animate-entrar p-5" onSubmit={async (e) => {
      e.preventDefault(); setEnviando(true); onError("");
      const { data, error } = await supabase().rpc("cerrar_caja", { p_efectivo_contado: Number(contado), p_notas: notas });
      setEnviando(false);
      if (error) return onError(mensajeError(error));
      onCerrada(data as Resumen);
    }}>
      <h2 className="font-titulo text-2xl">Cerrar caja</h2>
      <p className="mt-1 text-sm text-suave">Contá el efectivo que hay en la caja y anotalo. Debería haber {precio(caja.efectivo_esperado)}.</p>
      <label className="etiqueta mt-4" htmlFor="c-contado">Efectivo contado ($)</label>
      <input id="c-contado" required type="number" min={0} step="1" inputMode="numeric" className="campo text-2xl font-extrabold"
        value={contado} onChange={(e) => setContado(e.target.value)} />
      {diferencia !== null && (
        <p className={`mt-2 font-extrabold ${diferencia === 0 ? "text-menta" : "text-frutilla-osc"}`}>
          {diferencia === 0 ? "Cierra justa" : diferencia > 0 ? `Sobran ${precio(diferencia)}` : `Faltan ${precio(-diferencia)}`}
        </p>
      )}
      <label className="etiqueta mt-4" htmlFor="c-notas">Notas (opcional)</label>
      <input id="c-notas" className="campo" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: se pagó al repartidor en efectivo" />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secundario" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primario" disabled={enviando}>{enviando ? "Cerrando…" : "Confirmar cierre"}</button>
      </div>
    </form>
  );
}

function CierreHecho({ caja, onListo }: { caja: Resumen; onListo: () => void }) {
  const dif = Number(caja.efectivo_contado ?? 0) - Number(caja.efectivo_esperado);
  return (
    <section className="tarjeta animate-rebote p-6 text-center">
      <p className="text-5xl" aria-hidden>{dif === 0 ? "🎉" : "📝"}</p>
      <h1 className="mt-2 font-titulo text-3xl">Caja cerrada</h1>
      <p className="mt-2 text-suave">Vendido: <b className="text-tinta">{precio(caja.ventas_total)}</b> en {caja.mesas_cobradas} mesas</p>
      <p className="text-suave">Debía haber {precio(caja.efectivo_esperado)} y se contaron {precio(caja.efectivo_contado ?? 0)}</p>
      <p className={`mt-3 text-xl font-extrabold ${dif === 0 ? "text-menta" : "text-frutilla-osc"}`}>
        {dif === 0 ? "¡Cerró justa!" : dif > 0 ? `Sobraron ${precio(dif)}` : `Faltaron ${precio(-dif)}`}
      </p>
      <button className="btn-primario mt-5" onClick={onListo}>Listo</button>
    </section>
  );
}

function Cifra({ titulo, valor, detalle, destacada }: { titulo: string; valor: string; detalle: string; destacada?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${destacada ? "bg-choco text-white" : "bg-crema/80"}`}>
      <p className={`text-xs font-bold ${destacada ? "text-white/80" : "text-suave"}`}>{titulo}</p>
      <p className="font-titulo text-2xl tabular-nums">{valor}</p>
      <p className={`text-xs ${destacada ? "text-white/80" : "text-suave"}`}>{detalle}</p>
    </div>
  );
}

function Linea({ t, v, signo }: { t: string; v: number; signo?: "+" | "−" }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-suave">{t}</dt>
      <dd className={`tabular-nums font-bold ${signo === "−" ? "text-frutilla-osc" : ""}`}>{signo ?? ""}{precio(v)}</dd>
    </div>
  );
}
