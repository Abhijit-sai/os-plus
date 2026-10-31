import { z } from "zod";
/** Shared across text and image captions so no delivery path weakens the customer boundary. */
export const customerTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(6000)
  .refine(
    (value) =>
      !/[{}\[\]]|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|\b(?:tenant_id|correlation_id|quiet_until|api[_ -]?key|access[_ -]?token|understanding_json|decision_json|stack trace|system prompt)\b/i.test(
        value,
      ),
    "Unsafe reply.",
  );
