"use client";

import { Fondo } from "@/components/Fondo";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/formato";
import { emailEquipo } from "@/lib/equipo";

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const [registro, setRegistro] = useState(params.get("modo") === "registro");
  // "equipo": empleados con usuario creado por el dueño (código del local + usuario + contraseña).
  const [modo, setModo] = useState<"duenio" | "equipo">(params.get("modo") === "equipo" ? "equipo" : "duenio");
  const [codigo, setCodigo] = useState("");
  const [usuario, setUsuario] = useState("");

  // La tablet del local recuerda el código para no tipearlo cada vez.
  useEffect(() => {
    try {
      const c = localStorage.getItem("codigo-local");
      if (c) { setCodigo(c); if (params.get("modo") !== "registro") setModo("equipo"); }
    } catch {}
  }, [params]);
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setCargando(true);
    const sb = supabase();
    const equipo = modo === "equipo" && !registro;
    const res = registro
      ? await sb.auth.signUp({ email, password: clave })
      : await sb.auth.signInWithPassword({ email: equipo ? emailEquipo(usuario, codigo) : email, password: clave });
    if (equipo && res.error?.message.includes("Invalid login credentials")) {
      setCargando(false);
      return setError("El código, el usuario o la contraseña no coinciden. Si no te acordás, pedile al dueño una contraseña nueva.");
    }
    if (equipo && !res.error) { try { localStorage.setItem("codigo-local", codigo.trim().toUpperCase()); } catch {} }
    setCargando(false);
    if (res.error) return setError(mensajeError(res.error));
    if (registro && !res.data.session) {
      return setInfo("Te mandamos un email para confirmar la cuenta. Después volvé e ingresá.");
    }
    router.replace("/panel");
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Fondo />
      <form onSubmit={enviar} className="tarjeta w-full max-w-sm p-6">
        <Link href="/" className="text-sm font-semibold text-frutilla">Mesa Match</Link>
        <h1 className="mt-1 font-titulo text-2xl">{registro ? "Crear cuenta" : "Ingresar"}</h1>
        {!registro && (
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-borde/60 p-1 text-sm font-bold" role="tablist" aria-label="Tipo de cuenta">
            {(["duenio", "equipo"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => { setModo(m); setError(""); }}
                className={`rounded-full py-2 ${modo === m ? "bg-papel shadow-sm" : "text-suave"}`}>
                {m === "duenio" ? "Dueño" : "Equipo"}
              </button>
            ))}
          </div>
        )}
        {modo === "equipo" && !registro ? (
          <>
            <label className="etiqueta mt-5" htmlFor="codigo">Código del local</label>
            <input id="codigo" required className="campo font-mono uppercase tracking-widest" value={codigo} maxLength={10}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Te lo da el dueño" autoComplete="organization" />
            <label className="etiqueta mt-3" htmlFor="usuario">Usuario</label>
            <input id="usuario" required className="campo lowercase" value={usuario} autoComplete="username" autoCapitalize="none"
              onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ""))} />
          </>
        ) : (
          <>
            <label className="etiqueta mt-5" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
          </>
        )}
        <label className="etiqueta mt-3" htmlFor="clave">Contraseña</label>
        <input id="clave" type="password" required minLength={6} autoComplete={registro ? "new-password" : "current-password"}
          className="campo" value={clave} onChange={(e) => setClave(e.target.value)} />
        {error && <p role="alert" className="mt-3 text-sm text-frutilla-osc">{error}</p>}
        {info && <p role="status" className="mt-3 text-sm text-menta">{info}</p>}
        <button className="btn-primario mt-5 w-full" disabled={cargando}>{cargando ? "Un momento…" : registro ? "Crear cuenta" : "Ingresar"}</button>
        {(modo === "duenio" || registro) && (
          <button type="button" className="mt-3 w-full text-sm text-suave underline" onClick={() => { setRegistro(!registro); setError(""); setInfo(""); }}>
            {registro ? "Ya tengo cuenta" : "No tengo cuenta, quiero crear una"}
          </button>
        )}
        {modo === "equipo" && !registro && <p className="mt-3 text-center text-xs text-suave">Tu usuario y contraseña te los da el dueño del local.</p>}
      </form>
    </main>
  );
}

export default function Login() {
  return <Suspense><Formulario /></Suspense>;
}
