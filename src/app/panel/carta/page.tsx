"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";
import { SubirImagen } from "@/components/SubirImagen";
import { borrarImagen } from "@/lib/imagenes";
import type { Categoria, GrupoOpciones, Opcion, Producto, ProductoGrupo } from "@/lib/tipos";

type Vinculo = { activo: boolean; minimo: number; maximo: number };
type Edicion = Partial<Producto> & { categoria_id: string; vinculos: Record<string, Vinculo> };

export default function Carta() {
  const { negocio } = usePanel();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpciones[]>([]);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [vinculos, setVinculos] = useState<ProductoGrupo[]>([]);
  const [editando, setEditando] = useState<Edicion | null>(null);
  const [nuevaCat, setNuevaCat] = useState("");
  const [nuevoGrupo, setNuevoGrupo] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [c, p, g, o, v] = await Promise.all([
      sb.from("categorias").select("*").order("orden").order("nombre"),
      sb.from("productos").select("*").order("orden").order("nombre"),
      sb.from("grupos_opciones").select("*").order("orden").order("nombre"),
      sb.from("opciones").select("*").order("orden").order("nombre"),
      sb.from("producto_grupos").select("*").order("orden"),
    ]);
    setCategorias(c.data ?? []); setProductos(p.data ?? []); setGrupos(g.data ?? []);
    setOpciones(o.data ?? []); setVinculos(v.data ?? []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function ejecutar(promesa: PromiseLike<{ error: unknown }>) {
    setError("");
    const { error } = await promesa;
    if (error) setError(mensajeError(error));
    await cargar();
    return !error;
  }

  function abrirProducto(p: Partial<Producto> & { categoria_id: string }) {
    const v: Record<string, Vinculo> = {};
    for (const g of grupos) {
      const actual = vinculos.find((x) => x.producto_id === p.id && x.grupo_id === g.id);
      v[g.id] = actual ? { activo: true, minimo: actual.minimo, maximo: actual.maximo } : { activo: false, minimo: 1, maximo: 1 };
    }
    setEditando({ disponible: true, ...p, vinculos: v });
  }

  async function guardarProducto(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setError("");
    const sb = supabase();
    const datos = {
      negocio_id: negocio.id,
      categoria_id: editando.categoria_id,
      nombre: (editando.nombre ?? "").trim(),
      descripcion: editando.descripcion?.trim() || null,
      precio: Number(editando.precio ?? 0),
      foto_url: editando.foto_url?.trim() || null,
      disponible: editando.disponible ?? true,
    };
    const res = editando.id
      ? await sb.from("productos").update(datos).eq("id", editando.id).select("id").single()
      : await sb.from("productos").insert(datos).select("id").single();
    if (res.error || !res.data) return setError(mensajeError(res.error));
    const id = res.data.id as string;
    const fotoAnterior = productos.find((p) => p.id === id)?.foto_url;
    if (fotoAnterior && fotoAnterior !== datos.foto_url) borrarImagen(fotoAnterior);
    // Reemplaza los grupos de opciones del producto por los marcados.
    const filas = grupos
      .filter((g) => editando.vinculos[g.id]?.activo)
      .map((g, i) => {
        const v = editando.vinculos[g.id];
        return { negocio_id: negocio.id, producto_id: id, grupo_id: g.id, minimo: Math.min(v.minimo, v.maximo), maximo: v.maximo, orden: i + 1 };
      });
    const borrado = await sb.from("producto_grupos").delete().eq("producto_id", id);
    if (borrado.error) return setError(mensajeError(borrado.error));
    if (filas.length && !(await ejecutar(sb.from("producto_grupos").insert(filas)))) return;
    await cargar();
    setEditando(null);
  }

  const resumenGrupos = (productoId: string) =>
    vinculos.filter((v) => v.producto_id === productoId)
      .map((v) => grupos.find((g) => g.id === v.grupo_id)?.nombre).filter(Boolean).join(", ");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-4 font-titulo text-2xl font-bold">Carta</h1>
        {error && <p role="alert" className="mb-3 rounded-xl bg-frutilla/10 p-3 text-sm text-frutilla-osc">{error}</p>}
        <div className="space-y-6">
          {categorias.map((c) => (
            <section key={c.id} className="tarjeta p-4">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="flex-1 font-titulo text-xl font-bold">{c.nombre}</h2>
                <button className="btn-secundario py-1.5 text-sm" onClick={() => abrirProducto({ categoria_id: c.id })}>+ Producto</button>
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
                        {precio(p.precio)}{resumenGrupos(p.id) && ` · ${resumenGrupos(p.id)}`}{!p.disponible && " · sin stock"}
                      </p>
                    </div>
                    <button className="text-sm font-semibold text-frutilla" onClick={() => abrirProducto(p)}>Editar</button>
                  </li>
                ))}
                {productos.every((p) => p.categoria_id !== c.id) && <li className="py-2 text-sm text-suave">Sin productos.</li>}
              </ul>
            </section>
          ))}
        </div>
        <form className="mt-4 flex gap-2" onSubmit={async (e) => {
          e.preventDefault();
          if (nuevaCat.trim() && await ejecutar(supabase().from("categorias").insert({ negocio_id: negocio.id, nombre: nuevaCat.trim(), orden: categorias.length + 1 }))) setNuevaCat("");
        }}>
          <input className="campo" placeholder="Nueva categoría (ej: Postres)" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} />
          <button className="btn-primario shrink-0">Agregar</button>
        </form>
      </div>

      <aside>
        <h2 className="mt-1 font-titulo text-xl font-bold">Opciones</h2>
        <p className="mb-3 mt-1 text-sm text-suave">Listas que el cliente elige al pedir: sabores, leche, tamaño, extras. Después marcás en cada producto cuáles usa.</p>
        <div className="space-y-4">
          {grupos.map((g) => (
            <GrupoEditor key={g.id} grupo={g} opciones={opciones.filter((o) => o.grupo_id === g.id)} negocioId={negocio.id} ejecutar={ejecutar} />
          ))}
        </div>
        <form className="mt-4 flex gap-2" onSubmit={async (e) => {
          e.preventDefault();
          if (nuevoGrupo.trim() && await ejecutar(supabase().from("grupos_opciones").insert({ negocio_id: negocio.id, nombre: nuevoGrupo.trim(), orden: grupos.length + 1 }))) setNuevoGrupo("");
        }}>
          <input className="campo" placeholder="Nueva lista (ej: Tipo de pan)" value={nuevoGrupo} onChange={(e) => setNuevoGrupo(e.target.value)} />
          <button className="btn-primario shrink-0 px-4">+</button>
        </form>
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
                <input id="p-precio" required type="number" min={0} step="1" inputMode="numeric" className="campo" value={editando.precio ?? ""}
                  onChange={(e) => setEditando({ ...editando, precio: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </div>
              <div>
                <label className="etiqueta" htmlFor="p-cat">Categoría</label>
                <select id="p-cat" className="campo" value={editando.categoria_id} onChange={(e) => setEditando({ ...editando, categoria_id: e.target.value })}>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>

            {grupos.length > 0 && (
              <fieldset className="mt-4">
                <legend className="etiqueta">Qué elige el cliente</legend>
                <ul className="space-y-2">
                  {grupos.map((g) => {
                    const v = editando.vinculos[g.id];
                    const cambiar = (nuevo: Partial<Vinculo>) =>
                      setEditando({ ...editando, vinculos: { ...editando.vinculos, [g.id]: { ...v, ...nuevo } } });
                    return (
                      <li key={g.id} className={`rounded-xl border p-3 ${v.activo ? "border-frutilla/50 bg-papel" : "border-borde"}`}>
                        <label className="flex items-center gap-3 font-medium">
                          <input type="checkbox" className="h-4 w-4 accent-frutilla" checked={v.activo} onChange={(e) => cambiar({ activo: e.target.checked })} />
                          {g.nombre}
                        </label>
                        {v.activo && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 pl-7 text-sm">
                            <select aria-label={`Obligatorio en ${g.nombre}`} className="rounded-lg border border-borde bg-papel px-2 py-1.5"
                              value={v.minimo > 0 ? "si" : "no"} onChange={(e) => cambiar({ minimo: e.target.value === "si" ? 1 : 0 })}>
                              <option value="si">Obligatorio</option>
                              <option value="no">Opcional</option>
                            </select>
                            <span>hasta</span>
                            <select aria-label={`Máximo en ${g.nombre}`} className="rounded-lg border border-borde bg-papel px-2 py-1.5"
                              value={v.maximo} onChange={(e) => cambiar({ maximo: Number(e.target.value) })}>
                              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}

            <div className="mt-4">
              <SubirImagen negocioId={negocio.id} tipo="producto" url={editando.foto_url} etiqueta="Foto (opcional)"
                onCambio={(url) => setEditando({ ...editando, foto_url: url })} />
            </div>
            <label className="mt-4 flex items-center gap-3">
              <input type="checkbox" className="h-4 w-4 accent-frutilla" checked={editando.disponible ?? true} onChange={(e) => setEditando({ ...editando, disponible: e.target.checked })} />
              Disponible
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-frutilla-osc">{error}</p>}
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

function GrupoEditor({ grupo, opciones, negocioId, ejecutar }: {
  grupo: GrupoOpciones; opciones: Opcion[]; negocioId: string;
  ejecutar: (p: PromiseLike<{ error: unknown }>) => Promise<boolean>;
}) {
  const [nombre, setNombre] = useState("");
  const [extra, setExtra] = useState("");
  const sb = supabase();

  return (
    <section className="tarjeta p-4">
      <div className="mb-2 flex items-center">
        <h3 className="flex-1 font-semibold">{grupo.nombre}</h3>
        <button className="text-sm text-suave underline" onClick={() => {
          if (confirm(`¿Borrar la lista “${grupo.nombre}” y sus opciones? Se quita de todos los productos.`)) ejecutar(sb.from("grupos_opciones").delete().eq("id", grupo.id));
        }}>Borrar</button>
      </div>
      <ul className="divide-y divide-borde">
        {opciones.map((o) => (
          <li key={o.id} className="flex items-center gap-2 py-2 text-sm">
            <span className={`flex-1 ${o.disponible ? "" : "text-suave line-through"}`}>
              {o.nombre}{Number(o.precio_extra) > 0 && <span className="text-suave"> · +{precio(o.precio_extra)}</span>}
            </span>
            <button className="text-xs font-semibold text-suave" onClick={() => ejecutar(sb.rpc("cambiar_disponible", { p_tipo: "opcion", p_id: o.id, p_disponible: !o.disponible }))}>
              {o.disponible ? "Hay" : "Sin stock"}
            </button>
            <button aria-label={`Borrar ${o.nombre}`} className="text-suave" onClick={() => {
              if (confirm(`¿Borrar “${o.nombre}”?`)) ejecutar(sb.from("opciones").delete().eq("id", o.id));
            }}>✕</button>
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        const ok = await ejecutar(sb.from("opciones").insert({
          negocio_id: negocioId, grupo_id: grupo.id, nombre: nombre.trim(), precio_extra: Number(extra || 0), orden: opciones.length + 1,
        }));
        if (ok) { setNombre(""); setExtra(""); }
      }}>
        <input aria-label={`Nueva opción en ${grupo.nombre}`} className="campo py-2 text-sm" placeholder="Nueva opción" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input aria-label="Precio extra" type="number" min={0} inputMode="numeric" className="campo w-24 py-2 text-sm" placeholder="+$" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <button className="btn-secundario shrink-0 px-3 py-2 text-sm">+</button>
      </form>
    </section>
  );
}
