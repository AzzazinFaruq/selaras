import { useCallback, useEffect, useMemo, useState } from "react";
import api, { pesanGalat } from "../api/axios";
import useAuthStore from "../stores/authStore";
import usePaginasi from "../lib/usePaginasi";
import Paginasi from "../components/Paginasi";
import Dialog from "../components/Dialog";
import Ikon from "../components/Ikon";
import { kelasPersen } from "../lib/indikator";
import { labelPeriode, labelPersen, labelWaktu } from "../lib/format";

// Panel admin: kelola puskesmas, posyandu, dan akun petugas di semua
// puskesmas. Audit hanya bisa dilihat dan dihapus (angkanya tidak bisa diubah).
// Setiap tab dijelaskan lewat konfigurasi: kolom tabel + isian formulir.

const PERAN = [{ nilai: "petugas", label: "Petugas" }, { nilai: "admin", label: "Admin" }];

function susunTab(data, idSaya) {
  const pilihanPuskesmas = data.puskesmas.map((p) => ({ nilai: p.id, label: `${p.nama} · ${p.kota}` }));
  return [
    {
      kunci: "puskesmas", label: "Puskesmas", satuan: "puskesmas",
      kolom: [
        { judul: "Nama", isi: (r) => <b className="font-medium">{r.nama}</b> },
        { judul: "Kota", isi: (r) => r.kota },
        { judul: "Posyandu", angka: true, isi: (r) => r.jumlah_posyandu },
        { judul: "Petugas", angka: true, isi: (r) => r.jumlah_petugas },
      ],
      isian: [
        { nama: "nama", label: "Nama puskesmas", maks: 150, contoh: "Puskesmas Dinoyo" },
        { nama: "kota", label: "Kota", maks: 100, contoh: "Kota Malang" },
      ],
      sebut: (r) => r.nama,
    },
    {
      kunci: "posyandu", label: "Posyandu", satuan: "posyandu",
      kolom: [
        { judul: "Nama", isi: (r) => <b className="font-medium">{r.nama}</b> },
        { judul: "Kelurahan", isi: (r) => r.kelurahan ?? <span className="text-navy/55">–</span> },
        { judul: "Puskesmas", isi: (r) => r.puskesmas_nama },
        { judul: "Audit", angka: true, isi: (r) => r.jumlah_audit },
      ],
      isian: [
        { nama: "puskesmas_id", label: "Puskesmas", jenis: "pilih", opsi: pilihanPuskesmas },
        { nama: "nama", label: "Nama posyandu", maks: 100, contoh: "Posyandu Melati" },
        { nama: "kelurahan", label: "Kelurahan (opsional)", maks: 100, opsional: true },
      ],
      sebut: (r) => r.nama,
    },
    {
      kunci: "petugas", label: "Petugas", satuan: "akun",
      kolom: [
        {
          judul: "Nama", isi: (r) => (
            <>
              <b className="block font-medium">{r.nama}{r.id === idSaya && <span className="font-normal text-navy/75"> (Anda)</span>}</b>
              <span className="block text-xs text-navy/75">{r.email}</span>
            </>
          ),
        },
        { judul: "Puskesmas", isi: (r) => r.puskesmas_nama },
        { judul: "Peran", isi: (r) => (r.peran === "admin" ? <span className="lencana bg-aksen/40 text-tinta">Admin</span> : "Petugas") },
        {
          judul: "Status", isi: (r) => (r.aktif
            ? <span className="lencana bg-naik/30 text-hijau">Aktif</span>
            : <span className="lencana bg-navy/10 text-navy/75">Nonaktif</span>),
        },
        { judul: "Audit", angka: true, isi: (r) => r.jumlah_audit },
      ],
      isian: [
        { nama: "nama", label: "Nama", maks: 150 },
        { nama: "email", label: "Email", jenis: "email", maks: 254 },
        { nama: "puskesmas_id", label: "Puskesmas", jenis: "pilih", opsi: pilihanPuskesmas },
        { nama: "peran", label: "Peran", jenis: "pilih", opsi: PERAN, bawaan: "petugas" },
        { nama: "aktif", label: "Akun aktif (boleh login)", jenis: "centang", bawaan: true, hanyaUbah: true },
      ],
      sebut: (r) => `${r.nama} (${r.email})`,
      milikSendiri: (r) => r.id === idSaya,
      resetPassword: true,
    },
    {
      kunci: "audit", label: "Audit", satuan: "audit", hanyaHapus: true,
      kolom: [
        {
          judul: "Posyandu", isi: (r) => (
            <>
              <b className="block font-medium whitespace-nowrap">{r.posyandu_nama}</b>
              <span className="block text-xs text-navy/75">{r.puskesmas_nama}</span>
            </>
          ),
        },
        { judul: "Periode", isi: (r) => <span className="whitespace-nowrap">{labelPeriode(r.periode)}</span> },
        { judul: "Sampel", angka: true, isi: (r) => r.jumlah_sampel },
        ...[["Kelengkapan", "persen_kelengkapan"], ["Kesesuaian", "persen_kesesuaian"], ["Ketepatan", "persen_ketepatan"]].map(([judul, k]) => ({
          judul, angka: true, isi: (r) => <span className={`font-semibold ${kelasPersen(r[k])}`}>{labelPersen(r[k])}</span>,
        })),
        {
          judul: "Dibuat", isi: (r) => (
            <>
              <span className="block whitespace-nowrap">{labelWaktu(r.dibuat_pada)}</span>
              <span className="block text-xs text-navy/75">{r.petugas_nama}</span>
            </>
          ),
        },
      ],
      sebut: (r) => `${r.posyandu_nama} periode ${labelPeriode(r.periode)}`,
    },
  ];
}

