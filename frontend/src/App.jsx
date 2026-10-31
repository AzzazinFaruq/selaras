import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import useAuthStore from "./stores/authStore";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AuditBaru from "./pages/AuditBaru";
import Riwayat from "./pages/Riwayat";
import Posyandu from "./pages/Posyandu";
import Akun from "./pages/Akun";

function GuestRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const sudahCek = useAuthStore((s) => s.sudahCek);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (!sudahCek) {
    return <p className="p-8 text-sm text-slate-500">Memuat…</p>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/audit-baru" element={<AuditBaru />} />
          <Route path="/riwayat" element={<Riwayat />} />
          <Route path="/posyandu" element={<Posyandu />} />
          <Route path="/akun" element={<Akun />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
