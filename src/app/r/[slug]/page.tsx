import PublicRafflePage from "@/components/PublicRafflePage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function RaffleSlugPage({ params }: PageProps) {
  return <PublicRafflePage slug={params.slug} />;
}
