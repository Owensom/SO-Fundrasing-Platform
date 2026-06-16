"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

const ALLOWED_FULFILMENT_STATUSES = new Set([
  "not_started",
  "ready_for_collection",
  "ready_for_delivery",
  "arranged",
  "collected",
  "delivered",
  "posted",
]);

const COMPLETED_FULFILMENT_STATUSES = new Set([
  "collected",
  "delivered",
  "posted",
]);

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function limitText(value: unknown, maxLength: number) {
  const clean = cleanText(value);

  if (!clean) return null;

  return clean.slice(0, maxLength);
}

async function requireTenantAccess() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return tenantSlug;
}

export async function updateMerchandiseOrderFulfilment(formData: FormData) {
  const tenantSlug = await requireTenantAccess();

  const orderId = cleanText(formData.get("orderId"));
  const fulfilmentStatus = cleanText(formData.get("fulfilmentStatus"));
  const internalNote = limitText(formData.get("internalNote"), 1200);

  if (!orderId || !ALLOWED_FULFILMENT_STATUSES.has(fulfilmentStatus)) {
    redirect("/admin/merchandise/fulfilment?error=invalid_fulfilment_update");
  }

  const completed = COMPLETED_FULFILMENT_STATUSES.has(fulfilmentStatus);

  await query(
    `
      update merchandise_orders
         set fulfilment_status = $3,
             internal_note = $4,
             fulfilled_at = case
               when $5::boolean = true then coalesce(fulfilled_at, now())
               else null
             end,
             status = case
               when $5::boolean = true then 'fulfilled'
               when status = 'fulfilled' then 'paid'
               else status
             end,
             updated_at = now()
       where id = $1::uuid
         and tenant_slug = $2
         and status in ('paid', 'fulfilled', 'part_fulfilled')
    `,
    [orderId, tenantSlug, fulfilmentStatus, internalNote, completed],
  );

  revalidatePath("/admin/merchandise/fulfilment");
  revalidatePath("/admin/merchandise/orders");
  redirect("/admin/merchandise/fulfilment?saved=fulfilment");
}
