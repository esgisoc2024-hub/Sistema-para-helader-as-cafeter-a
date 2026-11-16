"use client";
import { supabase } from "./supabase";

const BUCKET = "imagenes";

// Achica la foto en el navegador antes de subirla: una foto de celular de 5 MB queda en ~100 KB.
async function comprimir(archivo: File, ladoMax: number): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la imagen"))), "image/webp", 0.82));
}

/** Sube una imagen a la carpeta del negocio y devuelve su dirección pública. */
export async function subirImagen(negocioId: string, archivo: File, tipo: "logo" | "producto"): Promise<string> {
  if (!archivo.type.startsWith("image/")) throw new Error("El archivo no es una imagen.");
  const blob = await comprimir(archivo, tipo === "logo" ? 400 : 1000);
  const ruta = `${negocioId}/${tipo}-${crypto.randomUUID()}.webp`;
  const sb = supabase();
  const { error } = await sb.storage.from(BUCKET).upload(ruta, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

/** Borra una imagen subida por nosotros (ignora links externos). */
export async function borrarImagen(url: string | null | undefined) {
  const marca = `/object/public/${BUCKET}/`;
  if (!url || !url.includes(marca)) return;
  await supabase().storage.from(BUCKET).remove([url.split(marca)[1]]);
}
