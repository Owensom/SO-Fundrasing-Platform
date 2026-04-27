/import PublicRafflePage from "@/components/PublicRafflePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function RaffleSlugPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <div style={{ padding: 24, background: "#ffffff", minHeight: "100vh" }}>
      <PublicRafflePage slug={slug} />
    </div>
  );
}
