// Función "equipo": el dueño crea, cambia la contraseña o quita cuentas de su equipo.
// Usa la clave de servicio de Supabase (solo existe en el servidor), por eso no puede hacerse desde el navegador.
// Las cuentas no tienen email real: se usa <usuario>.<código del local>@equipo.mesamatch.app (ver src/lib/equipo.ts).
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const emailEquipo = (usuario: string, codigo: string) => `${usuario}.${codigo.toLowerCase()}@equipo.mesamatch.app`;
const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;
const ROLES = ["mozo", "barra"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "metodo_invalido" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quién pide: tiene que ser el dueño de un local.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: sesion, error: errSesion } = await admin.auth.getUser(token);
  if (errSesion || !sesion.user) return responder({ error: "no_autenticado" }, 401);
  const { data: yo } = await admin.from("usuarios").select("negocio_id, rol").eq("id", sesion.user.id).maybeSingle();
  if (!yo || yo.rol !== "duenio") return responder({ error: "sin_permiso" }, 403);
  const { data: negocio } = await admin.from("negocios").select("codigo_equipo").eq("id", yo.negocio_id).single();
  if (!negocio) return responder({ error: "sin_permiso" }, 403);

  let pedido: Record<string, unknown>;
  try { pedido = await req.json(); } catch { return responder({ error: "pedido_invalido" }, 400); }

  if (pedido.accion === "crear") {
    const nombre = String(pedido.nombre ?? "").trim();
    const usuario = String(pedido.usuario ?? "").trim().toLowerCase();
    const password = String(pedido.password ?? "");
    const rol = String(pedido.rol ?? "");
    if (nombre.length < 1 || nombre.length > 80) return responder({ error: "nombre_invalido" }, 400);
    if (!USUARIO_VALIDO.test(usuario)) return responder({ error: "usuario_invalido" }, 400);
    if (password.length < 6) return responder({ error: "contrasena_corta" }, 400);
    if (!ROLES.includes(rol)) return responder({ error: "rol_invalido" }, 400);

    const { data: creado, error } = await admin.auth.admin.createUser({
      email: emailEquipo(usuario, negocio.codigo_equipo), password, email_confirm: true,
      user_metadata: { nombre, creado_por_duenio: true },
    });
    if (error || !creado.user) {
      return responder({ error: /already|registered|exists/i.test(error?.message ?? "") ? "usuario_existe" : "no_se_pudo_crear" }, 400);
    }
    const { error: errFila } = await admin.from("usuarios").insert({ id: creado.user.id, negocio_id: yo.negocio_id, nombre, rol, usuario });
    if (errFila) {
      await admin.auth.admin.deleteUser(creado.user.id); // no dejar cuentas sueltas
      return responder({ error: errFila.code === "23505" ? "usuario_existe" : "no_se_pudo_crear" }, 400);
    }
    return responder({ ok: true, id: creado.user.id, usuario, codigo: negocio.codigo_equipo });
  }

  if (pedido.accion === "contrasena" || pedido.accion === "borrar") {
    const id = String(pedido.id ?? "");
    const { data: persona } = await admin.from("usuarios").select("id, negocio_id, usuario").eq("id", id).maybeSingle();
    // Solo cuentas creadas por el dueño, de su propio local, y nunca la suya.
    if (!persona || persona.negocio_id !== yo.negocio_id || id === sesion.user.id || !persona.usuario) {
      return responder({ error: "sin_permiso" }, 403);
    }
    if (pedido.accion === "contrasena") {
      const password = String(pedido.password ?? "");
      if (password.length < 6) return responder({ error: "contrasena_corta" }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      return error ? responder({ error: "no_se_pudo_cambiar" }, 400) : responder({ ok: true });
    }
    const { error } = await admin.auth.admin.deleteUser(id); // borra también su fila en "usuarios"
    return error ? responder({ error: "no_se_pudo_borrar" }, 400) : responder({ ok: true });
  }

  return responder({ error: "accion_invalida" }, 400);
});
