"use client";
// Equipo del local: el dueño crea las cuentas de sus empleados (usuario + contraseña, sin email),
// les cambia el rol, les pone una contraseña nueva o los quita.
import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/formato";
import { USUARIO_VALIDO, contrasenaSugerida } from "@/lib/equipo";
import type { Negocio, Rol, Usuario } from "@/lib/tipos";

const ROLES: { valor: Rol; texto: string; detalle: string }[] = [
  { valor: "mozo", texto: "Mozo / cajero", detalle: "Mostrador, Barra y Mesas: toma pedidos y cobra." },
  { valor: "barra", texto: "Barra / cocina", detalle: "Mostrador y Barra: prepara los pedidos." },
  { valor: "duenio", texto: "Dueño / encargado", detalle: "Todo, incluida la administración." },
];

const ERRORES: Record<string, string> = {
  usuario_existe: "Ese usuario ya existe en tu local. Probá con otro.",
  usuario_invalido: "El usuario va en minúsculas, sin espacios, de 3 a 30 letras o números.",
  contrasena_corta: "La contraseña tiene que tener al menos 6 caracteres.",
  nombre_invalido: "Escribí el nombre de la persona.",
  sin_permiso: "Solo el dueño puede hacer esto.",
};

async function llamarEquipo(cuerpo: Record<string, unknown>): Promise<{ ok: true; datos: Record<string, string> } | { ok: false; error: string }> {
  const { data, error } = await supabase().functions.invoke("equipo", { body: cuerpo });
  if (!error) return { ok: true, datos: data };
  let codigo = "";
  if (error instanceof FunctionsHttpError) {
    try { codigo = (await error.context.json()).error ?? ""; } catch {}
  }
  return { ok: false, error: ERRORES[codigo] ?? "No se pudo completar. Probá de nuevo en un momento." };
}

// "Juan Pérez" → "juan.perez"
const usuarioDesde = (nombre: string) =>
  nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "").slice(0, 30);

interface Credenciales { nombre: string; usuario: string; contrasena: string; nueva?: boolean }

