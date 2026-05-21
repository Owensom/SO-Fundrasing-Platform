import { query, queryOne } from "@/lib/db";

export type AuctionStatus = "draft" | "published" | "closed";
export type AuctionItemStatus = "active" | "closed" | "withdrawn";
export type AuctionBidPaymentStatus =
  | "unpaid"
  | "checkout_started"
  | "paid"
  | "cancelled";

export type SilentAuction = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_focus_x: number;
  image_focus_y: number;
  status: AuctionStatus;
  currency: string;
  opens_at: string | null;
  closes_at: string | null;
  terms_text: string | null;
  created_at: string;
  updated_at: string;
};

export type SilentAuctionItem = {
  id: string;
  auction_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_focus_x: number;
  image_focus_y: number;
  donor_name: string | null;
  starting_bid_cents: number;
  minimum_increment_cents: number;
  reserve_price_cents: number | null;
  status: AuctionItemStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  highest_bid_cents: number | null;
  bid_count: number;
};

export type SilentAuctionBid = {
  id: string;
  auction_id: string;
  item_id: string;
  bidder_name: string;
  bidder_email: string;
  bidder_phone: string | null;
  amount_cents: number;
  is_winning: boolean;
  created_at: string;
  payment_token: string | null;
  payment_status: AuctionBidPaymentStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
};

export type AuctionWinningBidPayment = {
  bid_id: string;
  auction_id: string;
  item_id: string;
  tenant_slug: string;
  auction_slug: string;
  auction_title: string;
  auction_status: AuctionStatus;
  currency: string;
  item_title: string;
  item_status: AuctionItemStatus;
  reserve_price_cents: number | null;
  bidder_name: string;
  bidder_email: string;
  bidder_phone: string | null;
  amount_cents: number;
  is_winning: boolean;
  payment_token: string;
  payment_status: AuctionBidPaymentStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
};

function cleanStatus(value: unknown): AuctionStatus {
  const status = String(value || "draft").toLowerCase();
  if (status === "published" || status === "closed") return status;
  return "draft";
}

function cleanItemStatus(value: unknown): AuctionItemStatus {
  const status = String(value || "active").toLowerCase();
  if (status === "closed" || status === "withdrawn") return status;
  return "active";
}

function cleanBidPaymentStatus(value: unknown): AuctionBidPaymentStatus {
  const status = String(value || "unpaid").toLowerCase();

  if (
    status === "checkout_started" ||
    status === "paid" ||
    status === "cancelled"
  ) {
    return status;
  }

  return "unpaid";
}

function cleanFocus(value: unknown, fallback = 50) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function slugifyAuctionTitle(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || `auction-${Date.now()}`;
}

export async function listAuctions(tenantSlug: string) {
  return query<SilentAuction>(
    `
      select *
      from silent_auctions
      where tenant_slug = $1
      order by created_at desc
    `,
    [tenantSlug],
  );
}

export async function getAuctionById(id: string, tenantSlug?: string) {
  if (tenantSlug) {
    return queryOne<SilentAuction>(
      `
        select *
        from silent_auctions
        where id = $1
          and tenant_slug = $2
        limit 1
      `,
      [id, tenantSlug],
    );
  }

  return queryOne<SilentAuction>(
    `
      select *
      from silent_auctions
      where id = $1
      limit 1
    `,
    [id],
  );
}

export async function getAuctionBySlug(slug: string, tenantSlug: string) {
  return queryOne<SilentAuction>(
    `
      select *
      from silent_auctions
      where lower(slug) = lower($1)
        and tenant_slug = $2
      limit 1
    `,
    [slug.trim(), tenantSlug],
  );
}

export async function createAuction(input: {
  tenantSlug: string;
  title: string;
  slug?: string;
  description?: string | null;
  imageUrl?: string | null;
  imageFocusX?: number;
  imageFocusY?: number;
  status?: AuctionStatus;
  currency?: string;
  opensAt?: string | null;
  closesAt?: string | null;
  termsText?: string | null;
}) {
  const title = input.title.trim() || "Untitled auction";
  const slug = (input.slug?.trim() || slugifyAuctionTitle(title)).toLowerCase();

  return queryOne<SilentAuction>(
    `
      insert into silent_auctions (
        tenant_slug,
        slug,
        title,
        description,
        image_url,
        image_focus_x,
        image_focus_y,
        status,
        currency,
        opens_at,
        closes_at,
        terms_text
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      returning *
    `,
    [
      input.tenantSlug,
      slug,
      title,
      input.description || null,
      input.imageUrl || null,
      cleanFocus(input.imageFocusX),
      cleanFocus(input.imageFocusY),
      cleanStatus(input.status),
      input.currency || "GBP",
      input.opensAt || null,
      input.closesAt || null,
      input.termsText || null,
    ],
  );
}

