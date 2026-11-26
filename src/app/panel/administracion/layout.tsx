"use client";
// Sección Administración (plan Premium). Solo el dueño la ve en el menú.
import Link from "next/link";
import { usePanel } from "@/components/PanelContexto";

const INCLUYE = [
  ["Caja", "Apertura y cierre, con lo que debería haber y lo que sobró o faltó."],
  ["Libro diario", "Todo lo que entró y salió, día por día."],
  ["Cuentas por cobrar", "Quién te debe y cuánto."],
  ["Gastos y cuentas por pagar", "Alquiler, luz, impuestos y vencimientos."],
  ["Proveedores", "Qué te vende cada uno, a qué costo y cuánto le debés."],
  ["Empleados y sueldos", "Sueldos con comisiones a medida."],
  ["Precios y márgenes", "Cuánto te deja cada producto."],
  ["Resultado del mes", "Si estás ganando o perdiendo plata."],
];

export default function AdministracionLayout({ children }: { children: React.ReactNode }) {
  const { negocio, usuario, suscripcion } = usePanel();

  if (usuario.rol !== "duenio") {
    return <p className="tarjeta p-6 text-center text-suave">Esta sección es solo para el dueño del local.</p>;
  }

  if ((suscripcion?.plan_vigente ?? negocio.plan) !== "premium") {
    return (
      <section className="tarjeta mx-auto max-w-2xl p-6">
        <p className="text-4xl" aria-hidden>🔒</p>
        <h1 className="mt-2 font-titulo text-3xl">Administración</h1>
        <p className="mt-1 text-suave">Disponible en el plan Premium. Llevá las cuentas de tu local sin planillas aparte.</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {INCLUYE.map(([t, d]) => (
            <li key={t} className="rounded-2xl bg-crema/80 p-3">
              <p className="font-extrabold">{t}</p>
              <p className="text-sm text-suave">{d}</p>
            </li>
          ))}
        </ul>
        <Link href="/panel/suscripcion" className="btn-primario mt-5 inline-block">Pasarme a Premium</Link>
      </section>
    );
  }

  return <>{children}</>;
}
