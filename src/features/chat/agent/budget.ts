import { z } from "zod";
const usd = z.string().regex(/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,12})?$/);
const schema = z
  .object({
    capUsd: usd.nullable(),
    spentUsd: usd,
    reservedUsd: usd,
    maxCallUsd: usd.nullable(),
  })
  .strict();
/** Exact pico-dollars avoid floating-point under-reservation at a hard cap. SQL repeats this under lock. */
export function usdUnits(input: unknown): bigint {
  const value = usd.parse(input),
    [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * BigInt("1000000000000") + BigInt(fraction.padEnd(12, "0"))
  );
}
export function budgetAdmission(raw: unknown): boolean {
  const input = schema.parse(raw);
  if (input.maxCallUsd === null || usdUnits(input.maxCallUsd) === BigInt(0))
    return false;
  return (
    input.capUsd === null ||
    usdUnits(input.spentUsd) +
      usdUnits(input.reservedUsd) +
      usdUnits(input.maxCallUsd) <=
      usdUnits(input.capUsd)
  );
}
