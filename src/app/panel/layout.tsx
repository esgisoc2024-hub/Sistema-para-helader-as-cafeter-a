"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BookOpen, ChartColumn, Coffee, HandCoins, LayoutGrid, Lock, LogOut, Menu, NotebookText, Percent, QrCode,
  Receipt, Store, TrendingUp, Truck, Users, Wallet, X, Building2, CreditCard, type LucideIcon,
} from "lucide-react";
import { useSesion } from "@/lib/useSesion";
import { supabase } from "@/lib/supabase";
import { PanelContexto } from "@/components/PanelContexto";
import { Fondo } from "@/components/Fondo";
import { AvisosSalon } from "@/components/AvisosSalon";
import type { Negocio, Rol, Usuario } from "@/lib/tipos";
import { diasTexto, fechaLarga, type MiSuscripcion } from "@/lib/suscripcion";

// Pantallas del mostrador: mantienen el estilo de la marca (también cuando las abre el dueño).
const MOSTRADOR = ["/panel/mostrador", "/panel/barra", "/panel/mesas"];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = useSesion();
  const router = useRouter();
  const ruta = usePathname();
  const [esAdmin, setEsAdmin] = useState(false);
  const [suscripcion, setSuscripcion] = useState<MiSuscripcion | null>(null);

  const recargarSuscripcion = useCallback(() => {
    supabase().rpc("mi_suscripcion").then(({ data }) => { if (data) setSuscripcion(data as MiSuscripcion); });
  }, []);

  useEffect(() => {
    if (sesion.cargando || sesion.sinLogin) return;
    supabase().rpc("es_admin").then(({ data }) => setEsAdmin(data === true));
    if (sesion.usuario) recargarSuscripcion();
  }, [sesion, recargarSuscripcion]);

  // Prueba (o pago) vencida: el dueño solo puede entrar a elegir su plan.
  const vencida = suscripcion?.situacion === "vencida";
  const esDuenio = !sesion.cargando && !sesion.sinLogin && sesion.usuario?.rol === "duenio";
  useEffect(() => {
    if (vencida && esDuenio && !ruta.startsWith("/panel/suscripcion")) router.replace("/panel/suscripcion");
  }, [vencida, esDuenio, ruta, router]);

  useEffect(() => {
    if (sesion.cargando) return;
    if ("sinLogin" in sesion && sesion.sinLogin) router.replace("/login");
    else if (!sesion.sinLogin && !sesion.usuario) router.replace("/bienvenida");
  }, [sesion, router]);

  if (sesion.cargando || sesion.sinLogin || !sesion.usuario || !sesion.negocio) {
    return <main className="grid min-h-dvh place-items-center text-suave">Cargando…</main>;
  }
  const { usuario, negocio } = sesion;
  const salir = async () => { await supabase().auth.signOut(); router.replace("/login"); };

  return (
    <PanelContexto.Provider value={{ usuario, negocio, suscripcion, recargarSuscripcion }}>
      {usuario.rol === "duenio"
        ? <PanelDuenio negocio={negocio} usuario={usuario} suscripcion={suscripcion} esAdmin={esAdmin} onSalir={salir}>
            {vencida && !ruta.startsWith("/panel/suscripcion") ? null : children}
          </PanelDuenio>
        : <PanelMostrador negocio={negocio} rol={usuario.rol} suscripcion={suscripcion} onSalir={salir}>{children}</PanelMostrador>}
    </PanelContexto.Provider>
  );
}

// Cartel arriba del panel: suspendido, días de prueba, gracia o carta pausada.
function AvisoCuenta({ negocio, suscripcion, duenio }: { negocio: Negocio; suscripcion: MiSuscripcion | null; duenio: boolean }) {
  const fuerte = "no-imprimir bg-frutilla px-4 py-2 text-center text-sm font-bold text-white";
  if (negocio.estado === "suspendido" || suscripcion?.situacion === "suspendido") {
    return <p role="alert" className={fuerte}>Tu cuenta está suspendida: los clientes no pueden pedir desde el QR. Escribinos para reactivarla.</p>;
  }
  if (!suscripcion) return null;
  const elegir = duenio && <Link href="/panel/suscripcion" className="ml-2 underline">Elegir plan</Link>;
  const { situacion, dias_restantes } = suscripcion;
  if (situacion === "prueba" && dias_restantes != null) {
    const pronto = dias_restantes <= 3;
    return (
      <p className={`no-imprimir px-4 py-2 text-center text-sm font-bold ${pronto ? "bg-limon/40 text-tinta" : "bg-rubor/70 text-tinta"}`}>
        {dias_restantes === 0 ? "Hoy es el último día de tu prueba gratis." : `Prueba gratis: te quedan ${diasTexto(dias_restantes)}.`}
        {elegir}
      </p>
    );
  }
  if (situacion === "gracia") {
    return (
      <p role="alert" className={fuerte}>
        {suscripcion.mp_estado === "authorized" || suscripcion.pagado_hasta ? "No pudimos cobrar tu plan." : "Terminó tu prueba gratis."}
        {" "}La carta QR se pausa el {fechaLarga(suscripcion.gracia_hasta)}.{duenio ? elegir : " Avisale al dueño."}
      </p>
    );
  }
  if (situacion === "vencida") {
    return (
      <p role="alert" className={fuerte}>
        La carta QR está pausada: los clientes no pueden pedir.{duenio ? " Elegí un plan para seguir." : " Pedile al dueño que elija un plan."}
      </p>
    );
  }
  return null;
}

