// Un solo "parlante" para todo el panel. Los navegadores (sobre todo iPad y iPhone) no dejan sonar
// nada hasta que la persona toca la pantalla: se crea apenas carga y se destraba con el primer toque.

let audio: AudioContext | null = null;
const avisar = new Set<() => void>();

export function prepararAudio() {
  if (typeof window === "undefined") return;
  try { audio ??= new AudioContext(); } catch { return; }
  if (audio.state === "running") return;
  const destrabar = () => {
    audio?.resume().then(() => {
      if (audio?.state !== "running") return;
      ["pointerdown", "keydown", "touchstart"].forEach((e) => window.removeEventListener(e, destrabar, true));
      avisar.forEach((f) => f());
    }).catch(() => {});
  };
  ["pointerdown", "keydown", "touchstart"].forEach((e) => window.addEventListener(e, destrabar, true));
}

export const audioListo = () => audio?.state === "running";

export function alHabilitarAudio(f: () => void) {
  avisar.add(f);
  return () => { avisar.delete(f); };
}

function tonos(notas: { f: number; t: number; dur: number; vol?: number }[]) {
  if (!audio) return;
  try {
    if (audio.state === "suspended") audio.resume();
    const base = audio.currentTime + 0.02;
    for (const n of notas) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = "sine";
      o.frequency.value = n.f;
      o.connect(g); g.connect(audio.destination);
      const t = base + n.t;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(n.vol ?? 0.4, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
      o.start(t); o.stop(t + n.dur + 0.02);
    }
  } catch {}
}

/** Comanda nueva: campanita "ding-dong" (dos veces, para que se oiga con el salón lleno). */
export function campanaComanda() {
  tonos([
    { f: 1318, t: 0, dur: 0.6 }, { f: 2636, t: 0, dur: 0.25, vol: 0.08 },
    { f: 988, t: 0.28, dur: 0.8 },
    { f: 1318, t: 1.0, dur: 0.6 }, { f: 988, t: 1.28, dur: 0.9 },
  ]);
}

/** Una mesa llama: tres toques rápidos y agudos, distintos de la comanda. */
export function campanaLlamado() {
  tonos([0, 0.16, 0.32, 0.7, 0.86, 1.02].map((t, i) => ({ f: i % 3 === 2 ? 1760 : 1568, t, dur: 0.14, vol: 0.45 })));
}
