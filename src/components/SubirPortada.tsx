"use client";
// Portada del local: foto o video corto que se ve arriba de la carta.
import { useRef, useState } from "react";
import { subirPortada } from "@/lib/imagenes";

export function SubirPortada({ negocioId, url, tipo, onCambio }: {
  negocioId: string; url: string | null; tipo: "imagen" | "video" | null;
  onCambio: (p: { url: string | null; tipo: "imagen" | "video" | null }) => void;
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
      onCambio(await subirPortada(negocioId, archivo));
    } catch (err) {
      setError((err as Error).message?.includes("15 MB") ? (err as Error).message : "No se pudo subir. Probá con una foto JPG o un video MP4.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <span className="etiqueta">Portada (foto o video corto)</span>
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[22px] border border-borde bg-rubor/40">
        {url && tipo === "video" && <video src={url} className="h-full w-full object-cover" autoPlay muted loop playsInline />}
        {url && tipo === "imagen" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        )}
        {!url && (
          <p className="grid h-full place-items-center px-6 text-center text-sm text-suave">
            Una foto de tu mejor helado o un video de 5 a 10 segundos sirviendo una copa.
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secundario py-2 text-sm" disabled={subiendo} onClick={() => input.current?.click()}>
          {subiendo ? "Subiendo…" : url ? "Cambiar portada" : "Subir portada"}
        </button>
        {url && !subiendo && (
          <button type="button" className="text-sm text-suave underline" onClick={() => onCambio({ url: null, tipo: null })}>Quitar</button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" onChange={elegir} />
      {error && <p role="alert" className="mt-2 text-sm text-frutilla-osc">{error}</p>}
    </div>
  );
}
