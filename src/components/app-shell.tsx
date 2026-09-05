import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header>
        <Link className="brand" href="/">
          BolsaSim CO
        </Link>
        <span>Simulador educativo</span>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer>
        Capital ficticio. Los resultados históricos no garantizan resultados
        futuros y no constituyen asesoría financiera.
      </footer>
    </>
  );
}