export async function updateAuction(
  id: string,
  input: {
    title: string;
    slug: string;
    description?: string | null;
    imageUrl?: string | null;
    imageFocusX?: number;
    imageFocusY?: number;
    status?: AuctionStatus;
    currency?: string;
    opensAt?: string | null;
    closesAt?: string | null;
    termsText?: string | null;
  },
) {
  return queryOne<SilentAuction>(
    `
      update silent_auctions
      set
        title = $2,
        slug = $3,
        description = $4,
        image_url = $5,
        image_focus_x = $6,
        image_focus_y = $7,
        status = $8,
        currency = $9,
        opens_at = $10,
        closes_at = $11,
        terms_text = $12,
        updated_at = now()
      where id = $1
      returning *
    `,
    [
      id,
      input.title.trim() || "Untitled auction",
      input.slug.trim().toLowerCase() || slugifyAuctionTitle(input.title),
      input.description || null,
      input.imageUrl || null,
      cleanFocus(input.imageFocusX),
      cleanFocus(input.imageFocusY),
      cleanStatus(input.status),
      input.currency || "GBP",
      input.opensAt || null,
      input.closesAt || null,
      input.termsText || null,
    ],
  );
}

export async function deleteAuction(id: string) {
  await query(
    `
      delete from silent_auctions
      where id = $1
    `,
    [id],
  );
}

export async function listAuctionItems(auctionId: string) {
  return query<SilentAuctionItem>(
    `
      select
        item.*,
        coalesce(max(bid.amount_cents), null) as highest_bid_cents,
        count(bid.id)::int as bid_count
      from silent_auction_items item
      left join silent_auction_bids bid
        on bid.item_id = item.id
      where item.auction_id = $1
      group by item.id
      order by item.sort_order asc, item.created_at asc
    `,
    [auctionId],
  );
}

export async function getAuctionItemById(itemId: string) {
  return queryOne<SilentAuctionItem>(
    `
      select
        item.*,
        coalesce(max(bid.amount_cents), null) as highest_bid_cents,
        count(bid.id)::int as bid_count
      from silent_auction_items item
      left join silent_auction_bids bid
        on bid.item_id = item.id
      where item.id = $1
      group by item.id
      limit 1
    `,
    [itemId],
  );
}

export async function createAuctionItem(input: {
  auctionId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  imageFocusX?: number;
  imageFocusY?: number;
  donorName?: string | null;
  startingBidCents?: number;
  minimumIncrementCents?: number;
  reservePriceCents?: number | null;
  status?: AuctionItemStatus;
  sortOrder?: number;
}) {
  return queryOne<SilentAuctionItem>(
    `
      insert into silent_auction_items (
        auction_id,
        title,
        description,
        image_url,
        image_focus_x,
        image_focus_y,
        donor_name,
        starting_bid_cents,
        minimum_increment_cents,
        reserve_price_cents,
        status,
        sort_order
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      returning *,
        null::integer as highest_bid_cents,
        0::integer as bid_count
    `,
    [
      input.auctionId,
      input.title.trim() || "Untitled item",
      input.description || null,
      input.imageUrl || null,
      cleanFocus(input.imageFocusX),
      cleanFocus(input.imageFocusY),
      input.donorName || null,
      Number(input.startingBidCents || 0),
      Number(input.minimumIncrementCents || 100),
      input.reservePriceCents ?? null,
      cleanItemStatus(input.status),
      Number(input.sortOrder || 0),
    ],
  );
}

export async function updateAuctionItem(
  itemId: string,
  input: {
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    imageFocusX?: number;
    imageFocusY?: number;
    donorName?: string | null;
    startingBidCents?: number;
    minimumIncrementCents?: number;
    reservePriceCents?: number | null;
    status?: AuctionItemStatus;
    sortOrder?: number;
  },
) {
  return queryOne<SilentAuctionItem>(
    `
      update silent_auction_items
      set
        title = $2,
        description = $3,
        image_url = $4,
        image_focus_x = $5,
        image_focus_y = $6,
        donor_name = $7,
        starting_bid_cents = $8,
        minimum_increment_cents = $9,
        reserve_price_cents = $10,
        status = $11,
        sort_order = $12,
        updated_at = now()
      where id = $1
      returning *,
        null::integer as highest_bid_cents,
        0::integer as bid_count
    `,
    [
      itemId,
      input.title.trim() || "Untitled item",
      input.description || null,
      input.imageUrl || null,
      cleanFocus(input.imageFocusX),
      cleanFocus(input.imageFocusY),
      input.donorName || null,
      Number(input.startingBidCents || 0),
      Number(input.minimumIncrementCents || 100),
      input.reservePriceCents ?? null,
      cleanItemStatus(input.status),
      Number(input.sortOrder || 0),
    ],
  );
}

export async function deleteAuctionItem(itemId: string) {
  await query(
    `
      delete from silent_auction_items
      where id = $1
    `,
    [itemId],
  );
}

export async function listAuctionBids(auctionId: string) {
  return query<SilentAuctionBid>(
    `
      select *
      from silent_auction_bids
      where auction_id = $1
      order by created_at desc
    `,
    [auctionId],
  );
}

export async function listAuctionBidsForItem(itemId: string) {
  return query<SilentAuctionBid>(
    `
      select *
      from silent_auction_bids
      where item_id = $1
      order by amount_cents desc, created_at asc
    `,
    [itemId],
  );
}

