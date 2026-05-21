import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  canPublishAnotherCampaign,
  checkSubscriptionCapability,
  getCampaignLimitMessage,
  getTierLabel,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import { sendAuctionWinnerEmail } from "@/lib/email";
import { listSquaresGames } from "../../../../../api/_lib/squares-repo";
import { listEvents } from "../../../../../api/_lib/events-repo";
import {
  createAuctionItem,
  deleteAuction,
  deleteAuctionItem,
  getAuctionById,
  listAuctionBids,
  listAuctionItems,
  listAuctions,
  updateAuction,
  updateAuctionItem,
  type AuctionItemStatus,
  type AuctionStatus,
  type SilentAuctionBid,
} from "../../../../../api/_lib/auctions-repo";

const DEFAULT_AUCTION_IMAGE = "/brand/so-default-auctions.png";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

type RaffleItem = {
  id: string;
  status: string;
};

type RafflesApiResponse = {
  ok: boolean;
  items?: RaffleItem[];
};

type WinningBidSummary = {
  bid_id: string;
  bidder_name: string | null;
  bidder_email: string | null;
  amount_cents: number;
  payment_token: string | null;
  payment_status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
};

function moneyFromCents(cents: number | null | undefined, currency = "GBP") {
  const amount = Number(cents || 0) / 100;

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

function poundsToCents(value: FormDataEntryValue | null) {
  const raw = String(value || "").replace(/[£,\s]/g, "").trim();
  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount < 0) return 0;

  return Math.round(amount * 100);
}

function optionalPoundsToCents(value: FormDataEntryValue | null) {
  const raw = String(value || "").replace(/[£,\s]/g, "").trim();

  if (!raw) return null;

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount < 0) return null;

  return Math.round(amount * 100);
}

function centsToPoundsInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (Number(cents || 0) / 100).toFixed(2);
}

function cleanFocus(value: FormDataEntryValue | null) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function focusValue(value: number | null | undefined) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function focusedImageStyle(
  focusX: number | null | undefined,
  focusY: number | null | undefined,
): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${focusValue(focusX)}% ${focusValue(focusY)}%`,
    display: "block",
  };
}

function defaultAuctionImageStyle(padding = 20): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
    display: "block",
    padding,
    boxSizing: "border-box",
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
  };
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function cleanDateTime(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();

  if (!raw) return null;

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not scheduled";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusStyle(status: string | null | undefined): CSSProperties {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published" || clean === "active") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      border: "1px solid #fed7aa",
    };
  }

  if (clean === "paid") {
    return {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (clean === "checkout_started") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }

  if (clean === "withdrawn" || clean === "cancelled") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
  };
}

function auctionStatusLabel(status: string | null | undefined) {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published") return "Published";
  if (clean === "closed") return "Closed";
  return "Draft";
}

function paymentStatusLabel(status: string | null | undefined) {
  const clean = String(status || "unpaid").toLowerCase();

  if (clean === "paid") return "Paid";
  if (clean === "checkout_started") return "Checkout started";
  if (clean === "cancelled") return "Cancelled";
  return "Unpaid";
}

function getErrorMessage(value: string | undefined) {
  if (!value) return "";

  if (value === "subscription-required") {
    return "Auctions require the Professional plan or higher. Existing auction records are available in read-only mode on the Community plan.";
  }

  return value;
}

async function getAppBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";

  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "";

  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }

  return `${protocol}://${host}`;
}

function buildAuctionPaymentUrl(params: {
  baseUrl: string;
  paymentToken: string | null | undefined;
}) {
  const paymentToken = String(params.paymentToken || "").trim();

  if (!paymentToken) return "";

  return `${params.baseUrl}/api/stripe/checkout/auction-winning-bid?token=${encodeURIComponent(
    paymentToken,
  )}`;
}

async function requireAuctionAccess(id: string) {
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

  const auction = await getAuctionById(id, tenantSlug);

  if (!auction) {
    notFound();
  }

  return { auction, tenantSlug };
}

async function requireAuctionWriteAccess(id: string) {
  const { auction, tenantSlug } = await requireAuctionAccess(id);
  const settings = await getTenantSettings(tenantSlug);

  const capability = checkSubscriptionCapability(settings, "auctions");

  if (!capability.allowed) {
    redirect(`/admin/auctions/${auction.id}?error=subscription-required`);
  }

  return { auction, tenantSlug, settings };
}

