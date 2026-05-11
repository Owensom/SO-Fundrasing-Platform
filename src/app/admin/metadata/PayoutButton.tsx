"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  tenantSlug: string;
  currency: string;
  disabled?: boolean;
};

export default function PayoutButton({ tenantSlug, currency, disabled }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markPaid() {
    const reference = window.prompt(
      `Enter payout reference for ${tenantSlug} (${currency.toUpperCase()}), e.g. bank transfer ref:`
    );

    if (reference === null) return;

    const confirmed = window.confirm(
      `Mark all pending ${currency.toUpperCase()} payouts for ${tenantSlug} as paid?`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const response = await fetch("/api/admin/payouts/mark-paid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug,
          currency,
          reference,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        alert(data?.error || "Failed to mark payout paid.");
        return;
      }

      alert(`Marked ${data.paidCount} payment(s) as paid.`);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to mark payout paid.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={markPaid}
      disabled={disabled || loading}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid #16a34a",
        background: disabled || loading ? "#dcfce7" : "#16a34a",
        color: disabled || loading ? "#166534" : "#ffffff",
        fontWeight: 700,
        cursor: disabled || loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "Marking..." : "Mark paid"}
    </button>
  );
}
