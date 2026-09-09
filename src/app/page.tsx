import { PortfolioDashboard } from "@/components/portfolio-dashboard";

export default function Home() {
  return (
    <section aria-labelledby="page-title">
      <p className="eyebrow">Portafolio</p>
      <h1 id="page-title">BolsaSim CO</h1>
      <PortfolioDashboard />
    </section>
  );
}
