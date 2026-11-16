const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
export const precio = (n: number) => pesos.format(Number(n));

export function minutosDesde(iso: string, ahora = Date.now()) {
  return Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000));
}

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

// Traduce los errores de las funciones SQL a mensajes para el cliente.
export function mensajeError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (m.startsWith("sin_stock:")) return `Se acaba de agotar: ${m.split(":")[1]}. Sacalo del pedido.`;
  if (m.startsWith("demasiados_sabores")) return "Elegiste más sabores de los permitidos.";
  if (m.includes("sabor_sin_stock")) return "Uno de los sabores se acaba de agotar. Elegí otro.";
  if (m.includes("demasiados_pedidos")) return "Hiciste muchos pedidos seguidos. Esperá un momento.";
  if (m.includes("mesa_invalida")) return "Este QR no corresponde a una mesa activa.";
  if (m.includes("codigo_invalido")) return "El código del equipo no existe. Pedíselo al dueño.";
  if (m.includes("ya_tiene_negocio")) return "Tu usuario ya pertenece a un negocio.";
  if (m.includes("sin_permiso")) return "No tenés permiso para hacer esto.";
  if (m.includes("Invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("User already registered")) return "Ese email ya tiene cuenta. Ingresá.";
  return "Algo salió mal. Probá de nuevo.";
}

export const ETIQUETA_ESTADO: Record<string, string> = {
  nuevo: "Recibido", preparando: "Preparando", listo: "Listo", entregado: "Entregado", cancelado: "Cancelado",
};
