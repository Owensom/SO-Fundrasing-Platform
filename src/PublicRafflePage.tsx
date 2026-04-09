import { useEffect, useState } from "react";
import { publicApiFetch } from "./api";

export default function PublicRafflePage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await publicApiFetch(
        "/api/public/raffles/demo-a"
      );
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load");
    }
  }

  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }

  if (!data) {
    return <div style={{ color: "white" }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 20, color: "white" }}>
      <h1>{data.tenant.name}</h1>

      {data.raffles.length === 0 && (
        <p>No raffles available</p>
      )}

      {data.raffles.map((r: any) => (
        <div
          key={r.id}
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            padding: 16,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <h2>{r.title}</h2>
          <p>Price: £{r.price}</p>
        </div>
      ))}
    </div>
  );
}
