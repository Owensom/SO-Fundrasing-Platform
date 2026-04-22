import PublicRafflePage from "@/components/PublicRafflePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function RaffleSlugPage({ params }: PageProps) {
  return (
    <div style={{ padding: 24, background: "#ffffff", minHeight: "100vh" }}>
      <PublicRafflePage slug={params.slug} />
    </div>
  );
}
