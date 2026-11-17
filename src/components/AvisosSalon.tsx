"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { minutosDesde } from "@/lib/formato";
import { campanaComanda, campanaLlamado, prepararAudio, audioListo, alHabilitarAudio } from "@/lib/campana";
import type { Mesa } from "@/lib/tipos";

/**
 * Avisos de todo el panel (barra, mozos y dueño), en cualquier pantalla:
 *  - La campanita de comandas está SIEMPRE activa: suena con cada pedido nuevo y vuelve a sonar
 *    cada minuto mientras haya pedidos sin empezar hace más de 3 minutos.
 *  - Cuando una mesa llama al mozo o pide la cuenta, aparece un cartel grande arriba de todo,
 *    con un sonido distinto que se repite cada 20 segundos hasta que alguien toca "Voy".
 * Los navegadores no dejan sonar nada hasta el primer toque en la pantalla: mientras tanto se muestra
 * un aviso para tocar una vez, y desde ahí queda habilitado mientras la pestaña siga abierta.
 */
export function AvisosSalon({ negocioId }: { negocioId: string }) {
  const [llamando, setLlamando] = useState<Mesa[]>([]);
  const [conAudio, setConAudio] = useState(true);
  const [ahora, setAhora] = useState(Date.now());
  const pedidosConocidos = useRef<Set<string> | null>(null);
  const llamadosConocidos = useRef<Set<string> | null>(null);
  const esperando = useRef<{ id: string; creado_at: string }[]>([]);

  const revisar = useCallback(async () => {
    const sb = supabase();
    const desde = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const [p, m] = await Promise.all([
      sb.from("pedidos").select("id, creado_at").eq("estado", "nuevo").gte("creado_at", desde),
      sb.from("mesas").select("*").eq("activa", true).not("llamado_at", "is", null).order("llamado_at"),
    ]);
    if (p.error || m.error) return;

    const nuevos = p.data ?? [];
    if (pedidosConocidos.current && nuevos.some((x) => !pedidosConocidos.current!.has(x.id))) {
      campanaComanda();
      vibrar([200, 100, 200]);
    }
    pedidosConocidos.current = new Set([...(pedidosConocidos.current ?? []), ...nuevos.map((x) => x.id)]);
    esperando.current = nuevos;

    const mesas = (m.data ?? []) as Mesa[];
    const clave = (x: Mesa) => `${x.id}:${x.llamado_at}:${x.estado}`;
    if (llamadosConocidos.current && mesas.some((x) => !llamadosConocidos.current!.has(clave(x)))) {
      campanaLlamado();
      vibrar([400, 150, 400]);
    }
    llamadosConocidos.current = new Set(mesas.map(clave));
    setLlamando(mesas);
  }, []);

  // Tiempo real + respaldo cada 15 s por si se corta la conexión.
  useEffect(() => {
    revisar();
    const sb = supabase();
    const canal = sb.channel(`avisos-${negocioId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `negocio_id=eq.${negocioId}` }, () => revisar())
      .on("postgres_changes", { event: "*", schema: "public", table: "mesas", filter: `negocio_id=eq.${negocioId}` }, () => revisar())
      .subscribe();
    const respaldo = setInterval(revisar, 15000);
    return () => { sb.removeChannel(canal); clearInterval(respaldo); };
  }, [negocioId, revisar]);

  // Recordatorios mientras haya algo sin atender.
  useEffect(() => {
    const llamados = setInterval(() => { if (llamadosConocidos.current?.size) campanaLlamado(); }, 20000);
    const comandas = setInterval(() => {
      if (esperando.current.some((p) => minutosDesde(p.creado_at) >= 3)) campanaComanda();
    }, 60000);
    const reloj = setInterval(() => setAhora(Date.now()), 15000);
    return () => { clearInterval(llamados); clearInterval(comandas); clearInterval(reloj); };
  }, []);

  // El sonido se habilita solo con el primer toque en cualquier parte de la pantalla.
  useEffect(() => {
    prepararAudio();
    setConAudio(audioListo());
    return alHabilitarAudio(() => setConAudio(true));
  }, []);

  // La tablet de la barra no se apaga mientras el panel está abierto.
  useEffect(() => {
    let bloqueo: { release: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === "visible") bloqueo = await wl.request("screen");
      } catch {}
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => { document.removeEventListener("visibilitychange", pedir); bloqueo?.release().catch(() => {}); };
  }, []);

  // El título de la pestaña también avisa.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) 🔔 /, "");
    document.title = llamando.length ? `(${llamando.length}) 🔔 ${base}` : base;
  }, [llamando.length]);

  async function atender(mesa: Mesa) {
    setLlamando((l) => l.filter((x) => x.id !== mesa.id));
    llamadosConocidos.current?.forEach((k) => { if (k.startsWith(`${mesa.id}:`)) llamadosConocidos.current!.delete(k); });
    await supabase().from("mesas").update({ llamado_at: null }).eq("id", mesa.id);
  }

  return (
    <>
      {!conAudio && (
        <button type="button" onClick={() => setConAudio(true)}
          className="no-imprimir fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-choco px-4 py-3 text-left text-white shadow-2xl">
          <span aria-hidden className="animate-latir text-2xl">🔔</span>
          <span className="text-sm"><b className="block">Tocá acá para habilitar la campanita</b>
            El navegador pide un toque antes de dejar sonar los avisos de comandas y mesas.</span>
        </button>
      )}

      {llamando.length > 0 && (
        <div role="alert" aria-live="assertive" className="no-imprimir pointer-events-none fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-2 px-3">
          {llamando.map((m) => {
            const cuenta = m.estado === "pide_cuenta";
            const min = m.llamado_at ? minutosDesde(m.llamado_at, ahora) : 0;
            return (
              <div key={m.id}
                className={`aviso-mesa pointer-events-auto flex w-full max-w-xl items-center gap-4 rounded-3xl px-5 py-4 text-white shadow-2xl ${cuenta ? "bg-choco" : "bg-frutilla"}`}>
                <span aria-hidden className="aviso-campana grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15 text-3xl">
                  {cuenta ? "🧾" : "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-titulo text-3xl leading-none">Mesa {m.numero}</p>
                  <p className="mt-1 font-bold text-white/90">
                    {cuenta ? "Pide la cuenta" : "Llama al mozo"} · {min < 1 ? "recién" : `hace ${min} min`}
                  </p>
                </div>
                <button type="button" onClick={() => atender(m)}
                  className="btn shrink-0 bg-white px-6 py-3 text-lg text-tinta hover:bg-crema">Voy</button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function vibrar(patron: number[]) {
  try { navigator.vibrate?.(patron); } catch {}
}
