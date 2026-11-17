import Link from "next/link";
import { Fondo } from "@/components/Fondo";

// Mesa 1 de "Heladería Demo": carta de prueba en modo demo (no crea pedidos reales).
const DEMO = "/m/e6b698b6ab?demo=1";

const DOLORES = [
  {
    hoy: "Quince minutos esperando que alguien tome el pedido.",
    con: "El cliente pide desde la mesa apenas se sienta, y el pedido aparece en la barra en el momento.",
  },
  {
    hoy: "Se acabó el chocolate amargo y el mozo se entera cuando ya lo anotó.",
    con: "Un toque en “sin stock” y ese sabor desaparece de la carta de todas las mesas.",
  },
  {
    hoy: "La cuenta de la mesa 4 no cierra y nadie sabe qué se pidió.",
    con: "Cada pedido queda registrado con hora y precio. La cuenta se arma sola.",
  },
];

const PASOS = [
  { titulo: "El cliente escanea y pide", texto: "Abre la carta con el QR de su mesa, elige sabores, leche o tamaño, y confirma. Sin descargar nada." },
  { titulo: "La barra lo recibe al instante", texto: "Suena un aviso en la tablet y aparece la comanda con la mesa, los sabores y los minutos de espera." },
  { titulo: "El mozo cobra y vos ves los números", texto: "La mesa avisa cuando quiere la cuenta. Al cerrar el día sabés qué se vendió y cuánto esperó la gente." },
];

const ROLES = [
  { emoji: "📱", quien: "Tu cliente", texto: "Ve la carta con fotos, arma su pedido, sigue cómo avanza y llama al mozo o pide la cuenta desde el celular." },
  { emoji: "🍨", quien: "Tu barra", texto: "Comandas en orden de llegada, alerta a los 10 minutos y botón de “sin stock” para sabores y productos." },
  { emoji: "🧾", quien: "Tus mozos", texto: "Mapa de mesas: libres, ocupadas, pidiendo la cuenta. Cobran en efectivo, QR o tarjeta y liberan la mesa." },
  { emoji: "📊", quien: "Vos", texto: "Tu carta, tus precios, tu logo y tus colores. Reportes de ventas, sabores más pedidos y tiempos de espera." },
];

const RUBROS = ["Heladerías con salón", "Cafeterías", "Cafés de especialidad", "Pastelerías y casas de té"];

const PLANES = [
  {
    nombre: "Básico", para: "Para ordenar el salón",
    incluye: ["Carta por QR con tu marca", "Comandas en la barra con sonido", "Mapa de mesas y cobro", "Sabores y opciones por producto", "Reportes de ventas y espera", "Mesas, productos y empleados sin límite"],
  },
  {
    nombre: "Premium", para: "Para saber si ganás plata", destacado: true,
    incluye: ["Todo lo del plan Básico", "Caja: apertura y cierre", "Libro diario", "Cuentas por pagar y gastos fijos", "Proveedores, costos y deudas", "Cuentas por cobrar y mesas fiadas", "Empleados y sueldos con comisiones", "Próximamente: márgenes y resultado del mes"],
  },
];

const PREGUNTAS = [
  { p: "¿Tengo que comprar equipos?", r: "No. Funciona en el navegador de cualquier celular, tablet o computadora. Para la barra alcanza con una tablet o un celular que ya tengas." },
  { p: "¿Mis clientes tienen que descargar una app?", r: "No. Escanean el QR con la cámara y la carta se abre en el navegador." },
  { p: "¿Cuánto tarda en estar funcionando?", r: "Se pone en marcha en una visita: cargamos tu carta, imprimís los QR y dejás la tablet en la barra. Si querés, arrancás con una carta de ejemplo y la editás después." },
  { p: "¿El cliente paga desde el celular?", r: "No. El sistema registra el pedido y la cuenta; el cobro lo seguís haciendo como siempre: efectivo, posnet o tu QR de Mercado Pago. Sin comisiones nuevas." },
  { p: "¿Emite factura electrónica?", r: "Todavía no. La facturación la seguís haciendo con tu sistema actual." },
  { p: "¿Hay permanencia?", r: "No. Se paga mes a mes y lo das de baja cuando quieras." },
];

