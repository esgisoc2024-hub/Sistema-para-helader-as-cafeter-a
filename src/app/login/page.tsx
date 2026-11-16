"use client";

import { Fondo } from "@/components/Fondo";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/formato";

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const [registro, setRegistro] = useState(params.get("modo") === "registro");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setCargando(true);
    const sb = supabase();
    const res = registro
      ? await sb.auth.signUp({ email, password: clave })
      : await sb.auth.signInWithPassword({ email, password: clave });
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
        <Link href="/" className="text-sm font-semibold text-frutilla">Mesa Dulce</Link>
        <h1 className="mt-1 font-titulo text-2xl">{registro ? "Crear cuenta" : "Ingresar"}</h1>
        <label className="etiqueta mt-5" htmlFor="email">Email</label>
        <input id="email" type="email" required autoComplete="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="etiqueta mt-3" htmlFor="clave">Contraseña</label>
        <input id="clave" type="password" required minLength={6} autoComplete={registro ? "new-password" : "current-password"}
          className="campo" value={clave} onChange={(e) => setClave(e.target.value)} />
        {error && <p role="alert" className="mt-3 text-sm text-frutilla-osc">{error}</p>}
        {info && <p role="status" className="mt-3 text-sm text-menta">{info}</p>}
        <button className="btn-primario mt-5 w-full" disabled={cargando}>{cargando ? "Un momento…" : registro ? "Crear cuenta" : "Ingresar"}</button>
        <button type="button" className="mt-3 w-full text-sm text-suave underline" onClick={() => { setRegistro(!registro); setError(""); setInfo(""); }}>
          {registro ? "Ya tengo cuenta" : "No tengo cuenta, quiero crear una"}
        </button>
      </form>
    </main>
  );
}

export default function Login() {
  return <Suspense><Formulario /></Suspense>;
}
