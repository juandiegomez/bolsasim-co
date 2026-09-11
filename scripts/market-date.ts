const MARKET_TIME_ZONE = "America/New_York";

export function currentMarketDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isDatasetStale(
  cutoffDate: string | undefined,
  marketDate: string,
): boolean {
  return !cutoffDate || cutoffDate < marketDate;
}
