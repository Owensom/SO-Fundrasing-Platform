<section style={{ marginTop: 30 }}>
  <h2>Offers</h2>

  <div style={{ display: "grid", gap: 10 }}>
    {offers.map((offer: any, i: number) => (
      <div
        key={i}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 100px 100px 80px",
          gap: 10,
        }}
      >
        <input
          placeholder="Label (e.g. 3 for 12)"
          defaultValue={offer.label || ""}
          name={`offer_label_${i}`}
        />

        <input
          type="number"
          placeholder="Tickets"
          defaultValue={offer.quantity ?? offer.tickets ?? 0}
          name={`offer_quantity_${i}`}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Price"
          defaultValue={offer.price ?? 0}
          name={`offer_price_${i}`}
        />

        <input
          type="checkbox"
          defaultChecked={offer.is_active ?? true}
          name={`offer_active_${i}`}
        />
      </div>
    ))}
  </div>

  <input
    type="hidden"
    name="offers"
    value={JSON.stringify(
      offers.map((offer: any, i: number) => ({
        id: offer.id || `offer-${i}`,
        label: offer.label,
        price: Number(offer.price),
        quantity: Number(offer.quantity ?? offer.tickets),
        is_active: offer.is_active ?? true,
        sort_order: i,
      })),
    )}
  />
</section>
