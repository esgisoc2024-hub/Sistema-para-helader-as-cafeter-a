"use client";
// Panel privado de la plataforma: todos los locales, su actividad y su estado. Solo cuentas administradoras.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";

type Estado = "prueba" | "activo" | "suspendido";
interface Local {
  id: string; nombre: string; estado: Estado; plan: "basico" | "premium"; plan_solicitado: "basico" | "premium" | null; telefono: string | null; alta: string; logo_url: string | null;
  duenio: string | null; email: string | null; equipo: number; mesas: number; productos: number;
  pedidos_7d: number; pedidos_30d: number; ventas_30d: number; ultimo_pedido: string | null;
  contacto: string | null; pagado_hasta: string | null; notas: string | null;
}

const ESTADOS: Record<Estado, { texto: string; clase: string }> = {
  prueba: { texto: "En prueba", clase: "bg-limon/25 text-tinta" },
  activo: { texto: "Activo", clase: "bg-menta text-white" },
  suspendido: { texto: "Suspendido", clase: "bg-frutilla text-white" },
};
const FILTROS = { todos: "Todos", uso: "Lo usan", sinuso: "Sin uso", vencidos: "Pago vencido", suspendidos: "Suspendidos" } as const;
type Filtro = keyof typeof FILTROS;

const dias = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
const hoy = () => new Date().toISOString().slice(0, 10);
const usa = (l: Local) => l.pedidos_7d > 0;
const vencido = (l: Local) => l.estado === "activo" && (!l.pagado_hasta || l.pagado_hasta < hoy());

function ultimaActividad(l: Local) {
  if (!l.ultimo_pedido) return "Nunca hizo un pedido";
  const d = dias(l.ultimo_pedido);
  return d === 0 ? "Último pedido: hoy" : d === 1 ? "Último pedido: ayer" : `Último pedido: hace ${d} días`;
}

