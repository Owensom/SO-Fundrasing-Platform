"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  tenantSlug: string;
  currency: string;
  disabled?: boolean;
};

function normaliseCurrency(value: string) {
  const clean = String(value || "GBP").trim().toLowerCase();

  return clean || "gbp";
}

export default function PayoutButton({ tenantSlug, currency, disabled }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const safeTenantSlug = String(tenantSlug || "").trim();
  const safeCurrency = normaliseCurrency(currency);
  const currencyLabel = safeCurrency.toUpperCase();

  async function markPaid() {
    if (!safeTenantSlug || disabled || loading) {
      return;
    }

    const enteredReference = window.prompt(
      `Enter payout reference for ${safeTenantSlug} (${currencyLabel}), e.g. bank transfer ref:`,
    );

    if (enteredReference === null) {
      return;
    }

    const reference = enteredReference.trim();

    if (!reference) {
      window.alert("Please enter a payout reference before marking this as paid.");
      return;
    }

    const confirmed = window.confirm(
      `Mark all pending ${currencyLabel} payouts for ${safeTenantSlug} as paid?`,
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/payouts/mark-paid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug: safeTenantSlug,
          currency: safeCurrency,
          reference,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        window.alert(data?.error || "Failed to mark payout paid.");
        return;
      }

      window.alert(`Marked ${data.paidCount || 0} payment(s) as paid.`);
      router.refresh();
    } catch (error) {
      console.error("Mark payout paid failed:", error);
      window.alert("Failed to mark payout paid.");
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = Boolean(disabled || loading || !safeTenantSlug);

  return (
    <button
      type="button"
      onClick={markPaid}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid #16a34a",
        background: isDisabled ? "#dcfce7" : "#16a34a",
        color: isDisabled ? "#166534" : "#ffffff",
        fontWeight: 700,
        cursor: isDisabled ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "Marking..." : "Mark paid"}
    </button>
  );
}
