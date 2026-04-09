import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>Raffle Platform</h1>
      <p>Choose where you want to go.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <Link to="/login">
          <button>Login</button>
        </Link>

        <Link to="/register">
          <button>Register</button>
        </Link>

        <Link to="/admin">
          <button>Admin</button>
        </Link>

        <Link to="/r/demo-raffle">
          <button>View Public Raffle</button>
        </Link>
      </div>
    </div>
  );
}
