type PageProps = {
  params: {
    slug: string;
  };
};

export default function PublicRafflePage({ params }: PageProps) {
  return (
    <main style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      <h1>Public raffle page</h1>
      <p>Slug: {params.slug}</p>
      <p>App Router route is working.</p>
    </main>
  );
}
