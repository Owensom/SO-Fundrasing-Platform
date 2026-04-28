import crypto from "crypto";
import { query, queryOne } from "./db";

type CurrencyCode = "GBP" | "USD" | "EUR";

export type SquaresStatus = "draft" | "published" | "closed" | "drawn";

export type SquarePrize = {
  title: string;
  description?: string;
  imageUrl?: string;
};

export type SquaresConfig = {
  prizes?: SquarePrize[];
  sold?: number[];
  reserved?: number[];
};

export type SquaresGameRow = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  draw_at: string | null;
  status: SquaresStatus;
  currency: CurrencyCode | null;
  price_per_square_cents: number;
  total_squares: number;
  config_json: SquaresConfig | null;
  created_at: string;
  updated_at: string;
};

export type CreateSquaresGameInput = {
  tenant_slug: string;
  slug: string;
  title: string;
  description?: string;
  image_url?: string;
  draw_at?: string | null;
  status?: SquaresStatus;
  currency?: CurrencyCode;
  price_per_square_cents: number;
  total_squares: number;
  prizes?: SquarePrize[];
};

export type UpdateSquaresGameInput = Partial<CreateSquaresGameInput> & {
  sold?: number[];
  reserved?: number[];
};

export type SquaresReservationRow = {
  id: string;
  tenant_slug: string;
  game_id: string;
  reservation_token: string;
  squares: number[];
  customer_email: string | null;
  customer_name: string | null;
  stripe_checkout_session_id: string | null;
  payment_status: string;
  expires_at: string;
  created_at: string;
};

export type SquaresSaleRow = {
  id: string;
  tenant_slug: string;
  game_id: string;
  reservation_token: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_status: string;
  currency: CurrencyCode | null;
  gross_amount_cents: number;
  platform_fee_cents: number;
  net_amount_cents: number;
  customer_email: string | null;
  customer_name: string | null;
  squares: number[];
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

export type SquaresWinnerRow = {
  id: string;
  tenant_slug: string;
  game_id: string;
  prize_index: number;
  prize_title: string;
  square_number: number;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
};

function uuid() {
  return crypto.randomUUID();
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normaliseSquares(value: unknown, totalSquares: number) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<number>();

  for (const item of value) {
    const n = Number(item);

    if (
      Number.isInteger(n) &&
      n >= 1 &&
      n <= totalSquares &&
      !seen.has(n)
    ) {
      seen.add(n);
    }
  }

  return Array.from(seen).sort((a, b) => a - b);
}

export function normalisePrizes(value: unknown): SquarePrize[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const raw = item as Record<string, unknown>;

      return {
        title: String(raw.title ?? raw.name ?? "").trim(),
        description: String(raw.description ?? "").trim(),
        imageUrl: String(raw.imageUrl ?? raw.image_url ?? "").trim(),
      };
    })
    .filter((item) => item.title.length > 0);
}

export async function listSquaresGames(tenantSlug: string) {
  return query<SquaresGameRow>(
    `
      select *
      from squares_games
      where tenant_slug = $1
      order by created_at desc
    `,
    [tenantSlug],
  );
}

export async function getSquaresGameById(id: string) {
  return queryOne<SquaresGameRow>(
    `
      select *
      from squares_games
      where id = $1
      limit 1
    `,
    [id],
  );
}

export async function getSquaresGameByTenantAndSlug(
  tenantSlug: string,
  slug: string,
) {
  return queryOne<SquaresGameRow>(
    `
      select *
      from squares_games
      where tenant_slug = $1
        and slug = $2
      limit 1
    `,
    [tenantSlug, slug],
  );
}