export default function Admin() {
  const [acceso, setAcceso] = useState<"cargando" | "si" | "no">("cargando");
  const [locales, setLocales] = useState<Local[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Local | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase().rpc("admin_locales");
    if (error) return setAcceso("no");
    setLocales((data ?? []) as Local[]);
    setAcceso("si");
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (acceso === "cargando") return <main className="grid min-h-dvh place-items-center text-suave">Cargando…</main>;
  if (acceso === "no") {
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center">
        <div>
          <p className="font-titulo text-2xl">Esta sección es privada</p>
          <Link href="/panel" className="mt-3 inline-block text-frutilla underline">Volver a mi panel</Link>
        </div>
      </main>
    );
  }

  const cuenta = {
    todos: locales.length, uso: locales.filter(usa).length,
    sinuso: locales.filter((l) => !usa(l) && l.estado !== "suspendido").length,
    vencidos: locales.filter(vencido).length, suspendidos: locales.filter((l) => l.estado === "suspendido").length,
  };
  const b = busqueda.trim().toLowerCase();
  const visibles = locales.filter((l) =>
    (filtro === "todos" || (filtro === "uso" && usa(l)) || (filtro === "sinuso" && !usa(l) && l.estado !== "suspendido")
      || (filtro === "vencidos" && vencido(l)) || (filtro === "suspendidos" && l.estado === "suspendido"))
    && (!b || `${l.nombre} ${l.duenio ?? ""} ${l.email ?? ""}`.toLowerCase().includes(b)));

  return (
    <main className="tema-saas min-h-dvh"><div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-titulo text-3xl">Mis locales</h1>
        <span className="text-sm text-suave">Solo vos ves esta pantalla</span>
        <Link href="/panel" className="ml-auto text-sm text-suave underline">Ir a mi panel</Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(FILTROS) as Filtro[]).map((f) => (
          <button key={f} onClick={() => setFiltro(f)} aria-pressed={filtro === f}
            className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${filtro === f ? "bg-choco text-white" : "bg-papel/85 text-tinta"}`}>
            {FILTROS[f]} <span className={filtro === f ? "opacity-80" : "text-suave"}>{cuenta[f]}</span>
          </button>
        ))}
      </div>
      <input className="campo mt-3" placeholder="Buscar por local, dueño o email" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {visibles.map((l) => (
          <li key={l.id}>
            <button onClick={() => setEditando(l)} className="tarjeta w-full p-4 text-left transition active:scale-[0.98]">
              <div className="flex items-start gap-3">
                {l.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-papel object-contain" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-extrabold">{l.nombre}</p>
                  <p className="truncate text-sm text-suave">{l.duenio ?? "Sin dueño"}{l.email && ` · ${l.email}`}</p>
                  {l.telefono && <p className="truncate text-sm text-suave">WhatsApp: {l.telefono}</p>}
                  {l.plan_solicitado === "premium" && l.plan !== "premium" && (
                    <p className="mt-1 inline-block rounded-full bg-limon/30 px-2 py-0.5 text-xs font-extrabold">Pidió Premium al registrarse</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${ESTADOS[l.estado].clase}`}>{ESTADOS[l.estado].texto}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${l.plan === "premium" ? "bg-choco text-white" : "bg-papel text-suave"}`}>
                    {l.plan === "premium" ? "Premium" : "Básico"}
                  </span>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Dato valor={String(l.pedidos_7d)} titulo="pedidos, 7 días" alerta={!usa(l)} />
                <Dato valor={String(l.pedidos_30d)} titulo="pedidos, 30 días" />
                <Dato valor={precio(l.ventas_30d)} titulo="cobrado, 30 días" />
              </dl>
              <p className={`mt-3 text-sm ${usa(l) ? "text-suave" : "font-bold text-frutilla-osc"}`}>{ultimaActividad(l)}</p>
              <p className="text-sm text-suave">
                Alta: {fecha(l.alta)} · {l.mesas} mesas · {l.productos} productos · {l.equipo} en el equipo
              </p>
              <p className={`text-sm ${vencido(l) ? "font-bold text-frutilla-osc" : "text-suave"}`}>
                {l.pagado_hasta ? `Pagado hasta: ${fecha(l.pagado_hasta + "T12:00:00")}` : "Sin pagos anotados"}
              </p>
              {l.notas && <p className="mt-2 rounded-xl bg-rubor/60 px-3 py-2 text-sm">{l.notas}</p>}
            </button>
          </li>
        ))}
      </ul>
      {visibles.length === 0 && <p className="tarjeta mt-4 p-6 text-center text-suave">No hay locales en esta vista.</p>}

      {editando && <Editar local={editando} onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar(); }} />}
    </div></main>
  );
}

function Dato({ valor, titulo, alerta }: { valor: string; titulo: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl bg-crema/80 px-1 py-2">
      <dd className={`font-titulo text-xl ${alerta ? "text-frutilla-osc" : ""}`}>{valor}</dd>
      <dt className="text-xs text-suave">{titulo}</dt>
    </div>
  );
}

function Editar({ local, onCerrar, onGuardado }: { local: Local; onCerrar: () => void; onGuardado: () => void }) {
  const [estado, setEstado] = useState<Estado>(local.estado);
  const [plan, setPlan] = useState(local.plan);
  const [contacto, setContacto] = useState(local.contacto ?? "");
  const [pagado, setPagado] = useState(local.pagado_hasta ?? "");
  const [notas, setNotas] = useState(local.notas ?? "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (estado === "suspendido" && local.estado !== "suspendido"
      && !confirm(`¿Suspender ${local.nombre}? Sus clientes no van a poder pedir desde el QR hasta que lo reactives.`)) return;
    setGuardando(true); setError("");
    const { error } = await supabase().rpc("admin_actualizar_local", {
      p_negocio: local.id, p_estado: estado, p_contacto: contacto, p_pagado_hasta: pagado || null, p_notas: notas, p_plan: plan,
    });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-tinta/40 p-4" onClick={onCerrar}>
      <form onSubmit={guardar} onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-md animate-entrar overflow-y-auto rounded-[28px] bg-crema p-5">
        <h2 className="font-titulo text-2xl">{local.nombre}</h2>
        <p className="text-sm text-suave">{local.duenio}{local.email && ` · ${local.email}`}</p>

        <fieldset className="mt-4">
          <legend className="etiqueta">Estado</legend>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ESTADOS) as Estado[]).map((e) => (
              <button key={e} type="button" onClick={() => setEstado(e)} aria-pressed={estado === e}
                className={`rounded-2xl border-2 px-2 py-3 text-sm font-extrabold ${estado === e ? `border-transparent ${ESTADOS[e].clase}` : "border-borde bg-papel"}`}>
                {ESTADOS[e].texto}
              </button>
            ))}
          </div>
          {estado === "suspendido" && <p className="mt-2 text-sm text-frutilla-osc">Con el local suspendido, la carta del QR muestra “no disponible” y no entran pedidos.</p>}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="etiqueta">Plan</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["basico", "premium"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPlan(p)} aria-pressed={plan === p}
                className={`rounded-2xl border-2 px-2 py-3 text-sm font-extrabold ${plan === p ? "border-transparent bg-choco text-white" : "border-borde bg-papel"}`}>
                {p === "premium" ? "Premium" : "Básico"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-suave">Premium suma la sección Administración (caja, libro diario y más) para el dueño.</p>
        </fieldset>

        <label className="etiqueta mt-4" htmlFor="a-pagado">Pagado hasta</label>
        <input id="a-pagado" type="date" className="campo" value={pagado} onChange={(e) => setPagado(e.target.value)} />
        <label className="etiqueta mt-3" htmlFor="a-contacto">WhatsApp o teléfono</label>
        <input id="a-contacto" className="campo" value={contacto} onChange={(e) => setContacto(e.target.value)} />
        <label className="etiqueta mt-3" htmlFor="a-notas">Notas (solo las ves vos)</label>
        <textarea id="a-notas" rows={4} className="campo" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: pidió dividir la cuenta. Volver a llamar el lunes." />

        {error && <p role="alert" className="mt-3 text-sm text-frutilla-osc">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" className="btn-secundario ml-auto" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
