import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const titulo = Fraunces({ variable: "--font-titulo", subsets: ["latin"], weight: ["600", "700"] });
const texto = Inter({ variable: "--font-texto", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mesa Dulce · pedidos en mesa para heladerías y cafés",
  description: "Pedidos por QR, comandas en la barra y reportes para heladerías y cafeterías.",
};

export const viewport: Viewport = { themeColor: "#fff8ef", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className={`${titulo.variable} ${texto.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
