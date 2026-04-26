// src/lib/campaigns.ts
// =======================================
// Preserves all previous exports and query usage
// Uses TLS-safe db helpers
// =======================================
import { query, queryOne } from "@/lib/db";

export async function getCampaignBySlug(slug: string) {
  return await queryOne("SELECT * FROM campaigns WHERE slug = $1", [slug]);
}

export async function listCampaignsForTenant(tenantSlug: string) {
  return await query("SELECT * FROM campaigns WHERE tenant_slug = $1", [tenantSlug]);
}
