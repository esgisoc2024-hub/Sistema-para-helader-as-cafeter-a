"use client";
// Mi plan: estado de la prueba gratis y suscripción mensual con Mercado Pago.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { precio } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";
import { INCLUYE, NOMBRE_PLAN, diasTexto, fechaLarga, type MiSuscripcion, type Plan } from "@/lib/suscripcion";

const ERRORES: Record<string, string> = {
  mp_no_configurado: "Todavía no está habilitado el pago con Mercado Pago. Escribinos y lo activamos a mano.",
  mp_rechazo: "Mercado Pago no pudo crear la suscripción. Revisá el email y probá de nuevo.",
  email_invalido: "Revisá el email de tu cuenta de Mercado Pago.",
  ya_suscripto: "Ya tenés una suscripción activa.",
  local_suspendido: "Tu cuenta está suspendida. Escribinos para reactivarla.",
};

export default function PaginaSuscripcion() {
  return <Suspense fallback={null}><MiPlan /></Suspense>;
}

function MiPlan() {
  const { usuario, suscripcion: s, recargarSuscripcion } = usePanel();
  const params = useSearchParams();
  const volvio = params.get("mp") === "volvio";
  const [elegido, setElegido] = useState<Plan | null>(null);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { supabase().auth.getUser().then(({ data }) => setEmail((e) => e || data.user?.email || "")); }, []);
  useEffect(() => { if (s && !elegido) setElegido(s.mp_plan ?? s.plan_solicitado ?? "basico"); }, [s, elegido]);

  // Al volver de Mercado Pago, el aviso de pago puede tardar unos segundos: se vuelve a consultar.
  const confirmado = s?.mp_estado === "authorized";
  useEffect(() => {
    if (!volvio || confirmado) return;
    let vueltas = 0;
    const t = setInterval(() => { recargarSuscripcion(); if (++vueltas >= 12) clearInterval(t); }, 5000);
    return () => clearInterval(t);
  }, [volvio, confirmado, recargarSuscripcion]);

  if (usuario.rol !== "duenio") return <p className="tarjeta p-6 text-center text-suave">El plan lo elige el dueño del local.</p>;
  if (!s) return <p className="text-suave">Cargando…</p>;

  async function suscribirme() {
    if (!elegido) return;
    setEnviando(true); setError("");
    const { data, error } = await supabase().functions.invoke("suscripcion", { body: { plan: elegido, email: email.trim() } });
    if (error || !data?.url) {
      let codigo = "";
      try { codigo = (await (error as { context?: Response })?.context?.json())?.error ?? ""; } catch { /* sin detalle */ }
      setEnviando(false);
      return setError(ERRORES[codigo] ?? "No pudimos conectar con Mercado Pago. Probá de nuevo en un rato.");
    }
    window.location.href = data.url;
  }

  const activoMp = s.situacion === "activo" && confirmado;
  const activoManual = s.situacion === "activo" && !s.mp_estado;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-titulo text-3xl">Mi plan</h1>
      <Estado s={s} esperando={volvio && !confirmado} />

      {activoMp && (
        <section className="tarjeta mt-5 p-5">
          <p className="text-lg font-extrabold">Plan {NOMBRE_PLAN[s.plan]} activo</p>
          <p className="mt-1 text-suave">
            Se cobra {precio(s.precios[s.plan])} por mes con Mercado Pago{s.pagado_hasta && <>. Próximo cobro: {fechaLarga(s.pagado_hasta)}</>}.
          </p>
          <p className="mt-3 text-sm text-suave">
            Para cambiar la tarjeta o dar de baja, entrá a{" "}
            <a className="underline" href="https://www.mercadopago.com.ar/subscriptions" target="_blank" rel="noreferrer">tus suscripciones en Mercado Pago</a>.
          </p>
        </section>
      )}

      {activoManual && (
        <section className="tarjeta mt-5 p-5">
          <p className="text-lg font-extrabold">Plan {NOMBRE_PLAN[s.plan]} activo</p>
          <p className="mt-1 text-suave">Tu plan está al día. Para cambiarlo, escribinos.</p>
        </section>
      )}

      {!activoMp && !activoManual && s.situacion !== "suspendido" && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Plan">
            {(["basico", "premium"] as Plan[]).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={elegido === p} onClick={() => setElegido(p)}
                className={`tarjeta p-5 text-left transition ${elegido === p ? "ring-2 ring-frutilla" : "opacity-90"}`}>
                <p className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold">{NOMBRE_PLAN[p]}</span>
                  {p === "premium" && <span className="rounded-full bg-choco px-2 py-0.5 text-xs font-extrabold text-white">El más completo</span>}
                </p>
                <p className="mt-1 font-titulo text-3xl">{precio(s.precios[p])}<span className="text-base text-suave"> /mes</span></p>
                <p className="mt-1 text-sm text-suave">{INCLUYE[p].para}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {INCLUYE[p].items.map((i) => <li key={i} className="flex gap-2"><span aria-hidden className="text-frutilla">✓</span>{i}</li>)}
                </ul>
              </button>
            ))}
          </div>

          <section className="tarjeta mt-4 p-5">
            <label className="etiqueta" htmlFor="mp-email">Email de tu cuenta de Mercado Pago</label>
            <input id="mp-email" type="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <p className="mt-2 text-sm text-suave">Tiene que ser el mismo email con el que entrás a Mercado Pago. Se cobra mes a mes y lo das de baja cuando quieras.</p>
            {error && <p role="alert" className="mt-3 text-sm text-frutilla-osc">{error}</p>}
            <button className="btn-primario mt-4 w-full sm:w-auto" onClick={suscribirme} disabled={enviando || !elegido}>
              {enviando ? "Abriendo Mercado Pago…" : `Suscribirme al plan ${elegido ? NOMBRE_PLAN[elegido] : ""} con Mercado Pago`}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function Estado({ s, esperando }: { s: MiSuscripcion; esperando: boolean }) {
  if (esperando) return <p className="mt-2 rounded-xl bg-limon/30 px-4 py-3 font-bold">Estamos esperando la confirmación de Mercado Pago. Puede tardar unos segundos…</p>;
  const caja = "mt-2 rounded-xl px-4 py-3";
  switch (s.situacion) {
    case "prueba":
      return (
        <p className={`${caja} bg-rubor/70`}>
          Estás en la prueba gratis{s.plan_vigente === "premium" && " del plan Premium"}.{" "}
          {s.dias_restantes === 0 ? "Hoy es el último día." : `Te quedan ${diasTexto(s.dias_restantes ?? 0)} (hasta el ${fechaLarga(s.prueba_hasta)}).`}
          {" "}Suscribite ahora y no se corta nada.
        </p>
      );
    case "gracia":
      return (
        <p role="alert" className={`${caja} bg-frutilla text-white font-bold`}>
          {s.pagado_hasta ? "No pudimos cobrar tu plan." : "Terminó tu prueba gratis."} Tu carta QR sigue andando hasta el {fechaLarga(s.gracia_hasta)}. Elegí tu plan para no cortar.
        </p>
      );
    case "vencida":
      return (
        <p role="alert" className={`${caja} bg-frutilla text-white font-bold`}>
          {s.pagado_hasta ? "Tu suscripción venció" : "Terminó tu prueba gratis"} y la carta QR está pausada. Elegí un plan y se reactiva apenas Mercado Pago confirme el pago. No perdés nada de lo que cargaste.
        </p>
      );
    case "suspendido":
      return <p role="alert" className={`${caja} bg-frutilla text-white font-bold`}>Tu cuenta está suspendida. Escribinos para reactivarla.</p>;
    default:
      return null;
  }
}
