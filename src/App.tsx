import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicRafflePage from "./pages/PublicRafflePage";

function HomePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Raffle Platform</h1>

      <div style={{ marginTop: 16 }}>
        <a href="/r/demo-raffle">
          <button type="button">Open Demo Raffle</button>
        </a>
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
      </Routes>
    </BrowserRouter>
  );
}
