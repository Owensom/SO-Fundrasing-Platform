import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import PublicRafflePage from "./pages/PublicRafflePage";

function HomePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Raffle Platform</h1>
      <Link to="/r/demo-raffle">
        <button type="button">Open Demo Raffle</button>
      </Link>
    </div>
  );
}

function SafeAdminPlaceholder() {
  return <div style={{ padding: 24 }}>Admin placeholder</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<SafeAdminPlaceholder />} />
        <Route path="/r/:slug" element={<PublicRafflePage />} />
      </Routes>
    </BrowserRouter>
  );
}