const nilaiAwal = (isian, baris) =>
  Object.fromEntries(isian.map((f) => [f.nama, baris?.[f.nama] ?? f.bawaan ?? (f.jenis === "pilih" ? f.opsi[0]?.nilai ?? "" : "")]));

function Formulir({ tab, baris, onBatal, onSimpan }) {
  const isian = tab.isian.filter((f) => baris || !f.hanyaUbah);
  const [nilai, setNilai] = useState(() => nilaiAwal(isian, baris));
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState(null);
  const ubah = (nama, v) => setNilai((n) => ({ ...n, [nama]: v }));

  const kirim = async (e) => {
    e.preventDefault();
    setProses(true);
    setGalat(null);
    const pesan = await onSimpan(nilai);
    if (pesan) {
      setGalat(pesan);
      setProses(false);
    }
  };

  return (
    <form onSubmit={kirim} className="space-y-4">
      {isian.map((f, i) => {
        const id = `isian-${f.nama}`;
        if (f.jenis === "centang") {
          return (
            <label key={f.nama} className="flex min-h-10 items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4 accent-navy" checked={!!nilai[f.nama]} onChange={(e) => ubah(f.nama, e.target.checked)} />
              {f.label}
            </label>
          );
        }
        return (
          <div key={f.nama}>
            <label className="label" htmlFor={id}>{f.label}</label>
            {f.jenis === "pilih" ? (
              <select id={id} className="input" required value={nilai[f.nama]} onChange={(e) => ubah(f.nama, e.target.value)}>
                {f.opsi.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
              </select>
            ) : (
              <input
                id={id} className="input" type={f.jenis ?? "text"} required={!f.opsional} maxLength={f.maks} placeholder={f.contoh}
                data-fokus={i === 0 ? "" : undefined}
                value={nilai[f.nama] ?? ""} onChange={(e) => ubah(f.nama, e.target.value)}
              />
            )}
          </div>
        );
      })}
      {galat && <p className="galat" role="alert">{galat}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="tombol-garis" disabled={proses} onClick={onBatal}>Batal</button>
        <button className="tombol" disabled={proses}>{proses ? "Menyimpan…" : "Simpan"}</button>
      </div>
    </form>
  );
}

// Konfirmasi tindakan yang tidak bisa dibatalkan (hapus, reset password).
function Konfirmasi({ children, labelYa, bahaya, onBatal, onYa }) {
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState(null);
  const jalan = async () => {
    setProses(true);
    setGalat(null);
    const pesan = await onYa();
    if (pesan) {
      setGalat(pesan);
      setProses(false);
    }
  };
  return (
    <>
      {children}
      {galat && <p className="galat" role="alert">{galat}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="tombol-garis" data-fokus="" disabled={proses} onClick={onBatal}>Batal</button>
        <button type="button" className={bahaya ? "tombol-bahaya" : "tombol"} disabled={proses} onClick={jalan}>
          {proses ? "Memproses…" : labelYa}
        </button>
      </div>
    </>
  );
}

function PasswordSekali({ email, password, onTutup }) {
  const [tersalin, setTersalin] = useState(false);
  const salin = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setTersalin(true);
    } catch {
      // clipboard diblokir: password tetap terlihat untuk disalin manual
    }
  };
  return (
    <>
      <p className="text-sm">Password untuk <b>{email}</b>:</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 rounded border border-navy/30 bg-latar px-3 py-2 text-base font-semibold break-all select-all">{password}</code>
        <button type="button" className="tombol-garis shrink-0" onClick={salin}>{tersalin ? "Tersalin" : "Salin"}</button>
      </div>
      <p className="peringatan">
        Password ini hanya ditampilkan sekali.
      </p>
      <div className="flex justify-end">
        <button type="button" className="tombol" data-fokus="" onClick={onTutup}>Selesai</button>
      </div>
    </>
  );
}

export default function Admin() {
  const idSaya = useAuthStore((s) => s.user.id);
  const [data, setData] = useState({ puskesmas: [], posyandu: [], petugas: [], audit: [] });
  const [siap, setSiap] = useState(false);
  const [galat, setGalat] = useState(null);
  const [aktif, setAktif] = useState("puskesmas");
  const [cari, setCari] = useState("");
  // { jenis: "tambah" | "ubah" | "hapus" | "reset" | "password", baris, email, password }
  const [dialog, setDialog] = useState(null);

  const muat = useCallback(async () => {
    try {
      const [puskesmas, posyandu, petugas, audit] = await Promise.all(
        ["puskesmas", "posyandu", "petugas", "audit"].map((k) => api.get(`/admin/${k}`).then((r) => r.data.data))
      );
      setData({ puskesmas, posyandu, petugas, audit });
      setGalat(null);
    } catch (err) {
      setGalat(pesanGalat(err, "Gagal memuat data admin"));
    }
    setSiap(true);
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const daftarTab = useMemo(() => susunTab(data, idSaya), [data, idSaya]);
  const tab = daftarTab.find((t) => t.kunci === aktif);
  const semua = data[aktif];
  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!kata.length) return semua;
    return semua.filter((r) => {
      const teks = Object.values(r).join(" ").toLowerCase();
      return kata.every((k) => teks.includes(k));
    });
  }, [semua, cari]);
  const hal = usePaginasi(tampil, 10);

  const pindah = (kunci) => {
    setAktif(kunci);
    setCari("");
    hal.setHalaman(1);
  };
  const tutup = () => setDialog(null);

  // Mengembalikan pesan galat (string) bila gagal, supaya dialog tetap terbuka.
  const jalankan = async (permintaan, sesudah) => {
    try {
      const res = await permintaan();
      await muat();
      if (sesudah) sesudah(res);
      else tutup();
      return null;
    } catch (err) {
      return pesanGalat(err, "Gagal menyimpan. Coba lagi.");
    }
  };
  const simpan = (nilai) => {
    const baris = dialog.baris;
    if (baris) return jalankan(() => api.put(`/admin/${aktif}/${baris.id}`, nilai));
    return jalankan(
      () => api.post(`/admin/${aktif}`, nilai),
      (res) => (res.data.data?.password ? setDialog({ jenis: "password", email: res.data.data.email, password: res.data.data.password }) : tutup())
    );
  };
  const hapus = () => jalankan(() => api.delete(`/admin/${aktif}/${dialog.baris.id}`));
  const reset = () => {
    const { baris } = dialog;
    return jalankan(
      () => api.post(`/admin/petugas/${baris.id}/reset-password`, {}),
      (res) => setDialog({ jenis: "password", email: baris.email, password: res.data.data.password })
    );
  };

  const butuhPuskesmas = aktif !== "puskesmas" && data.puskesmas.length === 0;
  const judulDialog = dialog && {
    tambah: `Tambah ${tab.label.toLowerCase()}`,
    ubah: `Ubah ${tab.label.toLowerCase()}`,
    hapus: `Hapus ${tab.label.toLowerCase()} ini?`,
    reset: "Reset password?",
    password: "Password akun",
  }[dialog.jenis];

  return (
    <div className="space-y-6">
      <h1 className="judul">Administrasi</h1>
      {galat && <p className="galat">{galat}</p>}

      <div role="tablist" aria-label="Data yang dikelola" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {daftarTab.map((t) => (
          <button
            key={t.kunci} type="button" role="tab" aria-selected={t.kunci === aktif} onClick={() => pindah(t.kunci)}
            className={`kartu p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
              t.kunci === aktif ? "border-navy bg-navy text-white" : "hover:bg-navy/5"
            }`}
          >
            <span className={`block text-sm ${t.kunci === aktif ? "text-muda" : "text-navy/75"}`}>{t.label}</span>
            <span className="block font-label text-3xl leading-tight font-semibold tabular-nums">{siap ? data[t.kunci].length : "–"}</span>
          </button>
        ))}
      </div>

      <section className="kartu overflow-hidden p-0" role="tabpanel" aria-label={tab.label}>
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Ikon nama="cari" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/55" />
            <input
              type="search" className="input pl-9" aria-label={`Cari ${tab.label.toLowerCase()}`} placeholder={`Cari ${tab.label.toLowerCase()}`}
              value={cari} onChange={(e) => { setCari(e.target.value); hal.setHalaman(1); }}
            />
          </div>
          {!tab.hanyaHapus && (
            <button type="button" className="tombol sm:ml-auto" disabled={butuhPuskesmas} onClick={() => setDialog({ jenis: "tambah" })}>
              Tambah {tab.label.toLowerCase()}
            </button>
          )}
        </div>
        {butuhPuskesmas && <p className="px-4 pb-3 text-sm text-navy/75 sm:px-5">Tambahkan puskesmas dulu.</p>}

        {/* relative: teks sr-only di kepala tabel ikut terpotong wadah gulir ini */}
        <div className="relative overflow-x-auto">
          <table className="tabel">
            <thead>
              <tr>
                {tab.kolom.map((k) => <th key={k.judul} className={k.angka ? "text-right" : ""}>{k.judul}</th>)}
                <th><span className="sr-only">Tindakan</span></th>
              </tr>
            </thead>
            <tbody>
              {hal.potong.map((r) => {
                const sendiri = tab.milikSendiri?.(r);
                return (
                  <tr key={r.id}>
                    {tab.kolom.map((k) => <td key={k.judul} className={k.angka ? "text-right tabular-nums" : ""}>{k.isi(r)}</td>)}
                    <td className="text-right whitespace-nowrap">
                      {!tab.hanyaHapus && (
                        <button type="button" className="rounded-sm px-2 py-1 text-sm font-medium text-navy underline decoration-aksen decoration-2 underline-offset-2 hover:bg-navy/5" onClick={() => setDialog({ jenis: "ubah", baris: r })}>
                          Ubah
                        </button>
                      )}
                      {tab.resetPassword && !sendiri && (
                        <button type="button" className="rounded-sm px-2 py-1 text-sm font-medium text-navy hover:bg-navy/5" onClick={() => setDialog({ jenis: "reset", baris: r })}>
                          Reset password
                        </button>
                      )}
                      {!sendiri && (
                        <button type="button" className="rounded-sm px-2 py-1 text-sm font-medium text-merah hover:bg-turun/10" onClick={() => setDialog({ jenis: "hapus", baris: r })}>
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tampil.length === 0 && (
                <tr>
                  <td colSpan={tab.kolom.length + 1} className="py-8 text-center text-navy/75">
                    {!siap ? "Memuat…" : semua.length === 0 ? `Belum ada ${tab.label.toLowerCase()}.` : "Tidak ada yang cocok dengan pencarian."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {tampil.length > 0 && (
          <div className="border-t border-navy/10">
            <Paginasi p={hal} satuan={tab.satuan} />
          </div>
        )}
      </section>

      <Dialog buka={!!dialog} onTutup={tutup} judul={judulDialog ?? ""}>
        {dialog && (dialog.jenis === "tambah" || dialog.jenis === "ubah") && (
          <Formulir key={`${aktif}-${dialog.baris?.id ?? "baru"}`} tab={tab} baris={dialog.baris} onBatal={tutup} onSimpan={simpan} />
        )}
        {dialog?.jenis === "hapus" && (
          <Konfirmasi labelYa="Hapus" bahaya onBatal={tutup} onYa={hapus}>
            <p className="text-sm"><b>{tab.sebut(dialog.baris)}</b> akan dihapus.</p>
          </Konfirmasi>
        )}
        {dialog?.jenis === "reset" && (
          <Konfirmasi labelYa="Reset password" onBatal={tutup} onYa={reset}>
            <p className="text-sm">
              Password <b>{tab.sebut(dialog.baris)}</b> akan diganti dengan password baru.
            </p>
          </Konfirmasi>
        )}
        {dialog?.jenis === "password" && <PasswordSekali email={dialog.email} password={dialog.password} onTutup={tutup} />}
      </Dialog>
    </div>
  );
}
