import type { Instrument } from "./instrument";
import type { HistoricalSeries, PriceObservation } from "./market";
import { DomainError } from "./errors";
import { Money, roundMoney } from "./money";
import { Quantity, roundQuantity } from "./quantity";
import type { MarketDate } from "./transaction";
import { UnitPrice } from "./unit-price";
import Decimal from "decimal.js";

export interface HistoricalSimulationInput {
  readonly instrument: Instrument;
  readonly requestedAmount: Money;
  readonly requestedStartDate: MarketDate;
  readonly requestedEndDate: MarketDate | null;
  readonly initialPrice: PriceObservation;
  readonly finalPrice: PriceObservation;
  readonly series: HistoricalSeries;
}

export interface HistoricalSimulationPoint {
  readonly date: MarketDate;
  readonly price: UnitPrice;
  readonly value: Money;
}

export interface HistoricalSimulationResult {
  readonly instrument: Instrument;
  readonly requestedAmount: Money;
  readonly requestedStartDate: MarketDate;
  readonly requestedEndDate: MarketDate | null;
  readonly effectiveStartDate: MarketDate;
  readonly effectiveEndDate: MarketDate;
  readonly initialPrice: PriceObservation;
  readonly finalPrice: PriceObservation;
  readonly quantity: Quantity;
  readonly investedAmount: Money;
  readonly remainder: Money;
  readonly finalValue: Money;
  readonly pnl: Money;
  readonly returnPct: Decimal | null;
  readonly series: readonly HistoricalSimulationPoint[];
  readonly assumptions: readonly string[];
}

function priceFor(
  observation: PriceObservation,
  currency: Money["currency"],
): UnitPrice {
  if (observation.currency !== currency) {
    throw new DomainError(
      "CURRENCY_MISMATCH",
      "La simulación combina monedas distintas.",
    );
  }
  return UnitPrice.create(observation.close, currency);
}

function assertMarketData(
  input: HistoricalSimulationInput,
  observations: readonly PriceObservation[],
): void {
  const { instrument, requestedAmount, initialPrice, finalPrice } = input;
  if (!requestedAmount.amount.isPositive()) {
    throw new DomainError(
      "INVALID_MONEY",
      "El monto de la simulación debe ser positivo.",
    );
  }
  if (requestedAmount.currency !== instrument.currency) {
    throw new DomainError(
      "CURRENCY_MISMATCH",
      "El monto debe estar denominado en la moneda del instrumento.",
    );
  }
  if (input.series.instrumentId !== instrument.id) {
    throw new DomainError(
      "INVALID_PROVIDER_DATA",
      "La serie no corresponde al instrumento solicitado.",
    );
  }
  if (observations.length === 0) {
    throw new DomainError(
      "NO_MARKET_DATA",
      "No existen observaciones para la simulación.",
    );
  }
  if (
    initialPrice.instrumentId !== instrument.id ||
    finalPrice.instrumentId !== instrument.id
  ) {
    throw new DomainError(
      "INVALID_PROVIDER_DATA",
      "Los precios no corresponden al instrumento solicitado.",
    );
  }
  const basis = initialPrice.metadata.priceBasis;
  let previousDate: MarketDate | undefined;
  for (const observation of observations) {
    if (
      observation.instrumentId !== instrument.id ||
      observation.currency !== requestedAmount.currency ||
      observation.metadata.priceBasis !== basis
    ) {
      throw new DomainError(
        "INVALID_PROVIDER_DATA",
        "La serie contiene moneda o base de precio inconsistente.",
      );
    }
    if (previousDate && observation.sessionDate <= previousDate) {
      throw new DomainError(
        "INVALID_PROVIDER_DATA",
        "La serie no está ordenada o contiene sesiones duplicadas.",
      );
    }
    previousDate = observation.sessionDate;
    priceFor(observation, requestedAmount.currency);
  }
  if (
    initialPrice.metadata.priceBasis !== finalPrice.metadata.priceBasis ||
    initialPrice.currency !== requestedAmount.currency ||
    finalPrice.currency !== requestedAmount.currency
  ) {
    throw new DomainError(
      "INVALID_PROVIDER_DATA",
      "Los precios inicial y final no comparten moneda y base.",
    );
  }
  priceFor(initialPrice, requestedAmount.currency);
  priceFor(finalPrice, requestedAmount.currency);
  if (initialPrice.sessionDate > finalPrice.sessionDate) {
    throw new DomainError(
      "INVALID_DATE_RANGE",
      "La sesión inicial no puede ser posterior a la sesión final.",
    );
  }
}

// HIST-003/FIN-001/FIN-002/FIN-003: pure historical calculation. It receives
// resolved market observations and has no persistence or provider dependency.
export function calculateHistoricalInvestment(
  input: HistoricalSimulationInput,
): HistoricalSimulationResult {
  assertMarketData(input, input.series.observations);
  const currency = input.requestedAmount.currency;
  const initialUnitPrice = priceFor(input.initialPrice, currency);
  const quantity = roundQuantity(
    input.requestedAmount.amount.div(initialUnitPrice.amount),
  );
  if (quantity.value.isZero()) {
    throw new DomainError(
      "HISTORICAL_AMOUNT_TOO_SMALL",
      "El monto no alcanza para adquirir una fracción liquidable.",
    );
  }

  const investedAmount = roundMoney(
    quantity.value.mul(initialUnitPrice.amount),
    currency,
  );
  const remainder = input.requestedAmount.minus(investedAmount);
  const series = input.series.observations.map((observation) => {
    const price = priceFor(observation, currency);
    const marketValue = roundMoney(quantity.value.mul(price.amount), currency);
    return {
      date: observation.sessionDate,
      price,
      value: marketValue.plus(remainder),
    };
  });
  const finalValue = series.at(-1)?.value;
  if (!finalValue) {
    throw new DomainError(
      "NO_MARKET_DATA",
      "No existen observaciones para la simulación.",
    );
  }
  const pnl = finalValue.minus(input.requestedAmount);
  const returnPct = input.requestedAmount.amount.isZero()
    ? null
    : pnl.amount.div(input.requestedAmount.amount).mul(100);

  return {
    instrument: input.instrument,
    requestedAmount: input.requestedAmount,
    requestedStartDate: input.requestedStartDate,
    requestedEndDate: input.requestedEndDate,
    effectiveStartDate: input.initialPrice.sessionDate,
    effectiveEndDate: input.finalPrice.sessionDate,
    initialPrice: input.initialPrice,
    finalPrice: input.finalPrice,
    quantity,
    investedAmount,
    remainder,
    finalValue,
    pnl,
    returnPct,
    series,
    assumptions: [
      "La cantidad es teórica y se redondea hacia abajo a 8 decimales.",
      "El remanente permanece en efectivo durante todo el periodo.",
      "El resultado es retorno bruto: no incluye fees, dividendos ni impuestos.",
    ],
  };
}
