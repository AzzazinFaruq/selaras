import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../stores/authStore";
import { pesanGalat } from "../api/axios";
import Ikon from "../components/Ikon";
import { inisial } from "../lib/format";

const MIN_PASSWORD = 10;

function Baris({ ikon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded bg-latar text-navy">
        <Ikon nama={ikon} className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-navy/75">{label}</dt>
        <dd className="text-sm font-medium break-words">{children}</dd>
      </div>
    </div>
  );
}

function InputPassword({ id, label, value, onChange, ...lain }) {
  const [tampak, setTampak] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id} type={tampak ? "text" : "password"} className="input pr-11" required
          value={value} onChange={(e) => onChange(e.target.value)} {...lain}
        />
        <button
          type="button" onClick={() => setTampak(!tampak)}
          aria-label={tampak ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={tampak}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r text-navy/75 hover:text-navy"
        >
          <Ikon nama={tampak ? "mataTutup" : "mata"} />
        </button>
      </div>
    </div>
  );
}

function Syarat({ ok, children }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "font-medium text-hijau" : "text-navy/75"}`}>
      <span className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${ok ? "bg-hijau text-white" : "border border-navy/40"}`}>
        {ok && <Ikon nama="cek" className="size-3" />}
      </span>
      {children}
    </li>
  );
}

export default function Akun() {
  const { user, gantiPassword, logout } = useAuthStore();
  const navigate = useNavigate();
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [error, setError] = useState(null);
  const [proses, setProses] = useState(false);

  const syarat = {
    panjang: baru.length >= MIN_PASSWORD,
    sama: baru.length > 0 && baru === ulang,
  };
  const siap = lama.length > 0 && syarat.panjang && syarat.sama;

  const kirim = async (e) => {
    e.preventDefault();
    if (!siap) return;
    setError(null);
    setProses(true);
    try {
      await gantiPassword(lama, baru);
      navigate("/login", { replace: true, state: { pesan: "Password diganti. Silakan masuk dengan password baru." } });
    } catch (err) {
      setError(pesanGalat(err, "Gagal mengganti password"));
      setProses(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="judul">Akun</h1>
        <p className="mt-1 text-sm text-navy/75">Profil petugas dan keamanan akun.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="kartu p-0">
          <div className="flex items-center gap-4 p-5">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-aksen text-lg font-semibold text-tinta" aria-hidden="true">
              {inisial(user.nama)}
            </span>
            <div className="min-w-0">
              <p className="subjudul truncate">{user.nama}</p>
              <p className="text-sm text-navy/75">Petugas puskesmas</p>
            </div>
          </div>
          <dl className="divide-y divide-navy/10 border-t border-navy/10 px-5">
            <Baris ikon="surat" label="Email">{user.email}</Baris>
            <Baris ikon="gedung" label="Puskesmas">{user.puskesmas.nama}</Baris>
            <Baris ikon="lokasi" label="Kota">{user.puskesmas.kota}</Baris>
          </dl>
          <div className="space-y-3 border-t border-navy/10 p-5">
            <p className="text-xs text-navy/75">
              Nama, email, dan puskesmas diatur oleh admin. Hubungi admin bila ada yang perlu diubah.
            </p>
            <button type="button" className="tombol-garis w-full" onClick={logout}>
              <Ikon nama="keluar" className="size-4" />
              Keluar dari perangkat ini
            </button>
          </div>
        </section>

        <form onSubmit={kirim} className="kartu space-y-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded bg-latar text-navy">
              <Ikon nama="gembok" />
            </span>
            <div>
              <h2 className="subjudul">Ganti password</h2>
              <p className="mt-0.5 text-sm text-navy/75">Setelah diganti, semua sesi di perangkat lain ikut keluar dan Anda perlu masuk lagi.</p>
            </div>
          </div>

          {error && <p className="galat" role="alert">{error}</p>}

          <InputPassword id="pw-lama" label="Password lama" autoComplete="current-password" value={lama} onChange={setLama} />
          <div className="grid gap-4 sm:grid-cols-2">
            <InputPassword id="pw-baru" label="Password baru" autoComplete="new-password"
              minLength={MIN_PASSWORD} maxLength={72} value={baru} onChange={setBaru} />
            <InputPassword id="pw-ulang" label="Ulangi password baru" autoComplete="new-password"
              maxLength={72} value={ulang} onChange={setUlang} />
          </div>

          <ul className="space-y-1.5 text-sm">
            <Syarat ok={syarat.panjang}>Minimal {MIN_PASSWORD} karakter</Syarat>
            <Syarat ok={syarat.sama}>Kedua isian password baru sama</Syarat>
          </ul>

          <button className="tombol w-full sm:w-auto" disabled={!siap || proses}>
            {proses ? "Menyimpan…" : "Ganti password"}
          </button>
        </form>
      </div>
    </div>
  );
}
