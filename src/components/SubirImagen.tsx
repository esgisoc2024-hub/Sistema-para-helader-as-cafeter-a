"use client";
// Botón para subir una imagen (logo o foto de producto) con vista previa.
import { useRef, useState } from "react";
import { subirImagen } from "@/lib/imagenes";

export function SubirImagen({ negocioId, tipo, url, onCambio, etiqueta }: {
  negocioId: string; tipo: "logo" | "producto"; url: string | null | undefined;
  onCambio: (url: string | null) => void; etiqueta: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setError(""); setSubiendo(true);
    try {
      onCambio(await subirImagen(negocioId, archivo, tipo));
    } catch {
      setError("No se pudo subir la imagen. Probá con otra foto (JPG o PNG).");
    } finally {
      setSubiendo(false);
    }
  }

  const caja = tipo === "logo" ? "h-20 w-20 rounded-2xl" : "h-24 w-24 rounded-xl";
  return (
    <div>
      <span className="etiqueta">{etiqueta}</span>
      <div className="flex items-center gap-3">
        <div className={`${caja} grid shrink-0 place-items-center overflow-hidden border border-borde bg-papel text-xs text-suave`}>
          {url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={url} alt="" className={`h-full w-full ${tipo === "logo" ? "object-contain p-1" : "object-cover"}`} />
            : "Sin imagen"}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" className="btn-secundario py-2 text-sm" disabled={subiendo} onClick={() => input.current?.click()}>
            {subiendo ? "Subiendo…" : url ? "Cambiar" : "Subir imagen"}
          </button>
          {url && !subiendo && (
            <button type="button" className="text-sm text-suave underline" onClick={() => onCambio(null)}>Quitar</button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={elegir} />
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-frutilla-osc">{error}</p>}
    </div>
  );
}