async function getAdminRaffles(): Promise<RaffleItem[]> {
  try {
    const headerStore = await headers();
    const cookieStore = await cookies();

    const host = headerStore.get("host") || "";
    const protocol = host.includes("localhost") ? "http" : "https";

    const cookieHeader = cookieStore
      .getAll()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const res = await fetch(`${protocol}://${host}/api/admin/raffles`, {
      cache: "no-store",
      headers: {
        cookie: cookieHeader,
      },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as RafflesApiResponse;

    if (!data.ok || !data.items) return [];

    return data.items;
  } catch {
    return [];
  }
}

async function getActiveCampaignCountForTenant(tenantSlug: string) {
  const [raffles, squares, events, auctions] = await Promise.all([
    getAdminRaffles(),
    listSquaresGames(tenantSlug),
    listEvents(tenantSlug),
    listAuctions(tenantSlug),
  ]);

  return (
    raffles.filter((item) => item.status === "published").length +
    squares.filter((item) => item.status === "published").length +
    events.filter((item) => item.status === "published").length +
    auctions.filter((item) => item.status === "published").length
  );
}

function buildHighestBidMap(bids: SilentAuctionBid[]) {
  const winnerByItemId = new Map<string, WinningBidSummary>();

  for (const bid of bids) {
    const itemId = String(bid.item_id || "");
    if (!itemId) continue;

    const amountCents = Number(bid.amount_cents || 0);
    const existing = winnerByItemId.get(itemId);

    if (!existing || amountCents > Number(existing.amount_cents || 0)) {
      winnerByItemId.set(itemId, {
        bid_id: bid.id,
        bidder_name: bid.bidder_name || null,
        bidder_email: bid.bidder_email || null,
        amount_cents: amountCents,
        payment_token: bid.payment_token || null,
        payment_status: bid.payment_status || "unpaid",
        stripe_checkout_session_id: bid.stripe_checkout_session_id || null,
        stripe_payment_intent_id: bid.stripe_payment_intent_id || null,
        paid_at: bid.paid_at || null,
        created_at: bid.created_at,
      });
    }
  }

  return winnerByItemId;
}
async function updateAuctionAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "").trim();

  if (!id) redirect("/admin/auctions");

  const { auction, tenantSlug, settings } = await requireAuctionWriteAccess(id);

  const requestedStatus = String(
    formData.get("status") || "draft",
  ) as AuctionStatus;

  if (requestedStatus === "published" && auction.status !== "published") {
    const tier = normaliseSubscriptionTier(settings?.subscription_tier);

    const activeCampaignCount =
      await getActiveCampaignCountForTenant(tenantSlug);

    const canPublish = canPublishAnotherCampaign({
      subscription_tier: tier,
      currentActiveCampaigns: activeCampaignCount,
    });

    if (!canPublish) {
      redirect(
        `/admin/auctions/${auction.id}?error=${encodeURIComponent(
          getCampaignLimitMessage(tier),
        )}#auction-settings`,
      );
    }
  }

  await updateAuction(auction.id, {
    title: String(formData.get("title") || "").trim() || "Untitled auction",
    slug:
      String(formData.get("slug") || "").trim().toLowerCase() || auction.slug,
    description: String(formData.get("description") || "").trim() || null,
    imageUrl:
      String(formData.get("image_url") || "").trim() || DEFAULT_AUCTION_IMAGE,
    imageFocusX: cleanFocus(formData.get("image_focus_x")),
    imageFocusY: cleanFocus(formData.get("image_focus_y")),
    status: requestedStatus,
    currency: String(formData.get("currency") || "GBP").trim() || "GBP",
    opensAt: cleanDateTime(formData.get("opens_at")),
    closesAt: cleanDateTime(formData.get("closes_at")),
    termsText: String(formData.get("terms_text") || "").trim() || null,
  });

  redirect(`/admin/auctions/${auction.id}#auction-settings`);
}

