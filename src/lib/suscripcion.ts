// Prueba gratis, gracia y suscripción del local (ver la migración 20261126000015_prueba_y_suscripcion.sql).
export type Situacion = "prueba" | "gracia" | "vencida" | "activo" | "suspendido";
export type Plan = "basico" | "premium";

export interface MiSuscripcion {
  situacion: Situacion;
  plan: Plan; plan_solicitado: Plan | null; plan_vigente: Plan;
  prueba_hasta: string | null; dias_restantes: number | null; gracia_hasta: string | null; pagado_hasta: string | null;
  mp_estado: string | null; mp_plan: Plan | null;
  dias_prueba: number; dias_gracia: number;
  precios: Record<Plan, number>;
}

// Precios por defecto (los reales salen de la base: config_publica / mi_suscripcion).
export const PRECIOS_BASE: Record<Plan, number> = { basico: 29900, premium: 59900 };
export const DIAS_PRUEBA_BASE = 14;

export const NOMBRE_PLAN: Record<Plan, string> = { basico: "Básico", premium: "Premium" };

export const fechaLarga = (iso: string | null) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" }) : "";

export const diasTexto = (n: number) => (n === 1 ? "1 día" : `${n} días`);

export const INCLUYE: Record<Plan, { para: string; items: string[] }> = {
  basico: { para: "Para ordenar el salón", items: ["Carta por QR con tu marca", "Comandas con campanita en la barra", "Mostrador y mapa de mesas", "Reportes de ventas y espera"] },
  premium: { para: "Para saber si ganás plata", items: ["Todo lo del plan Básico", "Caja y libro diario", "Proveedores, gastos y cuentas por pagar", "Empleados, sueldos y resultado del mes"] },
};
