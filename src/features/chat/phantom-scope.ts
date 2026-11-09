// Stable tenant IDs keep the boutique workflow out of other brands' conversations.
const phantomTenants = new Set([
  "364f9052-2ec4-45c1-aeca-70618b37265c",
  "7be40f50-94a0-46c5-af57-7eea5e36ea8a",
]);

export function usesPhantomWorkflow(tenantId: string) {
  return phantomTenants.has(tenantId);
}