async function closeAuctionAndNotifyWinnersAction(formData: FormData) {
  "use server";

  const auctionId = String(formData.get("auction_id") || "").trim();

  if (!auctionId) redirect("/admin/auctions");

  const { auction } = await requireAuctionWriteAccess(auctionId);
  const items = await listAuctionItems(auction.id);
  const bids = await listAuctionBids(auction.id);
  const baseUrl = await getAppBaseUrl();

  const winnerByItemId = buildHighestBidMap(bids);

  for (const item of items) {
    if (item.status !== "active") continue;

    await updateAuctionItem(item.id, {
      title: item.title,
      description: item.description,
      imageUrl: item.image_url,
      imageFocusX: item.image_focus_x ?? 50,
      imageFocusY: item.image_focus_y ?? 50,
      donorName: item.donor_name,
      startingBidCents: Number(item.starting_bid_cents || 0),
      minimumIncrementCents: Number(item.minimum_increment_cents || 100),
      reservePriceCents: item.reserve_price_cents,
      status: "closed",
      sortOrder: Number(item.sort_order || 0),
    });

    const winner = winnerByItemId.get(item.id);

    if (!winner?.bidder_email) continue;

    if (
      item.reserve_price_cents !== null &&
      item.reserve_price_cents !== undefined &&
      Number(winner.amount_cents || 0) < Number(item.reserve_price_cents || 0)
    ) {
      continue;
    }

    const paymentUrl =
      winner.payment_status === "paid"
        ? ""
        : buildAuctionPaymentUrl({
            baseUrl,
            paymentToken: winner.payment_token,
          });

    await sendAuctionWinnerEmail({
      to: winner.bidder_email,
      name: winner.bidder_name,
      auctionTitle: auction.title,
      itemTitle: item.title,
      winningAmountCents: Number(winner.amount_cents || 0),
      currency: auction.currency || "GBP",
      paymentUrl,
    });
  }

  await updateAuction(auction.id, {
    title: auction.title,
    slug: auction.slug,
    description: auction.description,
    imageUrl: auction.image_url || DEFAULT_AUCTION_IMAGE,
    imageFocusX: auction.image_focus_x ?? 50,
    imageFocusY: auction.image_focus_y ?? 50,
    status: "closed",
    currency: auction.currency || "GBP",
    opensAt: auction.opens_at,
    closesAt: auction.closes_at || new Date().toISOString(),
    termsText: auction.terms_text,
  });

  redirect(`/admin/auctions/${auction.id}#winner-tools`);
}

async function deleteClosedAuctionAction(formData: FormData) {
  "use server";

  const auctionId = String(formData.get("auction_id") || "").trim();

  if (!auctionId) redirect("/admin/auctions");

  const { auction } = await requireAuctionWriteAccess(auctionId);

  if (auction.status !== "closed") {
    redirect(`/admin/auctions/${auction.id}#danger-zone`);
  }

  await deleteAuction(auction.id);

  redirect("/admin/auctions");
}

async function createAuctionItemAction(formData: FormData) {
  "use server";

  const auctionId = String(formData.get("auction_id") || "").trim();

  if (!auctionId) redirect("/admin/auctions");

  const { auction } = await requireAuctionWriteAccess(auctionId);

  await createAuctionItem({
    auctionId: auction.id,
    title: String(formData.get("title") || "").trim() || "Untitled item",
    description: String(formData.get("description") || "").trim() || null,
    imageUrl:
      String(formData.get("image_url") || "").trim() || DEFAULT_AUCTION_IMAGE,
    imageFocusX: cleanFocus(formData.get("image_focus_x")),
    imageFocusY: cleanFocus(formData.get("image_focus_y")),
    donorName: String(formData.get("donor_name") || "").trim() || null,
    startingBidCents: poundsToCents(formData.get("starting_bid")),
    minimumIncrementCents:
      poundsToCents(formData.get("minimum_increment")) || 100,
    reservePriceCents: optionalPoundsToCents(formData.get("reserve_price")),
    status: String(formData.get("status") || "draft") as AuctionItemStatus,
    sortOrder: Number(formData.get("sort_order") || 0),
  });

  redirect(`/admin/auctions/${auction.id}#auction-items`);
}

async function updateAuctionItemAction(formData: FormData) {
  "use server";

  const itemId = String(formData.get("item_id") || "").trim();
  const auctionId = String(formData.get("auction_id") || "").trim();

  if (!itemId || !auctionId) redirect("/admin/auctions");

  const { auction } = await requireAuctionWriteAccess(auctionId);

  await updateAuctionItem(itemId, {
    title: String(formData.get("title") || "").trim() || "Untitled item",
    description: String(formData.get("description") || "").trim() || null,
    imageUrl:
      String(formData.get("image_url") || "").trim() || DEFAULT_AUCTION_IMAGE,
    imageFocusX: cleanFocus(formData.get("image_focus_x")),
    imageFocusY: cleanFocus(formData.get("image_focus_y")),
    donorName: String(formData.get("donor_name") || "").trim() || null,
    startingBidCents: poundsToCents(formData.get("starting_bid")),
    minimumIncrementCents:
      poundsToCents(formData.get("minimum_increment")) || 100,
    reservePriceCents: optionalPoundsToCents(formData.get("reserve_price")),
    status: String(formData.get("status") || "draft") as AuctionItemStatus,
    sortOrder: Number(formData.get("sort_order") || 0),
  });

  redirect(`/admin/auctions/${auction.id}#auction-items`);
}

