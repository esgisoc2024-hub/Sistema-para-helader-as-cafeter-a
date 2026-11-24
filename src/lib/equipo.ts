// Cuentas del equipo creadas por el dueño: se inicia sesión con código del local + usuario + contraseña.
// Debe coincidir con supabase/functions/equipo/index.ts.
export const emailEquipo = (usuario: string, codigo: string) =>
  `${usuario.trim().toLowerCase()}.${codigo.trim().toLowerCase()}@equipo.mesamatch.app`;

export const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;

/** Contraseña fácil de dictar: 3 letras + 4 números (ej: "mar4821"). */
export function contrasenaSugerida() {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const n = crypto.getRandomValues(new Uint32Array(7));
  return Array.from(n.slice(0, 3), (x) => letras[x % letras.length]).join("") + Array.from(n.slice(3), (x) => x % 10).join("");
}
