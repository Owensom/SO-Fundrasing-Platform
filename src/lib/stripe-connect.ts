import { query } from "@/lib/db";

type StripeAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  country?: string | null;
  default_currency?: string | null;
};

type StripeAccountLink = {
  object: "account_link";
  created: number;
  expires_at: number;
  url: string;
};

function getStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  return key;
}

async function stripeRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: URLSearchParams;
  } = {},
): Promise<T> {
  const method = options.method || "GET";

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: method === "POST" ? options.body?.toString() : undefined,
    cache: "no-store",
  });

  const text = await response.text();

  let parsed: any = null;

  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Stripe returned a non-JSON response: ${text.slice(0, 160)}`);
  }

  if (!response.ok) {
    throw new Error(
      parsed?.error?.message ||
        parsed?.error ||
        `Stripe request failed with status ${response.status}`,
    );
  }

  return parsed as T;
}

export async function createStripeConnectAccount({
  tenantSlug,
  email,
}: {
  tenantSlug: string;
  email?: string | null;
}) {
  const body = new URLSearchParams();

  body.set("type", "express");
  body.set("country", "GB");

  if (email) {
    body.set("email", email);
  }

  body.set("capabilities[card_payments][requested]", "true");
  body.set("capabilities[transfers][requested]", "true");
  body.set("metadata[tenant_slug]", tenantSlug);

  return stripeRequest<StripeAccount>("/accounts", {
    method: "POST",
    body,
  });
}

export async function createStripeConnectAccountLink({
  accountId,
  origin,
}: {
  accountId: string;
  origin: string;
}) {
  const body = new URLSearchParams();

  body.set("account", accountId);
  body.set("type", "account_onboarding");
  body.set("refresh_url", `${origin}/api/stripe/connect/refresh`);
  body.set(
    "return_url",
    `${origin}/admin/settings/billing?stripe_connect=returned`,
  );

  return stripeRequest<StripeAccountLink>("/account_links", {
    method: "POST",
    body,
  });
}

export async function retrieveStripeConnectAccount(accountId: string) {
  const cleanAccountId = String(accountId || "").trim();

  if (!cleanAccountId) {
    throw new Error("Missing Stripe Connect account ID");
  }

  return stripeRequest<StripeAccount>(
    `/accounts/${encodeURIComponent(cleanAccountId)}`,
  );
}

export async function saveTenantStripeConnectAccount({
  tenantSlug,
  account,
}: {
  tenantSlug: string;
  account: StripeAccount;
}) {
  const accountId = String(account.id || "").trim();

  if (!tenantSlug || !accountId) {
    throw new Error("Missing tenant slug or Stripe Connect account ID");
  }

  await query(
    `
      update tenants
      set
        stripe_connect_account_id = $1,
        stripe_connect_onboarding_complete = $2,
        stripe_connect_charges_enabled = $3,
        stripe_connect_payouts_enabled = $4,
        stripe_connect_details_submitted = $5,
        stripe_connect_country = $6,
        stripe_connect_default_currency = $7,
        stripe_connect_last_synced_at = now(),
        updated_at = now()
      where slug = $8
    `,
    [
      accountId,
      Boolean(account.details_submitted),
      Boolean(account.charges_enabled),
      Boolean(account.payouts_enabled),
      Boolean(account.details_submitted),
      account.country || null,
      account.default_currency || null,
      tenantSlug,
    ],
  );

  await query(
    `
      update tenant_settings
      set
        stripe_connect_account_id = $1,
        updated_at = now()
      where tenant_slug = $2
    `,
    [accountId, tenantSlug],
  );
}

export async function getTenantStripeConnectAccountId(tenantSlug: string) {
  const rows = await query<{
    stripe_connect_account_id: string | null;
  }>(
    `
      select stripe_connect_account_id
      from tenants
      where slug = $1
      limit 1
    `,
    [tenantSlug],
  );

  return rows[0]?.stripe_connect_account_id || null;
}