async function deleteAuctionItemAction(formData: FormData) {
  "use server";

  const itemId = String(formData.get("item_id") || "").trim();
  const auctionId = String(formData.get("auction_id") || "").trim();

  if (!itemId || !auctionId) redirect("/admin/auctions");

  const { auction } = await requireAuctionWriteAccess(auctionId);

  await deleteAuctionItem(itemId);

  redirect(`/admin/auctions/${auction.id}#auction-items`);
}
export default async function AdminAuctionPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const { auction, tenantSlug } = await requireAuctionAccess(
    resolvedParams.id,
  );

  const tenantSettings = await getTenantSettings(tenantSlug);
  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );
  const tierLabel = getTierLabel(subscriptionTier);
  const auctionCapability = checkSubscriptionCapability(
    tenantSettings,
    "auctions",
  );
  const isReadOnly = !auctionCapability.allowed;

  const items = await listAuctionItems(auction.id);
  const bids = await listAuctionBids(auction.id);
  const highestBidByItemId = buildHighestBidMap(bids);
  const baseUrl = await getAppBaseUrl();

  const publishedItems = items.filter((item) => item.status === "active");
  const errorMessage = getErrorMessage(resolvedSearchParams?.error);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroImageWrap}>
          <img
            src={auction.image_url || DEFAULT_AUCTION_IMAGE}
            alt={auction.title}
            style={
              auction.image_url && auction.image_url !== DEFAULT_AUCTION_IMAGE
                ? focusedImageStyle(
                    auction.image_focus_x,
                    auction.image_focus_y,
                  )
                : defaultAuctionImageStyle(28)
            }
          />
        </div>

        <div style={styles.heroContent}>
          <div style={styles.heroTopRow}>
            <div style={styles.badgeRow}>
              <div
                style={{
                  ...styles.statusBadge,
                  ...getStatusStyle(auction.status),
                }}
              >
                {auctionStatusLabel(auction.status)}
              </div>

              <div style={styles.planBadge}>{tierLabel} plan</div>

              {isReadOnly ? (
                <div style={styles.lockedBadge}>Read-only</div>
              ) : null}
            </div>

            <Link href="/admin/auctions" style={styles.secondaryButton}>
              ← Back to auctions
            </Link>
          </div>

          <h1 style={styles.heroTitle}>{auction.title}</h1>

          <p style={styles.heroDescription}>
            {auction.description?.trim() ||
              "Configure your auction details, items, bidding and closing workflow."}
          </p>

          <div style={styles.heroStats}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Currency</div>
              <div style={styles.statValue}>
                {(auction.currency || "GBP").toUpperCase()}
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Items</div>
              <div style={styles.statValue}>{items.length}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Active items</div>
              <div style={styles.statValue}>{publishedItems.length}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Bids</div>
              <div style={styles.statValue}>{bids.length}</div>
            </div>
          </div>

          <div style={styles.heroMeta}>
            <div>
              <strong>Opens:</strong> {formatDate(auction.opens_at)}
            </div>

            <div>
              <strong>Closes:</strong> {formatDate(auction.closes_at)}
            </div>

            <div>
              <strong>Tenant:</strong> {tenantSlug}
            </div>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section style={styles.errorBanner}>{errorMessage}</section>
      ) : null}

      {isReadOnly ? (
        <section style={styles.upgradeBanner}>
          <div>
            <div style={styles.upgradeEyebrow}>Professional feature</div>

            <h2 style={styles.upgradeTitle}>
              Auction management is locked on the Community plan.
            </h2>

            <p style={styles.upgradeText}>
              Existing auction records are preserved here for reference, but
              editing, creating items, deleting, closing and winner email tools
              require the Professional plan or higher.
            </p>
          </div>

          <div style={styles.upgradeActions}>
            <Link href="/admin/settings/billing" style={styles.upgradeButton}>
              View billing options
            </Link>

            <Link href="/admin/auctions" style={styles.upgradeSecondaryButton}>
              Back to auctions
            </Link>
          </div>
        </section>
      ) : null}

      <section id="auction-settings" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionEyebrow}>Configuration</div>
            <h2 style={styles.sectionTitle}>Auction settings</h2>
          </div>
        </div>

        {isReadOnly ? (
          <div style={styles.readOnlyGrid}>
            <InfoCard label="Title" value={auction.title} />
            <InfoCard label="Slug" value={`/a/${auction.slug}`} />
            <InfoCard
              label="Description"
              value={
                auction.description?.trim() ||
                "No auction description has been added."
              }
              wide
            />
            <InfoCard
              label="Currency"
              value={(auction.currency || "GBP").toUpperCase()}
            />
            <InfoCard label="Status" value={auctionStatusLabel(auction.status)} />
            <InfoCard label="Opens" value={formatDate(auction.opens_at)} />
            <InfoCard label="Closes" value={formatDate(auction.closes_at)} />
            <InfoCard
              label="Terms / auction rules"
              value={
                auction.terms_text?.trim() ||
                "No auction terms have been added."
              }
              wide
            />
          </div>
        ) : (
          <form action={updateAuctionAction} style={styles.formGrid}>
            <input type="hidden" name="id" value={auction.id} />

            <label style={styles.field}>
              <span style={styles.label}>Auction title</span>

              <input
                type="text"
                name="title"
                defaultValue={auction.title}
                required
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Slug</span>

              <input
                type="text"
                name="slug"
                defaultValue={auction.slug}
                required
                style={styles.input}
              />
            </label>

            <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
              <span style={styles.label}>Description</span>

              <textarea
                name="description"
                defaultValue={auction.description || ""}
                rows={4}
                style={styles.textarea}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Currency</span>

              <select
                name="currency"
                defaultValue={auction.currency || "GBP"}
                style={styles.select}
              >
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Status</span>

              <select
                name="status"
                defaultValue={auction.status}
                style={styles.select}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Opens at</span>

              <input
                type="datetime-local"
                name="opens_at"
                defaultValue={toDateTimeLocalValue(auction.opens_at)}
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Closes at</span>

              <input
                type="datetime-local"
                name="closes_at"
                defaultValue={toDateTimeLocalValue(auction.closes_at)}
                style={styles.input}
              />
            </label>

            <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
              <span style={styles.label}>Main auction image URL</span>

              <input
                type="text"
                name="image_url"
                defaultValue={auction.image_url || DEFAULT_AUCTION_IMAGE}
                style={styles.input}
              />
            </label>

            <input
              type="hidden"
              name="image_focus_x"
              defaultValue={focusValue(auction.image_focus_x)}
            />

            <input
              type="hidden"
              name="image_focus_y"
              defaultValue={focusValue(auction.image_focus_y)}
            />

            <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
              <span style={styles.label}>Terms / auction rules</span>

              <textarea
                name="terms_text"
                defaultValue={auction.terms_text || ""}
                rows={5}
                style={styles.textarea}
              />
            </label>

            <div style={styles.submitRow}>
              <button type="submit" style={styles.primaryButton}>
                Save auction settings
              </button>
            </div>
          </form>
        )}
      </section>
            <section id="auction-items" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionEyebrow}>Lots</div>
            <h2 style={styles.sectionTitle}>Auction items</h2>
          </div>
        </div>

        {isReadOnly ? (
          <div style={styles.lockedNotice}>
            🔒 Item creation and editing are locked on the Community plan.
            Existing auction items remain visible below for reference.
          </div>
        ) : (
          <form action={createAuctionItemAction} style={styles.formGrid}>
            <input type="hidden" name="auction_id" value={auction.id} />

            <label style={styles.field}>
              <span style={styles.label}>Item title</span>

              <input
                type="text"
                name="title"
                required
                placeholder="Weekend stay, signed shirt, dinner voucher..."
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Donor / sponsor</span>

              <input
                type="text"
                name="donor_name"
                placeholder="Optional"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Starting bid</span>

              <input
                type="text"
                name="starting_bid"
                placeholder="25.00"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Minimum increment</span>

              <input
                type="text"
                name="minimum_increment"
                defaultValue="5.00"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Reserve price</span>

              <input
                type="text"
                name="reserve_price"
                placeholder="Optional"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Sort order</span>

              <input
                type="number"
                name="sort_order"
                defaultValue="0"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Status</span>

              <select name="status" defaultValue="active" style={styles.select}>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>

            <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
              <span style={styles.label}>Description</span>

              <textarea name="description" rows={4} style={styles.textarea} />
            </label>

            <input type="hidden" name="image_focus_x" defaultValue="50" />
            <input type="hidden" name="image_focus_y" defaultValue="50" />

            <div style={styles.submitRow}>
              <button type="submit" style={styles.primaryButton}>
                Add auction item
              </button>
            </div>
          </form>
        )}

        <div style={styles.itemsList}>
          {items.length === 0 ? (
            <div style={styles.emptyState}>No auction items added yet.</div>
          ) : (
            items.map((item) => {
              const highest = highestBidByItemId.get(item.id);
              const paymentUrl = buildAuctionPaymentUrl({
                baseUrl,
                paymentToken: highest?.payment_token,
              });

              return (
                <details key={item.id} style={styles.itemCard}>
                  <summary style={styles.itemSummary}>
                    <div>
                      <strong>{item.title}</strong>

                      <div style={styles.itemMeta}>
                        {item.status} ·{" "}
                        {moneyFromCents(
                          highest?.amount_cents ||
                            item.starting_bid_cents ||
                            0,
                          auction.currency,
                        )}
                      </div>
                    </div>

                    <span style={styles.chevron}>Open</span>
                  </summary>

                  {highest ? (
                    <div style={styles.winnerPaymentCard}>
                      <div style={styles.winnerPaymentHeader}>
                        <div>
                          <div style={styles.infoLabel}>Current highest bid</div>
                          <div style={styles.winnerPaymentTitle}>
                            {highest.bidder_name || "Unknown bidder"}
                          </div>
                          <div style={styles.itemMeta}>
                            {highest.bidder_email || "No email"} ·{" "}
                            {moneyFromCents(
                              highest.amount_cents,
                              auction.currency,
                            )}
                          </div>
                        </div>

                        <span
                          style={{
                            ...styles.statusBadge,
                            ...getStatusStyle(highest.payment_status),
                          }}
                        >
                          {paymentStatusLabel(highest.payment_status)}
                        </span>
                      </div>

                      {highest.paid_at ? (
                        <div style={styles.itemMeta}>
                          Paid: {formatDate(highest.paid_at)}
                        </div>
                      ) : null}

                      {highest.payment_status !== "paid" &&
                      highest.payment_token ? (
                        <div style={styles.paymentLinkBox}>
                          <div style={styles.infoLabel}>
                            Winner payment link
                          </div>

                          <a
                            href={paymentUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.paymentLink}
                          >
                            Open Stripe payment link
                          </a>

                          <div style={styles.paymentUrlText}>{paymentUrl}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isReadOnly ? (
                    <div style={styles.readOnlyGrid}>
                      <InfoCard label="Title" value={item.title} />
                      <InfoCard
                        label="Donor / sponsor"
                        value={item.donor_name || "Not set"}
                      />
                      <InfoCard
                        label="Starting bid"
                        value={moneyFromCents(
                          item.starting_bid_cents,
                          auction.currency,
                        )}
                      />
                      <InfoCard
                        label="Minimum increment"
                        value={moneyFromCents(
                          item.minimum_increment_cents,
                          auction.currency,
                        )}
                      />
                      <InfoCard
                        label="Reserve price"
                        value={
                          item.reserve_price_cents === null ||
                          item.reserve_price_cents === undefined
                            ? "Not set"
                            : moneyFromCents(
                                item.reserve_price_cents,
                                auction.currency,
                              )
                        }
                      />
                      <InfoCard label="Sort order" value={item.sort_order || 0} />
                      <InfoCard label="Status" value={item.status} />
                      <InfoCard
                        label="Payment status"
                        value={paymentStatusLabel(highest?.payment_status)}
                      />
                      <InfoCard
                        label="Description"
                        value={
                          item.description?.trim() ||
                          "No item description has been added."
                        }
                        wide
                      />
                    </div>
                  ) : (
                    <>
                      <form
                        action={updateAuctionItemAction}
                        style={styles.formGrid}
                      >
                        <input
                          type="hidden"
                          name="auction_id"
                          value={auction.id}
                        />

                        <input type="hidden" name="item_id" value={item.id} />

                        <label style={styles.field}>
                          <span style={styles.label}>Item title</span>

                          <input
                            type="text"
                            name="title"
                            defaultValue={item.title}
                            required
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Donor / sponsor</span>

                          <input
                            type="text"
                            name="donor_name"
                            defaultValue={item.donor_name || ""}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Starting bid</span>

                          <input
                            type="text"
                            name="starting_bid"
                            defaultValue={centsToPoundsInput(
                              item.starting_bid_cents,
                            )}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Minimum increment</span>

                          <input
                            type="text"
                            name="minimum_increment"
                            defaultValue={centsToPoundsInput(
                              item.minimum_increment_cents,
                            )}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Reserve price</span>

                          <input
                            type="text"
                            name="reserve_price"
                            defaultValue={centsToPoundsInput(
                              item.reserve_price_cents,
                            )}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Sort order</span>

                          <input
                            type="number"
                            name="sort_order"
                            defaultValue={item.sort_order || 0}
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Status</span>

                          <select
                            name="status"
                            defaultValue={item.status}
                            style={styles.select}
                          >
                            <option value="active">Active</option>
                            <option value="closed">Closed</option>
                            <option value="withdrawn">Withdrawn</option>
                          </select>
                        </label>

                        <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
                          <span style={styles.label}>Description</span>

                          <textarea
                            name="description"
                            defaultValue={item.description || ""}
                            rows={4}
                            style={styles.textarea}
                          />
                        </label>

                        <input
                          type="hidden"
                          name="image_url"
                          defaultValue={item.image_url || ""}
                        />

                        <input
                          type="hidden"
                          name="image_focus_x"
                          defaultValue={focusValue(item.image_focus_x)}
                        />

                        <input
                          type="hidden"
                          name="image_focus_y"
                          defaultValue={focusValue(item.image_focus_y)}
                        />

                        <div style={styles.submitRow}>
                          <button type="submit" style={styles.primaryButton}>
                            Save item
                          </button>
                        </div>
                      </form>

                      <form
                        action={deleteAuctionItemAction}
                        style={styles.deleteRow}
                      >
                        <input
                          type="hidden"
                          name="auction_id"
                          value={auction.id}
                        />

                        <input type="hidden" name="item_id" value={item.id} />

                        <button type="submit" style={styles.deleteButton}>
                          Delete item
                        </button>
                      </form>
                    </>
                  )}
                </details>
              );
            })
          )}
        </div>
      </section>
            <section id="winner-tools" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionEyebrow}>Winner tools</div>
            <h2 style={styles.sectionTitle}>Close auction and notify winners</h2>
          </div>
        </div>

        <p style={styles.sectionText}>
          Closing the auction closes active lots and emails the highest valid
          bidder for each lot where the reserve has been met. Winner emails now
          include a secure Stripe payment link for unpaid winning bids.
        </p>

        <div style={styles.winnerSummaryGrid}>
          {items.length === 0 ? (
            <div style={styles.emptyState}>No auction items added yet.</div>
          ) : (
            items.map((item) => {
              const highest = highestBidByItemId.get(item.id);
              const reserveMet =
                item.reserve_price_cents === null ||
                item.reserve_price_cents === undefined ||
                Number(highest?.amount_cents || 0) >=
                  Number(item.reserve_price_cents || 0);

              const paymentUrl = buildAuctionPaymentUrl({
                baseUrl,
                paymentToken: highest?.payment_token,
              });

              return (
                <article key={`winner-${item.id}`} style={styles.winnerCard}>
                  <div style={styles.winnerPaymentHeader}>
                    <div>
                      <div style={styles.infoLabel}>{item.title}</div>

                      <div style={styles.winnerPaymentTitle}>
                        {highest?.bidder_name || "No winning bid yet"}
                      </div>

                      <div style={styles.itemMeta}>
                        {highest?.bidder_email || "No bidder email"}{" "}
                        {highest
                          ? `· ${moneyFromCents(
                              highest.amount_cents,
                              auction.currency,
                            )}`
                          : ""}
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.statusBadge,
                        ...getStatusStyle(highest?.payment_status),
                      }}
                    >
                      {paymentStatusLabel(highest?.payment_status)}
                    </span>
                  </div>

                  <div style={styles.winnerMiniGrid}>
                    <InfoCard
                      label="Reserve"
                      value={
                        item.reserve_price_cents === null ||
                        item.reserve_price_cents === undefined
                          ? "No reserve"
                          : moneyFromCents(
                              item.reserve_price_cents,
                              auction.currency,
                            )
                      }
                    />

                    <InfoCard
                      label="Reserve status"
                      value={reserveMet ? "Reserve met" : "Reserve not met"}
                    />

                    <InfoCard label="Item status" value={item.status} />

                    <InfoCard
                      label="Paid at"
                      value={highest?.paid_at ? formatDate(highest.paid_at) : "Not paid"}
                    />
                  </div>

                  {highest &&
                  highest.payment_status !== "paid" &&
                  highest.payment_token &&
                  reserveMet ? (
                    <div style={styles.paymentLinkBox}>
                      <div style={styles.infoLabel}>Payment link</div>

                      <a
                        href={paymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.paymentLink}
                      >
                        Open Stripe payment link
                      </a>

                      <div style={styles.paymentUrlText}>{paymentUrl}</div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>

        {isReadOnly ? (
          <div style={styles.lockedNotice}>
            🔒 Winner tools are locked on the Community plan. Upgrade to
            Professional to close auctions, email winners and collect winning
            bid payments.
          </div>
        ) : (
          <form
            action={closeAuctionAndNotifyWinnersAction}
            style={styles.submitRow}
          >
            <input type="hidden" name="auction_id" value={auction.id} />

            <button
              type="submit"
              disabled={auction.status === "closed"}
              style={{
                ...styles.primaryButton,
                opacity: auction.status === "closed" ? 0.55 : 1,
                cursor: auction.status === "closed" ? "not-allowed" : "pointer",
              }}
            >
              {auction.status === "closed"
                ? "Auction already closed"
                : "Close auction and email winners"}
            </button>
          </form>
        )}
      </section>

      <section id="danger-zone" style={styles.dangerCard}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.dangerEyebrow}>Danger zone</div>
            <h2 style={styles.sectionTitle}>Delete auction</h2>
          </div>
        </div>

        <p style={styles.sectionText}>
          For safety, an auction can only be deleted after it has been closed.
        </p>

        {isReadOnly ? (
          <div style={styles.lockedNotice}>
            🔒 Deleting auctions is locked on the Community plan. Existing
            auction data is preserved for reference.
          </div>
        ) : auction.status === "closed" ? (
          <form action={deleteClosedAuctionAction} style={styles.submitRow}>
            <input type="hidden" name="auction_id" value={auction.id} />

            <button type="submit" style={styles.deleteButton}>
              Delete closed auction
            </button>
          </form>
        ) : (
          <button type="button" disabled style={styles.disabledButton}>
            Close auction before deleting
          </button>
        )}
      </section>
    </main>
  );
}

function InfoCard({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.infoCard,
        gridColumn: wide ? "1 / -1" : undefined,
      }}
    >
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}
const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.10), transparent 34%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 0.85fr) minmax(0, 1.15fr)",
    gap: 22,
    padding: 24,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    minWidth: 0,
    overflow: "hidden",
  },

  heroImageWrap: {
    minHeight: 260,
    borderRadius: 22,
    overflow: "hidden",
    background: "#ffffff",
    minWidth: 0,
  },

  heroContent: {
    display: "grid",
    gap: 14,
    alignContent: "start",
    minWidth: 0,
  },

  heroTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    minWidth: 0,
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  },

  heroTitle: {
    margin: 0,
    fontSize: "clamp(36px, 6vw, 58px)",
    lineHeight: 0.96,
    letterSpacing: "-0.07em",
    overflowWrap: "anywhere",
  },

  heroDescription: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    minWidth: 0,
  },

  heroMeta: {
    display: "grid",
    gap: 6,
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  statusBadge: {
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  planBadge: {
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#dbeafe",
    border: "1px solid rgba(191,219,254,0.36)",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  lockedBadge: {
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.12)",
    color: "#fde68a",
    border: "1px solid rgba(251,191,36,0.54)",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
  },

  statCard: {
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.16)",
    minWidth: 0,
  },

  statLabel: {
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 900,
  },

  statValue: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 22,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  errorBanner: {
    padding: 14,
    borderRadius: 18,
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    fontWeight: 900,
    marginBottom: 18,
    overflowWrap: "anywhere",
  },

  upgradeBanner: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 18,
    alignItems: "center",
    padding: 20,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 60%, #eff6ff 100%)",
    border: "1px solid rgba(217,119,6,0.32)",
    boxShadow: "0 16px 40px rgba(15,23,42,0.07)",
    marginBottom: 18,
    minWidth: 0,
  },

  upgradeEyebrow: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 8,
  },

  upgradeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  upgradeText: {
    margin: "8px 0 0",
    color: "#475569",
    lineHeight: 1.55,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  upgradeActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  upgradeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  upgradeSecondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  sectionCard: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 18,
    minWidth: 0,
    overflow: "hidden",
  },

  dangerCard: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 26,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    marginBottom: 18,
    minWidth: 0,
    overflow: "hidden",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    minWidth: 0,
  },

  sectionEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },

  dangerEyebrow: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    minWidth: 0,
  },

  readOnlyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    minWidth: 0,
  },

  infoCard: {
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  },

  infoValue: {
    color: "#0f172a",
    fontWeight: 850,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },

  lockedNotice: {
    padding: 14,
    borderRadius: 18,
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    lineHeight: 1.5,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  field: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },

  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  input: {
    width: "100%",
    minHeight: 46,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 15,
    boxSizing: "border-box",
    minWidth: 0,
  },

  select: {
    width: "100%",
    minHeight: 46,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 15,
    boxSizing: "border-box",
    minWidth: 0,
  },

  textarea: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 15,
    fontFamily: "inherit",
    boxSizing: "border-box",
    minWidth: 0,
  },

  submitRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    gridColumn: "1 / -1",
  },

  primaryButton: {
    minHeight: 46,
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
  },
    deleteButton: {
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
  },

  disabledButton: {
    width: "fit-content",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#e5e7eb",
    color: "#64748b",
    border: "none",
    fontWeight: 950,
    cursor: "not-allowed",
  },

  itemsList: {
    display: "grid",
    gap: 12,
  },

  itemCard: {
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: 14,
    minWidth: 0,
    overflow: "hidden",
  },

  itemSummary: {
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    minWidth: 0,
  },

  itemMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  chevron: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  deleteRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 12,
    flexWrap: "wrap",
  },

  emptyState: {
    padding: 20,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    textAlign: "center",
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  winnerPaymentCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    margin: "14px 0",
    minWidth: 0,
  },

  winnerPaymentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    minWidth: 0,
  },

  winnerPaymentTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.025em",
    overflowWrap: "anywhere",
  },

  paymentLinkBox: {
    display: "grid",
    gap: 8,
    padding: 13,
    borderRadius: 16,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    minWidth: 0,
  },

  paymentLink: {
    width: "fit-content",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 10px 20px rgba(22,131,248,0.18)",
  },

  paymentUrlText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
    wordBreak: "break-all",
  },

  winnerSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 14,
    minWidth: 0,
  },

  winnerCard: {
    display: "grid",
    gap: 13,
    padding: 15,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 54%, #eff6ff 100%)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },

  winnerMiniGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
    gap: 10,
    minWidth: 0,
  },
};
