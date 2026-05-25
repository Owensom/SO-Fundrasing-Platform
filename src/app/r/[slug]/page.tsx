import { notFound } from "next/navigation";
import PublicRafflePage from "@/components/PublicRafflePage";
import { queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type RafflePublicGateRow = {
  status: string | null;
};

function isDraftStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "draft";
}

export default async function RaffleSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const tenantSlug = await getTenantSlugFromHeaders();

  if (!slug || !tenantSlug) {
    notFound();
  }

  const raffle = await queryOne<RafflePublicGateRow>(
    `
      select status
      from raffles
      where tenant_slug = $1
        and slug = $2
      limit 1
    `,
    [tenantSlug, slug],
  );

  if (!raffle || isDraftStatus(raffle.status)) {
    notFound();
  }

  return <PublicRafflePage slug={slug} />;
}
