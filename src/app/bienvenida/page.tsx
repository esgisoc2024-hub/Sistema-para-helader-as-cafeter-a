"use client";

import { Fondo } from "@/components/Fondo";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/formato";

export default function Bienvenida() {
  const router = useRouter();
  const [modo, setModo] = useState<"crear" | "unirse">("crear");
  const [miNombre, setMiNombre] = useState("");
  const [negocio, setNegocio] = useState("");
  const [codigo, setCodigo] = useState("");
  const [conDemo, setConDemo] = useState(true);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setCargando(true);
    const sb = supabase();
    const { error } = modo === "crear"
      ? await sb.rpc("crear_negocio", { p_nombre: negocio, p_mi_nombre: miNombre, p_con_demo: conDemo })
      : await sb.rpc("unirse_a_negocio", { p_codigo: codigo, p_mi_nombre: miNombre });
    setCargando(false);
    if (error) return setError(mensajeError(error));
    window.location.href = "/panel";
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Fondo />
      <form onSubmit={enviar} className="tarjeta w-full max-w-md p-6">
        <h1 className="font-titulo text-2xl">Bienvenido</h1>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-borde/60 p-1 text-sm font-semibold">
          <button type="button" onClick={() => setModo("crear")} className={`rounded-full py-2 ${modo === "crear" ? "bg-papel" : "text-suave"}`}>Soy el dueño</button>
          <button type="button" onClick={() => setModo("unirse")} className={`rounded-full py-2 ${modo === "unirse" ? "bg-papel" : "text-suave"}`}>Soy del equipo</button>
        </div>
        <label className="etiqueta mt-5" htmlFor="nombre">Tu nombre</label>
        <input id="nombre" required className="campo" value={miNombre} onChange={(e) => setMiNombre(e.target.value)} />
        {modo === "crear" ? (
          <>
            <label className="etiqueta mt-3" htmlFor="negocio">Nombre del local</label>
            <input id="negocio" required maxLength={80} className="campo" value={negocio} onChange={(e) => setNegocio(e.target.value)} />
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-frutilla" checked={conDemo} onChange={(e) => setConDemo(e.target.checked)} />
              <span>Cargar una carta de ejemplo y 8 mesas para probar ya (después se edita o borra).</span>
            </label>
          </>
        ) : (
          <>
            <label className="etiqueta mt-3" htmlFor="codigo">Código del equipo</label>
            <input id="codigo" required className="campo uppercase tracking-widest" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Te lo pasa el dueño" />
          </>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-frutilla-osc">{error}</p>}
        <button className="btn-primario mt-5 w-full" disabled={cargando}>{cargando ? "Un momento…" : "Continuar"}</button>
        <button type="button" className="mt-3 w-full text-sm text-suave underline" onClick={async () => { await supabase().auth.signOut(); router.replace("/login"); }}>Salir</button>
      </form>
    </main>
  );
}