/* ───────── Mozos y barra: el panel de siempre ───────── */

const MENU_MOSTRADOR: { href: string; texto: string; roles: Rol[] }[] = [
  { href: "/panel/mostrador", texto: "Mostrador", roles: ["mozo", "barra"] },
  { href: "/panel/barra", texto: "Barra", roles: ["mozo", "barra"] },
  { href: "/panel/mesas", texto: "Mesas", roles: ["mozo"] },
];

function PanelMostrador({ negocio, rol, suscripcion, onSalir, children }: {
  negocio: Negocio; rol: Rol; suscripcion: MiSuscripcion | null; onSalir: () => void; children: React.ReactNode;
}) {
  const ruta = usePathname();
  const menu = MENU_MOSTRADOR.filter((m) => m.roles.includes(rol));
  return (
    <div className="min-h-dvh">
      <Fondo url={negocio.portada_url} tipo={negocio.portada_tipo} />
      <AvisosSalon negocioId={negocio.id} />
      <header className="no-imprimir sticky top-0 z-20 bg-crema/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <p className="min-w-0 flex-1 truncate font-titulo text-lg md:flex-none">{negocio.nombre}</p>
          <button className="shrink-0 text-sm text-suave underline md:order-last" onClick={onSalir}>Salir</button>
          <nav aria-label="Secciones" className="flex w-full flex-wrap gap-1.5 text-sm font-semibold md:w-auto md:flex-1">
            {menu.map((m) => (
              <Link key={m.href} href={m.href}
                className={`rounded-full border px-3 py-1.5 ${ruta.startsWith(m.href) ? "border-choco bg-choco text-white" : "border-borde bg-papel text-tinta hover:bg-borde/50"}`}>
                {m.texto}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <AvisoCuenta negocio={negocio} suscripcion={suscripcion} duenio={false} />
      <div className="mx-auto max-w-6xl px-4 py-5">{children}</div>
    </div>
  );
}

/* ───────── Dueño: panel tipo software, con menú a la izquierda ───────── */

interface Item { href: string; texto: string; icono: LucideIcon }
const OPERACION: Item[] = [
  { href: "/panel/mostrador", texto: "Mostrador", icono: Store },
  { href: "/panel/barra", texto: "Barra", icono: Coffee },
  { href: "/panel/mesas", texto: "Mesas", icono: LayoutGrid },
];
const MI_LOCAL: Item[] = [
  { href: "/panel/carta", texto: "Carta", icono: BookOpen },
  { href: "/panel/local", texto: "Local y QR", icono: QrCode },
  { href: "/panel/reportes", texto: "Reportes", icono: ChartColumn },
  { href: "/panel/suscripcion", texto: "Mi plan", icono: CreditCard },
];
const ADMINISTRACION: Item[] = [
  { href: "/panel/administracion/resultado", texto: "Resultado del mes", icono: TrendingUp },
  { href: "/panel/administracion/caja", texto: "Caja", icono: Wallet },
  { href: "/panel/administracion/libro", texto: "Libro diario", icono: NotebookText },
  { href: "/panel/administracion/cobrar", texto: "Cuentas por cobrar", icono: HandCoins },
  { href: "/panel/administracion/pagar", texto: "Cuentas por pagar", icono: Receipt },
  { href: "/panel/administracion/proveedores", texto: "Proveedores", icono: Truck },
  { href: "/panel/administracion/empleados", texto: "Empleados y sueldos", icono: Users },
  { href: "/panel/administracion/margenes", texto: "Precios y márgenes", icono: Percent },
];

function PanelDuenio({ negocio, usuario, suscripcion, esAdmin, onSalir, children }: {
  negocio: Negocio; usuario: Usuario; suscripcion: MiSuscripcion | null; esAdmin: boolean; onSalir: () => void; children: React.ReactNode;
}) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  useEffect(() => { setAbierto(false); }, [ruta]);
  const mostrador = MOSTRADOR.some((r) => ruta.startsWith(r));
  const premium = (suscripcion?.plan_vigente ?? negocio.plan) === "premium";
  const enPrueba = suscripcion?.situacion === "prueba" || (suscripcion?.situacion === "gracia" && negocio.estado === "prueba");

  const activo = (href: string) =>
    ruta.startsWith(href) || (ruta === "/panel/administracion" && href.endsWith("/resultado"));

  const enlace = (it: Item, bloqueado = false) => {
    const Icono = it.icono;
    const on = activo(it.href);
    return (
      <li key={it.href}>
        <Link href={it.href} aria-current={on ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
            on ? "bg-rubor text-frutilla-osc" : "text-suave hover:bg-crema hover:text-tinta"}`}>
          <Icono aria-hidden size={18} strokeWidth={2} className="shrink-0" />
          <span className="flex-1">{it.texto}</span>
          {bloqueado && <Lock aria-label="Disponible en Premium" size={14} className="text-suave/70" />}
        </Link>
      </li>
    );
  };

  const menu = (
    <nav aria-label="Secciones" className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-borde px-4 py-4">
        {negocio.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={negocio.logo_url} alt="" className="h-9 w-9 rounded-lg border border-borde object-contain" />
          : <span className="grid h-9 w-9 place-items-center rounded-lg bg-frutilla font-titulo text-lg text-white">{negocio.nombre.slice(0, 1)}</span>}
        <div className="min-w-0">
          <p className="truncate font-titulo text-base leading-tight">{negocio.nombre}</p>
          <p className="text-xs text-suave">Plan {premium ? "Premium" : "Básico"}{enPrueba && " · prueba gratis"}</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <Grupo titulo="Operación">{OPERACION.map((i) => enlace(i))}</Grupo>
        <Grupo titulo="Mi local">{MI_LOCAL.map((i) => enlace(i))}</Grupo>
        <Grupo titulo="Administración" marca={premium ? undefined : "Premium"}>{ADMINISTRACION.map((i) => enlace(i, !premium))}</Grupo>
      </div>

      <div className="space-y-1 border-t border-borde px-3 py-3">
        {esAdmin && (
          <Link href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-suave hover:bg-crema hover:text-tinta">
            <Building2 aria-hidden size={18} /> Mis locales
          </Link>
        )}
        <button onClick={onSalir} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold text-suave hover:bg-crema hover:text-tinta">
          <LogOut aria-hidden size={18} />
          <span className="min-w-0 flex-1 truncate">Salir <span className="font-normal">· {usuario.nombre}</span></span>
        </button>
      </div>
    </nav>
  );

  return (
    <div className={`min-h-dvh ${mostrador ? "" : "tema-saas"}`}>
      {mostrador && <Fondo url={negocio.portada_url} tipo={negocio.portada_tipo} />}
      <AvisosSalon negocioId={negocio.id} />

      {/* Menú fijo en computadora */}
      <aside className="tema-saas superficie no-imprimir fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-borde lg:block">{menu}</aside>

      {/* Celular: barra superior con botón de menú */}
      <header className="tema-saas superficie no-imprimir sticky top-0 z-20 flex items-center gap-3 border-b border-borde px-4 py-3 lg:hidden">
        <button aria-label="Abrir menú" aria-expanded={abierto} onClick={() => setAbierto(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-borde">
          <Menu size={18} />
        </button>
        <p className="truncate font-titulo text-base">{negocio.nombre}</p>
      </header>
      {abierto && (
        <div className="fixed inset-0 z-40 bg-tinta/40 lg:hidden" onClick={() => setAbierto(false)}>
          <aside onClick={(e) => e.stopPropagation()} className="tema-saas superficie relative h-full w-72 max-w-[85vw] animate-entrar shadow-xl">
            <button aria-label="Cerrar menú" onClick={() => setAbierto(false)} className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-suave">
              <X size={18} />
            </button>
            {menu}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <AvisoCuenta negocio={negocio} suscripcion={suscripcion} duenio />
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}

function Grupo({ titulo, marca, children }: { titulo: string; marca?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-2 px-3 text-xs font-bold text-suave/80">
        {titulo}
        {marca && <span className="rounded-full bg-choco px-2 py-0.5 text-[10px] font-extrabold text-white">{marca}</span>}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
