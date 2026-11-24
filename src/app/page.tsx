import Link from "next/link";
import Image from "next/image";
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import "@fontsource/caveat/500.css";
import { Movimiento } from "@/components/Movimiento";
import { Recorrido, type Momento } from "@/components/Recorrido";
// Fotos propias del cliente
import charla from "../../public/inicio/charla.webp";
import terraza from "../../public/inicio/mesa-terraza.webp";
// Fotos de Unsplash (licencia Unsplash: uso comercial libre). Créditos en el pie y en docs/creditos-fotos.md
import latte from "../../public/inicio/latte-barista.webp";
import conoCalle from "../../public/inicio/cono-calle.webp";
import conoFlorencia from "../../public/inicio/cono-florencia.webp";
import conoLimon from "../../public/inicio/cono-limon.webp";
import conoChocolate from "../../public/inicio/cono-chocolate.webp";
import cafeBiscotti from "../../public/inicio/cafe-biscotti.webp";
import barraCafe from "../../public/inicio/barra-cafe.webp";
import salonCafe from "../../public/inicio/salon-cafe.webp";
import mesaRestaurante from "../../public/inicio/mesa-restaurante.webp";
import brindis from "../../public/inicio/brindis-cafe.webp";

// Mesa 1 de "Heladería Demo": carta de prueba en modo demo (no crea pedidos reales).
const DEMO = "/m/e6b698b6ab?demo=1";

const MOMENTOS: Momento[] = [
  { sobre: "Se sienta", titulo: "Abre tu carta con el QR.", texto: "Sin descargar nada. Tu carta con fotos, tus colores y tu logo, en el celular de cada cliente.",
    foto: cafeBiscotti, alt: "", pantalla: "carta" },
  { sobre: "Elige", titulo: "Pistacho, dulce de leche y frutilla.", texto: "Sabores, tipo de leche, tamaño y extras. Lo que no hay, no aparece: un toque en “sin stock” y listo.",
    foto: conoFlorencia, alt: "", pantalla: "sabores" },
  { sobre: "Confirma", titulo: "Y sigue su pedido desde la mesa.", texto: "Recibido, preparando, en camino. Nadie levanta la mano para preguntar cuánto falta.",
    foto: latte, alt: "", pantalla: "enviado" },
  { sobre: "Suena la barra", titulo: "La campanita nunca se apaga.", texto: "La comanda llega al instante, con sonido. Y si una mesa llama al mozo, salta un cartel que no se va hasta que alguien va.",
    foto: barraCafe, alt: "", pantalla: "barra" },
];

const DOLORES = [
  { hoy: "Quince minutos esperando que alguien tome el pedido.", con: "El cliente pide desde la mesa apenas se sienta, y la comanda suena en la barra en ese momento." },
  { hoy: "Se terminó el chocolate amargo y el mozo se entera cuando ya lo anotó.", con: "Un toque en “sin stock” y ese sabor desaparece de la carta de todas las mesas." },
  { hoy: "La mesa 4 levanta la mano y nadie la ve.", con: "La barra recibe un cartel grande con sonido: “Mesa 4 llama al mozo”. Hasta que alguien va." },
];

const GALERIA = [
  { foto: conoCalle, alt: "Mano sosteniendo un cucurucho en una calle de Siena", nota: "una vuelta, un cucurucho", giro: -5, prof: 0.14, clase: "lp-g1" },
  { foto: charla, alt: "Dos personas conversando con un café bajo una lámpara cálida", nota: "café & charla ♡", giro: 3, prof: 0.05, clase: "lp-g2" },
  { foto: conoLimon, alt: "Cucurucho de helado de limón apoyado en un vaso sobre mármol", nota: "limón, siempre", giro: -2, prof: 0.2, clase: "lp-g3" },
  { foto: terraza, alt: "Mesa en una terraza al atardecer con dos cafés y medialunas", nota: "una mesa, dos historias", giro: 4, prof: 0.09, clase: "lp-g4" },
  { foto: conoChocolate, alt: "Cucurucho de chocolate y vainilla", nota: "chocolate & vainilla", giro: -4, prof: 0.17, clase: "lp-g5" },
];

const ROLES = [
  { quien: "Tu cliente", texto: "Ve la carta con fotos, arma su pedido, sigue cómo avanza y llama al mozo o pide la cuenta desde el celular." },
  { quien: "Tu barra", texto: "Comandas en orden de llegada, campanita siempre activa, cartel cuando una mesa llama y botón de “sin stock”." },
  { quien: "Tus mozos", texto: "Mapa de mesas: libres, ocupadas, pidiendo la cuenta. Cobran en efectivo, QR o tarjeta y liberan la mesa." },
  { quien: "Vos", texto: "Tu carta, tus precios, tu logo y tus colores. Ventas, sabores más pedidos y tiempos de espera." },
];

