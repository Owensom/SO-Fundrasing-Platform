import React, { useMemo, useState } from "react";

type Offer = {
  label: string;
  price: number;
  quantity: number;
};

export default function AdminCreateRafflePage() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(100);
  const [ticketPrice, setTicketPrice] = useState(1);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [colours, setColours] = useState<string[]>([]);
  const [colourInput, setColourInput] = useState("");

  const totalTickets = useMemo(() => {
    if (endNumber < startNumber) return 0;
    return endNumber - startNumber + 1;
  }, [startNumber, endNumber]);

  function addOffer() {
    setOffers((prev) => [...prev, { label: "", price: 0, quantity: 1 }]);
  }

  function updateOffer(index: number, field: keyof Offer, value: string | number) {
    setOffers((prev) =>
      prev.map((offer, i) =>
        i === index ? { ...offer, [field]: value } : offer
      )
    );
  }

  function removeOffer(index: number) {
    setOffers((prev) => prev.filter((_, i) => i !== index));
  }

  function addColour() {
    const value = colourInput.trim();
    if (!value) return;
    if (colours.includes(value)) return;
    setColours((prev) => [...prev, value]);
    setColourInput("");
  }

  function removeColour(colour: string) {
    setColours((prev) => prev.filter((c) => c !== colour));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const payload = {
      title,
      slug,
      startNumber,
      endNumber,
      totalTickets,
      ticketPrice,
      offers,
      colours,
    };

    console.log("Create raffle payload:", payload);
    alert("Create page restored. API wiring comes next.");
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Create Raffle</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label htmlFor="title">Title</label>
            <br />
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: 10 }}
              required
            />
          </div>

          <div>
            <label htmlFor="slug">Slug</label>
            <br />
            <input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              style={{ width: "100%", padding: 10 }}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label htmlFor="startNumber">Start Number</label>
              <br />
              <input
                id="startNumber"
                type="number"
                value={startNumber}
                onChange={(e) => setStartNumber(Number(e.target.value))}
                style={{ width: "100%", padding: 10 }}
                required
              />
            </div>

            <div>
              <label htmlFor="endNumber">End Number</label>
              <br />
              <input
                id="endNumber"
                type="number"
                value={endNumber}
                onChange={(e) => setEndNumber(Number(e.target.value))}
                style={{ width: "100%", padding: 10 }}
                required
              />
            </div>
          </div>

          <div>
            <strong>Total tickets: {totalTickets}</strong>
          </div>

          <div>
            <label htmlFor="ticketPrice">Single Ticket Price</label>
            <br />
            <input
              id="ticketPrice"
              type="number"
              min="0"
              step="0.01"
              value={ticketPrice}
              onChange={(e) => setTicketPrice(Number(e.target.value))}
              style={{ width: "100%", padding: 10 }}
              required
            />
          </div>

          <div>
            <h2>Offers</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {offers.map((offer, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr auto",
                    gap: 12,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <label>Label</label>
                    <br />
                    <input
                      value={offer.label}
                      onChange={(e) =>
                        updateOffer(index, "label", e.target.value)
                      }
                      style={{ width: "100%", padding: 10 }}
                      placeholder="e.g. 5 for £4"
                    />
                  </div>

                  <div>
                    <label>Price</label>
                    <br />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={offer.price}
                      onChange={(e) =>
                        updateOffer(index, "price", Number(e.target.value))
                      }
                      style={{ width: "100%", padding: 10 }}
                    />
                  </div>

                  <div>
                    <label>Quantity</label>
                    <br />
                    <input
                      type="number"
                      min="1"
                      value={offer.quantity}
                      onChange={(e) =>
                        updateOffer(index, "quantity", Number(e.target.value))
                      }
                      style={{ width: "100%", padding: 10 }}
                    />
                  </div>

                  <button type="button" onClick={() => removeOffer(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={addOffer}>
                Add Offer
              </button>
            </div>
          </div>

          <div>
            <h2>Colours</h2>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                value={colourInput}
                onChange={(e) => setColourInput(e.target.value)}
                placeholder="e.g. red or #ff0000"
                style={{ padding: 10, minWidth: 240 }}
              />
              <button type="button" onClick={addColour}>
                Add Colour
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 16,
              }}
            >
              {colours.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  onClick={() => removeColour(colour)}
                  title={`Remove ${colour}`}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: "1px solid #ccc",
                    background: colour,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <button type="submit">Create Raffle</button>
          </div>
        </div>
      </form>
    </div>
  );
}
