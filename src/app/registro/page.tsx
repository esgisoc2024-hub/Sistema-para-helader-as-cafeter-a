"use client";
// Crear cuenta en un paso: datos del dueño y del local, con el plan elegido en la página de inicio (?plan=premium).
// El plan pedido queda anotado para la administradora; Premium no se activa solo.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import "@fontsource/caveat/500.css";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";
import { DIAS_PRUEBA_BASE, PRECIOS_BASE } from "@/lib/suscripcion";
import gelateria from "../../../public/inicio/gelateria.webp";

type Plan = "basico" | "premium";
const PLANES: Record<Plan, { nombre: string; para: string; incluye: string[] }> = {
  basico: {
    nombre: "Básico", para: "Para ordenar el salón",
    incluye: ["Carta por QR con tu marca", "Comandas con campanita en la barra", "Mostrador y mapa de mesas", "Reportes de ventas y espera"],
  },
  premium: {
    nombre: "Premium", para: "Para saber si ganás plata",
    incluye: ["Todo lo del plan Básico", "Caja y libro diario", "Proveedores, gastos y cuentas por pagar", "Empleados, sueldos y resultado del mes"],
  },
};
const ventajas = (dias: number) => [`${dias} días de prueba gratis`, "Sin tarjeta de crédito", "Listo para usar en 15 minutos"];

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const [plan, setPlan] = useState<Plan>(params.get("plan") === "premium" ? "premium" : "basico");
  const [nombre, setNombre] = useState("");
  const [local, setLocal] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [conDemo, setConDemo] = useState(true);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [config, setConfig] = useState({ dias_prueba: DIAS_PRUEBA_BASE, precios: PRECIOS_BASE });
  useEffect(() => {
    supabase().rpc("config_publica").then(({ data }) => { if (data) setConfig(data as typeof config); });
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault(); setError(""); setEnviando(true);
    const sb = supabase();
    const datos = { nombre: nombre.trim(), negocio: local.trim(), telefono: telefono.trim(), plan, con_demo: conDemo };
    const { data, error } = await sb.auth.signUp({
      email: email.trim(), password: clave,
      options: { emailRedirectTo: `${window.location.origin}/bienvenida`, data: datos },
    });
    if (error) { setEnviando(false); return setError(mensajeError(error)); }
    if (!data.session) { setEnviando(false); return setConfirmar(true); } // hay que confirmar el email primero
    const r = await sb.rpc("crear_negocio", {
      p_nombre: datos.negocio, p_mi_nombre: datos.nombre, p_con_demo: conDemo, p_telefono: datos.telefono, p_plan_solicitado: plan,
    });
    if (r.error) { setEnviando(false); return setError(mensajeError(r.error)); }
    router.replace("/panel");
  }

  const p = PLANES[plan];
  return (
    <main className="lp grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Plan elegido */}
      <aside className="lp-oscuro relative overflow-hidden px-6 py-8 sm:px-10 lg:py-12">
        <Image src={gelateria} alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(31,23,19,0.55)] to-[rgba(31,23,19,0.92)]" />
        <div className="relative mx-auto flex h-full max-w-md flex-col">
          <Link href="/" className="lp-marca">Mesa Match</Link>
          <p className="lp-mano mt-8 text-2xl text-[var(--lp-laton)] lg:mt-16">empezá hoy ♡</p>
          <h2 className="lp-titulo mt-2 text-4xl leading-tight sm:text-5xl">Tu salón, <em>ordenado desde el primer día.</em></h2>

          <div className="mt-8 rounded-[22px] border border-white/15 bg-white/5 p-5 backdrop-blur">
            <div className="grid grid-cols-2 gap-1 rounded-full bg-black/25 p-1 text-sm font-bold" role="radiogroup" aria-label="Plan">
              {(["basico", "premium"] as Plan[]).map((x) => (
                <button key={x} type="button" role="radio" aria-checked={plan === x} onClick={() => setPlan(x)}
                  className={`rounded-full py-2 transition ${plan === x ? "bg-[var(--lp-laton)] text-[var(--lp-espresso)]" : "text-white/70"}`}>
                  {PLANES[x].nombre}
                </button>
              ))}
            </div>
            <p className="mt-4 text-white/70">{p.para}</p>
            <p className="mt-1 text-white/90"><span className="font-bold">{precio(config.precios[plan])}</span> por mes, después de {config.dias_prueba} días gratis</p>
            <ul className="mt-3 space-y-2">
              {p.incluye.map((i) => <li key={i} className="flex gap-2"><span aria-hidden className="text-[var(--lp-laton)]">✓</span>{i}</li>)}
            </ul>
          </div>

          <ul className="mt-6 space-y-1.5 text-sm text-white/80 lg:mt-auto lg:pt-10">
            {ventajas(config.dias_prueba).map((v) => <li key={v} className="flex items-center gap-2"><span aria-hidden className="text-[var(--lp-laton)]">♡</span>{v}</li>)}
          </ul>
        </div>
      </aside>

      {/* Formulario */}
      <section className="flex items-center justify-center px-6 py-10 sm:px-10">
        {confirmar ? (
          <div className="w-full max-w-md text-center">
            <p className="text-5xl" aria-hidden>💌</p>
            <h1 className="lp-titulo mt-4 text-4xl">Revisá tu email</h1>
            <p className="mt-3 text-[var(--lp-suave)]">
              Te mandamos un link a <b className="text-[var(--lp-espresso)]">{email}</b> para activar la cuenta.
              Al tocarlo, tu local <b className="text-[var(--lp-espresso)]">{local}</b> queda listo.
            </p>
            <p className="mt-6 text-sm text-[var(--lp-suave)]">¿No llegó? Mirá en spam o promociones.</p>
          </div>
        ) : (
          <form onSubmit={crear} className="w-full max-w-md">
            <h1 className="lp-titulo text-4xl">Creá tu cuenta</h1>
            <p className="mt-2 text-[var(--lp-suave)]">Plan {p.nombre}. Lo podés cambiar cuando quieras.</p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <Campo id="r-nombre" etiqueta="Tu nombre" valor={nombre} onCambio={setNombre} autoComplete="name" />
              <Campo id="r-local" etiqueta="Nombre del local" valor={local} onCambio={setLocal} autoComplete="organization" maxLength={60} />
              <Campo id="r-tel" etiqueta="WhatsApp" valor={telefono} onCambio={setTelefono} tipo="tel" autoComplete="tel" placeholder="11 5555-5555" />
              <Campo id="r-email" etiqueta="Email" valor={email} onCambio={setEmail} tipo="email" autoComplete="email" />
              <div className="sm:col-span-2">
                <label htmlFor="r-clave" className="mb-1.5 block text-sm font-bold">Contraseña</label>
                <div className="relative">
                  <input id="r-clave" required minLength={6} type={verClave ? "text" : "password"} autoComplete="new-password"
                    value={clave} onChange={(e) => setClave(e.target.value)} className="lp-campo pr-20" />
                  <button type="button" onClick={() => setVerClave(!verClave)} aria-pressed={verClave}
                    className="absolute inset-y-0 right-3 my-auto h-8 rounded-full px-3 text-xs font-bold text-[var(--lp-suave)] hover:bg-[var(--lp-lino)]">
                    {verClave ? "Ocultar" : "Ver"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-[var(--lp-suave)]">Mínimo 6 caracteres.</p>
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--lp-terracota)]" checked={conDemo} onChange={(e) => setConDemo(e.target.checked)} />
              <span>Cargar una carta de ejemplo y 8 mesas para probar ya (después la editás o la borrás).</span>
            </label>

            {error && <p role="alert" className="mt-4 rounded-xl bg-[#f6e3dc] px-4 py-3 text-sm text-[var(--lp-terracota)]">{error}</p>}
            <button className="lp-btn lp-btn-oscuro mt-6 w-full" disabled={enviando}>{enviando ? "Creando tu cuenta…" : "Crear mi cuenta gratis"}</button>
            <p className="mt-5 text-center text-sm text-[var(--lp-suave)]">
              ¿Ya tenés cuenta? <Link href="/login" className="font-bold text-[var(--lp-espresso)] underline">Ingresar</Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}

function Campo({ id, etiqueta, valor, onCambio, tipo = "text", autoComplete, placeholder, maxLength = 80 }: {
  id: string; etiqueta: string; valor: string; onCambio: (v: string) => void; tipo?: string; autoComplete?: string; placeholder?: string; maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold">{etiqueta}</label>
      <input id={id} required type={tipo} value={valor} onChange={(e) => onCambio(e.target.value)} autoComplete={autoComplete}
        placeholder={placeholder} maxLength={maxLength} className="lp-campo" />
    </div>
  );
}

export default function Registro() {
  return <Suspense><Formulario /></Suspense>;
}
