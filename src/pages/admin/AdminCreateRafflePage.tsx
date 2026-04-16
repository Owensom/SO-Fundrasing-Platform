```tsx
import React, { useState } from "react";

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

  const totalTickets = endNumber - startNumber + 1;

  function addOffer() {
    setOffers([
      ...offers,
      { label: "", price: 0, quantity: 1 },
    ]);
  }

  function updateOffer(index: number, field: keyof Offer, value: any) {
    const updated = [...offers];
    (updated[index] as any)[field] = value;
    setOffers(updated);
  }

  function removeOffer(index: number) {
    setOffers(offers.filter((_, i) => i !== index));
  }

  function addColour(colour: string) {
    if (!colour) return;
    if (colours.includes(colour)) return;
    setColours([...colours, colour]);
  }

  function removeColour(colour: string) {
    setColours(colours.filter((c) => c !== colour));
  }

  async function handleSubmit(e: React.FormEvent) {
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

    console.log("CREATE RAFFLE:", payload);

    // TODO: wire to API
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto" }}>
      <h1>Create Raffle</h1>

      <form onSubmit={handleSubmit}>
        {/* BASIC INFO */}
        <div>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <label>Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </div>

        {/* TICKET RANGE */}
        <h3>Tickets</h3>

        <div>
          <label>Start Number</label>
          <input
            type="number"
            value={startNumber}
            onChange={(e) => setStartNumber(Number(e.target.value))}
          />
        </div>

        <div>
          <label>End Number</label>
          <input
            type="number"
            value={endNumber}
            onChange={(e) => setEndNumber(Number(e.target.value))}
          />
        </div>

        <p><strong>Total Tickets: {totalTickets}</strong></p>

        <div>
          <label>Single Ticket Price</label>
          <input
            type="number"
            value={ticketPrice}
            onChange={(e) => setTicketPrice(Number(e.target.value))}
          />
        </div>

        {/* OFFERS */}
        <h3>Offers</h3>

        {offers.map((offer, i) => (
          <div key={i} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <input
              placeholder="Label (e.g. 5 for £4)"
              value={offer.label}
              onChange={(e) => updateOffer(i, "label", e.target.value)}
            />
            <input
              type="number"
              placeholder="Price"
              value={offer.price}
              onChange={(e) => updateOffer(i, "price", Number(e.target.value))}
            />
            <input
              type="number"
              placeholder="Quantity"
              value={offer.quantity}
              onChange={(e) => updateOffer(i, "quantity", Number(e.target.value))}
            />
            <button type="button" onClick={() => removeOffer(i)}>Remove</button>
          </div>
        ))}

        <button type="button" onClick={addOffer}>
          Add Offer
        </button>

        {/* COLOURS */}
        <h3>Colours</h3>

        <input
          type="text"
          placeholder="Add colour (e.g. red or #ff0000)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addColour((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {colours.map((c) => (
            <div
              key={c}
              onClick={() => removeColour(c)}
              style={{
                width: 30,
                height: 30,
                background: c,
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        <br />
        <button type="submit">Create Raffle</button>
      </form>
    </div>
  );
}
```
