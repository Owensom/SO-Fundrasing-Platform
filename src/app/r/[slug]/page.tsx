import PublicRafflePage from "@/components/PublicRafflePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function RaffleSlugPage({ params }: PageProps) {
  const slug = typeof params?.slug === "string" ? params.slug : "";

  return <PublicRafflePage slug={slug} />;
}
