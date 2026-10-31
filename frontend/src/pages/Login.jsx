import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../stores/authStore";

export default function Login() {
  const { login, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const pesan = useLocation().state?.pesan;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const kirim = async (e) => {
    e.preventDefault();
    if (await login(email, password)) navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={kirim} className="kartu w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-teal-800">SELARAS</h1>
          <p className="text-sm text-slate-500">Audit kualitas data pertumbuhan balita</p>
        </div>

        {pesan && <p className="sukses">{pesan}</p>}
        {error && <p className="galat">{error}</p>}

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email" type="email" className="input" autoComplete="username" required
            value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password" type="password" className="input" autoComplete="current-password" required
            value={password} onChange={(e) => { setPassword(e.target.value); clearError(); }}
          />
        </div>
        <button className="tombol w-full" disabled={loading}>
          {loading ? "Masuk…" : "Masuk"}
        </button>
        <p className="text-xs text-slate-500">Akun dibuat oleh admin. Hubungi admin bila lupa password.</p>
      </form>
    </div>
  );
}