const PLANES = [
  { nombre: "Básico", para: "Para ordenar el salón",
    incluye: ["Carta por QR con tu marca", "Comandas con campanita siempre activa", "Aviso en la barra cuando una mesa llama", "Mapa de mesas y cobro", "Sabores y opciones por producto", "Reportes de ventas y espera"] },
  { nombre: "Premium", para: "Para saber si ganás plata", destacado: true,
    incluye: ["Todo lo del plan Básico", "Caja: apertura y cierre", "Libro diario", "Cuentas por pagar y gastos fijos", "Proveedores, costos y deudas", "Cuentas por cobrar", "Empleados y sueldos con comisiones", "Costos, márgenes y resultado del mes"] },
];

const PREGUNTAS = [
  { p: "¿Tengo que comprar equipos?", r: "No. Funciona en el navegador de cualquier celular, tablet o computadora. Para la barra alcanza con una tablet o un celular que ya tengas." },
  { p: "¿Mis clientes tienen que descargar una app?", r: "No. Escanean el QR con la cámara y la carta se abre en el navegador." },
  { p: "¿Y si la barra no escucha la campanita?", r: "La campanita vuelve a sonar cada minuto mientras haya comandas sin empezar, y cuando una mesa llama aparece un cartel grande que no se va hasta que alguien toca “Voy”." },
  { p: "¿El cliente paga desde el celular?", r: "No. El sistema registra el pedido y la cuenta; el cobro lo seguís haciendo como siempre: efectivo, posnet o tu QR de Mercado Pago. Sin comisiones nuevas." },
  { p: "¿Emite factura electrónica?", r: "Todavía no. La facturación la seguís haciendo con tu sistema actual." },
  { p: "¿Hay permanencia?", r: "No. Se paga mes a mes y lo das de baja cuando quieras." },
];

const CREDITOS = ["Jonas Jacobsson", "Mona Jain", "Di Bella Coffee", "Vanessa", "carlos lugo", "Dimitar Krastev", "Alexis Rodriguez", "Sadia Alam", "Jonathan Borba", "Petr Sevcovic"];

