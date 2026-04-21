import type { ComponentType } from "react";
import * as PublicRaffleModule from "@/components/PublicRafflePage";

type PageProps = {
  params: {
    slug: string;
  };
};

const PublicRafflePage = (
  (PublicRaffleModule as any).default ??
  (PublicRaffleModule as any).PublicRafflePage
) as ComponentType<{ slug: string }>;

export default function RafflePage({ params }: PageProps) {
  if (!PublicRafflePage) {
    return <div>Public raffle page component not found.</div>;
  }

  return <PublicRafflePage slug={params.slug} />;
}
