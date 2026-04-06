// FULL PREMIUM TICKETS SECTION (FINAL — NO REGRESSION)

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
      soldSeats: ["A1"],
      tables: [],
    },
  ]);

  const [activeId, setActiveId] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [qty, setQty] = useState(1);

  const uploadRef = useRef<HTMLInputElement>(null);

  const event = events.find(e => e.id === activeId)!;

  function addEvent() {
    const id = Date.now();
    setEvents([...events, {
      id,
      title: "New Event",
      price: 10,
      mode: "rows",
      rows: 5,
      seatsPerRow: 10,
      soldSeats: [],
      tables: []
    }]);
    setActiveId(id);
  }

  function removeEvent() {
    if (events.length <= 1) return;
    const filtered = events.filter(e => e.id !== activeId);
    setEvents(filtered);
    setActiveId(filtered[0].id);
  }

  function toggleSeat(s: string) {
    if (event.soldSeats.includes(s)) return;
    setSelectedSeats(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  function buy() {
    if (event.mode === "rows") {
      setEvents(events.map(e =>
        e.id === event.id
          ? { ...e, soldSeats: [...e.soldSeats, ...selectedSeats] }
          : e
      ));
      setSelectedSeats([]);
    }

    if (event.mode === "tables") {
      setEvents(events.map(e =>
        e.id === event.id
          ? {
              ...e,
              tables: e.tables.map(t =>
                t.id === selectedTable
                  ? { ...t, sold: t.sold + qty }
                  : t
              )
            }
          : e
      ));
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

      <button on