export default function Inicio() {
  return (
    <div className="lp">
      <Movimiento />

      <header className="lp-cabecera">
        <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4">
          <Link href="/" className="lp-marca whitespace-nowrap">Mesa Match</Link>
          <div className="hidden flex-1 justify-center gap-7 text-[13px] tracking-[0.14em] uppercase md:flex">
            <a href="#como-funciona" className="lp-enlace">Cómo funciona</a>
            <a href="#barra" className="lp-enlace">La barra</a>
            <a href="#planes" className="lp-enlace">Planes</a>
            <a href="#preguntas" className="lp-enlace">Preguntas</a>
          </div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link href="/login" className="lp-enlace hidden px-2 text-sm sm:inline">Ingresar</Link>
            <Link href="/login?modo=registro" className="lp-btn lp-btn-claro whitespace-nowrap">Crear mi local</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Portada: el celular apoyado en la mesa y los avisos de la barra flotando arriba, en vidrio ── */}
        <section className="lp-portada">
          <div aria-hidden className="lp-portada-fondo lp-capa" style={{ "--d": -12 } as React.CSSProperties}>
            <Image src={mesaRestaurante} alt="" priority sizes="100vw" className="lp-respira h-full w-full object-cover" />
          </div>
          <div aria-hidden className="lp-portada-velo" />

          <div className="relative z-10 mx-auto grid min-h-[100svh] max-w-6xl items-center gap-6 px-4 pb-10 pt-28 md:grid-cols-[1fr_1.1fr] md:gap-10">
            <div className="lp-entrada">
              <p className="lp-mano text-2xl text-[var(--lp-laton)]">helado, café & mesas bien atendidas.</p>
              <h1 className="lp-titulo mt-3 text-[2.9rem] leading-[1.02] text-white sm:text-6xl md:text-[4.4rem]">
                Que nadie en tu salón <em>espere</em> de más.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/75">
                Tus clientes piden desde la mesa con un QR, la barra escucha la campanita al instante y ve qué mesa la está llamando.
                Para heladerías y cafeterías con alma.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/login?modo=registro" className="lp-btn lp-btn-laton">Crear mi local</Link>
                <Link href={DEMO} className="lp-btn lp-btn-linea">Probar la carta</Link>
              </div>
              <p className="mt-6 text-sm tracking-wide text-white/50">Sin instalar nada · Sin permanencia · Con tu marca</p>
            </div>

            <div className="lp-mesa" aria-hidden>
              {/* Brindis: la mano levanta el café hacia la cámara */}
              <div className="lp-capa lp-brindis" style={{ "--d": 14 } as React.CSSProperties}>
                <div><Image src={brindis} alt="" sizes="(min-width: 768px) 240px, 40vw" className="h-full w-full object-cover" /></div>
              </div>

              {/* Celular apoyado sobre la mesa */}
              <div className="lp-capa lp-movil-caja" style={{ "--d": 24 } as React.CSSProperties}>
                <div className="lp-movil-sombra" />
                <div className="lp-movil">
                  <div className="lp-movil-pantalla">
                    <span className="lp-movil-reflejo" />
                    <p className="lp-titulo text-[15px] text-white/90">Mesa Match</p>
                    <p className="text-[9px] tracking-[0.2em] text-white/40 uppercase">Barra · en vivo</p>
                    <div className="mt-3 space-y-1.5">{[0, 1, 2, 3].map((i) => <span key={i} className="lp-movil-linea" style={{ width: `${90 - i * 14}%` }} />)}</div>
                  </div>
                </div>
              </div>

              {/* Avisos de vidrio que salen del celular y quedan flotando */}
              <ol className="lp-capa lp-avisos" style={{ "--d": 44 } as React.CSSProperties}>
                {[
                  { icono: "🔔", titulo: "Mesa 4 · Pedido nuevo", texto: "1 cucurucho · 2 flat white", tono: "lp-tono-laton" },
                  { icono: "✋", titulo: "Mesa 7 llama al mozo", texto: "Esperando hace 1 min", tono: "lp-tono-terracota" },
                  { icono: "🧾", titulo: "Mesa 2 pide la cuenta", texto: "$ 18.400 · efectivo", tono: "lp-tono-salvia" },
                ].map((n, i) => (
                  <li key={n.titulo} className="lp-aviso" style={{ "--i": i } as React.CSSProperties}>
                    <div className="lp-aviso-vidrio">
                      <span className={`lp-aviso-icono ${n.tono}`}>{n.icono}</span>
                      <span className="min-w-0 flex-1"><b className="block truncate">{n.titulo}</b><span className="text-white/70">{n.texto}</span></span>
                      <span className="self-start text-[11px] text-white/50">ahora</span>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="lp-capa lp-mano lp-nota-mesa" style={{ "--d": 34 } as React.CSSProperties}>cada mesa, a tiempo ♡</p>
            </div>
          </div>
          <div aria-hidden className="lp-bajar hidden md:block">deslizá</div>
        </section>

        {/* ── Frase ── */}
        <section className="mx-auto max-w-4xl px-4 py-24 text-center">
          <p data-revelar className="lp-titulo text-3xl leading-snug sm:text-[2.6rem]">
            Los lugares cambian. <em>La sensación de ser bien atendido</em> es la que hace volver.
          </p>
        </section>

        {/* ── Un pedido en cuatro tiempos (sección fija con scroll) ── */}
        <section id="como-funciona" aria-label="Cómo funciona" className="scroll-mt-0">
          <Recorrido momentos={MOMENTOS} />
        </section>

        {/* ── Problemas del salón ── */}
        <section className="lp-banda py-24">
          <div className="mx-auto max-w-6xl px-4">
            <p data-revelar className="lp-sobre">Un sábado a la tarde</p>
            <h2 data-revelar className="lp-titulo mt-3 max-w-2xl text-4xl leading-tight sm:text-5xl">Lo que pasa hoy, <em>y cómo cambia.</em></h2>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-[28px] bg-[var(--lp-linea)] md:grid-cols-3">
              {DOLORES.map((d, i) => (
                <li key={d.hoy} data-revelar style={{ transitionDelay: `${i * 0.12}s` }} className="flex flex-col bg-[var(--lp-papel)] p-8">
                  <p className="lp-sobre text-[var(--lp-terracota)]">Hoy</p>
                  <p className="lp-titulo mt-3 text-[1.45rem] leading-snug">{d.hoy}</p>
                  <span aria-hidden className="my-6 h-px w-10 bg-[var(--lp-laton)]" />
                  <p className="lp-sobre text-[var(--lp-salvia)]">Con Mesa Match</p>
                  <p className="mt-2 leading-relaxed text-[var(--lp-suave)]">{d.con}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Galería en distintos planos ── */}
        <section className="lp-galeria">
          <div className="mx-auto max-w-6xl px-4 pt-24 text-center">
            <p data-revelar className="lp-sobre">Lugares que dan ganas de volver</p>
            <h2 data-revelar className="lp-titulo mx-auto mt-3 max-w-2xl text-4xl leading-tight sm:text-5xl">Cada mesa <em>cuenta una historia.</em></h2>
          </div>
          <div className="lp-galeria-escena">
            {GALERIA.map((g) => (
              <figure key={g.nota} className={`lp-galeria-item ${g.clase}`}>
                <div data-paralaje={g.prof}>
                  <div data-revelar className="lp-polaroid" style={{ "--giro": `${g.giro}deg` } as React.CSSProperties}>
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <Image src={g.foto} alt={g.alt} fill sizes="(min-width: 768px) 300px, 45vw" className="lp-respira object-cover" />
                    </div>
                    <figcaption className="lp-mano mt-2 text-center text-xl text-[var(--lp-cacao)]">{g.nota}</figcaption>
                  </div>
                </div>
              </figure>
            ))}
          </div>
        </section>

        {/* ── Probalo ahora ── */}
        <section className="mx-auto max-w-3xl px-4 py-24 text-center">
          <div data-revelar>
            <p className="lp-sobre">Probalo ahora</p>
            <h2 className="lp-titulo mt-3 text-4xl leading-tight sm:text-5xl">Sentate en la mesa 1 <em>de nuestra heladería de prueba.</em></h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[var(--lp-suave)]">
              Abrí la carta como lo haría tu cliente: elegí sabores, mirá cómo se arma el pedido y sentí lo simple que es.
              Es una demo: no se envía nada de verdad.
            </p>
            <Link href={DEMO} className="lp-btn lp-btn-oscuro mt-8">Abrir la carta de prueba</Link>
          </div>
        </section>

        {/* ── La barra: campanita siempre activa y cartel de mesas que llaman ── */}
        <section id="barra" className="lp-oscuro relative scroll-mt-20 overflow-hidden py-24">
          <div aria-hidden className="lp-barra-fondo">
            <Image src={barraCafe} alt="" sizes="50vw" className="h-full w-full object-cover" />
          </div>
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 md:grid-cols-[1fr_1.1fr]">
            <div data-revelar>
              <p className="lp-sobre text-[var(--lp-laton)]">Para la barra</p>
              <h2 className="lp-titulo mt-3 text-4xl leading-tight sm:text-5xl">Ninguna mesa <em>queda esperando.</em></h2>
              <ul className="mt-8 space-y-5 text-white/75">
                <li className="flex gap-4"><span aria-hidden className="lp-icono">🔔</span>
                  <span><b className="block text-white">Campanita siempre activa</b>Suena con cada comanda nueva y vuelve a sonar si un pedido lleva más de 3 minutos sin empezar.</span></li>
                <li className="flex gap-4"><span aria-hidden className="lp-icono">✋</span>
                  <span><b className="block text-white">Cartel cuando una mesa llama</b>“Mesa 4 llama al mozo”, grande y con un sonido distinto, hasta que alguien toca “Voy”.</span></li>
                <li className="flex gap-4"><span aria-hidden className="lp-icono">🧾</span>
                  <span><b className="block text-white">Pedidos de cuenta a la vista</b>Las mesas que quieren pagar se distinguen de un vistazo.</span></li>
              </ul>
            </div>

            <div data-revelar aria-label="Pantalla de la barra: llega una comanda y la mesa 4 llama al mozo" role="img" className="lp-tablet">
              <div className="flex items-center justify-between">
                <p className="lp-titulo text-xl">Comandas</p>
                <span className="lp-chip"><span className="lp-punto" />Campanita activa</span>
              </div>
              <div className="lp-cartel">
                <span className="lp-cartel-icono">🔔</span>
                <span className="flex-1"><b className="lp-titulo block text-2xl leading-none">Mesa 4</b><span className="text-sm text-white/85">Llama al mozo · recién</span></span>
                <span className="lp-cartel-voy">Voy</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                {([
                  ["Nuevos", "Mesa 7", "1 × Vasito 1/4 kg", "Pistacho · Dulce de leche"],
                  ["Preparando", "Mesa 2", "2 × Flat white", "Leche de almendras"],
                  ["Para entregar", "Mesa 5", "1 × Affogato", ""],
                ] as const).map(([titulo, m, i, o], c) => (
                  <div key={titulo} className="rounded-2xl bg-[var(--lp-lino)] p-2">
                    <p className="px-1 text-[11px] tracking-wider text-[var(--lp-suave)] uppercase">{titulo}</p>
                    <div className={`mt-2 rounded-xl bg-white p-2 ${c === 0 ? "lp-comanda" : ""}`}>
                      <p className="lp-titulo text-base">{m}</p>
                      <p className="font-bold">{i}</p>
                      {o && <p className="text-[var(--lp-suave)]">{o}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Para cada uno ── */}
        <section className="mx-auto max-w-6xl px-4 py-24">
          <p data-revelar className="lp-sobre">Una pantalla para cada uno</p>
          <ul className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r, i) => (
              <li key={r.quien} data-revelar style={{ transitionDelay: `${i * 0.1}s` }} className="border-t border-[var(--lp-espresso)] pt-5">
                <p className="lp-titulo text-2xl">{r.quien}</p>
                <p className="mt-2 leading-relaxed text-[var(--lp-suave)]">{r.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Planes ── */}
        <section id="planes" className="lp-banda scroll-mt-20 py-24">
          <div className="mx-auto max-w-5xl px-4">
            <div data-revelar className="text-center">
              <p className="lp-sobre">Planes</p>
              <h2 className="lp-titulo mt-3 text-4xl sm:text-5xl">Mes a mes, <em>sin permanencia.</em></h2>
              <p className="mt-3 text-[var(--lp-suave)]">El primer mes es de prueba.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {PLANES.map((p, i) => (
                <article key={p.nombre} data-revelar style={{ transitionDelay: `${i * 0.12}s` }}
                  className={`flex flex-col rounded-[28px] p-9 ${p.destacado ? "lp-oscuro" : "border border-[var(--lp-linea)] bg-[var(--lp-papel)]"}`}>
                  <h3 className="lp-titulo text-4xl">{p.nombre}</h3>
                  <p className={`lp-mano mt-1 text-2xl ${p.destacado ? "text-[var(--lp-laton)]" : "text-[var(--lp-terracota)]"}`}>{p.para}</p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {p.incluye.map((x) => (
                      <li key={x} className="flex gap-3"><span aria-hidden className="text-[var(--lp-laton)]">—</span>{x}</li>
                    ))}
                  </ul>
                  <Link href="/login?modo=registro" className={`lp-btn mt-9 w-full ${p.destacado ? "lp-btn-laton" : "lp-btn-oscuro"}`}>
                    Empezar con {p.nombre}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Preguntas ── */}
        <section id="preguntas" className="scroll-mt-20 mx-auto max-w-3xl px-4 py-24">
          <p data-revelar className="lp-sobre text-center">Preguntas frecuentes</p>
          <div className="mt-8 divide-y divide-[var(--lp-linea)] border-y border-[var(--lp-linea)]">
            {PREGUNTAS.map((q) => (
              <details key={q.p} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="lp-titulo text-xl">{q.p}</span>
                  <span aria-hidden className="text-2xl text-[var(--lp-laton)] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-[var(--lp-suave)]">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Cierre ── */}
        <section className="lp-cierre">
          <Image src={salonCafe} alt="" aria-hidden fill sizes="100vw" className="lp-respira object-cover" />
          <div className="relative mx-auto max-w-3xl px-4 py-32 text-center">
            <p className="lp-mano text-3xl text-[var(--lp-laton)]">los lugares cambian, la sensación queda.</p>
            <h2 className="lp-titulo mt-3 text-4xl text-white sm:text-6xl">Tu próximo sábado, <em>sin mesas esperando.</em></h2>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/login?modo=registro" className="lp-btn lp-btn-laton">Crear mi local</Link>
              <Link href={DEMO} className="lp-btn lp-btn-linea">Probar la carta</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[var(--lp-espresso)] py-10 text-sm text-white/55">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4">
          <span className="lp-marca text-white">Mesa Match</span>
          <span>Pedidos en mesa para heladerías y cafeterías.</span>
          <span className="ml-auto flex gap-5">
            <Link href="/login" className="hover:text-white">Ingresar</Link>
            <Link href="/login?modo=registro" className="hover:text-white">Crear mi local</Link>
          </span>
          <p className="w-full text-xs text-white/35">Fotos: {CREDITOS.join(", ")} en Unsplash.</p>
        </div>
      </footer>
    </div>
  );
}
