import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";

import AdminPage from "./pages/AdminPage";

// You can replace these with real components later
function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Raffle App</h1>
      <p>Welcome to the platform.</p>
    </div>
  );
}

function Login() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Login</h1>
      <p>TODO: Build login form</p>
    </div>
  );
}

function Register() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Register</h1>
      <p>TODO: Build register form</p>
    </div>
  );
}

function PublicRaffle() {
  const [raffle, setRaffle] = useState<any>(null);

  const slug = window.location.pathname.split("/").pop();

  useEffect(() => {
    fetch(`/api/public/raffles/${slug}`)
      .then((res) => res.json())
      .then((data) => setRaffle(data));
  }, [slug]);

  if (!raffle) return <div>Loading raffle...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>{raffle.title}</h1>
      <p>{raffle.description}</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Core pages */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Admin */}
        <Route path="/admin" element={<AdminPage />} />

        {/* Public buyer page */}
        <Route path="/r/:slug" element={<PublicRaffle />} />
      </Routes>
    </BrowserRouter>
  );
}
