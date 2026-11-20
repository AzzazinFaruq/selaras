import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../stores/authStore";
import Ikon from "../components/Ikon";

// "Remember me" hanya mengingat alamat email di browser ini. Lama sesi tetap
// ditentukan server; password tidak pernah disimpan.
const KUNCI_EMAIL = "selaras-email";
const emailTersimpan = () => {
  try {
    return localStorage.getItem(KUNCI_EMAIL) ?? "";
  } catch {
    return "";
  }
};
const simpanEmail = (email) => {
  try {
    if (email) localStorage.setItem(KUNCI_EMAIL, email);
    else localStorage.removeItem(KUNCI_EMAIL);
  } catch {
    // penyimpanan diblokir (mode privat): abaikan
  }
};

function Isian({ id, label, ikon, ...lain }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input id={id} className="input pr-10" required {...lain} />
        <Ikon nama={ikon} className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-tinta/50" />
      </div>
    </div>
  );
}

export default function Login() {
  const { login, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const pesan = useLocation().state?.pesan;
  const [email, setEmail] = useState(emailTersimpan);
  const [password, setPassword] = useState("");
  const [ingat, setIngat] = useState(() => emailTersimpan() !== "");
  const [info, setInfo] = useState(false);

  const kirim = async (e) => {
    e.preventDefault();
    if (await login(email, password)) {
      simpanEmail(ingat ? email : "");
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="tema-gelap flex min-h-dvh flex-col">
      <div className="latar-krom" aria-hidden="true" />

      <header className="px-6 pt-6 sm:px-10 sm:pt-8">
        <div className="logo-selaras [--t:30] sm:[--t:40]" role="img" aria-label="Selaras" />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pt-8 pb-16">
        <form onSubmit={kirim} className="kartu w-full max-w-sm space-y-4 p-6 sm:p-8">
          <h1 className="judul text-center text-4xl">Login</h1>

          {pesan && <p className="sukses">{pesan}</p>}
          {error && <p className="galat" role="alert">{error}</p>}

          <Isian
            id="email" label="Email" ikon="akun" type="email" autoComplete="username"
            value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }}
          />
          <Isian
            id="password" label="Password" ikon="gembok" type="password" autoComplete="current-password"
            value={password} onChange={(e) => { setPassword(e.target.value); clearError(); }}
          />

          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 text-white/80">
              <input type="checkbox" className="size-4 accent-aksen" checked={ingat} onChange={(e) => setIngat(e.target.checked)} />
              Remember me
            </label>
            <button type="button" className="text-aksen hover:underline" onClick={() => setInfo(true)}>Forgot Password?</button>
          </div>

          <button className="tombol w-full py-2.5" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </button>

          <p className="text-center text-sm text-white/70">
            New to Selaras?{" "}
            <button type="button" className="text-aksen hover:underline" onClick={() => setInfo(true)}>Create an account</button>
          </p>
          {info && (
            <p className="text-center text-xs text-white/60" role="status">
              Akun dibuat oleh admin. Hubungi admin bila lupa password.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
