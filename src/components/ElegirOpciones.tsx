"use client";

import { useState } from "react";
import { precio } from "@/lib/formato";
import type { ProductoPublico } from "@/lib/tipos";

// Selector de sabores y opciones de un producto, y la hoja que sube desde abajo. Lo usan la carta del QR y el mostrador.
export interface OpcionCarrito { id: string; grupo: string; nombre: string; extra: number }

export function ElegirOpciones({ producto, onCerrar, onAgregar }: {
  producto: ProductoPublico; onCerrar: () => void;
  onAgregar: (p: ProductoPublico, opciones: OpcionCarrito[], nota: string) => void;
}) {
  const [elegidas, setElegidas] = useState<Record<string, string[]>>({});
  const [nota, setNota] = useState("");

  function alternar(grupoId: string, maximo: number, id: string) {
    setElegidas((e) => {
      const actual = e[grupoId] ?? [];
      if (actual.includes(id)) return { ...e, [grupoId]: actual.filter((x) => x !== id) };
      if (maximo === 1) return { ...e, [grupoId]: [id] }; // elección única: reemplaza
      if (actual.length >= maximo) return e;
      return { ...e, [grupoId]: [...actual, id] };
    });
  }

  const completos = producto.grupos.every((g) => (elegidas[g.id]?.length ?? 0) >= g.minimo);
  const seleccion: OpcionCarrito[] = producto.grupos.flatMap((g) =>
    g.opciones.filter((o) => elegidas[g.id]?.includes(o.id)).map((o) => ({ id: o.id, grupo: g.nombre, nombre: o.nombre, extra: Number(o.precio_extra) })));
  const total = Number(producto.precio) + seleccion.reduce((s, o) => s + o.extra, 0);

  return (
    <Hoja onCerrar={onCerrar} titulo={producto.nombre}>
      <div className="space-y-5">
        {producto.grupos.map((g) => {
          const n = elegidas[g.id]?.length ?? 0;
          const lleno = g.maximo > 1 && n >= g.maximo;
          const regla = g.maximo === 1 ? (g.minimo ? "Elegí 1" : "Opcional, elegí 1")
            : g.minimo ? `Elegí de ${g.minimo} a ${g.maximo}` : `Opcional, hasta ${g.maximo}`;
          return (
            <fieldset key={g.id}>
              <legend className="mb-2 flex w-full items-baseline justify-between">
                <span className="font-semibold">{g.nombre}</span>
                <span className={`text-sm ${n < g.minimo ? "font-semibold text-frutilla-osc" : "text-suave"}`}>{regla}{g.maximo > 1 && ` · ${n}`}</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {g.opciones.map((o) => {
                  const activo = elegidas[g.id]?.includes(o.id) ?? false;
                  return (
                    <button key={o.id} type="button" onClick={() => alternar(g.id, g.maximo, o.id)} aria-pressed={activo}
                      disabled={!activo && lleno}
                      className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition disabled:opacity-40 ${
                        activo ? "scale-[1.03] border-frutilla bg-rubor text-frutilla-osc" : "border-borde bg-papel"}`}>
                      {o.nombre}
                      {Number(o.precio_extra) > 0 && <span className="block text-xs font-normal text-suave">+ {precio(o.precio_extra)}</span>}
                    </button>
                  );
                })}
              </div>
              {g.opciones.length === 0 && <p className="text-sm text-suave">No hay opciones disponibles en este momento.</p>}
            </fieldset>
          );
        })}
      </div>
      <label className="etiqueta mt-5" htmlFor="nota">Aclaración (opcional)</label>
      <input id="nota" className="campo" maxLength={120} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: bien caliente" />
      <button className="btn-primario mt-4 w-full" disabled={!completos} onClick={() => onAgregar(producto, seleccion, nota.trim())}>
        Agregar · {precio(total)}
      </button>
    </Hoja>
  );
}

export function Hoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-tinta/40" onClick={onCerrar}>
      <div role="dialog" aria-modal aria-label={titulo} onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-xl animate-subir overflow-y-auto rounded-t-[32px] bg-crema p-5 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-titulo text-xl">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="h-9 w-9 rounded-full border border-borde bg-papel">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

