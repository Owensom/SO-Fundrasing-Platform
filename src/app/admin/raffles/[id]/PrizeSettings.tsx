"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Prize = {
  position: number;
  title: string;
  description?: string;
  isPublic?: boolean;
  is_public?: boolean;
};

type Props = {
  raffleId: string;
  initialPrizes: Prize[];
};

function normalisePrizes(prizes: Prize[]) {
  return prizes
    .map((prize, index) => ({
      position: Number.isFinite(Number(prize.position))
        ? Math.max(1, Math.floor(Number(prize.position)))
        : index + 1,
      title: String(prize.title || "").trim(),
      description: String(prize.description || "").trim(),
      isPublic: prize.isPublic !== false && prize.is_public !== false,
    }))
    .filter((prize) => prize.title.length > 0)
    .sort((a, b) => a.position - b.position);
}

export default function PrizeSettings({ raffleId, initialPrizes }: Props) {
  const router = useRouter();

  const [prizes, setPrizes] = useState<Prize[]>(
    normalisePrizes(initialPrizes).length
      ? normalisePrizes(initialPrizes)
      : [
          {
            position: 1,
            title: "",
            description: "",
            isPublic: true,
          },
        ]
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updatePrize(index: number, patch: Partial<Prize>) {
    setPrizes((current) =>
      current.map((prize, i) => (i === index ? { ...prize, ...patch } : prize))
    );
  }

  function addPrize() {
    setPrizes((current) => [
      ...current,
      {
        position: current.length + 1,
        title: "",
        description: "",
        isPublic: true,
      },
    ]);
  }

  function removePrize(index: number) {
    setPrizes((current) =>
      current
        .filter((_, i) => i !== index)
        .map((prize, i) => ({
          ...prize,
          position: i + 1,
        }))
    );
  }

  async function savePrizes() {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      const cleanPrizes = normalisePrizes(prizes);

      const response = await fetch(`/api/admin/raffles/${raffleId}/prizes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prizes: cleanPrizes,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save prizes.");
      }

      setPrizes(
        data.prizes.length
          ? data.prizes
          : [
              {
                position: 1,
                title: "",
                description: "",
                isPublic: true,
              },
            ]
      );

      setMessage("Prize settings saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prizes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 24,
        display: "grid",
        gap: 14,
        padding: 20,
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#ffffff",
      }}
    >
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Prize Settings</div>
        <div style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
          Choose what prizes are visible on the public raffle page.
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {prizes.map((prize, index) => (
          <div
            key={index}
            style={{
              display: "grid",
              gap: 10,
              padding: 14,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Position</span>
                <input
                  type="number"
                  min={1}
                  value={prize.position}
                  onChange={(event) =>
                    updatePrize(index, {
                      position: Math.max(
                        1,
                        Math.floor(Number(event.target.value) || 1)
                      ),
                    })
                  }
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Prize title
                </span>
                <input
                  value={prize.title}
                  onChange={(event) =>
                    updatePrize(index, { title: event.target.value })
                  }
                  placeholder="e.g. £500 cash, Luxury hamper, Weekend break"
                  style={inputStyle}
                />
              </label>

              <button
                type="button"
                onClick={() => removePrize(index)}
                style={{
                  alignSelf: "end",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Description optional
              </span>
              <textarea
                value={prize.description || ""}
                onChange={(event) =>
                  updatePrize(index, { description: event.target.value })
                }
                placeholder="Optional extra detail shown publicly"
                rows={2}
                style={{
                  ...inputStyle,
                  height: "auto",
                  paddingTop: 10,
                  resize: "vertical",
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={prize.isPublic !== false && prize.is_public !== false}
                onChange={(event) =>
                  updatePrize(index, { isPublic: event.target.checked })
                }
              />
              Show this prize on public page
            </label>
          </div>
        ))}
      </div>

      {message ? (
        <div style={{ color: "#166534", fontWeight: 700 }}>{message}</div>
      ) : null}

      {error ? (
        <div style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={addPrize}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: "#111827",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Add prize
        </button>

        <button
          type="button"
          onClick={savePrizes}
          disabled={saving}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #16a34a",
            background: "#16a34a",
            color: "#ffffff",
            fontWeight: 800,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save prizes"}
        </button>
      </div>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 8,
  border: "1px solid #d1d5db",
  padding: "0 10px",
  fontSize: 15,
};
