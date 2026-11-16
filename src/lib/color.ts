// Ayudantes para el color de marca de cada local.

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexDe = (c: number[]) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

export function oscurecer(hex: string, cuanto = 0.18) {
  return hexDe(rgb(hex).map((v) => v * (1 - cuanto)));
}

function luminancia(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste del color con texto blanco (4.5 o más se lee bien; menos de 3 se lee mal). */
export const contrasteConBlanco = (hex: string) => 1.05 / (luminancia(hex) + 0.05);

/** Si el color es muy claro para letras blancas, lo oscurece hasta que se lea. */
export function colorLegible(hex: string) {
  let c = hex;
  for (let i = 0; i < 10 && contrasteConBlanco(c) < 3.5; i++) c = oscurecer(c, 0.12);
  return c;
}

/** Variables CSS que reemplazan el color principal del sistema por el del local. */
export function estiloMarca(hex: string | null | undefined): React.CSSProperties | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  const base = colorLegible(hex);
  return { ["--color-frutilla" as string]: base, ["--color-frutilla-osc" as string]: oscurecer(base) };
}

export const COLORES_SUGERIDOS = [
  { nombre: "Frutilla", hex: "#d94a64" }, { nombre: "Chocolate", hex: "#6b3e26" },
  { nombre: "Pistacho", hex: "#4f8a3c" }, { nombre: "Menta", hex: "#2f9e7a" },
  { nombre: "Arándano", hex: "#4b4fb8" }, { nombre: "Uva", hex: "#7b3fa0" },
  { nombre: "Naranja", hex: "#d9661f" }, { nombre: "Café", hex: "#3d2b1f" },
];
