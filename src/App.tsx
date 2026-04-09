import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import PublicRafflePage from "./pages/PublicRafflePage";

function HomePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Raffle Platform</h1>
      <p>Home page is working.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/r/demo-raffle">
          <button type="button">Open Demo Raffle</button>
        </Link>

        <Link to="/admin">
          <button type="button">Open Admin</button>
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/r/:slug" element={<PublicRafflePage />} />
      </Routes>
    </BrowserRouter>
  );
}
