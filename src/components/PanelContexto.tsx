"use client";
import { createContext, useContext } from "react";
import type { Negocio, Usuario } from "@/lib/tipos";
import type { MiSuscripcion } from "@/lib/suscripcion";

export const PanelContexto = createContext<{
  usuario: Usuario; negocio: Negocio; suscripcion: MiSuscripcion | null; recargarSuscripcion: () => void;
} | null>(null);

export function usePanel() {
  const v = useContext(PanelContexto);
  if (!v) throw new Error("usePanel fuera del panel");
  return v;
}
