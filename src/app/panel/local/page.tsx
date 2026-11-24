"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/formato";
import { usePanel } from "@/components/PanelContexto";
import { Apariencia } from "@/components/Apariencia";
import { Equipo } from "@/components/Equipo";
import type { Mesa, Usuario } from "@/lib/tipos";


export default function Local() {
  const { negocio, usuario } = usePanel();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [cantidad, setCantidad] = useState(1);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [m, u] = await Promise.all([
      sb.from("mesas").select("*").order("numero"),
      sb.from("usuarios").select("*").order("nombre"),
    ]);
    const lista = (m.data ?? []) as Mesa[];
    setMesas(lista); setEquipo(u.data ?? []);
    const base = window.location.origin;
    const pares = await Promise.all(lista.map(async (x) =>
      [x.id, await QRCode.toDataURL(`${base}/m/${x.codigo}`, { margin: 1, width: 360, color: { dark: "#2b1d16" } })] as const));
    setQrs(Object.fromEntries(pares));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function agregarMesas() {
    setError("");
    const desde = Math.max(0, ...mesas.map((m) => m.numero)) + 1;
    const filas = Array.from({ length: cantidad }, (_, i) => ({ negocio_id: negocio.id, numero: desde + i }));
    const { error } = await supabase().from("mesas").insert(filas);
    if (error) setError(mensajeError(error));
    cargar();
  }

  async function alternarMesa(m: Mesa) {
    await supabase().from("mesas").update({ activa: !m.activa }).eq("id", m.id);
    cargar();
  }

  return (
    <div>
      <div className="no-imprimir mb-4"><Apariencia negocio={negocio} /></div>
      <section className="no-imprimir mb-8 grid gap-4 md:grid-cols-2">
        <Equipo negocio={negocio} yo={usuario} equipo={equipo} onCambio={cargar} />
        <div className="tarjeta p-5">
          <h2 className="font-titulo text-xl">Mesas</h2>
          <p className="mt-1 text-sm text-suave">Cada mesa tiene su QR. Imprimilos y pegalos en las mesas.</p>
          <div className="mt-4 flex items-center gap-2">
            <input aria-label="Cantidad de mesas" type="number" min={1} max={50} className="campo w-24" value={cantidad} onChange={(e) => setCantidad(Math.max(1, Math.min(50, Number(e.target.value))))} />
            <button className="btn-primario" onClick={agregarMesas}>Agregar mesas</button>
          </div>
          <button className="btn-secundario mt-3 w-full" onClick={() => window.print()}>Imprimir todos los QR</button>
          {error && <p role="alert" className="mt-3 text-sm text-frutilla-osc">{error}</p>}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
        {mesas.map((m) => (
          <div key={m.id} className={`tarjeta break-inside-avoid p-4 text-center ${m.activa ? "" : "opacity-40 print:hidden"}`}>
            <p className="text-sm font-semibold text-suave">{negocio.nombre}</p>
            <p className="font-titulo text-3xl">Mesa {m.numero}</p>
            {qrs[m.id] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrs[m.id]} alt={`QR mesa ${m.numero}`} className="mx-auto my-2 w-full max-w-[180px]" />
            )}
            <p className="text-sm">Escaneá para ver la carta y pedir</p>
            <div className="no-imprimir mt-2 flex justify-center gap-3 text-sm">
              <a className="text-frutilla underline" href={`/m/${m.codigo}`} target="_blank">Probar</a>
              <button className="text-suave underline" onClick={() => alternarMesa(m)}>{m.activa ? "Desactivar" : "Activar"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
