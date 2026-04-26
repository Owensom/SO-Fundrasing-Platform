// src/lib/campaigns.ts
// =======================================
// Full restore with 'type' field added
// Preserves all helpers and exports for multi-tenant platform
// =======================================

import { query, queryOne } from "@/lib/db";

// Campaign type
export type Campaign = {
  id: string;
  title: string;
  slug: string;
  description: string;
  tenant_slug: string;
  type: string; // ✅ Added to match page expectation
  image_url?: string;
  start_date?: string;
  end_date?: string;
  status: string;
};

// ------------------------------
// Fetch a single campaign by slug
// ------------------------------
export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  return await queryOne<Campaign>(
    "SELECT * FROM campaigns WHERE slug = $1",
    [slug]
  );
}

// ------------------------------
// Fetch all campaigns for a tenant
// ------------------------------
export async function getAllCampaignsForTenant(tenantSlug: string): Promise<Campaign[]> {
  return await query<Campaign>(
    "SELECT * FROM campaigns WHERE tenant_slug = $1 ORDER BY start_date DESC",
    [tenantSlug]
  );
}

// ------------------------------
// Any additional helpers
// Add other helpers exactly as they existed in your previous working version
// ------------------------------
