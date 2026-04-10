create table if not exists raffles (
  id text primary key,
  tenant_slug text not null,
  slug text not null,
  title text not null,
  description text not null default '',
  image_url text,
  ticket_price_cents integer not null check (ticket_price_cents >= 0),
  total_tickets integer not null check (total_tickets > 0),
  sold_tickets integer not null default 0 check (sold_tickets >= 0),
  status text not null check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, slug)
);

create table if not exists raffle_purchases (
  id text primary key,
  tenant_slug text not null,
  raffle_id text not null references raffles(id) on delete cascade,
  raffle_slug text not null,
  customer_name text not null,
  customer_email text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  total_price_cents integer not null check (total_price_cents >= 0),
  payment_status text not null check (payment_status in ('pending', 'paid', 'failed', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_raffles_tenant_slug on raffles (tenant_slug, slug);
create index if not exists idx_raffle_purchases_raffle on raffle_purchases (tenant_slug, raffle_slug, created_at desc);
create index if not exists idx_raffle_purchases_status on raffle_purchases (tenant_slug, raffle_slug, payment_status);

insert into raffles (
  id,
  tenant_slug,
  slug,
  title,
  description,
  image_url,
  ticket_price_cents,
  total_tickets,
  sold_tickets,
  status
)
values (
  'raffle_demo_001',
  'demo-a',
  'spring-cash-raffle',
  'Spring Cash Raffle',
  'Win the spring raffle prize. This is seeded demo data so the public page and purchase flow work end-to-end.',
  null,
  1000,
  100,
  0,
  'published'
)
on conflict (id) do nothing;
