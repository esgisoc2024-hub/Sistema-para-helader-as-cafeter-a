"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePanel } from "@/components/PanelContexto";

export default function PanelInicio() {
  const { usuario } = usePanel();
  const router = useRouter();
  useEffect(() => {
    router.replace(usuario.rol === "mozo" ? "/panel/mesas" : "/panel/barra");
  }, [usuario.rol, router]);
  return null;
}