export async function createAuctionBid(input: {
  auctionId: string;
  itemId: string;
  bidderName: string;
  bidderEmail: string;
  bidderPhone?: string | null;
  amountCents: number;
}) {
  await query(
    `
      update silent_auction_bids
      set is_winning = false
      where item_id = $1
    `,
    [input.itemId],
  );

  return queryOne<SilentAuctionBid>(
    `
      insert into silent_auction_bids (
        auction_id,
        item_id,
        bidder_name,
        bidder_email,
        bidder_phone,
        amount_cents,
        is_winning
      )
      values ($1,$2,$3,$4,$5,$6,true)
      returning *
    `,
    [
      input.auctionId,
      input.itemId,
      input.bidderName.trim(),
      input.bidderEmail.trim().toLowerCase(),
      input.bidderPhone || null,
      Number(input.amountCents),
    ],
  );
}

export async function getHighestBidForItem(itemId: string) {
  return queryOne<SilentAuctionBid>(
    `
      select *
      from silent_auction_bids
      where item_id = $1
      order by amount_cents desc, created_at asc
      limit 1
    `,
    [itemId],
  );
}

export async function getAuctionWinningBidPaymentByToken(
  paymentToken: string,
) {
  return queryOne<AuctionWinningBidPayment>(
    `
      select
        bid.id::text as bid_id,
        bid.auction_id::text as auction_id,
        bid.item_id::text as item_id,
        auction.tenant_slug,
        auction.slug as auction_slug,
        auction.title as auction_title,
        auction.status as auction_status,
        auction.currency,
        item.title as item_title,
        item.status as item_status,
        item.reserve_price_cents,
        bid.bidder_name,
        bid.bidder_email,
        bid.bidder_phone,
        bid.amount_cents,
        bid.is_winning,
        bid.payment_token::text as payment_token,
        bid.payment_status,
        bid.stripe_checkout_session_id,
        bid.stripe_payment_intent_id,
        bid.paid_at::text
      from silent_auction_bids bid
      inner join silent_auction_items item
        on item.id = bid.item_id
       and item.auction_id = bid.auction_id
      inner join silent_auctions auction
        on auction.id = bid.auction_id
      where bid.payment_token = $1::uuid
      limit 1
    `,
    [paymentToken],
  );
}

export async function getAuctionWinningBidPaymentByBidId(bidId: string) {
  return queryOne<AuctionWinningBidPayment>(
    `
      select
        bid.id::text as bid_id,
        bid.auction_id::text as auction_id,
        bid.item_id::text as item_id,
        auction.tenant_slug,
        auction.slug as auction_slug,
        auction.title as auction_title,
        auction.status as auction_status,
        auction.currency,
        item.title as item_title,
        item.status as item_status,
        item.reserve_price_cents,
        bid.bidder_name,
        bid.bidder_email,
        bid.bidder_phone,
        bid.amount_cents,
        bid.is_winning,
        bid.payment_token::text as payment_token,
        bid.payment_status,
        bid.stripe_checkout_session_id,
        bid.stripe_payment_intent_id,
        bid.paid_at::text
      from silent_auction_bids bid
      inner join silent_auction_items item
        on item.id = bid.item_id
       and item.auction_id = bid.auction_id
      inner join silent_auctions auction
        on auction.id = bid.auction_id
      where bid.id = $1::uuid
      limit 1
    `,
    [bidId],
  );
}

export async function markAuctionWinningBidCheckoutStarted(input: {
  bidId: string;
  stripeCheckoutSessionId: string;
}) {
  return queryOne<SilentAuctionBid>(
    `
      update silent_auction_bids
      set
        payment_status = 'checkout_started',
        stripe_checkout_session_id = $2
      where id = $1
        and payment_status <> 'paid'
      returning *
    `,
    [input.bidId, input.stripeCheckoutSessionId],
  );
}

export async function markAuctionWinningBidPaid(input: {
  bidId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
}) {
  return queryOne<SilentAuctionBid>(
    `
      update silent_auction_bids
      set
        payment_status = 'paid',
        stripe_checkout_session_id = $2,
        stripe_payment_intent_id = $3,
        paid_at = now()
      where id = $1
      returning *
    `,
    [
      input.bidId,
      input.stripeCheckoutSessionId,
      input.stripePaymentIntentId,
    ],
  );
}

export async function markAuctionWinningBidCancelled(input: {
  bidId: string;
}) {
  return queryOne<SilentAuctionBid>(
    `
      update silent_auction_bids
      set payment_status = 'cancelled'
      where id = $1
        and payment_status <> 'paid'
      returning *
    `,
    [input.bidId],
  );
}

export function isAuctionWinningBidPayable(
  payment: AuctionWinningBidPayment | null,
) {
  if (!payment) return false;
  if (!payment.is_winning) return false;
  if (payment.payment_status === "paid") return false;

  if (
    payment.reserve_price_cents !== null &&
    payment.reserve_price_cents !== undefined &&
    Number(payment.amount_cents || 0) < Number(payment.reserve_price_cents || 0)
  ) {
    return false;
  }

  return true;
}
