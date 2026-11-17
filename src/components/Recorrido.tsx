"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";

export interface Momento {
  sobre: string; titulo: string; texto: string; foto: StaticImageData; alt: string;
  pantalla: "carta" | "sabores" | "enviado" | "barra";
}

/**
 * "Un pedido en cuatro tiempos": la sección queda fija mientras se desliza; la foto de fondo,
 * el texto y la pantalla del celular avanzan juntos. En celular y con movimiento reducido
 * se muestra igual, solo que más simple.
 */
export function Recorrido({ momentos }: { momentos: Momento[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const [paso, setPaso] = useState(0);
  const [avance, setAvance] = useState(0);

  useEffect(() => {
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const r = caja.current?.getBoundingClientRect();
      if (!r) return;
      const total = r.height - innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / total));
      setAvance(p);
      setPaso(Math.min(momentos.length - 1, Math.floor(p * momentos.length * 0.999)));
    };
    const alMover = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    medir();
    addEventListener("scroll", alMover, { passive: true });
    addEventListener("resize", alMover);
    return () => { removeEventListener("scroll", alMover); removeEventListener("resize", alMover); cancelAnimationFrame(cuadro); };
  }, [momentos.length]);

  const m = momentos[paso];
  return (
    <div ref={caja} className="lp-recorrido" style={{ height: `${momentos.length * 100 + 40}vh` }}>
      <div className="lp-recorrido-fijo">
        {momentos.map((x, i) => (
          <div key={x.titulo} aria-hidden className={`lp-recorrido-foto ${i === paso ? "lp-activa" : ""}`}>
            <Image src={x.foto} alt="" sizes="100vw" className="h-full w-full object-cover" />
          </div>
        ))}
        <div aria-hidden className="lp-recorrido-velo" />

        <div className="relative z-10 mx-auto grid h-full max-w-6xl items-center gap-8 px-4 md:grid-cols-[1fr_auto_1fr]">
          <div key={m.titulo} className="lp-recorrido-texto">
            <p className="lp-sobre text-[var(--lp-laton)]">{String(paso + 1).padStart(2, "0")} — {m.sobre}</p>
            <h3 className="lp-titulo mt-3 text-4xl leading-tight text-white sm:text-5xl">{m.titulo}</h3>
            <p className="mt-4 max-w-sm text-lg leading-relaxed text-white/75">{m.texto}</p>
          </div>

          <Telefono pantalla={m.pantalla} />

          <ol className="hidden justify-self-end md:block" aria-label="Pasos">
            {momentos.map((x, i) => (
              <li key={x.titulo} className={`lp-recorrido-indice ${i === paso ? "lp-activa" : ""}`}>
                <span>{String(i + 1).padStart(2, "0")}</span>{x.sobre}
              </li>
            ))}
          </ol>
        </div>
        <div aria-hidden className="lp-recorrido-barra"><span style={{ transform: `scaleX(${avance})` }} /></div>
      </div>
    </div>
  );
}

function Telefono({ pantalla }: { pantalla: Momento["pantalla"] }) {
  return (
    <div aria-hidden className="lp-telefono">
      <div className="lp-telefono-isla" />
      <div key={pantalla} className="lp-telefono-pantalla">
        {pantalla === "carta" && (
          <>
            <p className="lp-titulo text-lg">Heladería Demo</p>
            <p className="text-[11px] text-[var(--lp-suave)]">Mesa 4 · Elegí lo que quieras</p>
            <div className="mt-3 flex gap-1.5 text-[10px] font-bold">
              {["Helados", "Cafés", "Pastelería"].map((c, i) => <span key={c} className={`rounded-full px-2.5 py-1 ${i === 0 ? "bg-[var(--lp-espresso)] text-white" : "bg-[var(--lp-lino)]"}`}>{c}</span>)}
            </div>
            {[["Cucurucho", "$ 4.200", "#e9c9a0"], ["Vasito 1/4 kg", "$ 6.000", "#c98f6b"], ["Copa de la casa", "$ 8.900", "#f1e2b8"], ["Affogato", "$ 5.400", "#6b4a35"]].map(([n, p, c], i) => (
              <div key={n} className="lp-fila" style={{ animationDelay: `${0.1 + i * 0.09}s` }}>
                <span className="h-9 w-9 shrink-0 rounded-xl" style={{ background: c }} />
                <span className="flex-1"><b className="block text-[12px]">{n}</b><span className="text-[11px] text-[var(--lp-terracota)]">{p}</span></span>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--lp-espresso)] text-[12px] text-white">+</span>
              </div>
            ))}
          </>
        )}
        {pantalla === "sabores" && (
          <>
            <p className="lp-titulo text-lg">Vasito 1/4 kg</p>
            <p className="text-[11px] text-[var(--lp-suave)]">Elegí hasta 3 sabores</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] font-bold">
              {["Pistacho", "Dulce de leche", "Limón", "Chocolate amargo", "Frutilla", "Sambayón"].map((s, i) => (
                <span key={s} className={`lp-fila rounded-xl px-2 py-2 ${[0, 1, 4].includes(i) ? "lp-sabor-elegido" : "bg-[var(--lp-lino)]"}`} style={{ animationDelay: `${i * 0.07}s` }}>
                  {[0, 1, 4].includes(i) ? "✓ " : ""}{s}
                </span>
              ))}
            </div>
            <div className="mt-auto rounded-full bg-[var(--lp-espresso)] py-2.5 text-center text-[12px] font-bold text-white">Agregar · $ 6.000</div>
          </>
        )}
        {pantalla === "enviado" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="lp-check">✓</span>
            <p className="lp-titulo mt-4 text-xl">¡Pedido enviado!</p>
            <p className="mt-1 text-[11px] text-[var(--lp-suave)]">La barra ya lo está viendo</p>
            <div className="mt-5 w-full space-y-1.5 text-left text-[11px]">
              {[["Recibido", true], ["Preparando", true], ["En camino a tu mesa", false]].map(([t, ok]) => (
                <p key={t as string} className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${ok ? "bg-[var(--lp-salvia)]" : "bg-[var(--lp-linea)]"}`} />{t as string}</p>
              ))}
            </div>
          </div>
        )}
        {pantalla === "barra" && (
          <>
            <div className="flex items-center justify-between"><p className="lp-titulo text-lg">Barra</p><span className="lp-campanita text-lg">🔔</span></div>
            <div className="lp-fila mt-3 flex-col items-start rounded-2xl bg-[var(--lp-terracota)] p-3 text-white">
              <b className="lp-titulo text-lg leading-none">Mesa 4</b><span className="text-[11px]">Comanda nueva · recién</span>
            </div>
            <div className="lp-fila mt-2 flex-col items-start rounded-2xl bg-white p-3 text-[11px]" style={{ animationDelay: ".15s" }}>
              <b>1 × Vasito 1/4 kg</b><span className="text-[var(--lp-suave)]">Pistacho · Dulce de leche · Frutilla</span>
            </div>
            <div className="lp-fila mt-2 flex-col items-start rounded-2xl bg-[var(--lp-espresso)] p-3 text-white" style={{ animationDelay: ".3s" }}>
              <b className="text-[12px]">✋ Mesa 9 llama al mozo</b><span className="text-[11px] text-white/70">hace 1 min</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
