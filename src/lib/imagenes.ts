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

const VIDEO_MAX = 15 * 1024 * 1024;

/** Portada del local: una foto (se comprime) o un video corto (hasta 15 MB, sin sonido en la carta). */
export async function subirPortada(negocioId: string, archivo: File): Promise<{ url: string; tipo: "imagen" | "video" }> {
  const sb = supabase();
  if (archivo.type.startsWith("image/")) {
    const blob = await comprimir(archivo, 1600);
    const ruta = `${negocioId}/portada-${crypto.randomUUID()}.webp`;
    const { error } = await sb.storage.from(BUCKET).upload(ruta, blob, { contentType: "image/webp", cacheControl: "31536000" });
    if (error) throw error;
    return { url: sb.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl, tipo: "imagen" };
  }
  if (archivo.type.startsWith("video/")) {
    if (archivo.size > VIDEO_MAX) throw new Error("El video pesa más de 15 MB. Usá uno más corto (5 a 10 segundos).");
    const ext = archivo.type === "video/webm" ? "webm" : archivo.type === "video/quicktime" ? "mov" : "mp4";
    const ruta = `${negocioId}/portada-${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(ruta, archivo, { contentType: archivo.type, cacheControl: "31536000" });
    if (error) throw error;
    return { url: sb.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl, tipo: "video" };
  }
  throw new Error("El archivo tiene que ser una foto o un video.");
}

/** Borra una imagen subida por nosotros (ignora links externos). */
export async function borrarImagen(url: string | null | undefined) {
  const marca = `/object/public/${BUCKET}/`;
  if (!url || !url.includes(marca)) return;
  await supabase().storage.from(BUCKET).remove([url.split(marca)[1]]);
}
