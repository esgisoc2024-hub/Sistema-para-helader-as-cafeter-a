import Link from "next/link";

const PUNTOS = [
  { t: "Pedido por QR en cada mesa", d: "El cliente escanea, elige sabores y pide desde su celular. Sin descargar nada." },
  { t: "Comanda directa a la barra", d: "El pedido aparece al instante en la tablet, con los minutos de espera a la vista." },
  { t: "Botón “sin stock”", d: "Se acabó un sabor: un toque y desaparece de la carta para las mesas siguientes." },
  { t: "Saber qué se vende", d: "Ventas por producto y por sabor, y el tiempo real de espera de cada día." },
];

export default function Inicio() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-wide text-frutilla">Mesa Dulce</p>
      <h1 className="mt-2 font-titulo text-4xl font-bold leading-tight sm:text-5xl">
        Que el pedido de la mesa llegue rápido y sin errores a la barra.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-suave">
        Sistema de pedidos en mesa para heladerías con salón y cafetería. Funciona desde el navegador del celular o la tablet.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login?modo=registro" className="btn-primario">Crear mi heladería</Link>
        <Link href="/login" className="btn-secundario">Ingresar</Link>
      </div>
      <ul className="mt-12 grid gap-3 sm:grid-cols-2">
        {PUNTOS.map((p) => (
          <li key={p.t} className="tarjeta p-5">
            <p className="font-semibold">{p.t}</p>
            <p className="mt-1 text-sm text-suave">{p.d}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