export async function createSquaresGame(input: CreateSquaresGameInput) {
  const id = uuid();

  const totalSquares = Math.min(
    500,
    Math.max(1, Number(input.total_squares || 100)),
  );

  const config: SquaresConfig = {
    prizes: normalisePrizes(input.prizes ?? []),
    sold: [],
    reserved: [],
  };

  return queryOne<SquaresGameRow>(
    `
      insert into squares_games (
        id,
        tenant_slug,
        slug,
        title,
        description,
        image_url,
        draw_at,
        status,
        currency,
        price_per_square_cents,
        total_squares,
        config_json
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
      returning *
    `,
    [
      id,
      input.tenant_slug,
      slugify(input.slug || input.title),
      input.title,
      input.description ?? "",
      input.image_url ?? "",
      input.draw_at ?? null,
      input.status ?? "draft",
      input.currency ?? "GBP",
      Number(input.price_per_square_cents || 0),
      totalSquares,
      JSON.stringify(config),
    ],
  );
}

export async function updateSquaresGame(
  id: string,
  input: UpdateSquaresGameInput,
) {
  const existing = await getSquaresGameById(id);

  if (!existing) return null;

  const currentConfig = existing.config_json ?? {};

  const totalSquares =
    input.total_squares != null
      ? Math.min(500, Math.max(1, Number(input.total_squares)))
      : existing.total_squares;

  const config: SquaresConfig = {
    prizes:
      input.prizes != null
        ? normalisePrizes(input.prizes)
        : normalisePrizes(currentConfig.prizes ?? []),
    sold:
      input.sold != null
        ? normaliseSquares(input.sold, totalSquares)
        : normaliseSquares(currentConfig.sold ?? [], totalSquares),
    reserved:
      input.reserved != null
        ? normaliseSquares(input.reserved, totalSquares)
        : normaliseSquares(currentConfig.reserved ?? [], totalSquares),
  };

  return queryOne<SquaresGameRow>(
    `
      update squares_games
      set
        tenant_slug = $2,
        slug = $3,
        title = $4,
        description = $5,
        image_url = $6,
        draw_at = $7,
        status = $8,
        currency = $9,
        price_per_square_cents = $10,
        total_squares = $11,
        config_json = $12::jsonb,
        updated_at = now()
      where id = $1
      returning *
    `,
    [
      id,
      input.tenant_slug ?? existing.tenant_slug,
      input.slug != null ? slugify(input.slug) : existing.slug,
      input.title ?? existing.title,
      input.description ?? existing.description ?? "",
      input.image_url ?? existing.image_url ?? "",
      input.draw_at !== undefined ? input.draw_at : existing.draw_at ?? null,
      input.status ?? existing.status,
      input.currency ?? existing.currency ?? "GBP",
      input.price_per_square_cents != null
        ? Number(input.price_per_square_cents)
        : existing.price_per_square_cents,
      totalSquares,
      JSON.stringify(config),
    ],
  );
}

export async function deleteSquaresGame(id: string, tenantSlug: string) {
  const result = await query<{ id: string }>(
    `
      delete from squares_games
      where id = $1
        and tenant_slug = $2
      returning id
    `,
    [id, tenantSlug],
  );

  return result.length > 0;
}

export async function cleanupExpiredSquaresReservations(gameId: string) {
  await query(
    `
      delete from squares_reservations
      where game_id = $1
        and payment_status = 'reserved'
        and expires_at < now()
    `,
    [gameId],
  );
}

export async function getActiveSquaresReservations(gameId: string) {
  return query<SquaresReservationRow>(
    `
      select *
      from squares_reservations
      where game_id = $1
        and payment_status = 'reserved'
        and expires_at >= now()
      order by created_at asc
    `,
    [gameId],
  );
}

