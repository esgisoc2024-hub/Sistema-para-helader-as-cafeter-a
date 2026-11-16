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
          {/* En el celular el menú baja a su propia fila y se acomoda en varias líneas: nunca queda escondido. */}
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <p className="min-w-0 flex-1 truncate font-titulo text-lg font-medium md:flex-none">{negocio.nombre}</p>
            <button className="shrink-0 text-sm text-suave underline md:order-last" onClick={async () => { await supabase().auth.signOut(); router.replace("/login"); }}>
              Salir
            </button>
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
        <div className="mx-auto max-w-6xl px-4 py-5">{children}</div>
      </div>
    </PanelContexto.Provider>
  );
}
