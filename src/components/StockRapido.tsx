"use client";
// Interruptores "sin stock" para productos y sabores. Lo usa la barra y el dueño.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Producto, Sabor } from "@/lib/tipos";

export function StockRapido() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [sabores, setSabores] = useState<Sabor[]>([]);
  const [filtro, setFiltro] = useState("");

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [p, s] = await Promise.all([
      sb.from("productos").select("*").order("nombre"),
      sb.from("sabores").select("*").order("nombre"),
    ]);
    setProductos(p.data ?? []);
    setSabores(s.data ?? []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function alternar(tipo: "producto" | "sabor", id: string, disponible: boolean) {
    const set = tipo === "producto" ? setProductos : setSabores;
    set((l: (Producto | Sabor)[]) => l.map((x) => (x.id === id ? { ...x, disponible } : x)) as never);
    const { error } = await supabase().rpc("cambiar_disponible", { p_tipo: tipo, p_id: id, p_disponible: disponible });
    if (error) cargar();
  }

  const f = filtro.trim().toLowerCase();
  const coincide = (n: string) => !f || n.toLowerCase().includes(f);

  return (
    <div>
      <input className="campo" placeholder="Buscar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <Grupo titulo="Sabores" items={sabores.filter((s) => coincide(s.nombre))} onAlternar={(id, d) => alternar("sabor", id, d)} />
      <Grupo titulo="Productos" items={productos.filter((p) => coincide(p.nombre))} onAlternar={(id, d) => alternar("producto", id, d)} />
    </div>
  );
}

function Grupo({ titulo, items, onAlternar }: { titulo: string; items: { id: string; nombre: string; disponible: boolean }[]; onAlternar: (id: string, d: boolean) => void }) {
  return (
    <>
      <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-suave">{titulo}</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((x) => (
          <li key={x.id}>
            <button onClick={() => onAlternar(x.id, !x.disponible)} aria-pressed={!x.disponible}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left font-medium ${
                x.disponible ? "border-borde bg-papel" : "border-frutilla/40 bg-frutilla/10 text-frutilla-osc line-through"}`}>
              <span>{x.nombre}</span>
              <span className="text-xs font-semibold no-underline">{x.disponible ? "Hay" : "Sin stock"}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
