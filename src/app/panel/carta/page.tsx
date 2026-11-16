"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";
import type { Categoria, Producto, Sabor } from "@/lib/tipos";

type Edicion = Partial<Producto> & { categoria_id: string };

export default function Carta() {
  const { negocio } = usePanel();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [sabores, setSabores] = useState<Sabor[]>([]);
  const [editando, setEditando] = useState<Edicion | null>(null);
  const [nuevaCat, setNuevaCat] = useState("");
  const [nuevoSabor, setNuevoSabor] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [c, p, s] = await Promise.all([
      sb.from("categorias").select("*").order("orden").order("nombre"),
      sb.from("productos").select("*").order("orden").order("nombre"),
      sb.from("sabores").select("*").order("nombre"),
    ]);
    setCategorias(c.data ?? []); setProductos(p.data ?? []); setSabores(s.data ?? []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function ejecutar(promesa: PromiseLike<{ error: unknown }>) {
    setError("");
    const { error } = await promesa;
    if (error) setError(mensajeError(error));
    await cargar();
    return !error;
  }

  async function agregarCategoria(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaCat.trim()) return;
    if (await ejecutar(supabase().from("categorias").insert({ negocio_id: negocio.id, nombre: nuevaCat.trim(), orden: categorias.length + 1 }))) setNuevaCat("");
  }

  async function agregarSabor(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoSabor.trim()) return;
    if (await ejecutar(supabase().from("sabores").insert({ negocio_id: negocio.id, nombre: nuevoSabor.trim() }))) setNuevoSabor("");
  }

  async function guardarProducto(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    const datos = {
      negocio_id: negocio.id,
      categoria_id: editando.categoria_id,
      nombre: (editando.nombre ?? "").trim(),
      descripcion: editando.descripcion?.trim() || null,
      precio: Number(editando.precio ?? 0),
      foto_url: editando.foto_url?.trim() || null,
      max_sabores: Number(editando.max_sabores ?? 0),
      disponible: editando.disponible ?? true,
    };
    const sb = supabase().from("productos");
    if (await ejecutar(editando.id ? sb.update(datos).eq("id", editando.id) : sb.insert(datos))) setEditando(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="mb-4 font-titulo text-2xl font-bold">Carta</h1>
        {error && <p role="alert" className="mb-3 rounded-xl bg-frutilla/10 p-3 text-sm text-frutilla-osc">{error}</p>}
        <div className="space-y-6">
          {categorias.map((c) => (
            <section key={c.id} className="tarjeta p-4">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="flex-1 font-titulo text-xl font-bold">{c.nombre}</h2>
                <button className="btn-secundario py-1.5 text-sm" onClick={() => setEditando({ categoria_id: c.id, disponible: true, max_sabores: 0 })}>+ Producto</button>
                <button className="text-sm text-suave underline" onClick={() => {
                  if (confirm(`¿Borrar la categoría “${c.nombre}” y todos sus productos?`)) ejecutar(supabase().from("categorias").delete().eq("id", c.id));
                }}>Borrar</button>
              </div>
              <ul className="divide-y divide-borde">
                {productos.filter((p) => p.categoria_id === c.id).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${p.disponible ? "" : "text-suave line-through"}`}>{p.nombre}</p>
                      <p className="text-sm text-suave">
                        {precio(p.precio)}{p.max_sabores > 0 && ` · hasta ${p.max_sabores} sabores`}{!p.disponible && " · sin stock"}
                      </p>
                    </div>
                    <button className="text-sm font-semibold text-frutilla" onClick={() => setEditando(p)}>Editar</button>
                  </li>
                ))}
                {productos.every((p) => p.categoria_id !== c.id) && <li className="py-2 text-sm text-suave">Sin productos.</li>}
              </ul>
            </section>
          ))}
        </div>
        <form onSubmit={agregarCategoria} className="mt-4 flex gap-2">
          <input className="campo" placeholder="Nueva categoría (ej: Postres)" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} />
          <button className="btn-primario shrink-0">Agregar</button>
        </form>
      </div>

      <aside>
        <h2 className="mb-3 mt-1 font-titulo text-xl font-bold">Sabores</h2>
        <form onSubmit={agregarSabor} className="mb-3 flex gap-2">
          <input className="campo" placeholder="Nuevo sabor" value={nuevoSabor} onChange={(e) => setNuevoSabor(e.target.value)} />
          <button className="btn-primario shrink-0 px-4">+</button>
        </form>
        <ul className="tarjeta divide-y divide-borde">
          {sabores.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-4 py-2.5">
              <span className={`flex-1 ${s.disponible ? "" : "text-suave line-through"}`}>{s.nombre}</span>
              <button className="text-xs font-semibold text-suave" onClick={() => ejecutar(supabase().rpc("cambiar_disponible", { p_tipo: "sabor", p_id: s.id, p_disponible: !s.disponible }))}>
                {s.disponible ? "Hay" : "Sin stock"}
              </button>
              <button aria-label={`Borrar ${s.nombre}`} className="text-suave" onClick={() => {
                if (confirm(`¿Borrar el sabor “${s.nombre}”?`)) ejecutar(supabase().from("sabores").delete().eq("id", s.id));
              }}>✕</button>
            </li>
          ))}
        </ul>
      </aside>

      {editando && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-tinta/30 p-4" onClick={() => setEditando(null)}>
          <form onSubmit={guardarProducto} onClick={(e) => e.stopPropagation()} className="tarjeta max-h-[90dvh] w-full max-w-md overflow-y-auto bg-crema p-5">
            <h2 className="mb-4 font-titulo text-xl font-bold">{editando.id ? "Editar producto" : "Nuevo producto"}</h2>
            <label className="etiqueta" htmlFor="p-nombre">Nombre</label>
            <input id="p-nombre" required className="campo" value={editando.nombre ?? ""} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
            <label className="etiqueta mt-3" htmlFor="p-desc">Descripción</label>
            <input id="p-desc" className="campo" value={editando.descripcion ?? ""} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="etiqueta" htmlFor="p-precio">Precio ($)</label>
                <input id="p-precio" required type="number" min={0} step="1" inputMode="numeric" className="campo" value={editando.precio ?? ""} onChange={(e) => setEditando({ ...editando, precio: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </div>
              <div>
                <label className="etiqueta" htmlFor="p-sab">Sabores a elegir</label>
                <select id="p-sab" className="campo" value={editando.max_sabores ?? 0} onChange={(e) => setEditando({ ...editando, max_sabores: Number(e.target.value) })}>
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n === 0 ? "No lleva" : `Hasta ${n}`}</option>)}
                </select>
              </div>
            </div>
            <label className="etiqueta mt-3" htmlFor="p-cat">Categoría</label>
            <select id="p-cat" className="campo" value={editando.categoria_id} onChange={(e) => setEditando({ ...editando, categoria_id: e.target.value })}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <label className="etiqueta mt-3" htmlFor="p-foto">Foto (link, opcional)</label>
            <input id="p-foto" type="url" className="campo" value={editando.foto_url ?? ""} onChange={(e) => setEditando({ ...editando, foto_url: e.target.value })} placeholder="https://…" />
            <label className="mt-4 flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 accent-frutilla" checked={editando.disponible ?? true} onChange={(e) => setEditando({ ...editando, disponible: e.target.checked })} />
              Disponible
            </label>
            <div className="mt-5 flex gap-2">
              {editando.id && (
                <button type="button" className="btn-secundario text-frutilla-osc" onClick={async () => {
                  if (confirm("¿Borrar este producto? Las ventas pasadas no se pierden.") && await ejecutar(supabase().from("productos").delete().eq("id", editando.id!))) setEditando(null);
                }}>Borrar</button>
              )}
              <button type="button" className="btn-secundario ml-auto" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-primario">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