export async function createSquaresReservation(input: {
  tenant_slug: string;
  game_id: string;
  squares: number[];
  customer_email?: string;
  customer_name?: string;
  minutes?: number;
}) {
  const id = uuid();
  const reservationToken = uuid();
  const minutes = Math.max(1, Number(input.minutes ?? 15));

  return queryOne<SquaresReservationRow>(
    `
      insert into squares_reservations (
        id,
        tenant_slug,
        game_id,
        reservation_token,
        squares,
        customer_email,
        customer_name,
        payment_status,
        expires_at
      )
      values (
        $1,$2,$3,$4,$5::jsonb,$6,$7,'reserved',now() + ($8 || ' minutes')::interval
      )
      returning *
    `,
    [
      id,
      input.tenant_slug,
      input.game_id,
      reservationToken,
      JSON.stringify(input.squares),
      input.customer_email ?? null,
      input.customer_name ?? null,
      minutes,
    ],
  );
}

export async function getSquaresReservationByToken(token: string) {
  return queryOne<SquaresReservationRow>(
    `
      select *
      from squares_reservations
      where reservation_token = $1
      limit 1
    `,
    [token],
  );
}

export async function markSquaresReservationCheckoutSession(
  reservationToken: string,
  stripeCheckoutSessionId: string,
) {
  return queryOne<SquaresReservationRow>(
    `
      update squares_reservations
      set stripe_checkout_session_id = $2
      where reservation_token = $1
      returning *
    `,
    [reservationToken, stripeCheckoutSessionId],
  );
}

export async function markSquaresReservationPaid(reservationToken: string) {
  return queryOne<SquaresReservationRow>(
    `
      update squares_reservations
      set payment_status = 'paid'
      where reservation_token = $1
      returning *
    `,
    [reservationToken],
  );
}

export async function createSquaresSale(input: {
  tenant_slug: string;
  game_id: string;
  reservation_token: string;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  payment_status?: string;
  currency?: CurrencyCode;
  gross_amount_cents: number;
  platform_fee_cents: number;
  net_amount_cents: number;
  customer_email?: string | null;
  customer_name?: string | null;
  squares: number[];
  metadata_json?: Record<string, unknown>;
}) {
  const id = uuid();

  return queryOne<SquaresSaleRow>(
    `
      insert into squares_sales (
        id,
        tenant_slug,
        game_id,
        reservation_token,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        payment_status,
        currency,
        gross_amount_cents,
        platform_fee_cents,
        net_amount_cents,
        customer_email,
        customer_name,
        squares,
        metadata_json
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb)
      returning *
    `,
    [
      id,
      input.tenant_slug,
      input.game_id,
      input.reservation_token,
      input.stripe_checkout_session_id ?? null,
      input.stripe_payment_intent_id ?? null,
      input.payment_status ?? "paid",
      input.currency ?? "GBP",
      Number(input.gross_amount_cents || 0),
      Number(input.platform_fee_cents || 0),
      Number(input.net_amount_cents || 0),
      input.customer_email ?? null,
      input.customer_name ?? null,
      JSON.stringify(input.squares),
      JSON.stringify(input.metadata_json ?? {}),
    ],
  );
}

export async function listSquaresSales(gameId: string) {
  return query<SquaresSaleRow>(
    `
      select *
      from squares_sales
      where game_id = $1
      order by created_at asc
    `,
    [gameId],
  );
}

export async function listSquaresWinners(gameId: string) {
  return query<SquaresWinnerRow>(
    `
      select *
      from squares_winners
      where game_id = $1
      order by prize_index asc, created_at asc
    `,
    [gameId],
  );
}

export async function createSquaresWinner(input: {
  tenant_slug: string;
  game_id: string;
  prize_index: number;
  prize_title: string;
  square_number: number;
  customer_name?: string | null;
  customer_email?: string | null;
}) {
  const id = uuid();

  return queryOne<SquaresWinnerRow>(
    `
      insert into squares_winners (
        id,
        tenant_slug,
        game_id,
        prize_index,
        prize_title,
        square_number,
        customer_name,
        customer_email
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8)
      returning *
    `,
    [
      id,
      input.tenant_slug,
      input.game_id,
      input.prize_index,
      input.prize_title,
      input.square_number,
      input.customer_name ?? null,
      input.customer_email ?? null,
    ],
  );
}
