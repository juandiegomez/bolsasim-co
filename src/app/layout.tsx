import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "BolsaSim CO",
  description: "Simulador educativo de inversiones para Colombia.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
