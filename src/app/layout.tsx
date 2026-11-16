import type { Metadata, Viewport } from "next";
// Fuentes incluidas en la app (no se descargan de Google al compilar).
import "@fontsource/lilita-one";
import "@fontsource-variable/nunito";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mesa Dulce · pedidos en mesa para heladerías y cafés",
  description: "Pedidos por QR, comandas en la barra y reportes para heladerías y cafeterías.",
};

export const viewport: Viewport = { themeColor: "#faf7f6", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
