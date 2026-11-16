"use client";
// Interruptores "sin stock" para opciones (sabores, leches…) y productos. Lo usa la barra y el dueño.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { GrupoOpciones, Opcion, Producto } from "@/lib/tipos";

type Item = { id: string; nombre: string; disponible: boolean };

export function StockRapido() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpciones[]>([]);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [filtro, setFiltro] = useState("");

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [p, g, o] = await Promise.all([
      sb.from("productos").select("*").order("nombre"),
      sb.from("grupos_opciones").select("*").order("orden"),
      sb.from("opciones").select("*").order("orden").order("nombre"),
    ]);
    setProductos(p.data ?? []); setGrupos(g.data ?? []); setOpciones(o.data ?? []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function alternar(tipo: "producto" | "opcion", id: string, disponible: boolean) {
    if (tipo === "producto") setProductos((l) => l.map((x) => (x.id === id ? { ...x, disponible } : x)));
    else setOpciones((l) => l.map((x) => (x.id === id ? { ...x, disponible } : x)));
    const { error } = await supabase().rpc("cambiar_disponible", { p_tipo: tipo, p_id: id, p_disponible: disponible });
    if (error) cargar();
  }

  const f = filtro.trim().toLowerCase();
  const coincide = (n: string) => !f || n.toLowerCase().includes(f);

  return (
    <div>
      <input className="campo" placeholder="Buscar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      {grupos.map((g) => {
        const items = opciones.filter((o) => o.grupo_id === g.id && coincide(o.nombre));
        return items.length > 0 && <Grupo key={g.id} titulo={g.nombre} items={items} onAlternar={(id, d) => alternar("opcion", id, d)} />;
      })}
      <Grupo titulo="Productos" items={productos.filter((p) => coincide(p.nombre))} onAlternar={(id, d) => alternar("producto", id, d)} />
    </div>
  );
}

function Grupo({ titulo, items, onAlternar }: { titulo: string; items: Item[]; onAlternar: (id: string, d: boolean) => void }) {
  return (
    <>
      <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-suave">{titulo}</h3>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((x) => (
          <li key={x.id}>
            <button onClick={() => onAlternar(x.id, !x.disponible)} aria-pressed={!x.disponible}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left font-medium ${
                x.disponible ? "border-borde bg-papel" : "border-frutilla/40 bg-frutilla/10 text-frutilla-osc"}`}>
              <span className={x.disponible ? "" : "line-through"}>{x.nombre}</span>
              <span className="text-xs font-semibold">{x.disponible ? "Hay" : "Sin stock"}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
