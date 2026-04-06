import React ...
...
export default function SquaresSection() {
  if (!canBuy) return;

  const now = new Date().toLocaleString();
  const purchase: Purchase = {
    id: Date.now(),
    gameId: game.id,
    gameTitle: game.title,
    buyerName: buyerName.trim(),
    buyerEmail: buyerEmail.trim(),
    squares: [...visibleSelected],
    total: totalCost,
    createdAt: now,
  };

  appendLedger({
    id: String(purchase.id),
    module: "squares",
    itemTitle: purchase.gameTitle,
    buyerName: purchase.buyerName,
    buyerEmail: purchase.buyerEmail,
    description: `Squares: ${purchase.squares.join(", ")}`,
    quantity: purchase.squares.length,
    total: purchase.total,
    createdAt: purchase.createdAt,
  });

  setPurchases((curr) => [purchase, ...curr]);

  setGames((curr) =>
    curr.map((g) =>
      g.id === game.id
        ? { ...g, sold: [...g.sold, ...visibleSelected].sort((a, b) => a - b) }
        : g,
    ),
  );

  setSelectedByGame((curr) => ({ ...curr, [game.id]: [] }));

  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("Squares Purchase Receipt", 20, 22);
  doc.setFontSize(12);
  doc.text(`Game: ${purchase.gameTitle}`, 20, 38);
  doc.text(`Buyer: ${purchase.buyerName}`, 20, 48);
  doc.text(`Email: ${purchase.buyerEmail}`, 20, 58);
  doc.text(`Purchased: ${purchase.createdAt}`, 20, 68);
  doc.text(`Squares: ${purchase.squares.join(", ")}`, 20, 82);
  doc.text(`Quantity: ${purchase.squares.length}`, 20, 92);
  doc.text(`Price each: ${money(game.price)}`, 20, 102);
  doc.text(`Total: ${money(purchase.total)}`, 20, 112);
  doc.save(`${purchase.gameTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-receipt.pdf`);
}
