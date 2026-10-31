import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../stores/authStore";
import { pesanGalat } from "../api/axios";

export default function Akun() {
  const { user, gantiPassword } = useAuthStore();
  const navigate = useNavigate();
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [error, setError] = useState(null);

  const kirim = async (e) => {
    e.preventDefault();
    setError(null);
    if (baru !== ulang) return setError("Ulangi password baru dengan benar");
    if (baru.length < 10) return setError("Password baru minimal 10 karakter");
    try {
      await gantiPassword(lama, baru);
      navigate("/login", { replace: true, state: { pesan: "Password diganti. Silakan masuk dengan password baru." } });
    } catch (err) {
      setError(pesanGalat(err, "Gagal mengganti password"));
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold">Akun</h1>
      <dl className="kartu grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Nama</dt>
        <dd>{user.nama}</dd>
        <dt className="text-slate-500">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-slate-500">Puskesmas</dt>
        <dd>{user.puskesmas.nama}, {user.puskesmas.kota}</dd>
      </dl>

      <form onSubmit={kirim} className="kartu space-y-3">
        <h2 className="font-medium">Ganti password</h2>
        {error && <p className="galat">{error}</p>}
        <div>
          <label className="label" htmlFor="pw-lama">Password lama</label>
          <input id="pw-lama" type="password" className="input" autoComplete="current-password" required
            value={lama} onChange={(e) => setLama(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pw-baru">Password baru (min. 10 karakter)</label>
          <input id="pw-baru" type="password" className="input" autoComplete="new-password" required minLength={10} maxLength={72}
            value={baru} onChange={(e) => setBaru(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pw-ulang">Ulangi password baru</label>
          <input id="pw-ulang" type="password" className="input" autoComplete="new-password" required
            value={ulang} onChange={(e) => setUlang(e.target.value)} />
        </div>
        <button className="tombol">Ganti password</button>
        <p className="text-xs text-slate-500">Setelah diganti, semua sesi di perangkat lain ikut keluar.</p>
      </form>
    </div>
  );
}
