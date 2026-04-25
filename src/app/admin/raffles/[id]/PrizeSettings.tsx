"use client";

import { useState } from "react";

type Props = {
  raffleId: string;
  initialPrizes: any[];
};

export default function PrizeSettings({ raffleId, initialPrizes }: Props) {
  const [prizes, setPrizes] = useState(initialPrizes || []);
  const [saving, setSaving] = useState(false);

  function updatePrize(index: number, key: string, value: string) {
    const updated = [...prizes];
    updated[index] = {
      ...updated[index],
      [key]: value,
    };
    setPrizes(updated);
  }

  function addPrize() {
    setPrizes([
      ...prizes,
      { title: "", description: "" },
    ]);
  }

  function removePrize(index: number) {
    setPrizes(prizes.filter((_, i) => i !== index));
  }

  async function save() {
    try {
      setSaving(true);

      const res = await fetch(
        `/api/admin/raffles/${raffleId}/prizes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prizes }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.error || "Save failed");
        return;
      }

      alert("Saved");
    } catch (err) {
      console.error(err);
      alert("Error saving prizes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h2>Prizes</h2>

      {prizes.map((prize, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #ddd",
            padding: 12,
            marginBottom: 10,
            borderRadius: 8,
          }}
        >
          <input
            placeholder="Title"
            value={prize.title || ""}
            onChange={(e) =>
              updatePrize(index, "title", e.target.value)
            }
            style={{ display: "block", width: "100%", marginBottom: 6 }}
          />

          <input
            placeholder="Description"
            value={prize.description || ""}
            onChange={(e) =>
              updatePrize(index, "description", e.target.value)
            }
            style={{ display: "block", width: "100%", marginBottom: 6 }}
          />

          <button onClick={() => removePrize(index)}>
            Remove
          </button>
        </div>
      ))}

      <button onClick={addPrize}>Add Prize</button>

      <div style={{ marginTop: 10 }}>
        <button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save prizes"}
        </button>
      </div>
    </div>
  );
}
