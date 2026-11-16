"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSesion } from "@/lib/useSesion";
import { supabase } from "@/lib/supabase";
import { PanelContexto } from "@/components/PanelContexto";
import type { Rol } from "@/lib/tipos";

const MENU: { href: string; texto: string; roles: Rol[] }[] = [
  { href: "/panel/barra", texto: "Barra", roles: ["duenio", "mozo", "barra"] },
  { href: "/panel/mesas", texto: "Mesas", roles: ["duenio", "mozo"] },
  { href: "/panel/carta", texto: "Carta", roles: ["duenio"] },
  { href: "/panel/local", texto: "Local y QR", roles: ["duenio"] },
  { href: "/panel/reportes", texto: "Reportes", roles: ["duenio"] },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = useSesion();
  const router = useRouter();
  const ruta = usePathname();

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
        <header className="no-imprimir sticky top-0 z-20 border-b border-borde bg-crema/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <p className="truncate font-titulo text-lg font-bold">{negocio.nombre}</p>
            <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto text-sm font-semibold">
              {menu.map((m) => (
                <Link key={m.href} href={m.href}
                  className={`shrink-0 rounded-full px-3 py-1.5 ${ruta.startsWith(m.href) ? "bg-choco text-white" : "text-suave hover:bg-borde/50"}`}>
                  {m.texto}
                </Link>
              ))}
            </nav>
            <button className="shrink-0 text-sm text-suave underline" onClick={async () => { await supabase().auth.signOut(); router.replace("/login"); }}>
              Salir
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-5">{children}</div>
      </div>
    </PanelContexto.Provider>
  );
}
