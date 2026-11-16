"use client";
import { createContext, useContext } from "react";
import type { Negocio, Usuario } from "@/lib/tipos";

export const PanelContexto = createContext<{ usuario: Usuario; negocio: Negocio } | null>(null);

export function usePanel() {
  const v = useContext(PanelContexto);
  if (!v) throw new Error("usePanel fuera del panel");
  return v;
}
