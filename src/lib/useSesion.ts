"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Negocio, Usuario } from "./tipos";

type Estado =
  | { cargando: true }
  | { cargando: false; sinLogin: true }
  | { cargando: false; sinLogin: false; usuario: Usuario | null; negocio: Negocio | null; userId: string };

export function useSesion(): Estado {
  const [estado, setEstado] = useState<Estado>({ cargando: true });

  useEffect(() => {
    let vivo = true;
    async function cargar() {
      const sb = supabase();
      const { data } = await sb.auth.getUser();
      if (!vivo) return;
      if (!data.user) return setEstado({ cargando: false, sinLogin: true });
      const { data: usuario } = await sb.from("usuarios").select("*").eq("id", data.user.id).maybeSingle();
      const { data: negocio } = usuario
        ? await sb.from("negocios").select("*").eq("id", usuario.negocio_id).maybeSingle()
        : { data: null };
      if (vivo) setEstado({ cargando: false, sinLogin: false, usuario, negocio, userId: data.user.id });
    }
    cargar();
    const { data: sub } = supabase().auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") setEstado({ cargando: false, sinLogin: true });
    });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);

  return estado;
}
