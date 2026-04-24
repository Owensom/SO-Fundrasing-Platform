import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getSquaresGameByTenantAndSlug } from "../../../../api/_lib/squares-repo";
import SquaresGameClient from "./SquaresGameClient";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function SquaresPublicPage({ params }: PageProps) {
  const tenantSlug = getTenantSlugFromHeaders();

  if (!tenantSlug) {
    notFound();
  }

  const game = await getSquaresGameByTenantAndSlug(tenantSlug, params.slug);

  if (!game || game.status !== "published") {
    notFound();
  }

  return <SquaresGameClient game={game} />;
}
