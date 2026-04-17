import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  createRaffle,
  updateRaffle,
  getAdminRaffle,
} from "../../../src/api";

export default function AdminRaffleEditPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [ticketPrice, setTicketPrice] = useState(0);
  const [currency, setCurrency] = useState("GBP");

  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const raffle = await getAdminRaffle(id);

        setTitle(raffle.title || "");
        setSlug(raffle.slug || "");
        setTicketPrice(raffle.ticketPrice || 0);
        setCurrency(raffle.currency || "GBP");
      } catch {
        setStatusMessage("New raffle");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  async function persist() {
    const payload = {
      title,
      slug,
      ticketPrice,
      currency,
    };

    if (id && id !== "create") {
      return await updateRaffle(id, payload as any);
    }

    return await createRaffle(payload as any);
  }

  // ✅ SAVE DRAFT (STAYS IN ADMIN)
  async function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setStatusMessage("");

    try {
      const saved = await persist();

      setStatusMessage("Draft saved");

      const nextId = saved.id || id;

      // stay in admin
      router.replace(`/admin/raffles/${nextId}`);
    } catch (err: any) {
      setStatusMessage(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ✅ COMPLETE (GOES TO PUBLIC PAGE)
  async function handleComplete() {
    setCompleting(true);
    setStatusMessage("");

    try {
      const saved = await persist();

      const publicSlug = saved.slug || slug;

      if (!publicSlug) {
        throw new Error("Missing slug");
      }

      router.push(`/r/${publicSlug}`);
    } catch (err: any) {
      setStatusMessage(err.message || "Complete failed");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <form onSubmit={handleSaveDraft}>
        <h1>Edit Raffle</h1>

        {statusMessage && (
          <div style={{ marginBottom: 12, color: "green" }}>
            {statusMessage}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={{ display: "block", width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="GBP">GBP (£)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Ticket Price</label>
          <input
            type="number"
            value={ticketPrice}
            onChange={(e) => setTicketPrice(Number(e.target.value))}
          />
        </div>

        {/* ✅ BUTTONS FIXED */}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit">
            {saving ? "Saving..." : "Save Draft"}
          </button>

          <button
            type="button"
            onClick={handleComplete}
          >
            {completing ? "Completing..." : "Complete"}
          </button>
        </div>
      </form>
    </div>
  );
}
