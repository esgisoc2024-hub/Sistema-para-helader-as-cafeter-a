"use client";
// Formulario corto para pagar (todo o una parte) una cuenta por pagar.
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { mensajeError, precio } from "@/lib/formato";
import { MEDIOS_PAGO, type CuentaPagar } from "@/lib/administracion";

export function PagarGasto({ cuenta, onPagado, onCancelar }: { cuenta: CuentaPagar; onPagado: () => void; onCancelar: () => void }) {
  const [monto, setMonto] = useState(String(Number(cuenta.saldo)));
  const [medio, setMedio] = useState("efectivo");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  return (
    <form className="mt-3 animate-entrar rounded-[20px] bg-crema/90 p-3" onSubmit={async (e) => {
      e.preventDefault(); setEnviando(true); setError("");
      const { error } = await supabase().rpc("pagar_gasto", { p_gasto: cuenta.id, p_monto: Number(monto), p_medio: medio });
      setEnviando(false);
      if (error) return setError(mensajeError(error));
      onPagado();
    }}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-32 flex-1 flex-col"><span className="etiqueta">Monto a pagar ($)</span>
          <input required type="number" min={1} max={Number(cuenta.saldo)} step="1" inputMode="numeric" className="campo py-2"
            value={monto} onChange={(e) => setMonto(e.target.value)} /></label>
        <label className="flex flex-col"><span className="etiqueta">Medio</span>
          <select className="campo py-2" value={medio} onChange={(e) => setMedio(e.target.value)}>
            {Object.entries(MEDIOS_PAGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select></label>
        <button type="button" className="btn-secundario py-2" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primario py-2" disabled={enviando}>{enviando ? "Pagando…" : "Pagar"}</button>
      </div>
      {Number(monto) < Number(cuenta.saldo) && Number(monto) > 0 && (
        <p className="mt-2 text-sm text-suave">Pago parcial: quedan {precio(Number(cuenta.saldo) - Number(monto))} por pagar.</p>
      )}
      {medio === "efectivo" && <p className="mt-1 text-xs text-suave">Si hay una caja abierta, sale de la caja.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-frutilla-osc">{error}</p>}
    </form>
  );
}
