type Confirmation = { ok: boolean; message: string; uncertain?: boolean };
/** A lost response may follow a committed transaction. Retain its exact payload/key until
 * confirmed; changed input must wait for a reload instead of creating a second operation. */
export function createConfirmedCommand<T extends Confirmation>(
  send: (input: unknown, key: string) => Promise<T>,
  newKey: () => string,
) {
  let attempt: { key: string; fingerprint: string; uncertain: boolean } | null =
    null;
  return {
    async run(input: unknown): Promise<T | Confirmation> {
      const fingerprint = JSON.stringify(input);
      if (attempt?.uncertain && attempt.fingerprint !== fingerprint)
        return {
          ok: false,
          uncertain: true,
          message:
            "The previous change is unconfirmed. Reload this record before submitting different changes.",
        };
      if (!attempt || attempt.fingerprint !== fingerprint)
        attempt = { key: newKey(), fingerprint, uncertain: false };
      const current = attempt;
      try {
        const result = await send(input, current.key);
        attempt = result.ok ? null : { ...current, uncertain: false };
        return result;
      } catch {
        attempt = { ...current, uncertain: true };
        return {
          ok: false,
          uncertain: true,
          message:
            "We could not confirm this change. Your inputs are kept. Retry the same change or reload to check whether it was saved.",
        };
      }
    },
  };
}