export function Equipo({ negocio, yo, equipo, onCambio }: { negocio: Negocio; yo: Usuario; equipo: Usuario[]; onCambio: () => void }) {
  const [creando, setCreando] = useState(false);
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);
  const [error, setError] = useState("");

  async function cambiarRol(u: Usuario, rol: Rol) {
    setError("");
    const { error } = await supabase().from("usuarios").update({ rol }).eq("id", u.id);
    if (error) setError(mensajeError(error));
    onCambio();
  }

  async function nuevaContrasena(u: Usuario) {
    if (!confirm(`¿Darle una contraseña nueva a ${u.nombre}? La anterior deja de funcionar.`)) return;
    const contrasena = contrasenaSugerida();
    const r = await llamarEquipo({ accion: "contrasena", id: u.id, password: contrasena });
    if (!r.ok) return setError(r.error);
    setCredenciales({ nombre: u.nombre, usuario: u.usuario!, contrasena });
  }

  async function quitar(u: Usuario) {
    if (!confirm(`¿Quitar a ${u.nombre} del equipo? ${u.usuario ? "Su cuenta deja de funcionar." : "Ya no va a poder entrar a tu local."}`)) return;
    setError("");
    if (u.usuario) {
      const r = await llamarEquipo({ accion: "borrar", id: u.id });
      if (!r.ok) return setError(r.error);
    } else {
      const { error } = await supabase().from("usuarios").delete().eq("id", u.id);
      if (error) return setError(mensajeError(error));
    }
    onCambio();
  }

  return (
    <div className="tarjeta p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-titulo text-xl">Equipo</h2>
        {!creando && <button className="btn-primario px-4 py-2 text-sm" onClick={() => { setCreando(true); setCredenciales(null); }}>+ Crear usuario</button>}
      </div>
      <p className="mt-1 text-sm text-suave">Creá la cuenta de cada empleado y elegí qué puede ver. No necesitan email.</p>

      {creando && (
        <NuevoUsuario onCancelar={() => setCreando(false)} onCreado={(c) => { setCreando(false); setCredenciales({ ...c, nueva: true }); onCambio(); }} />
      )}
      {credenciales && <TarjetaCredenciales negocio={negocio} c={credenciales} onCerrar={() => setCredenciales(null)} />}
      {error && <p role="alert" className="mt-3 rounded-xl bg-rubor p-3 text-sm text-frutilla-osc">{error}</p>}

      <ul className="mt-4 divide-y divide-borde">
        {equipo.map((u) => {
          const soyYo = u.id === yo.id;
          return (
            <li key={u.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{u.nombre}{soyYo && " (vos)"}</span>
                  <span className="block text-xs text-suave">{u.usuario ? `Usuario: ${u.usuario}` : "Entra con su email"}</span>
                </span>
                <select aria-label={`Acceso de ${u.nombre}`} className="rounded-lg border border-borde bg-papel px-2 py-1.5 text-sm" value={u.rol}
                  disabled={soyYo} onChange={(e) => cambiarRol(u, e.target.value as Rol)}>
                  {ROLES.filter((r) => r.valor !== "duenio" || !u.usuario || u.rol === "duenio").map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
                </select>
              </div>
              {!soyYo && (
                <div className="mt-1.5 flex gap-4 text-xs font-bold text-suave">
                  {u.usuario && <button className="underline" onClick={() => nuevaContrasena(u)}>Contraseña nueva</button>}
                  <button className="underline" onClick={() => quitar(u)}>Quitar del equipo</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-suave">
        También pueden sumarse con su propio email: que creen una cuenta, elijan “Soy del equipo” y pongan el código <b className="font-mono">{negocio.codigo_equipo}</b>.
      </p>
    </div>
  );
}

function NuevoUsuario({ onCancelar, onCreado }: { onCancelar: () => void; onCreado: (c: Credenciales) => void }) {
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [tocado, setTocado] = useState(false);
  const [contrasena, setContrasena] = useState(contrasenaSugerida);
  const [rol, setRol] = useState<Rol>("mozo");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const u = tocado ? usuario : usuarioDesde(nombre);

  async function crear(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!USUARIO_VALIDO.test(u)) return setError(ERRORES.usuario_invalido);
    setEnviando(true);
    const r = await llamarEquipo({ accion: "crear", nombre: nombre.trim(), usuario: u, password: contrasena, rol });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onCreado({ nombre: nombre.trim(), usuario: u, contrasena });
  }

  return (
    <form onSubmit={crear} className="mt-4 animate-entrar space-y-3 rounded-xl border border-borde bg-crema p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col"><span className="etiqueta">Nombre</span>
          <input required maxLength={80} className="campo py-2" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" /></label>
        <label className="flex flex-col"><span className="etiqueta">Usuario para entrar</span>
          <input required className="campo py-2 lowercase" value={u} placeholder="juan"
            onChange={(e) => { setTocado(true); setUsuario(e.target.value.toLowerCase().replace(/\s/g, "")); }} /></label>
        <label className="flex flex-col sm:col-span-2"><span className="etiqueta">Contraseña</span>
          <span className="flex gap-2">
            <input required minLength={6} className="campo py-2 font-mono" value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
            <button type="button" className="btn-secundario shrink-0 px-3 py-2 text-sm" onClick={() => setContrasena(contrasenaSugerida())}>Otra</button>
          </span></label>
      </div>
      <fieldset>
        <legend className="etiqueta">Qué puede ver</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.filter((r) => r.valor !== "duenio").map((r) => (
            <button key={r.valor} type="button" onClick={() => setRol(r.valor)} aria-pressed={rol === r.valor}
              className={`rounded-xl border-2 p-3 text-left text-sm ${rol === r.valor ? "border-frutilla bg-rubor" : "border-borde bg-papel"}`}>
              <span className="block font-extrabold">{r.texto}</span>
              <span className="text-xs text-suave">{r.detalle}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-frutilla-osc">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secundario py-2" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primario py-2" disabled={enviando}>{enviando ? "Creando…" : "Crear usuario"}</button>
      </div>
    </form>
  );
}

function TarjetaCredenciales({ negocio, c, onCerrar }: { negocio: Negocio; c: Credenciales; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Hola ${c.nombre}! Tus datos para entrar a ${negocio.nombre}:\n` +
    `${window.location.origin}/login\nPestaña "Equipo"\nCódigo del local: ${negocio.codigo_equipo}\nUsuario: ${c.usuario}\nContraseña: ${c.contrasena}`;
  return (
    <div role="status" className="mt-4 animate-rebote rounded-xl border-2 border-menta bg-papel p-4">
      <p className="font-extrabold text-menta">{c.nueva ? `Listo, ${c.nombre} ya tiene su cuenta.` : `Contraseña nueva para ${c.nombre}.`}</p>
      <p className="text-sm text-suave">Pasale estos datos. La contraseña no se vuelve a mostrar.</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-crema p-2"><dt className="text-xs text-suave">Código del local</dt><dd className="font-mono text-lg font-bold">{negocio.codigo_equipo}</dd></div>
        <div className="rounded-lg bg-crema p-2"><dt className="text-xs text-suave">Usuario</dt><dd className="font-mono text-lg font-bold">{c.usuario}</dd></div>
        <div className="rounded-lg bg-crema p-2"><dt className="text-xs text-suave">Contraseña</dt><dd className="font-mono text-lg font-bold">{c.contrasena}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primario py-2 text-sm" onClick={async () => {
          try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch {}
        }}>{copiado ? "¡Copiado!" : "Copiar para mandar por WhatsApp"}</button>
        <button className="btn-secundario py-2 text-sm" onClick={onCerrar}>Listo</button>
      </div>
    </div>
  );
}
