import PublicRafflePage from "@/components/PublicRafflePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function RaffleSlugPage({ params }: PageProps) {
  return <PublicRafflePage slug={params.slug} />;
}
