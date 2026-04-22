"use client";

import { useState } from "react";

type Props = {
  slug: string;
};

export default function PublicRafflePage({ slug }: Props) {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: 24, color: "#111111" }}>
      <h1>Client hooks test works</h1>
      <p>Slug: {slug}</p>
      <p>Count: {count}</p>
      <button
        type="button"
        onClick={() => setCount((c) => c + 1)}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Increment
      </button>
    </div>
  );
}
