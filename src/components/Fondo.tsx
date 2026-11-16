// Trasfondo difuminado de toda la pantalla: la portada del local (foto o video) muy desenfocada,
// o manchas de colores de helado que se mueven despacio. Un velo claro encima mantiene todo legible.
export function Fondo({ url, tipo }: { url?: string | null; tipo?: "imagen" | "video" | null }) {
  return (
    <div aria-hidden className="fondo">
      {url && tipo === "video" && <video src={url} className="fondo-media" autoPlay muted loop playsInline />}
      {url && tipo !== "video" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="fondo-media" />
      )}
      {!url && (
        <>
          <span className="fondo-bola" style={{ background: "#f79ab4", left: "-12%", top: "-8%" }} />
          <span className="fondo-bola" style={{ background: "#f8c66b", right: "-18%", top: "22%", animationDelay: "-6s" }} />
          <span className="fondo-bola" style={{ background: "#a9d6a0", left: "-15%", bottom: "8%", animationDelay: "-11s" }} />
          <span className="fondo-bola" style={{ background: "#c79a80", right: "-10%", bottom: "-12%", animationDelay: "-3s" }} />
        </>
      )}
      <div className={url ? "fondo-velo" : "fondo-velo fondo-velo-suave"} />
    </div>
  );
}
