// Tipos y textos compartidos del módulo de administración.

export const CATEGORIAS_GASTO = {
  alquiler: "Alquiler", servicios: "Servicios (luz, gas, agua, internet)", impuestos: "Impuestos",
  sueldos: "Sueldos", proveedores: "Proveedores", mantenimiento: "Mantenimiento", otros: "Otros",
} as const;
export type CategoriaGasto = keyof typeof CATEGORIAS_GASTO;
export const nombreCategoria = (c: string) => (CATEGORIAS_GASTO[c as CategoriaGasto] ?? c).replace(/ \(.*\)$/, "");

export const MEDIOS_PAGO: Record<string, string> = { efectivo: "Efectivo", qr: "QR / MP", tarjeta: "Tarjeta", transferencia: "Transferencia" };
/** Medios que pueden aparecer en las ventas (incluye las mesas fiadas). */
export const MEDIOS_VENTA: Record<string, string> = { ...MEDIOS_PAGO, fiado: "Fiado" };

export interface CobroDeuda { id: string; fecha: string; monto: number; medio: string; borrable: boolean }
export interface Deuda { id: string; concepto: string; monto: number; fecha: string; vence: string | null; saldo: number; de_mesa: boolean; cobros: CobroDeuda[] }
export interface Deudor {
  id: string; nombre: string; contacto: string | null; notas: string | null; saldo: number; vencido: boolean;
  ultima_deuda: string | null; ultimo_cobro: string | null; deudas: Deuda[];
}

export interface PagoGasto { id: string; fecha: string; monto: number; medio: string; borrable: boolean }
export interface CuentaPagar {
  id: string; categoria: CategoriaGasto; concepto: string; monto: number; fecha: string; vence: string;
  proveedor_id: string | null; proveedor: string | null; fijo_id: string | null;
  pagado: number; saldo: number; estado: "pagado" | "vencido" | "por_vencer" | "pendiente"; pagos: PagoGasto[];
}
export interface ItemProveedor { id: string; nombre: string; unidad: string | null; costo: number; updated_at: string }
export interface Proveedor {
  id: string; nombre: string; contacto: string | null; plazo_dias: number; notas: string | null; activo: boolean;
  items: ItemProveedor[]; deuda: number; ultima_compra: string | null; ultimo_pago: string | null; proximo_vencimiento: string | null;
}

export const TIPOS_COMISION = {
  ninguna: "Sin comisión",
  cobrado: "% de lo que cobró él",
  ventas_total: "% de las ventas del local",
  fijo: "Monto fijo por mes",
} as const;
export type TipoComision = keyof typeof TIPOS_COMISION;

export interface Liquidacion {
  id: string; total: number; comision: number; base_comision: number; sueldo_base: number;
  adicionales: number; descuentos: number; nota: string | null; gasto_id: string | null; vence: string | null; pagado: number;
}
export interface Empleado {
  id: string; nombre: string; puesto: string | null; contacto: string | null; usuario_id: string | null; cuenta: string | null;
  sueldo_base: number; comision_tipo: TipoComision; comision_valor: number; fecha_ingreso: string | null; activo: boolean;
  calculo: { sueldo_base: number; base_comision: number; comision: number; total: number; sin_cuenta: boolean };
  liquidacion: Liquidacion | null;
}

/** Fecha local de hoy (AAAA-MM-DD). */
export const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const fechaCorta = (d: string) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

/** "vence hoy", "venció hace 3 días", "vence en 5 días". */
export function cuandoVence(vence: string) {
  const dias = Math.round((new Date(vence + "T12:00:00").getTime() - new Date(hoyISO() + "T12:00:00").getTime()) / 864e5);
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias === -1) return "venció ayer";
  return dias < 0 ? `venció hace ${-dias} días` : `vence en ${dias} días`;
}

export const ESTADO_CUENTA = {
  vencido: { texto: "Vencido", clase: "bg-frutilla text-white" },
  por_vencer: { texto: "Por vencer", clase: "bg-limon/30 text-tinta" },
  pendiente: { texto: "Pendiente", clase: "bg-papel text-suave" },
  pagado: { texto: "Pagado", clase: "bg-menta text-white" },
} as const;
