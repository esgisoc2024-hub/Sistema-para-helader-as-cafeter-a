"use client";
// Video de presentación de la página de inicio: se ve la portada y empieza con sonido al tocar "Ver video".
import { useRef, useState } from "react";

export function VideoPresentacion({ src, portada, titulo }: { src: string; portada: string; titulo: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [reproduciendo, setReproduciendo] = useState(false);

  return (
    <div className="lp-video">
      <video ref={video} src={src} poster={portada} preload="metadata" playsInline controls={reproduciendo}
        aria-label={titulo} className="h-full w-full object-cover"
        onPlay={() => setReproduciendo(true)} onEnded={() => setReproduciendo(false)} />
      {!reproduciendo && (
        <button type="button" onClick={() => video.current?.play()} className="lp-video-play" aria-label={`Ver video: ${titulo}`}>
          <span className="lp-video-boton" aria-hidden>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
          </span>
          <span className="lp-mano text-2xl">mirá cómo funciona ♡</span>
        </button>
      )}
    </div>
  );
}
