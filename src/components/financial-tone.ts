export type FinancialTone = "positive" | "negative" | "neutral";

const ZERO_PATTERN = /^-?0(?:\.0+)?$/;

export function financialTone(
  amount: string | null | undefined,
): FinancialTone {
  const normalized = amount?.trim();
  if (!normalized || ZERO_PATTERN.test(normalized)) return "neutral";
  return normalized.startsWith("-") ? "negative" : "positive";
}

export function financialToneLabel(tone: FinancialTone): string {
  if (tone === "positive") return "Ganancia";
  if (tone === "negative") return "Pérdida";
  return "Sin variación";
}

export function formatSignedPercentage(
  percentage: string | null,
): string | null {
  const normalized = percentage?.trim();
  if (!normalized) return null;
  if (normalized.startsWith("-") || ZERO_PATTERN.test(normalized)) {
    return `${normalized}%`;
  }
  return `+${normalized}%`;
}

export function formatVisiblePercentage(
  percentage: string | null,
  amount: string | null | undefined,
): string | null {
  const formatted = formatSignedPercentage(percentage);
  const normalizedAmount = amount?.trim();
  const normalizedPercentage = percentage?.trim();
  if (
    formatted &&
    normalizedAmount &&
    normalizedPercentage &&
    ZERO_PATTERN.test(normalizedPercentage) &&
    !ZERO_PATTERN.test(normalizedAmount)
  ) {
    return "<0.01%";
  }
  return formatted;
}
