import { query, queryOne } from "@/lib/db";

export type AuctionStatus = "draft" | "published" | "closed";
export type AuctionItemStatus = "active" | "closed" | "withdrawn";

export type SilentAuction = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
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
      where slug = $1
        and tenant_slug = $2
      limit 1
    `,
    [slug, tenantSlug],
  );
}

export async function createAuction(input: {
  tenantSlug: string;
  title: string;
  slug?: string;
  description?: string | null;
  imageUrl?: string | null;
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
        status,
        currency,
        opens_at,
        closes_at,
        terms_text
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      returning *
    `,
    [
      input.tenantSlug,
      slug,
      title,
      input.description || null,
      input.imageUrl || null,
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
        status = $6,
        currency = $7,
        opens_at = $8,
        closes_at = $9,
        terms_text = $10,
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
        donor_name,
        starting_bid_cents,
        minimum_increment_cents,
        reserve_price_cents,
        status,
        sort_order
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      returning *,
        null::integer as highest_bid_cents,
        0::integer as bid_count
    `,
    [
      input.auctionId,
      input.title.trim() || "Untitled item",
      input.description || null,
      input.imageUrl || null,
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
        donor_name = $5,
        starting_bid_cents = $6,
        minimum_increment_cents = $7,
        reserve_price_cents = $8,
        status = $9,
        sort_order = $10,
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
