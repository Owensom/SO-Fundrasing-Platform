import { BrowserRouter, Route, Routes } from "react-router-dom";
import PublicRafflePage from "./pages/PublicRafflePage";
import AdminRaffleDetailsPage from "./pages/admin/AdminRaffleDetailsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/raffles/:slug" element={<PublicRafflePage />} />
        <Route
          path="/admin/raffles/:slug"
          element={<AdminRaffleDetailsPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}
