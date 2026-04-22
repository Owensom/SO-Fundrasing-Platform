export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function RaffleSlugPage({ params }: PageProps) {
  return (
    <main style={{ padding: 24 }}>
      <h1>Raffle route works</h1>
      <p>Slug: {params.slug}</p>
    </main>
  );
}
