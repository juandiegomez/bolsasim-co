import { InstrumentExplorer } from "@/components/instrument-explorer";

export const metadata = {
  title: "Explorar instrumentos · BolsaSim CO",
  description: "Búsqueda y detalle de instrumentos del simulador.",
};

export default function InstrumentsPage() {
  return (
    <section aria-labelledby="instruments-title">
      <p className="eyebrow">Explorar</p>
      <h1 id="instruments-title">Instrumentos</h1>
      <InstrumentExplorer />
    </section>
  );
}
