"use client";

import { useState } from "react";

type Props = {
  raffleId: string;
  status: "draft" | "published" | "closed" | "drawn";
};

export default function RaffleAdminActions({ raffleId, status }: Props) {
  const [loading, setLoading] = useState(false);

  const isLocked = status === "drawn";
  const isClosed = status === "closed";

  async function runAction(action: string, extra?: any) {
    try {
      setLoading(true);

      const res = await fetch(`/api/admin/raffles/${raffleId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...extra,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.error || "Action failed");
        return;
      }

      // refresh page
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      {/* ✅ PUBLISH */}
      {status === "draft" && (
        <button
          onClick={() => runAction("publish")}
          disabled={loading}
          style={buttonStyle("#2563eb")}
        >
          Publish
        </button>
      )}

      {/* ✅ CLOSE */}
      {status === "published" && (
        <button
          onClick={() => runAction("close")}
          disabled={loading}
          style={buttonStyle("#f59e0b")}
        >
          Close entries
        </button>
      )}

      {/* ✅ DRAW */}
      {status === "closed" && (
        <button
          onClick={() => runAction("draw")}
          disabled={loading}
          style={buttonStyle("#16a34a")}
        >
          Draw winner
        </button>
      )}

      {/* 🔒 DRAWN */}
      {status === "drawn" && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontWeight: 700,
          }}
        >
          Winner drawn — raffle locked
        </div>
      )}

      {/* 🗑 DELETE (always available) */}
      <button
        onClick={() => {
          if (!confirm("Delete this raffle? This cannot be undone.")) return;
          runAction("delete");
        }}
        disabled={loading}
        style={buttonStyle("#dc2626")}
      >
        Delete raffle
      </button>
    </div>
  );
}

function buttonStyle(color: string): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #111827",
    background: color,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  };
}
