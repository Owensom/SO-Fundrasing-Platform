import { BrowserRouter, Routes, Route } from "react-router-dom";

function HomePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>HOME TEST</h1>
      <a href="/r/demo-raffle">Go to raffle test</a>
    </div>
  );
}

function PublicRafflePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>PUBLIC RAFFLE TEST</h1>
      <p>If you can see this, the route is working.</p>
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
