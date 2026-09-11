import { HistoricalSimulator } from "@/components/historical-simulator";

export const metadata = {
  title: "Simulación histórica · BolsaSim CO",
  description: "Explora qué habría ocurrido con una inversión histórica.",
};

export default function HistoricalSimulatorPage() {
  return (
    <section aria-labelledby="historical-title">
      <p className="eyebrow">Aprender con historia</p>
      <h1 id="historical-title">Simulación histórica</h1>
      <p>
        Elige una acción, un monto y un periodo. Esta simulación es
        independiente de tu portafolio y no crea movimientos.
      </p>
      <HistoricalSimulator />
    </section>
  );
}
