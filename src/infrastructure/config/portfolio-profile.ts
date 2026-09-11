import { Money } from "@/domain/money";
import type { Environment } from "./env";

export function getConfiguredInitialDeposit(environment: Environment): Money {
  const amount =
    environment.INITIAL_DEPOSIT_AMOUNT ??
    environment.INITIAL_DEPOSIT_COP ??
    "10000000.00";
  return Money.create(amount, environment.SETTLEMENT_CURRENCY);
}
