export async function getPublicRaffleBySlug(
  slug: string,
  tenantSlug = "demo-a"
): Promise<RaffleDetails> {
  const result = await request<ApiEnvelope<RaffleDetails>>(
    `/api/public?slug=${encodeURIComponent(slug)}&tenantSlug=${encodeURIComponent(
      tenantSlug
    )}`
  );

  if (!result.item) {
    throw new Error("Raffle not found");
  }

  return result.item;
}
