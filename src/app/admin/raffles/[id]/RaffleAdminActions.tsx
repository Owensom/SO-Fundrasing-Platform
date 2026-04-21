"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  raffleId: string;
  status: "draft" | "published" | "closed" | "drawn";
  drawnAt?: string | null;
};

export default function RaffleAdminActions({
  raffleId,
  status,
  drawnAt,
}: Props) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<"close" | "draw" | null>(
    null
  );
  const [error, setError] = useState("");

  async function runAction(action: "close" | "draw") {
    const confirmMessage =
      action === "close"
        ? "Are you sure you want to close this raffle? No more ticket purchases will be allowed."
        : "Are you sure you want to draw a winner? This should only be done once.";

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    setError("");
    setLoadingAction(action);

    try {
      const response = await fetch(`/api/admin/raffles/${raffleId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setError(data?.error || "Action failed.");
        return;
      }

      router.refresh();
    } catch (err) {
      console.error("raffle admin action error", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  }

  const canClose = status === "published";
  const canDraw = status === "closed" && !drawnAt;

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700 }}>Raffle Actions</div>

      {error ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {canClose ? (
          <button
            type="button"
            onClick={() => runAction("close")}
            disabled={loadingAction !== null}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              fontWeight: 600,
              cursor: loadingAction ? "not-allowed" : "pointer",
              opacity: loadingAction ? 0.7 : 1,
            }}
          >
            {loadingAction === "close" ? "Closing..." : "Close Raffle"}
          </button>
        ) : null}

        {canDraw ? (
          <button
            type="button"
            onClick={() => runAction("draw")}
            disabled={loadingAction !== null}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #166534",
              background: "#16a34a",
              color: "#fff",
              fontWeight: 700,
              cursor: loadingAction ? "not-allowed" : "pointer",
              opacity: loadingAction ? 0.7 : 1,
            }}
          >
            {loadingAction === "draw" ? "Drawing..." : "Draw Winner"}
          </button>
        ) : null}

        {status === "drawn" ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              fontWeight: 600,
            }}
          >
            Winner already drawn
          </div>
        ) : null}

        {status === "draft" ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              color: "#374151",
              fontWeight: 500,
            }}
          >
            Draft raffles cannot be closed or drawn.
          </div>
        ) : null}
      </div>
    </div>
  );
}
