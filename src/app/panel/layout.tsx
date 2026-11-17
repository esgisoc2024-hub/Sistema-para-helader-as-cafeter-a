"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSesion } from "@/lib/useSesion";
import { supabase } from "@/lib/supabase";
import { PanelContexto } from "@/components/PanelContexto";
import { Fondo } from "@/components/Fondo";
import { AvisosSalon } from "@/components/AvisosSalon";
import type { Rol } from "@/lib/tipos";

const MENU: { href: string; texto: string; roles: Rol[] }[] = [
  { href: "/panel/barra", texto: "Barra", roles: ["duenio", "mozo", "barra"] },
  { href: "/panel/mesas", texto: "Mesas", roles: ["duenio", "mozo"] },
  { href: "/panel/carta", texto: "Carta", roles: ["duenio"] },
  { href: "/panel/local", texto: "Local y QR", roles: ["duenio"] },
  { href: "/panel/reportes", texto: "Reportes", roles: ["duenio"] },
  { href: "/panel/administracion", texto: "Administración", roles: ["duenio"] },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = useSesion();
  const router = useRouter();
  const ruta = usePathname();
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    if (sesion.cargando || sesion.sinLogin) return;
    supabase().rpc("es_admin").then(({ data }) => setEsAdmin(data === true));
  }, [sesion]);

  useEffect(() => {
    if (sesion.cargando) return;
    if ("sinLogin" in sesion && sesion.sinLogin) router.replace("/login");
    else if (!sesion.sinLogin && !sesion.usuario) router.replace("/bienvenida");
  }, [sesion, router]);

  if (sesion.cargando || sesion.sinLogin || !sesion.usuario || !sesion.negocio) {
    return <main className="grid min-h-dvh place-items-center text-suave">Cargando…</main>;
  }
  const { usuario, negocio } = sesion;
  const menu = MENU.filter((m) => m.roles.includes(usuario.rol));

  return (
    <PanelContexto.Provider value={{ usuario, negocio }}>
      <div className="min-h-dvh">
        <Fondo url={negocio.portada_url} tipo={negocio.portada_tipo} />
        <AvisosSalon negocioId={negocio.id} />
        <header className="no-imprimir sticky top-0 z-20 bg-crema/60 backdrop-blur-md">
          {/* En el celular el menú baja a su propia fila y se acomoda en varias líneas: nunca queda escondido. */}
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <p className="min-w-0 flex-1 truncate font-titulo text-lg md:flex-none">{negocio.nombre}</p>
            <button className="shrink-0 text-sm text-suave underline md:order-last" onClick={async () => { await supabase().auth.signOut(); router.replace("/login"); }}>
              Salir
            </button>
            <nav aria-label="Secciones" className="flex w-full flex-wrap gap-1.5 text-sm font-semibold md:w-auto md:flex-1">
              {menu.map((m) => (
                <Link key={m.href} href={m.href}
                  className={`rounded-full border px-3 py-1.5 ${ruta.startsWith(m.href) ? "border-choco bg-choco text-white" : "border-borde bg-papel text-tinta hover:bg-borde/50"}`}>
                  {m.texto}{m.href === "/panel/administracion" && negocio.plan !== "premium" && " 🔒"}
                </Link>
              ))}
              {esAdmin && <Link href="/admin" className="rounded-full border border-choco px-3 py-1.5 text-choco">Mis locales</Link>}
            </nav>
          </div>
        </header>
        {negocio.estado === "suspendido" && (
          <p role="alert" className="no-imprimir bg-frutilla px-4 py-2 text-center text-sm font-bold text-white">
            Tu cuenta está suspendida: los clientes no pueden pedir desde el QR. Escribinos para reactivarla.
          </p>
        )}
        <div className="mx-auto max-w-6xl px-4 py-5">{children}</div>
      </div>
    </PanelContexto.Provider>
  );
}
