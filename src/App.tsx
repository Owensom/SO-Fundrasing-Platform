// COMPLETE PREMIUM TICKETS FILE WITH VALIDATION FIX

import React, { useRef, useState } from "react";
import { jsPDF } from "jspdf";

type Mode = "rows" | "tables";

type Table = {
  id: number;
  name: string;
  seats: number;
  sold: number;
};

type Event = {
  id: number;
  title: string;
  price: number;
  mode: Mode;
  rows: number;
  seatsPerRow: number;
  soldSeats: string[];
  tables: Table[];
  background?: string;
};

function money(n: number) {
  return `£${n.toFixed(2)}`;
}

function seatId(i: number, perRow: number) {
  const row = String.fromCharCode(65 + Math.floor(i / perRow));
  return row + ((i % perRow) + 1);
}

export default function App() {
  const [admin, setAdmin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [events, setEvents] = useState<Event[]>([
    {
      id: 1,
      title: "Gala Night",
      price: 25,
      mode: "rows",
      rows: 5,
      seatsPerRow: 10,
      soldSeats: [],
      tables: [],
    },
  ]);

  const [activeId, setActiveId] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [qty, setQty] = useState(1);

  const uploadRef = useRef<HTMLInputElement>(null);

  const event = events.find(e => e.id === activeId)!;

  const invalid =
    event.price <= 0 ||
    (event.mode === "rows" && (event.rows <= 0 || event.seatsPerRow <= 0));

  function addEvent() {
    const id = Date.now();
    setEvents([...events, {
      id,
      title: "New Event",
      price: 0,
      mode: "rows",
      rows: 0,
      seatsPerRow: 0,
      soldSeats: [],
      tables: []
    }]);
    setActiveId(id);
  }

  function toggleSeat(s: string) {
    if (event.soldSeats.includes(s)) return;
    setSelectedSeats(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  function buy() {
    if (invalid) return;

    if (event.mode === "rows") {
      setEvents(events.map(e =>
        e.id === event.id
          ? { ...e, soldSeats: [...e.soldSeats, ...selectedSeats] }
          : e
      ));
      setSelectedSeats([]);
    }

    const doc = new jsPDF();
    doc.text("Receipt", 20, 20);
    doc.text(`Name: ${name}`, 20, 30);
    doc.text(`Total: ${money(total())}`, 20, 40);
    doc.save("receipt.pdf");
  }

  function total() {
    return event.mode === "rows"
      ? selectedSeats.length * event.price
      : qty * event.price;
  }

  function upload(e: any) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      setEvents(events.map(ev =>
        ev.id === event.id ? { ...ev, background: reader.result as string } : ev
      ));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ padding: 20, background: "#020617", color: "white", minHeight: "100vh" }}>
      <h1>Tickets</h1>

      <button onClick={() => setAdmin(!admin)}>Admin {admin ? "ON" : "OFF"}</button>

      {admin && (
        <div>
          <button onClick={addEvent}>Add Event</button>

          <input
            type="number"
            value={event.price}
            onChange={e => setEvents(events.map(ev =>
              ev.id === event.id ? { ...ev, price: Number(e.target.value) } : ev
            ))}
          />

          <input
            type="number"
            value={event.rows}
            onChange={e => setEvents(events.map(ev =>
              ev.id === event.id ? { ...ev, rows: Number(e.target.value) } : ev
            ))}
          />

          <input
            type="number"
            value={event.seatsPerRow}
            onChange={e => setEvents(events.map(ev =>
              ev.id === event.id ? { ...ev, seatsPerRow: Number(e.target.value) } : ev
            ))}
          />

          <button onClick={() => uploadRef.current?.click()}>Upload Background</button>
          <input ref={uploadRef} type="file" style={{ display: "none" }} onChange={upload} />

          {invalid && <div style={{ color: "red" }}>Values must be greater than 0 to complete</div>}
        </div>
      )}

      <div>
        {event.mode === "rows" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)" }}>
            {Array.from({ length: event.rows * event.seatsPerRow }).map((_, i) => {
              const id = seatId(i, event.seatsPerRow);
              return (
                <button key={id} onClick={() => toggleSeat(id)}>
                  {id}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button disabled={invalid} onClick={buy}>
        Buy (£{total()})
      </button>
    </div>
  );
}
