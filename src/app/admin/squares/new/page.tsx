export default function NewSquaresGamePage() {
  const defaultPrizes = JSON.stringify(
    [
      {
        title: "1st Prize",
        description: "",
        imageUrl: "",
      },
    ],
    null,
    2,
  );

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Create squares game</h1>

      <form
        action="/api/admin/squares"
        method="post"
        style={{ display: "grid", gap: 16 }}
      >
        <label>
          Title
          <input
            name="title"
            required
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Slug
          <input
            name="slug"
            placeholder="summer-squares"
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Description
          <textarea
            name="description"
            rows={4}
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Image URL
          <input
            name="image_url"
            placeholder="https://..."
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Number of squares
          <input
            name="total_squares"
            type="number"
            min={1}
            max={500}
            defaultValue={100}
            required
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Price per square
          <input
            name="price_per_square"
            type="number"
            min={0}
            step="0.01"
            defaultValue="2.00"
            required
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Currency
          <select
            name="currency"
            defaultValue="GBP"
            style={{ display: "block", width: "100%", padding: 10 }}
          >
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label>
          Status
          <select
            name="status"
            defaultValue="draft"
            style={{ display: "block", width: "100%", padding: 10 }}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label>
          Prizes JSON
          <textarea
            name="prizes"
            rows={8}
            defaultValue={defaultPrizes}
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              fontFamily: "monospace",
            }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #111",
            cursor: "pointer",
          }}
        >
          Create squares game
        </button>
      </form>
    </main>
  );
}
