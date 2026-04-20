import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function SuccessPage() {
  const router = useRouter();
  const { session_id } = router.query;

  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!session_id) return;

    fetch(`/api/stripe/session?session_id=${session_id}`)
      .then((res) => res.json())
      .then(setData);
  }, [session_id]);

  if (!session_id) {
    return <div style={{ padding: 20 }}>Missing session ID</div>;
  }

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1>Payment successful</h1>

      {!data && <p>Loading...</p>}

      {data && (
        <>
          <p><strong>Amount:</strong> {data.amount}</p>
          <p><strong>Email:</strong> {data.email}</p>
          <p><strong>Status:</strong> {data.status}</p>
        </>
      )}
    </main>
  );
}
