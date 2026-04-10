import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicRafflePage from "./PublicRafflePage";

function HomePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>HOME TEST</h1>
      <a href="/r/demo-raffle">Go to raffle test</a>
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
