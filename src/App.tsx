import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import PublicRafflePage from "./pages/PublicRafflePage";
import AdminRaffleDetailsPage from "./pages/admin/AdminRaffleDetailsPage";
import AdminPage from "./pages/AdminPage";
import AdminCreateRafflePage from "./pages/admin/AdminCreateRafflePage";
import AdminEditRafflePage from "./pages/admin/AdminEditRafflePage";

function HomePage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.card}>
          <p style={styles.eyebrow}>SO Fundraising Platform</p>
          <h1 style={styles.title}>Demo Home</h1>
          <p style={styles.description}>
            The app is deployed. Use the links below to open the raffle flow.
          </p>

          <div style={styles.links}>
            <Link to="/raffles/spring-cash-raffle" style={styles.primaryLink}>
              Open public raffle page
            </Link>

            <Link to="/admin" style={styles.secondaryLink}>
              Open admin home
            </Link>

            <Link
              to="/admin/raffles/spring-cash-raffle"
              style={styles.secondaryLink}
            >
              Open raffle admin details
            </Link>

            <Link to="/admin/raffles/create" style={styles.secondaryLink}>
              Create new raffle
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/raffles/new" element={<AdminCreateRafflePage />} />
        <Route path="/admin/raffles/create" element={<AdminCreateRafflePage />} />
        <Route path="/admin/raffles/:slug" element={<AdminRaffleDetailsPage />} />
        <Route
          path="/admin/raffles/:slug/edit"
          element={<AdminEditRafflePage />}
        />

        <Route path="/raffles/:slug" element={<PublicRafflePage />} />
      </Routes>
    </BrowserRouter>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f7fb",
    padding: "32px 16px",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
  },
  eyebrow: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: "8px 0 12px",
    fontSize: 34,
    lineHeight: 1.1,
  },
  description: {
    margin: 0,
    color: "#334155",
    lineHeight: 1.6,
  },
  links: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    borderRadius: 10,
    padding: "12px 16px",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 700,
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    borderRadius: 10,
    padding: "12px 16px",
    background: "#e5e7eb",
    color: "#111827",
    fontWeight: 700,
  },
};
