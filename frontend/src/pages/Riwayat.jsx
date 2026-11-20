import { useEffect, useMemo, useState } from "react";
import useAuditStore from "../stores/auditStore";
import usePaginasi from "../lib/usePaginasi";
import Paginasi from "../components/Paginasi";
import Ikon from "../components/Ikon";
import Dialog from "../components/Dialog";
import LegendaAmbang from "../components/LegendaAmbang";
import { INDIKATOR, kelasPersen } from "../lib/indikator";
import { labelPeriode, labelPersen, labelWaktu } from "../lib/format";

const unik = (arr) => [...new Set(arr)];

export default function Riwayat() {
  const { riwayat, riwayatSiap, fetchRiwayat, deleteAudit, error } = useAuditStore();
  const [cari, setCari] = useState("");
  const [posyandu, setPosyandu] = useState("");
  const [periode, setPeriode] = useState("");
  const [petugas, setPetugas] = useState("");
  const [calonHapus, setCalonHapus] = useState(null); // audit yang sedang dikonfirmasi
  const [menghapus, setMenghapus] = useState(false);

  useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  // Pilihan filter diambil dari audit yang ada, bukan dari seluruh posyandu/bulan.
  const pilihan = useMemo(() => ({
    posyandu: unik(riwayat.map((a) => a.posyandu_nama)).sort((a, b) => a.localeCompare(b)),
    periode: unik(riwayat.map((a) => a.periode)).sort().reverse(),
    petugas: unik(riwayat.map((a) => a.petugas_nama)).sort((a, b) => a.localeCompare(b)),
  }), [riwayat]);

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return riwayat.filter((a) => {
      if (posyandu && a.posyandu_nama !== posyandu) return false;
      if (periode && a.periode !== periode) return false;
      if (petugas && a.petugas_nama !== petugas) return false;
      if (!kata.length) return true;
      const teks = `${a.posyandu_nama} ${a.petugas_nama} ${a.catatan ?? ""} ${labelPeriode(a.periode)} ${a.periode}`.toLowerCase();
      return kata.every((k) => teks.includes(k));
    });
  }, [riwayat, cari, posyandu, periode, petugas]);

  const hal = usePaginasi(tampil, 10);
  const adaFilter = cari || posyandu || periode || petugas;

  // Setiap perubahan filter kembali ke halaman pertama.
  const ubah = (set) => (e) => {
    set(e.target.value);
    hal.setHalaman(1);
  };
  const reset = () => {
    setCari("");
    setPosyandu("");
    setPeriode("");
    setPetugas("");
    hal.setHalaman(1);
  };

  const hapus = setCalonHapus;
  const jadiHapus = async () => {
    setMenghapus(true);
    await deleteAudit(calonHapus.id); // bila gagal, pesannya muncul di atas halaman
    setMenghapus(false);
    setCalonHapus(null);
  };

  const kosong = riwayat.length === 0
    ? (riwayatSiap ? "Belum ada audit." : "Memuat…")
    : "Tidak ada audit yang cocok dengan pencarian atau filter.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="judul">Riwayat audit</h1>
        <p className="mt-1 max-w-3xl text-sm text-navy/75">
          Audit yang salah bisa dihapus pembuatnya dalam 24 jam, lalu diulang. Dashboard memakai audit terbaru per periode.
        </p>
      </div>
      {error && <p className="galat">{error}</p>}

      <div className="kartu grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
        <div className="sm:col-span-3 lg:col-span-1">
          <label className="label" htmlFor="cari">Cari</label>
          <div className="relative">
            <Ikon nama="cari" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/55" />
            <input
              id="cari" type="search" className="input pl-9" value={cari} onChange={ubah(setCari)}
              placeholder="Posyandu, petugas, atau catatan"
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="f-posyandu">Posyandu</label>
          <select id="f-posyandu" className="input" value={posyandu} onChange={ubah(setPosyandu)}>
            <option value="">Semua</option>
            {pilihan.posyandu.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-periode">Periode</label>
          <select id="f-periode" className="input" value={periode} onChange={ubah(setPeriode)}>
            <option value="">Semua</option>
            {pilihan.periode.map((p) => <option key={p} value={p}>{labelPeriode(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-petugas">Petugas</label>
          <select id="f-petugas" className="input" value={petugas} onChange={ubah(setPetugas)}>
            <option value="">Semua</option>
            {pilihan.petugas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button type="button" className="tombol-garis sm:col-span-3 lg:col-span-1" disabled={!adaFilter} onClick={reset}>
          Reset
        </button>
      </div>

      <section className="kartu overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
          <p className="text-sm text-navy/75" aria-live="polite">
            {adaFilter && riwayat.length > 0 ? (
              <><b className="text-navy tabular-nums">{tampil.length}</b> dari <span className="tabular-nums">{riwayat.length}</span> audit cocok</>
            ) : (
              <><b className="text-navy tabular-nums">{riwayat.length}</b> audit tersimpan</>
            )}
          </p>
          <LegendaAmbang />
        </div>

        {/* Layar lebar: tabel */}
        <div className="hidden overflow-x-auto md:block">
          <table className="tabel">
            <thead>
              <tr>
                <th>Posyandu</th><th>Periode</th><th className="text-right">Sampel</th>
                <th className="text-right">Kelengkapan</th><th className="text-right">Kesesuaian</th>
                <th className="text-right">Ketepatan</th><th>Dibuat</th><th><span className="sr-only">Tindakan</span></th>
              </tr>
            </thead>
            <tbody>
              {hal.potong.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="block font-medium whitespace-nowrap">{a.posyandu_nama}</span>
                    {a.catatan && <span className="block max-w-64 truncate text-xs text-navy/75" title={a.catatan}>{a.catatan}</span>}
                  </td>
                  <td className="whitespace-nowrap">{labelPeriode(a.periode)}</td>
                  <td className="text-right tabular-nums">{a.jumlah_sampel}</td>
                  {INDIKATOR.map((s) => (
                    <td key={s.kunci} className={`text-right font-semibold tabular-nums ${kelasPersen(a[s.kunci])}`}>{labelPersen(a[s.kunci])}</td>
                  ))}
                  <td className="whitespace-nowrap">
                    <span className="block">{labelWaktu(a.dibuat_pada)}</span>
                    <span className="block text-xs text-navy/75">{a.petugas_nama}</span>
                  </td>
                  <td className="text-right">
                    {a.bisa_dihapus && (
                      <button className="rounded-sm px-2 py-1 text-sm font-medium text-merah hover:bg-turun/10" onClick={() => hapus(a)}>Hapus</button>
                    )}
                  </td>
                </tr>
              ))}
              {tampil.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-navy/75">{kosong}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ponsel: kartu per audit */}
        <ul className="divide-y divide-navy/10 border-t border-navy/10 md:hidden">
          {hal.potong.map((a) => (
            <li key={a.id} className="space-y-2 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.posyandu_nama}</p>
                  <p className="text-sm text-navy/75">{labelPeriode(a.periode)} · {a.jumlah_sampel} balita</p>
                </div>
                {a.bisa_dihapus && (
                  <button className="-mt-1 -mr-2 inline-flex min-h-10 items-center rounded-sm px-3 text-sm font-medium text-merah hover:bg-turun/10" onClick={() => hapus(a)}>Hapus</button>
                )}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                {INDIKATOR.map((s) => (
                  <div key={s.kunci}>
                    <dt className="text-xs text-navy/75">{s.label}</dt>
                    <dd className={`font-semibold tabular-nums ${kelasPersen(a[s.kunci])}`}>{labelPersen(a[s.kunci])}</dd>
                  </div>
                ))}
              </dl>
              {a.catatan && <p className="text-sm break-words text-navy/75">{a.catatan}</p>}
              <p className="text-xs text-navy/75">{a.petugas_nama} · {labelWaktu(a.dibuat_pada)}</p>
            </li>
          ))}
          {tampil.length === 0 && <li className="px-4 py-8 text-center text-sm text-navy/75">{kosong}</li>}
        </ul>

        {tampil.length > 0 && (
          <div className="border-t border-navy/10">
            <Paginasi p={hal} satuan="audit" />
          </div>
        )}
      </section>

      <Dialog buka={!!calonHapus} onTutup={() => setCalonHapus(null)} terkunci={menghapus} judul="Hapus audit ini?">
        {calonHapus && (
          <>
            <p className="text-sm">
              Audit <b>{calonHapus.posyandu_nama}</b> periode <b>{labelPeriode(calonHapus.periode)}</b> ({calonHapus.jumlah_sampel} balita
              sampel, dibuat {labelWaktu(calonHapus.dibuat_pada)}) akan dihapus.
            </p>
            <p className="text-sm text-navy/75">
              Audit yang dihapus tidak bisa dikembalikan. Bila salah, audit bisa diulang dari menu Audit baru.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="tombol-garis" data-fokus disabled={menghapus} onClick={() => setCalonHapus(null)}>Batal</button>
              <button type="button" className="tombol-bahaya" disabled={menghapus} onClick={jadiHapus}>
                {menghapus ? "Menghapus…" : "Hapus audit"}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
