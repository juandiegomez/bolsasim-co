import { InstrumentDetail } from "@/components/instrument-detail";

export const metadata = {
  title: "Detalle de instrumento · BolsaSim CO",
  description: "Metadata, último cierre e histórico del instrumento.",
};

export default async function InstrumentDetailPage({
  params,
}: {
  params: Promise<{ instrumentId: string }>;
}) {
  const { instrumentId } = await params;
  return (
    <section aria-labelledby="instrument-title">
      <p className="eyebrow">Detalle</p>
      <h1 id="instrument-title">Instrumento</h1>
      <InstrumentDetail instrumentId={instrumentId} />
    </section>
  );
}
