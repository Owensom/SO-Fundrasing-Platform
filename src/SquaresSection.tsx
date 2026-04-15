import { appendLedger } from "./purchaseLedger";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { useAuth } from "./useAuth";
import { apiFetch } from "./api";

type Game = {
  id: string;
  title: string;
  total: number;
  price: number;
  background?: string;
  sold: number[];
  reserved: number[];
};

type Purchase = {
  id: string;
  gameId: string;
  gameTitle: string;
  buyerName: string;
  buyerEmail: string;
  squares: number[];
  total: number;
  createdAt: string;
};

type Drafts = Record<string, { total: string; price: string }>;

type PurchaseResponse = {
  purchase: Purchase;
  game: Game;
};

function clampSquares(n: number) {
  return Math.max(1, Math.min(500, Number.isFinite(n) ? Math.floor(n) : 1));
}

function clampPrice(n: number) {
  return Math.max(1, Number.isFinite(n) ? n : 1);
}

function money(n: number) {
  return `£${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(18px)",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
  };
}

function inputStyle(invalid = false): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 18,
    border: invalid
      ? "1px solid rgba(251,113,133,0.45)"
      : "1px solid rgba(255,255,255,0.10)",
    background: invalid ? "rgba(127,29,29,0.18)" : "rgba(2,6,23,0.72)",
    color: "white",
    boxSizing: "border-box",
    outline: "none",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    marginBottom: 8,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#94a3b8",
  };
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    border: active
      ? "1px solid rgba(125,211,252,0.35)"
      : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
    color: "white",
    borderRadius: 18,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
  };
}

export default function SquaresSection() {
  const { canManage, loading, tenant, isLoggedIn } = useAuth();

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");

  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [activeGameId, setActiveGameId] = useState<string>("");

  const [selectedByGame, setSelectedByGame] = useState<Record<string, number[]>>({});
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const [drafts, setDrafts] = useState<Drafts>({});
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  useEffect(() => {
    async function loadGames() {
      if (!isLoggedIn) {
        setGames([]);
        setGamesLoading(false);
        return;
      }

      setGamesLoading(true);

      try {
        const data = await apiFetch<Game[]>("/api/squares");
        const loadedGames = Array.isArray(data) ? data : [];

        setGames(loadedGames);

        setDrafts(
          loadedGames.reduce((acc: Drafts, game: Game) => {
            acc[game.id] = {
              total: String(game.total),
              price: String(game.price),
            };
            return acc;
          }, {})
        );

        setSelectedByGame(
          loadedGames.reduce((acc: Record<string, number[]>, game: Game) => {
            acc[game.id] = [];
            return acc;
          }, {})
        );

        if (loadedGames.length > 0) {
          setActiveGameId((curr) =>
            curr && loadedGames.some((g: Game) => g.id === curr) ? curr : loadedGames[0].id
          );
        } else {
          setActiveGameId("");
        }
      } catch (err) {
        setAdminMessage(err instanceof Error ? err.message : "Unable to load squares.");
      } finally {
        setGamesLoading(false);
      }
    }

    loadGames();
  }, [isLoggedIn]);

  const game = games.find((g) => g.id === activeGameId) ?? games[0];

  if (!game && !gamesLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at right, rgba(168,85,247,0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #020617 100%)",
          color: "white",
          fontFamily: "Inter, Arial, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0 }}>Squares</h2>
            <p>{isLoggedIn ? "No squares games found for this tenant yet." : "Please log in."}</p>
          </section>
        </div>
      </div>
    );
  }

  const selected = game ? selectedByGame[game.id] ?? [] : [];
  const draft = game
    ? drafts[game.id] ?? {
        total: String(game.total),
        price: String(game.price),
      }
    : { total: "0", price: "0" };

  const totalValue =
    draft.total.trim() === "" || Number.isNaN(Number(draft.total))
      ? game?.total ?? 0
      : Number(draft.total);

  const priceValue =
    draft.price.trim() === "" || Number.isNaN(Number(draft.price))
      ? game?.price ?? 0
      : Number(draft.price);

  const hasBlankRequiredValues =
    draft.total.trim() === "" || draft.price.trim() === "";

  const visibleSelected = useMemo(() => {
    if (!game) return [];
    return selected.filter(
      (n) =>
        n <= game.total &&
        !game.sold.includes(n) &&
        !game.reserved.includes(n)
    );
  }, [selected, game]);

  const totalCost = visibleSelected.length * priceValue;
  const validNumbers = totalValue > 0 && priceValue > 0;

  const canBuy =
    !!game &&
    buyerName.trim() !== "" &&
    buyerEmail.trim() !== "" &&
    visibleSelected.length > 0 &&
    validNumbers &&
    !hasBlankRequiredValues;

  function setGamePatch(id: string, patch: Partial<Game>) {
    setGames((curr) => curr.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function setDraftPatch(
    id: string,
    patch: Partial<{ total: string; price: string }>
  ) {
    setDrafts((curr) => ({
      ...curr,
      [id]: { ...(curr[id] ?? { total: "", price: "" }), ...patch },
    }));
  }

  function toggleSquare(n: number) {
    if (!game) return;
    if (game.sold.includes(n) || game.reserved.includes(n)) return;

    setSelectedByGame((curr) => {
      const existing = curr[game.id] ?? [];
      const next = existing.includes(n)
        ? existing.filter((x) => x !== n)
        : [...existing, n].sort((a, b) => a - b);

      return { ...curr, [game.id]: next };
    });
  }

  async function addGame() {
    if (!canManage) return;

    setAdminMessage("");
    setAdminBusy(true);

    try {
      const payload = {
        title: `New Squares Game ${games.length + 1}`,
        total: 100,
        price: 5,
        sold: [],
        reserved: [],
        background: "",
      };

      const saved = await apiFetch<Game>("/api/squares", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const newGame: Game = {
        id: saved.id,
        title: saved.title,
        total: saved.total,
        price: saved.price,
        sold: saved.sold ?? [],
        reserved: saved.reserved ?? [],
        background: saved.background ?? "",
      };

      setGames((curr) => [...curr, newGame]);
      setSelectedByGame((curr) => ({ ...curr, [newGame.id]: [] }));
      setDrafts((curr) => ({
        ...curr,
        [newGame.id]: { total: String(newGame.total), price: String(newGame.price) },
      }));
      setActiveGameId(newGame.id);
      setAdminMessage("Game created.");
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : "Unable to add game.");
    } finally {
      setAdminBusy(false);
    }
  }

  async function removeCurrentGame() {
    if (!canManage || !game || games.length <= 1) return;

    setAdminMessage("");
    setAdminBusy(true);

    try {
      await apiFetch<{ ok?: boolean }>(`/api/squares/${game.id}`, {
        method: "DELETE",
      });

      const remaining = games.filter((g) => g.id !== game.id);
      setGames(remaining);

      setSelectedByGame((curr) => {
        const next = { ...curr };
        delete next[game.id];
        return next;
      });

      setDrafts((curr) => {
        const next = { ...curr };
        delete next[game.id];
        return next;
      });

      setActiveGameId(remaining[0]?.id ?? "");
      setAdminMessage("Game removed.");
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : "Unable to remove game.");
    } finally {
      setAdminBusy(false);
    }
  }

  function onUploadBackground(e: React.ChangeEvent<HTMLInputElement>) {
    if (!game) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setGamePatch(game.id, { background: String(reader.result || "") });
    };
    reader.readAsDataURL(file);
  }

  async function saveCurrentGame() {
    if (!canManage || !game) return;

    setAdminMessage("");
    setAdminBusy(true);

    try {
      const saved = await apiFetch<Game>(`/api/squares/${game.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: game.title,
          total: game.total,
          price: game.price,
          sold: game.sold,
          reserved: game.reserved,
          background: game.background ?? "",
        }),
      });

      setGames((curr) => curr.map((g) => (g.id === game.id ? saved : g)));
      setAdminMessage("Game saved.");
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : "Unable to save game.");
    } finally {
      setAdminBusy(false);
    }
  }

  async function buySquares() {
    if (!canBuy || !game) return;

    try {
      const response = await apiFetch<PurchaseResponse>("/api/squares/purchase", {
        method: "POST",
        body: JSON.stringify({
          gameId: game.id,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          squares: visibleSelected,
        }),
      });

      const purchaseFromServer = response.purchase;
      const updatedGame = response.game;

      const purchase: Purchase = {
        id: purchaseFromServer.id,
        gameId: purchaseFromServer.gameId,
        gameTitle: purchaseFromServer.gameTitle,
        buyerName: purchaseFromServer.buyerName,
        buyerEmail: purchaseFromServer.buyerEmail,
        squares: purchaseFromServer.squares,
        total: purchaseFromServer.total,
        createdAt: purchaseFromServer.createdAt,
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
      setGames((curr) => curr.map((g) => (g.id === updatedGame.id ? updatedGame : g)));
      setSelectedByGame((curr) => ({ ...curr, [game.id]: [] }));
      setBuyerName("");
      setBuyerEmail("");

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
      doc.save(
        `${purchase.gameTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-receipt.pdf`
      );
    } catch (err) {
      setAdminMessage(err instanceof Error ? err.message : "Unable to complete purchase.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at right, rgba(168,85,247,0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #020617 100%)",
        color: "white",
        fontFamily: "Inter, Arial, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <section style={cardStyle()}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#bae6fd",
                  marginBottom: 10,
                }}
              >
                Premium fundraising suite
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 38,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                }}
              >
                SO Fundraising Platform
              </h1>
              <p style={{ margin: "10px 0 0", color: "#cbd5e1", maxWidth: 760 }}>
                Clean Squares rebuild with blank-editable number fields, multiple
                games, background image upload, admin purchase tracking, and buyer
                PDF receipts.
              </p>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.08)",
                borderRadius: 999,
                padding: "10px 14px",
                fontSize: 12,
                color: loading ? "#cbd5e1" : canManage ? "#86efac" : "#cbd5e1",
              }}
            >
              {loading
                ? "Checking access..."
                : canManage
                ? `Managing ${tenant?.name ?? "platform"}`
                : "Buyer mode"}
            </div>
          </div>
        </section>

        {gamesLoading && (
          <section style={cardStyle()}>
            <div>Loading squares...</div>
          </section>
        )}

        {!loading && canManage && game && (
          <section style={cardStyle()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 28 }}>Admin • Squares</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={addGame} disabled={adminBusy} style={chipStyle(false)}>
                  Add Game
                </button>
                <button onClick={removeCurrentGame} disabled={adminBusy} style={chipStyle(false)}>
                  Remove Current
                </button>
                <button
                  onClick={() => uploadRef.current?.click()}
                  disabled={adminBusy}
                  style={chipStyle(false)}
                >
                  Background Image
                </button>
                <button onClick={saveCurrentGame} disabled={adminBusy} style={chipStyle(false)}>
                  Save Game
                </button>
              </div>
            </div>

            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onUploadBackground}
            />

            {adminMessage && (
              <div
                style={{
                  marginTop: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(2,6,23,0.55)",
                  borderRadius: 16,
                  padding: 12,
                  color: "#cbd5e1",
                }}
              >
                {adminMessage}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              {games.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGameId(g.id)}
                  style={chipStyle(g.id === game.id)}
                >
                  {g.title}
                </button>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginTop: 18,
              }}
            >
              <div>
                <label style={labelStyle()}>Game title</label>
                <input
                  value={game.title}
                  onChange={(e) => setGamePatch(game.id, { title: e.target.value })}
                  style={inputStyle(false)}
                />
              </div>

              <div>
                <label style={labelStyle()}>Squares to sell</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={draft.total}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftPatch(game.id, { total: v });

                    if (v.trim() !== "") {
                      const nextTotal = clampSquares(Number(v));

                      setGames((curr) =>
                        curr.map((g) =>
                          g.id === game.id
                            ? {
                                ...g,
                                total: nextTotal,
                                sold: g.sold.filter((n) => n <= nextTotal),
                                reserved: g.reserved.filter((n) => n <= nextTotal),
                              }
                            : g
                        )
                      );

                      setSelectedByGame((curr) => ({
                        ...curr,
                        [game.id]: (curr[game.id] || []).filter((n) => n <= nextTotal),
                      }));
                    }
                  }}
                  style={inputStyle(draft.total.trim() === "")}
                />
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: draft.total.trim() === "" ? "#fda4af" : "#64748b",
                  }}
                >
                  Blank allowed while editing. Required for completion. Range: 1 to 500.
                </div>
              </div>

              <div>
                <label style={labelStyle()}>Price per square</label>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  value={draft.price}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftPatch(game.id, { price: v });

                    if (v.trim() !== "") {
                      setGamePatch(game.id, { price: clampPrice(Number(v)) });
                    }
                  }}
                  style={inputStyle(draft.price.trim() === "")}
                />
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: draft.price.trim() === "" ? "#fda4af" : "#64748b",
                  }}
                >
                  Blank allowed while editing. Required for completion.
                </div>
              </div>

              <div style={{ ...cardStyle(), padding: 16, borderRadius: 20 }}>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: "#94a3b8",
                  }}
                >
                  Game status
                </div>
                <div style={{ marginTop: 8, fontWeight: 700, fontSize: 20 }}>
                  {game.total} squares active
                </div>
                <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 14 }}>
                  {game.sold.length} sold • {game.reserved.length} reserved
                </div>
              </div>
            </div>

            {hasBlankRequiredValues && (
              <div
                style={{
                  marginTop: 16,
                  border: "1px solid rgba(251,113,133,0.35)",
                  background: "rgba(127,29,29,0.18)",
                  borderRadius: 18,
                  padding: 14,
                  color: "#fecdd3",
                }}
              >
                One or more required number fields are blank. They can be blank while
                editing, but not for completion.
              </div>
            )}

            <div style={{ marginTop: 22 }}>
              <h3 style={{ marginTop: 0 }}>Purchase data</h3>
              <div style={{ display: "grid", gap: 12 }}>
                {purchases.filter((p) => p.gameId === game.id).length === 0 ? (
                  <div style={{ color: "#94a3b8" }}>
                    No purchases recorded for this game yet.
                  </div>
                ) : (
                  purchases
                    .filter((p) => p.gameId === game.id)
                    .map((p) => (
                      <div
                        key={p.id}
                        style={{
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(2,6,23,0.55)",
                          borderRadius: 18,
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{p.buyerName}</div>
                          <div>{money(p.total)}</div>
                        </div>
                        <div style={{ marginTop: 6, color: "#cbd5e1" }}>
                          {p.buyerEmail}
                        </div>
                        <div style={{ marginTop: 6, color: "#cbd5e1" }}>
                          Squares: {p.squares.join(", ")}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: "#94a3b8",
                          }}
                        >
                          {p.createdAt}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>
        )}

        {game && (
          <section
            style={{
              ...cardStyle(),
              backgroundImage: game.background ? `url(${game.background})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {game.background && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(2,6,23,0.72)",
                  pointerEvents: "none",
                }}
              />
            )}

            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  marginBottom: 20,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 30 }}>{game.title}</h2>
                  <div style={{ marginTop: 8, color: "#cbd5e1" }}>
                    {game.total} squares • {money(priceValue)} each
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {games.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setActiveGameId(g.id)}
                      style={chipStyle(g.id === game.id)}
                    >
                      {g.title}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div>
                  <label style={labelStyle()}>Buyer name</label>
                  <input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    style={inputStyle(false)}
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Buyer email</label>
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    style={inputStyle(false)}
                  />
                </div>

                <div style={{ ...cardStyle(), padding: 16, borderRadius: 20 }}>
                  <div
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      color: "#94a3b8",
                    }}
                  >
                    Summary
                  </div>
                  <div style={{ marginTop: 8, color: "#e2e8f0" }}>
                    Selected: {visibleSelected.length}
                  </div>
                  <div style={{ marginTop: 6, color: "#e2e8f0" }}>
                    Total: {money(totalCost)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {Array.from({ length: game.total }).map((_, i) => {
                  const n = i + 1;
                  const isSold = game.sold.includes(n);
                  const isReserved = game.reserved.includes(n);
                  const isSelected = visibleSelected.includes(n);

                  const bg = isSold
                    ? "rgba(244,63,94,0.22)"
                    : isReserved
                    ? "rgba(245,158,11,0.22)"
                    : isSelected
                    ? "white"
                    : "rgba(15,23,42,0.72)";

                  const color = isSelected ? "#020617" : "white";
                  const border = isSold
                    ? "1px solid rgba(251,113,133,0.35)"
                    : isReserved
                    ? "1px solid rgba(251,191,36,0.35)"
                    : isSelected
                    ? "1px solid white"
                    : "1px solid rgba(255,255,255,0.15)";

                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleSquare(n)}
                      disabled={isSold || isReserved}
                      style={{
                        aspectRatio: "1 / 1",
                        borderRadius: 18,
                        border,
                        background: bg,
                        color,
                        fontWeight: 700,
                        cursor: isSold || isReserved ? "not-allowed" : "pointer",
                        opacity: isSold || isReserved ? 0.82 : 1,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 18, ...cardStyle(), padding: 16, borderRadius: 20 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                        color: "#94a3b8",
                      }}
                    >
                      Selected numbers
                    </div>
                    <div style={{ marginTop: 8, color: "#e2e8f0" }}>
                      {visibleSelected.length
                        ? visibleSelected.join(", ")
                        : "None selected"}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                        color: "#94a3b8",
                      }}
                    >
                      Amount due
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700, fontSize: 22 }}>
                      {money(totalCost)}
                    </div>
                  </div>
                </div>

                <button
                  onClick={buySquares}
                  disabled={!canBuy}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    borderRadius: 18,
                    padding: "14px 18px",
                    background: canBuy ? "white" : "rgba(255,255,255,0.25)",
                    color: canBuy ? "#020617" : "#cbd5e1",
                    fontWeight: 700,
                    border: "none",
                    cursor: canBuy ? "pointer" : "not-allowed",
                  }}
                >
                  Buy Selected Squares
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
