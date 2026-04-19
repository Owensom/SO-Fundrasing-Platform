export default function AdminRaffleDetailsTestPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Admin raffle details test</h1>
      <p>
        ID: <strong>{params.id}</strong>
      </p>
    </main>
  );
}
