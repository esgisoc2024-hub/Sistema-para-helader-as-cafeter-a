// Función "mercadopago": recibe los avisos (webhooks) de Mercado Pago sobre las suscripciones.
// Se publica sin verificación de JWT (Mercado Pago no manda uno): ver config.toml y el README.
// No confía en el contenido del aviso: vuelve a consultar la suscripción a Mercado Pago con el token propio.
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const ok = (cuerpo: unknown = { ok: true }, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

async function hmacHex(secreto: string, texto: string) {
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(texto));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Firma de Mercado Pago: header x-signature "ts=...,v1=..." sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
async function firmaValida(req: Request, dataId: string, secreto: string) {
  const partes = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((p) => p.trim().split("=", 2)));
  if (!partes.ts || !partes.v1) return false;
  const requestId = req.headers.get("x-request-id") ?? "";
  const plantilla = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${partes.ts};`;
  return (await hmacHex(secreto, plantilla)) === partes.v1;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok({ ok: true });
  const tokenMp = Deno.env.get("MP_ACCESS_TOKEN");
  if (!tokenMp) return ok({ error: "mp_no_configurado" }, 503);

  const url = new URL(req.url);
  let cuerpo: Record<string, unknown> = {};
  try { cuerpo = await req.json(); } catch { /* algunos avisos vienen solo por query */ }
  const tipo = String(cuerpo.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
  const dataId = String((cuerpo.data as { id?: string } | undefined)?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!dataId) return ok({ ignorado: true });

  const secreto = Deno.env.get("MP_WEBHOOK_SECRET");
  if (secreto && !(await firmaValida(req, dataId, secreto))) return ok({ error: "firma_invalida" }, 401);

  const mp = (ruta: string) =>
    fetch(`https://api.mercadopago.com${ruta}`, { headers: { Authorization: `Bearer ${tokenMp}` } }).then((r) => r.ok ? r.json() : null);

  // Llegamos siempre a la suscripción (preapproval), sea el aviso de la suscripción o de uno de sus cobros.
  let preapprovalId: string | null = null;
  if (tipo === "subscription_preapproval" || tipo === "preapproval") preapprovalId = dataId;
  else if (tipo === "subscription_authorized_payment" || tipo === "authorized_payment") {
    const cobro = await mp(`/authorized_payments/${encodeURIComponent(dataId)}`);
    preapprovalId = cobro?.preapproval_id ?? null;
  } else return ok({ ignorado: tipo });
  if (!preapprovalId) return ok({ ignorado: "sin_suscripcion" });

  const sus = await mp(`/preapproval/${encodeURIComponent(preapprovalId)}`);
  if (!sus) return ok({ error: "no_se_pudo_consultar" }, 502); // Mercado Pago reintenta

  const proximo = typeof sus.next_payment_date === "string" ? sus.next_payment_date.slice(0, 10) : null;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc("mp_sincronizar", { p_preapproval: sus.id, p_estado: sus.status, p_proximo: proximo });
  if (error) { console.error(error); return ok({ error: "no_se_pudo_guardar" }, 500); }

  // Si hubo un pago nuevo o una baja, se manda el mail a la administradora en el momento.
  const avisosUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/avisos`;
  const secretoAvisos = Deno.env.get("AVISOS_SECRETO");
  if (secretoAvisos) {
    await fetch(avisosUrl, { method: "POST", headers: { "x-avisos-secreto": secretoAvisos } }).catch(() => null);
  }
  return ok({ ok: true, resultado: data });
});
