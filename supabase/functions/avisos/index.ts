// Función "avisos": manda por email (Resend) los avisos pendientes de prueba, pagos y bajas.
// La llama el cron diario (y el webhook de Mercado Pago) con el header x-avisos-secreto.
// Si todavía no hay RESEND_API_KEY / AVISOS_REMITENTE, no manda nada y los avisos quedan esperando (hasta 7 días).
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

interface Aviso {
  id: number; tipo: string; negocio: string; telefono: string | null; plan_solicitado: string | null; mp_plan: string | null;
  prueba_hasta: string | null; gracia_hasta: string | null; pagado_hasta: string | null; referencia: string;
  email_duenio: string | null; duenio: string | null; email_admin: string; precios: { basico: number; premium: number };
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" }) : "";
const pesos = (n: number) => "$" + Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
const plan = (p: string | null) => (p === "premium" ? "Premium" : "Básico");
const esc = (s: string | null) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function html(titulo: string, parrafos: string[], boton?: { texto: string; url: string }) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2b211c">
  <h2 style="color:#c8203f">${titulo}</h2>
  ${parrafos.map((p) => `<p style="font-size:15px;line-height:1.5">${p}</p>`).join("")}
  ${boton ? `<p style="margin:28px 0"><a href="${boton.url}" style="background:#c8203f;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${boton.texto}</a></p>` : ""}
  <p style="font-size:12px;color:#8a7d76">Mesa Match</p></div>`;
}

function armar(a: Aviso, appUrl: string): { para: string; asunto: string; cuerpo: string } | null {
  const planes = `Básico ${pesos(a.precios.basico)} o Premium ${pesos(a.precios.premium)} por mes`;
  const suscribirse = { texto: "Elegir mi plan", url: `${appUrl}/panel/suscripcion` };
  switch (a.tipo) {
    case "por_vencer":
      if (!a.email_duenio) return null;
      return { para: a.email_duenio, asunto: `Tu prueba de Mesa Match termina el ${fecha(a.prueba_hasta)}`,
        cuerpo: html(`Hola ${esc(a.duenio)}, tu prueba está por terminar`, [
          `La prueba gratis de <b>${esc(a.negocio)}</b> termina el <b>${fecha(a.prueba_hasta)}</b>.`,
          `Para seguir usando la carta QR, la barra y todo lo que ya cargaste, elegí tu plan: ${planes}. Se paga con Mercado Pago, mes a mes y sin permanencia.`,
        ], suscribirse) };
    case "vencio":
      if (!a.email_duenio) return null;
      return { para: a.email_duenio, asunto: "Terminó tu prueba de Mesa Match",
        cuerpo: html(`Terminó tu prueba gratis`, [
          `La prueba de <b>${esc(a.negocio)}</b> terminó el ${fecha(a.prueba_hasta)}. Tu carta QR sigue andando hasta el <b>${fecha(a.gracia_hasta)}</b>; después se pausa hasta que elijas un plan.`,
          `Planes: ${planes}. No perdés nada de lo que cargaste.`,
        ], suscribirse) };
    case "vencio_admin":
      return { para: a.email_admin, asunto: `Terminó la prueba de ${a.negocio}`,
        cuerpo: html(`Terminó la prueba de ${esc(a.negocio)}`, [
          `Dueño: ${esc(a.duenio)} · ${esc(a.email_duenio)}${a.telefono ? ` · WhatsApp ${esc(a.telefono)}` : ""}`,
          `Pidió el plan ${plan(a.plan_solicitado)} al registrarse. La carta se pausa el ${fecha(a.gracia_hasta)} si no se suscribe.`,
        ], { texto: "Ver en Mis locales", url: `${appUrl}/admin` }) };
    case "pago_admin":
      return { para: a.email_admin, asunto: `Pago recibido: ${a.negocio} (${plan(a.mp_plan)})`,
        cuerpo: html(`${esc(a.negocio)} pagó su plan ${plan(a.mp_plan)}`, [
          `Mercado Pago aprobó el cobro. Queda activo hasta el ${fecha(a.referencia)}.`,
          `Dueño: ${esc(a.duenio)} · ${esc(a.email_duenio)}${a.telefono ? ` · WhatsApp ${esc(a.telefono)}` : ""}`,
        ], { texto: "Ver en Mis locales", url: `${appUrl}/admin` }) };
    case "baja_admin":
      return { para: a.email_admin, asunto: `${a.negocio} canceló o pausó su suscripción`,
        cuerpo: html(`${esc(a.negocio)} dio de baja su suscripción`, [
          `Mercado Pago informa la suscripción como "${esc(a.referencia.split(":")[0])}". Sigue activo hasta ${a.pagado_hasta ? `el ${fecha(a.pagado_hasta)}` : "su último pago"} y después entra en los días de gracia.`,
          `Dueño: ${esc(a.duenio)} · ${esc(a.email_duenio)}${a.telefono ? ` · WhatsApp ${esc(a.telefono)}` : ""}`,
        ], { texto: "Ver en Mis locales", url: `${appUrl}/admin` }) };
  }
  return null;
}

Deno.serve(async (req) => {
  const secreto = Deno.env.get("AVISOS_SECRETO");
  if (!secreto || req.headers.get("x-avisos-secreto") !== secreto) return responder({ error: "sin_permiso" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc("avisos_pendientes");
  if (error) return responder({ error: "no_se_pudo_leer" }, 500);
  const pendientes = (data ?? []) as Aviso[];

  const claveResend = Deno.env.get("RESEND_API_KEY");
  const remitente = Deno.env.get("AVISOS_REMITENTE"); // ej: "Mesa Match <avisos@tudominio.com>"
  if (!claveResend || !remitente) return responder({ pendientes: pendientes.length, enviados: 0, motivo: "resend_sin_configurar" });
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

  let enviados = 0;
  for (const a of pendientes) {
    const mail = armar(a, appUrl);
    if (!mail) { await admin.rpc("marcar_aviso_enviado", { p_id: a.id }); continue; }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${claveResend}`, "Content-Type": "application/json", "Idempotency-Key": `aviso-${a.id}` },
      body: JSON.stringify({ from: remitente, to: [mail.para], subject: mail.asunto, html: mail.cuerpo }),
    });
    if (r.ok) { await admin.rpc("marcar_aviso_enviado", { p_id: a.id }); enviados++; }
    else console.error("Resend rechazó el aviso", a.id, r.status, await r.text());
  }
  return responder({ pendientes: pendientes.length, enviados });
});
