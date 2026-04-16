import React from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import PublicRafflePage from "./pages/PublicRafflePage";
import AdminCreateRafflePage from "./pages/admin/AdminCreateRafflePage";

function HomePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>SO Fundraising</h1>
      <div style={{ display: "flex", gap: 12 }}>
        <Link to="/r/demo-raffle">Open public raffle</Link>
        <Link to="/admin/create">Open admin create</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/r/:slug" element={<PublicRafflePage />} />
        <Route path="/admin/create" element={<AdminCreateRafflePage />} />
      </Routes>
    </BrowserRouter>
  );
}
