export type PendingCommandKey = {
  fingerprint: string;
  idempotencyKey: string;
};

function formValueFingerprint(value: FormDataEntryValue) {
  if (typeof value === "string") {
    return value;
  }

  return `${value.name}:${value.size}:${value.type}:${value.lastModified}`;
}

export function fingerprintCommandForm(formData: FormData) {
  return JSON.stringify(
    Array.from(formData.entries())
      .filter(([name]) => name !== "idempotencyKey")
      .map(([name, value]) => [name, formValueFingerprint(value)] as const)
      .sort(([leftName, leftValue], [rightName, rightValue]) =>
        leftName === rightName ? leftValue.localeCompare(rightValue) : leftName.localeCompare(rightName)
      )
  );
}

export function getOrCreateCommandKey(
  pendingKeys: Map<string, PendingCommandKey>,
  commandName: string,
  idempotencyPrefix: string,
  formData: FormData
) {
  const fingerprint = fingerprintCommandForm(formData);
  const existing = pendingKeys.get(commandName);

  if (existing?.fingerprint === fingerprint) {
    return existing.idempotencyKey;
  }

  const idempotencyKey = `${idempotencyPrefix}-${crypto.randomUUID()}`;
  pendingKeys.set(commandName, { fingerprint, idempotencyKey });
  return idempotencyKey;
}
