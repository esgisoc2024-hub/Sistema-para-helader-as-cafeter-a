"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";

interface Periodo {
  ventas: number; fiado: number; otros_ingresos: number; total_gastos: number; retiros: number; resultado: number;
  gastos: { rubro: string; monto: number }[];
}
interface Resultado extends Periodo {
  sueldos_sin_liquidar: number; te_deben: number; debes: number; anterior: Periodo;
}

const mesISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const nombreMes = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" });
const moverMes = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + n); return mesISO(d); };

function variacion(actual: number, anterior: number) {
  if (!anterior) return null;
  const v = ((actual - anterior) / Math.abs(anterior)) * 100;
  return `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}%`;
}

export default function ResultadoMes() {
  const [mes, setMes] = useState(mesISO(new Date()));
  const [r, setR] = useState<Resultado | null>(null);
  const [error, setError] = useState("");
  const esteMes = mes === mesISO(new Date());

  const cargar = useCallback(async () => {
    setR(null);
    const { data, error } = await supabase().rpc("resultado_mes", { p_periodo: mes });
    if (error) return setError(mensajeError(error));
    setError("");
    setR(data as Resultado);
  }, [mes]);
  useEffect(() => { cargar(); }, [cargar]);

  const ingresos = r ? Number(r.ventas) + Number(r.otros_ingresos) : 0;
  const resultado = r ? Number(r.resultado) : 0;
  const conSueldos = resultado - Number(r?.sueldos_sin_liquidar ?? 0);
  const gana = resultado >= 0;
  const maxGasto = Math.max(1, ...(r?.gastos.map((g) => Number(g.monto)) ?? []));
  const mesAnterior = nombreMes(moverMes(mes, -1)).split(" ")[0];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="sobre-fondo mr-auto font-titulo text-3xl">Resultado del mes</h1>
        <button aria-label="Mes anterior" className="h-10 w-10 rounded-full bg-papel/85 font-extrabold" onClick={() => setMes(moverMes(mes, -1))}>‹</button>
        <p className="min-w-44 text-center text-lg font-extrabold first-letter:uppercase">{nombreMes(mes)}</p>
        <button aria-label="Mes siguiente" className="h-10 w-10 rounded-full bg-papel/85 font-extrabold disabled:opacity-30" disabled={esteMes} onClick={() => setMes(moverMes(mes, 1))}>›</button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-2xl bg-rubor p-3 text-sm text-frutilla-osc">{error}</p>}
      {!r ? <p className="mt-4 text-suave">Cargando…</p> : (
        <>
          {/* Lo más importante: ganó o perdió */}
          <section className={`mt-4 animate-rebote rounded-[32px] p-6 text-white ${gana ? "bg-menta" : "bg-frutilla"}`}>
            <p className="text-lg font-extrabold text-white/90">{esteMes ? "Vas" : "Terminaste"} {gana ? "ganando" : "perdiendo"}</p>
            <p className="font-titulo text-5xl tabular-nums sm:text-6xl">{precio(Math.abs(resultado))}</p>
            <p className="mt-2 text-white/90">
              Entró {precio(ingresos)} y salieron {precio(r.total_gastos)} en gastos.
              {variacion(resultado, Number(r.anterior.resultado)) && ` En ${mesAnterior}: ${precio(r.anterior.resultado)} (${variacion(resultado, Number(r.anterior.resultado))}).`}
            </p>
            {Number(r.sueldos_sin_liquidar) > 0 && (
              <p className="mt-3 rounded-2xl bg-white/15 px-3 py-2 text-sm font-bold">
                Faltan liquidar sueldos por {precio(r.sueldos_sin_liquidar)}. Contándolos, el mes daría {conSueldos >= 0 ? "una ganancia" : "una pérdida"} de {precio(Math.abs(conSueldos))}.
                {" "}<Link href="/panel/administracion/empleados" className="underline">Liquidar</Link>
              </p>
            )}
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="tarjeta p-5">
              <h2 className="font-titulo text-2xl">Lo que entró</h2>
              <dl className="mt-3 space-y-2">
                <Fila t="Ventas del salón" v={r.ventas} ant={r.anterior.ventas} />
                {Number(r.fiado) > 0 && <p className="text-sm text-suave">De esas ventas, {precio(r.fiado)} fueron fiadas.</p>}
                <Fila t="Otros ingresos" v={r.otros_ingresos} ant={r.anterior.otros_ingresos} />
                <div className="border-t border-borde pt-2"><Fila t="Total" v={ingresos} fuerte /></div>
              </dl>
            </section>

            <section className="tarjeta p-5">
              <h2 className="font-titulo text-2xl">Lo que se gastó</h2>
              {r.gastos.length === 0 ? (
                <p className="mt-3 text-sm text-suave">No hay gastos cargados en este mes. Cargalos en <Link className="underline" href="/panel/administracion/pagar">Cuentas por pagar</Link> para ver el resultado real.</p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {r.gastos.map((g) => (
                    <li key={g.rubro}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="font-bold">{g.rubro}</span>
                        <span className="tabular-nums">{precio(g.monto)} <span className="text-suave">· {Math.round((Number(g.monto) / Math.max(1, Number(r.total_gastos))) * 100)}%</span></span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-borde/60"><div className="h-2 rounded-full bg-frutilla" style={{ width: `${(Number(g.monto) / maxGasto) * 100}%` }} /></div>
                    </li>
                  ))}
                  <li className="flex justify-between border-t border-borde pt-2 font-extrabold"><span>Total</span><span className="tabular-nums">{precio(r.total_gastos)}</span></li>
                </ul>
              )}
            </section>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Dato titulo="Te deben" valor={r.te_deben} href="/panel/administracion/cobrar" detalle="clientes con cuenta" />
            <Dato titulo="Debés" valor={r.debes} href="/panel/administracion/pagar" detalle="cuentas sin pagar" />
            <Dato titulo="Retiros del dueño" valor={r.retiros} detalle="no cuentan como gasto" />
          </div>
          <p className="mt-4 text-xs text-suave">
            Las ventas cuentan el día en que se cerró la mesa (también las fiadas). Los gastos cuentan en el mes de su fecha, estén pagados o no.
            Es una guía para tu gestión, no reemplaza la contabilidad de tu contador.
          </p>
        </>
      )}
    </div>
  );
}

function Fila({ t, v, ant, fuerte }: { t: string; v: number; ant?: number; fuerte?: boolean }) {
  const cambio = ant !== undefined ? variacion(Number(v), Number(ant)) : null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={fuerte ? "font-extrabold" : "text-suave"}>{t}</dt>
      <dd className={`tabular-nums ${fuerte ? "font-titulo text-2xl" : "font-extrabold"}`}>
        {precio(v)}{cambio && <span className={`ml-2 text-xs ${cambio.startsWith("+") ? "text-menta" : "text-frutilla-osc"}`}>{cambio}</span>}
      </dd>
    </div>
  );
}

function Dato({ titulo, valor, detalle, href }: { titulo: string; valor: number; detalle: string; href?: string }) {
  const contenido = (
    <>
      <p className="text-sm text-suave">{titulo}</p>
      <p className="font-titulo text-2xl tabular-nums">{precio(valor)}</p>
      <p className="text-xs text-suave">{detalle}</p>
    </>
  );
  return href
    ? <Link href={href} className="tarjeta block p-4 transition active:scale-[0.98]">{contenido}</Link>
    : <div className="tarjeta p-4">{contenido}</div>;
}