export default function Inicio() {
  return (
    <>
      <Fondo />
      <header className="sticky top-0 z-20 backdrop-blur-md">
        <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="font-titulo text-2xl text-frutilla">Mesa Match</Link>
          <div className="hidden flex-1 gap-5 text-sm font-bold text-suave md:flex">
            <a href="#como-funciona" className="hover:text-tinta">Cómo funciona</a>
            <a href="#para-quien" className="hover:text-tinta">Para quién</a>
            <a href="#planes" className="hover:text-tinta">Planes</a>
            <a href="#preguntas" className="hover:text-tinta">Preguntas</a>
          </div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link href="/login" className="rounded-full px-3 py-2 text-sm font-extrabold">Ingresar</Link>
            <Link href="/login?modo=registro" className="btn-primario px-4 py-2 text-sm">Crear mi local</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Portada ── */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.1fr_1fr] md:pt-14">
          <div>
            <h1 className="sobre-fondo font-titulo text-5xl leading-[0.95] sm:text-6xl">
              Que el pedido llegue a la barra antes de que se derrita.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-suave">
              Tus clientes piden desde la mesa con un QR, la barra recibe la comanda al instante y vos sabés qué se vende.
              Hecho para heladerías y cafeterías con salón.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/login?modo=registro" className="btn-primario px-6 py-4 text-lg">Crear mi local</Link>
              <Link href={DEMO} className="btn-secundario px-6 py-4 text-lg">Probar la carta</Link>
            </div>
            <ul className="mt-6 grid gap-1.5 text-sm font-bold text-suave sm:grid-cols-2">
              {["Sin instalar nada", "Sin permanencia", "Con tu logo y tus colores", "Funciona en el celular o tablet que ya tenés"].map((t) => (
                <li key={t} className="flex items-center gap-2"><span aria-hidden className="text-menta">✓</span>{t}</li>
              ))}
            </ul>
          </div>
          <EscenaPedido />
        </section>

        {/* ── Problemas del salón ── */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="sobre-fondo max-w-2xl font-titulo text-4xl">Lo que pasa un sábado a la tarde, y cómo cambia.</h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {DOLORES.map((d) => (
              <li key={d.hoy} className="tarjeta flex flex-col p-6">
                <p className="text-sm font-extrabold text-frutilla-osc">Hoy</p>
                <p className="mt-1 text-lg font-extrabold leading-snug">{d.hoy}</p>
                <p className="mt-5 text-sm font-extrabold text-menta">Con Mesa Match</p>
                <p className="mt-1 text-suave">{d.con}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Cómo funciona ── */}
        <section id="como-funciona" className="scroll-mt-20 bg-choco py-16 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="font-titulo text-4xl">Cómo funciona</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="flex gap-4">
                  <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-frutilla font-titulo text-2xl">{i + 1}</span>
                  <div>
                    <p className="text-lg font-extrabold">{p.titulo}</p>
                    <p className="mt-1 text-white/80">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href={DEMO} className="btn mt-10 bg-white text-choco hover:bg-rubor">Hacé un pedido de prueba</Link>
          </div>
        </section>

        {/* ── Para cada uno ── */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="sobre-fondo font-titulo text-4xl">Una pantalla para cada uno</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <li key={r.quien} className="tarjeta p-6">
                <p aria-hidden className="text-4xl">{r.emoji}</p>
                <p className="mt-3 text-xl font-extrabold">{r.quien}</p>
                <p className="mt-1 text-suave">{r.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Para quién ── */}
        <section id="para-quien" className="scroll-mt-20 mx-auto max-w-6xl px-4 pb-16">
          <div className="tarjeta grid items-center gap-6 p-8 md:grid-cols-[1fr_1.2fr]">
            <h2 className="font-titulo text-4xl">Pensado para locales donde la gente se sienta a disfrutar</h2>
            <ul className="flex flex-wrap gap-2">
              {RUBROS.map((r) => <li key={r} className="rounded-full bg-rubor px-4 py-2 font-extrabold text-frutilla-osc">{r}</li>)}
            </ul>
          </div>
        </section>

        {/* ── Planes ── */}
        <section id="planes" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16">
          <h2 className="sobre-fondo font-titulo text-4xl">Planes</h2>
          <p className="mt-2 text-suave">Mes a mes, sin permanencia. El primer mes es de prueba.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {PLANES.map((p) => (
              <article key={p.nombre} className={`rounded-[28px] p-7 ${p.destacado ? "bg-choco text-white shadow-xl" : "tarjeta"}`}>
                <h3 className="font-titulo text-3xl">{p.nombre}</h3>
                <p className={p.destacado ? "text-white/80" : "text-suave"}>{p.para}</p>
                <ul className="mt-5 space-y-2">
                  {p.incluye.map((i) => (
                    <li key={i} className="flex gap-2"><span aria-hidden className={p.destacado ? "text-limon" : "text-menta"}>✓</span>{i}</li>
                  ))}
                </ul>
                <Link href="/login?modo=registro" className={`btn mt-7 w-full ${p.destacado ? "bg-frutilla text-white hover:bg-frutilla-osc" : "border border-borde bg-papel"}`}>
                  Empezar con {p.nombre}
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* ── Preguntas ── */}
        <section id="preguntas" className="scroll-mt-20 mx-auto max-w-3xl px-4 py-16">
          <h2 className="sobre-fondo font-titulo text-4xl">Preguntas frecuentes</h2>
          <div className="mt-6 space-y-3">
            {PREGUNTAS.map((q) => (
              <details key={q.p} className="tarjeta group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-extrabold">
                  {q.p}<span aria-hidden className="text-2xl text-frutilla transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-suave">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Cierre ── */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="rounded-[32px] bg-frutilla px-6 py-12 text-center text-white">
            <h2 className="font-titulo text-4xl sm:text-5xl">Tu próximo sábado, sin mesas esperando</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/90">Creá tu local con una carta de ejemplo y probalo hoy mismo con tu celular.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/login?modo=registro" className="btn bg-white px-6 py-4 text-lg text-frutilla-osc hover:bg-rubor">Crear mi local</Link>
              <Link href={DEMO} className="btn border-2 border-white/70 px-6 py-4 text-lg text-white hover:bg-white/10">Probar la carta</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-borde/80 bg-papel/70 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 text-sm text-suave">
          <span className="font-titulo text-xl text-frutilla">Mesa Match</span>
          <span>Pedidos en mesa para heladerías y cafeterías.</span>
          <span className="ml-auto flex gap-4 font-bold">
            <Link href="/login" className="hover:text-tinta">Ingresar</Link>
            <Link href="/login?modo=registro" className="hover:text-tinta">Crear mi local</Link>
          </span>
        </div>
      </footer>
    </>
  );
}

/* Escena animada: el pedido sale del celular del cliente y llega a la tablet de la barra. */
function EscenaPedido() {
  return (
    <div aria-label="Un pedido de la mesa 4 viaja del celular del cliente a la tablet de la barra" role="img"
      className="relative mx-auto h-[420px] w-full max-w-[460px]">
      {/* Celular */}
      <div className="absolute left-0 top-6 w-[190px] -rotate-6 rounded-[34px] border-[6px] border-tinta bg-crema p-3 shadow-2xl">
        <p className="font-titulo text-lg leading-none">Heladería Demo</p>
        <p className="mt-0.5 text-[11px] font-bold text-suave">Mesa 4</p>
        {[["Vasito 1/4 kg", "$ 6.000"], ["Café con leche", "$ 3.300"], ["Medialunas x2", "$ 2.400"]].map(([n, p], i) => (
          <div key={n} className={`escena-producto mt-2 flex items-center justify-between rounded-xl bg-papel px-2 py-2 text-[11px] font-extrabold ${i === 0 ? "escena-elegido" : ""}`}>
            <span>{n}<span className="block font-bold text-frutilla">{p}</span></span>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-frutilla text-white">+</span>
          </div>
        ))}
        <div className="escena-boton mt-3 rounded-full bg-frutilla py-2 text-center text-[11px] font-extrabold text-white">Confirmar pedido</div>
      </div>

      {/* Comanda que viaja */}
      <div className="escena-ticket absolute left-[120px] top-[150px] z-10 w-[150px] rounded-2xl bg-papel p-2.5 text-[11px] shadow-xl">
        <p className="font-titulo text-base leading-none">Mesa 4</p>
        <p className="mt-1 font-extrabold">1 × Vasito 1/4 kg</p>
        <p className="text-choco">Frutilla · Chocolate</p>
      </div>

      {/* Tablet de la barra */}
      <div className="absolute bottom-0 right-0 w-[270px] rotate-3 rounded-[26px] border-[7px] border-tinta bg-crema p-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="font-titulo text-lg leading-none">Comandas</p>
          <span className="escena-ding rounded-full bg-limon/40 px-2 py-0.5 text-[10px] font-extrabold">🔔 ¡Nuevo!</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-borde/60 p-1.5">
            <p className="text-[10px] font-extrabold text-suave">Nuevos</p>
            <div className="escena-llegada mt-1 rounded-lg bg-papel p-1.5 text-[10px]">
              <p className="font-extrabold">Mesa 4 · 0 min</p>
              <p>1 × Vasito 1/4 kg</p>
            </div>
          </div>
          <div className="rounded-xl bg-borde/60 p-1.5">
            <p className="text-[10px] font-extrabold text-suave">Preparando</p>
            <div className="mt-1 rounded-lg bg-papel p-1.5 text-[10px]">
              <p className="font-extrabold">Mesa 2 · 3 min</p>
              <p>2 × Café con leche</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
