"use client";
// Logo, nombre y color del local, con vista previa de cómo lo ve el cliente.
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { borrarImagen } from "@/lib/imagenes";
import { COLORES_SUGERIDOS, contrasteConBlanco, estiloMarca } from "@/lib/color";
import { mensajeError, precio } from "@/lib/formato";
import { SubirImagen } from "./SubirImagen";
import type { Negocio } from "@/lib/tipos";

export function Apariencia({ negocio }: { negocio: Negocio }) {
  const [nombre, setNombre] = useState(negocio.nombre);
  const [logo, setLogo] = useState<string | null>(negocio.logo_url);
  const [color, setColor] = useState(negocio.color || "#d94a64");
  const [guardado, setGuardado] = useState({ nombre: negocio.nombre, logo: negocio.logo_url, color: negocio.color });
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cambios = nombre.trim() !== guardado.nombre || logo !== guardado.logo || color !== guardado.color;
  const claro = contrasteConBlanco(color) < 3.5;

  async function guardar() {
    setGuardando(true); setEstado(null);
    const { error } = await supabase().from("negocios").update({ nombre: nombre.trim(), logo_url: logo, color }).eq("id", negocio.id);
    setGuardando(false);
    if (error) return setEstado({ tipo: "error", texto: mensajeError(error) });
    if (guardado.logo && guardado.logo !== logo) borrarImagen(guardado.logo); // limpia el logo anterior
    setGuardado({ nombre: nombre.trim(), logo, color });
    setEstado({ tipo: "ok", texto: "Listo. Los clientes ya ven los cambios en la carta." });
  }

  return (
    <section className="tarjeta p-5">
      <h2 className="font-titulo text-xl font-bold">Apariencia</h2>
      <p className="mt-1 text-sm text-suave">Así se ve tu local en la carta que abre el cliente con el QR.</p>

      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div>
            <label className="etiqueta" htmlFor="ap-nombre">Nombre del local</label>
            <input id="ap-nombre" className="campo" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <SubirImagen negocioId={negocio.id} tipo="logo" url={logo} onCambio={setLogo} etiqueta="Logo (cuadrado se ve mejor)" />

          <fieldset>
            <legend className="etiqueta">Color principal</legend>
            <div className="flex flex-wrap gap-2">
              {COLORES_SUGERIDOS.map((c) => (
                <button key={c.hex} type="button" onClick={() => setColor(c.hex)} aria-pressed={color === c.hex} title={c.nombre}
                  className={`h-10 w-10 rounded-full border-2 ${color === c.hex ? "border-tinta ring-2 ring-tinta/20" : "border-papel"}`}
                  style={{ background: c.hex }}>
                  <span className="sr-only">{c.nombre}</span>
                </button>
              ))}
              <label className="flex h-10 items-center gap-2 rounded-full border border-borde bg-papel px-3 text-sm">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
                Otro
              </label>
            </div>
            {claro && <p className="mt-2 text-sm text-suave">Es un color claro: para que se lean los botones lo vamos a mostrar un poco más oscuro.</p>}
          </fieldset>
        </div>

        {/* Vista previa */}
        <div style={estiloMarca(color)} aria-label="Vista previa" className="rounded-3xl border border-borde bg-crema p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-suave">Vista previa</p>
          <div className="flex items-center gap-2">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-9 w-9 rounded-lg bg-papel object-contain" />
            )}
            <p className="truncate font-titulo text-lg font-bold">{nombre || "Tu local"}</p>
          </div>
          <div className="tarjeta mt-3 flex items-center gap-2 p-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">Vasito 1/4 kg</p>
              <p className="text-sm font-semibold text-frutilla">{precio(6000)}</p>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-frutilla text-white">+</span>
          </div>
          <div className="btn-primario mt-3 w-full py-2.5 text-sm">Confirmar pedido</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="btn-primario" disabled={!cambios || guardando || !nombre.trim()} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar apariencia"}
        </button>
        {estado && <p role="status" className={`text-sm ${estado.tipo === "ok" ? "text-menta" : "text-frutilla-osc"}`}>{estado.texto}</p>}
      </div>
    </section>
  );
}
