// Función "suscripcion": el dueño elige un plan y se crea su suscripción mensual en Mercado Pago.
// Devuelve el link de Mercado Pago (init_point) donde el dueño autoriza el débito mensual.
// El precio sale de la base (plataforma_config), nunca del navegador.
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOMBRE_PLAN: Record<string, string> = { basico: "Básico", premium: "Premium" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "metodo_invalido" }, 405);

  const tokenMp = Deno.env.get("MP_ACCESS_TOKEN");
  if (!tokenMp) return responder({ error: "mp_no_configurado" }, 503);
  // Dirección del sistema para volver de Mercado Pago: APP_URL o, si no está, la página desde donde se pidió.
  const appUrl = (Deno.env.get("APP_URL") ?? req.headers.get("origin") ?? "").replace(/\/$/, "");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quién pide: tiene que ser el dueño de un local.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: sesion, error: errSesion } = await admin.auth.getUser(token);
  if (errSesion || !sesion.user) return responder({ error: "no_autenticado" }, 401);
  const { data: yo } = await admin.from("usuarios").select("negocio_id, rol").eq("id", sesion.user.id).maybeSingle();
  if (!yo || yo.rol !== "duenio") return responder({ error: "sin_permiso" }, 403);
  const { data: negocio } = await admin.from("negocios").select("id, nombre, estado, mp_estado").eq("id", yo.negocio_id).single();
  if (!negocio) return responder({ error: "sin_permiso" }, 403);
  if (negocio.estado === "suspendido") return responder({ error: "local_suspendido" }, 403);

  let pedido: Record<string, unknown>;
  try { pedido = await req.json(); } catch { return responder({ error: "pedido_invalido" }, 400); }
  const plan = String(pedido.plan ?? "");
  if (!(plan in NOMBRE_PLAN)) return responder({ error: "plan_invalido" }, 400);
  const email = String(pedido.email ?? sesion.user.email ?? "").trim().toLowerCase();
  if (!EMAIL_VALIDO.test(email)) return responder({ error: "email_invalido" }, 400);
  if (negocio.mp_estado === "authorized") return responder({ error: "ya_suscripto" }, 400);

  const { data: config } = await admin.from("plataforma_config").select("precio_basico, precio_premium").eq("id", 1).single();
  if (!config) return responder({ error: "sin_config" }, 500);
  const monto = Number(plan === "premium" ? config.precio_premium : config.precio_basico);

  const resp = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenMp}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: `Mesa Match · Plan ${NOMBRE_PLAN[plan]} · ${negocio.nombre}`.slice(0, 250),
      external_reference: negocio.id,
      payer_email: email,
      back_url: `${appUrl}/panel/suscripcion?mp=volvio`,
      status: "pending",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: monto, currency_id: "ARS" },
    }),
  });
  const mp = await resp.json().catch(() => ({}));
  if (!resp.ok || !mp.id || !mp.init_point) {
    console.error("Mercado Pago rechazó la suscripción", resp.status, JSON.stringify(mp));
    return responder({ error: "mp_rechazo", detalle: mp.message ?? null }, 502);
  }

  const { error } = await admin.rpc("mp_registrar_suscripcion", { p_negocio: negocio.id, p_preapproval: mp.id, p_plan: plan, p_email: email });
  if (error) return responder({ error: "no_se_pudo_guardar" }, 500);
  return responder({ ok: true, url: mp.init_point });
});
