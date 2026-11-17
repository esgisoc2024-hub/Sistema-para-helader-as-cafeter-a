"use client";

import { useEffect } from "react";

/**
 * Movimiento de la página de inicio:
 *  - todo lo que tenga [data-revelar] aparece suave al entrar en pantalla;
 *  - todo lo que tenga [data-paralaje="0.1"] se desplaza un poco más lento que el scroll.
 * Si la persona pidió menos movimiento en su sistema, no hace nada.
 */
export function Movimiento() {
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.add("lp-js");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll("[data-revelar]").forEach((el) => el.classList.add("lp-visto"));
      return;
    }

    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) { e.target.classList.add("lp-visto"); obs.unobserve(e.target); }
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll("[data-revelar]").forEach((el) => obs.observe(el));

    const capas = Array.from(document.querySelectorAll<HTMLElement>("[data-paralaje]"));
    let cuadro = 0;
    const mover = () => {
      cuadro = 0;
      const alto = innerHeight;
      for (const el of capas) {
        const r = el.parentElement!.getBoundingClientRect();
        const centro = r.top + r.height / 2 - alto / 2;
        el.style.transform = `translate3d(0, ${(-centro * Number(el.dataset.paralaje)).toFixed(1)}px, 0)`;
      }
    };
    const alMover = () => { if (!cuadro) cuadro = requestAnimationFrame(mover); };
    mover();
    addEventListener("scroll", alMover, { passive: true });
    addEventListener("resize", alMover);
    return () => { obs.disconnect(); removeEventListener("scroll", alMover); removeEventListener("resize", alMover); cancelAnimationFrame(cuadro); };
  }, []);
  return null;
}
