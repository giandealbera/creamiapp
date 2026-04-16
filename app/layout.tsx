import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreaMiApp — Creá tu app sin programar",
  description: "Describí tu idea y la IA construye tu página o app en segundos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
