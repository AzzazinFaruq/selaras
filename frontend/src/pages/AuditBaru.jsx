import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import usePosyanduStore from "../stores/posyanduStore";
import useAuditStore from "../stores/auditStore";
import { pesanGalat } from "../api/axios";
import KolomMapper from "../components/KolomMapper";
import { bacaFile, unduhMasalah, unduhTemplate } from "../lib/excel";
import { labelPeriode, labelPersen, labelTanggal, periodeSekarang } from "../lib/format";
import {
  BATAS_HARI_INPUT,
  KOLOM_ASIK,
  KOLOM_REGISTER,
  bacaBaris,
  hitungRingkasan,
  indikator,
  rekonsiliasi,
  siapkanSampel,
  tebakPemetaan,
} from "../lib/rekonsiliasi";

// Semua data balita di halaman ini hanya ada di state React (memori browser).
// Tidak disimpan di store, localStorage, maupun server, dan hilang saat
// halaman ditinggalkan atau tab ditutup.

function Langkah({ no, judul, children }) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">
        <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-teal-700 text-xs text-white">{no}</span>
        {judul}
      </h2>
      {children}
    </section>
  );
}

function DaftarGalat({ judul, galat }) {
  if (!galat.length) return null;
  return (
    <div className="galat space-y-1">
      <p className="font-medium">{judul} ({galat.length} baris)</p>
      <ul className="max-h-48 list-disc overflow-y-auto pl-5">
        {galat.map((g, i) => <li key={i}>Baris {g.baris}: {g.pesan}</li>)}
      </ul>
    </div>
  );
}

function Indikator({ label, nilai, ket }) {
  return (
    <div className="kartu">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-3xl font-semibold tabular-nums text-teal-800">{labelPersen(nilai)}</p>
      <p className="text-xs text-slate-500">{ket}</p>
    </div>
  );
}

const kurang = (kolom, peta) => kolom.filter((k) => k.wajib && !peta[k.kunci]).map((k) => k.label);

export default function AuditBaru() {
  const { posyandu, fetchPosyandu } = usePosyanduStore();
  const createAudit = useAuditStore((s) => s.createAudit);

  const [posyanduId, setPosyanduId] = useState("");
  const [periode, setPeriode] = useState(periodeSekarang());
  const [fileReg, setFileReg] = useState(null);
  const [fileAsik, setFileAsik] = useState(null);
  const [petaReg, setPetaReg] = useState({});
  const [petaAsik, setPetaAsik] = useState({});
  const [periksa, setPeriksa] = useState(null);
  const [hasil, setHasil] = useState(null);
  const [hanyaMasalah, setHanyaMasalah] = useState(true);
  const [catatan, setCatatan] = useState("");
  const [simpan, setSimpan] = useState({ status: "belum", error: null });
  const [errorFile, setErrorFile] = useState(null);

  useEffect(() => {
    fetchPosyandu();
  }, [fetchPosyandu]);

  // Perubahan di langkah awal membatalkan hasil langkah berikutnya.
  const ulang = () => {
    setPeriksa(null);
    setHasil(null);
    setSimpan({ status: "belum", error: null });
  };

  const bukaFile = async (e, jenis) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErrorFile(null);
    ulang();
    try {
      const data = await bacaFile(f);
      if (!data.rows.length) throw new Error("kosong");
      if (jenis === "register") {
        setFileReg(data);
        setPetaReg(tebakPemetaan(data.header, KOLOM_REGISTER));
      } else {
        setFileAsik(data);
        setPetaAsik(tebakPemetaan(data.header, KOLOM_ASIK));
      }
    } catch {
      setErrorFile(`File “${f.name}” tidak bisa dibaca atau kosong. Gunakan .xlsx, .xls, atau .csv dengan header di baris pertama.`);
    }
  };

  const kurangReg = fileReg ? kurang(KOLOM_REGISTER, petaReg) : [];
  const kurangAsik = fileAsik ? kurang(KOLOM_ASIK, petaAsik) : [];
  const bisaPeriksa = posyanduId && periode && fileReg && fileAsik && !kurangReg.length && !kurangAsik.length;

  const jalankanPeriksa = () => {
    ulang();
    const reg = bacaBaris(fileReg.rows, petaReg, "register");
    const asik = bacaBaris(fileAsik.rows, petaAsik, "asik");
    const s = siapkanSampel(reg.data, periode);
    setPeriksa({
      sampel: s.sampel,
      asik: asik.data,
      diluarPeriode: s.diluarPeriode,
      galatReg: [...reg.galat, ...s.galat],
      galatAsik: asik.galat,
    });
  };
  const bisaRekonsiliasi = periksa && !periksa.galatReg.length && periksa.sampel.length > 0;

  const jalankanRekonsiliasi = async () => {
    setHasil(await rekonsiliasi(periksa.sampel, periksa.asik));
  };

  const ringkasan = useMemo(() => (hasil ? hitungRingkasan(hasil) : null), [hasil]);
  const ind = ringkasan ? indikator(ringkasan) : null;
  const namaPosyandu = posyandu.find((p) => p.id === posyanduId)?.nama ?? "";
  const payload = ringkasan ? { posyandu_id: posyanduId, periode, ...ringkasan, catatan: catatan.trim() } : null;
  const barisTampil = hasil ? (hanyaMasalah ? hasil.filter((h) => h.masalah.length) : hasil) : [];

  const kirim = async () => {
    setSimpan({ status: "proses", error: null });
    try {
      await createAudit(payload);
      setSimpan({ status: "selesai", error: null });
    } catch (err) {
      setSimpan({ status: "belum", error: pesanGalat(err, "Gagal menyimpan ringkasan") });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Audit baru</h1>
        <p className="text-sm text-slate-500">
          File dibaca dan dicocokkan di browser ini. Data balita tidak dikirim ke server; yang disimpan hanya angka ringkasan.
        </p>
      </div>

      <Langkah no={1} judul="Posyandu dan periode">
        {posyandu.length === 0 ? (
          <p className="text-sm">
            Belum ada posyandu. <Link to="/posyandu" className="text-teal-700 underline">Tambahkan dulu</Link>.
          </p>
        ) : (
          <div className="kartu grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="posyandu">Posyandu</label>
              <select id="posyandu" className="input" value={posyanduId} onChange={(e) => { setPosyanduId(e.target.value); ulang(); }}>
                <option value="">— pilih —</option>
                {posyandu.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="periode">Periode (bulan pengukuran)</label>
              <input id="periode" type="month" className="input" max={periodeSekarang()} value={periode}
                onChange={(e) => { setPeriode(e.target.value); ulang(); }} />
            </div>
          </div>
        )}
      </Langkah>

      <Langkah no={2} judul="Buka file">
        <div className="kartu grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="file-reg">Rekap buku register (sampel balita)</label>
            <input id="file-reg" type="file" accept=".xlsx,.xls,.csv" className="input" onChange={(e) => bukaFile(e, "register")} />
            <button type="button" className="mt-2 text-sm text-teal-700 hover:underline" onClick={unduhTemplate}>
              Unduh template register
            </button>
          </div>
          <div>
            <label className="label" htmlFor="file-asik">Ekspor data ASIK</label>
            <input id="file-asik" type="file" accept=".xlsx,.xls,.csv" className="input" onChange={(e) => bukaFile(e, "asik")} />
            <p className="mt-2 text-xs text-slate-500">Harus memuat tanggal input untuk menghitung ketepatan waktu.</p>
          </div>
        </div>
        {errorFile && <p className="galat">{errorFile}</p>}
      </Langkah>

      {(fileReg || fileAsik) && (
        <Langkah no={3} judul="Cocokkan kolom">
          <div className="grid gap-4 lg:grid-cols-2">
            {fileReg && (
              <KolomMapper judul="Buku register" file={fileReg} kolom={KOLOM_REGISTER} peta={petaReg}
                onChange={(p) => { setPetaReg(p); ulang(); }} />
            )}
            {fileAsik && (
              <KolomMapper judul="Ekspor ASIK" file={fileAsik} kolom={KOLOM_ASIK} peta={petaAsik}
                onChange={(p) => { setPetaAsik(p); ulang(); }} />
            )}
          </div>
          {[...kurangReg, ...kurangAsik].length > 0 && (
            <p className="text-sm text-amber-700">Kolom wajib belum dipilih: {[...new Set([...kurangReg, ...kurangAsik])].join(", ")}.</p>
          )}
          <p className="text-xs text-slate-500">
            Tanggal dibaca sebagai HH/BB/TTTT atau TTTT-BB-HH. Simpan NIK sebagai teks di Excel; angka 16 digit bisa terpotong.
          </p>
          <button className="tombol" disabled={!bisaPeriksa} onClick={jalankanPeriksa}>Periksa data</button>
        </Langkah>
      )}

      {periksa && (
        <Langkah no={4} judul="Hasil pemeriksaan">
          <div className="kartu space-y-1 text-sm">
            <p><b>{periksa.sampel.length}</b> balita sampel di buku register untuk {labelPeriode(periode)}.</p>
            {periksa.diluarPeriode > 0 && (
              <p className="text-slate-500">{periksa.diluarPeriode} baris register di luar periode ini diabaikan.</p>
            )}
            <p><b>{periksa.asik.length}</b> baris ASIK terbaca.</p>
          </div>
          <DaftarGalat judul="Perbaiki file register lalu buka ulang" galat={periksa.galatReg} />
          {periksa.galatAsik.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {periksa.galatAsik.length} baris ASIK dilewati karena identitas atau tanggal tidak terbaca
              (contoh: baris {periksa.galatAsik.slice(0, 5).map((g) => g.baris).join(", ")}).
            </div>
          )}
          {periksa.sampel.length === 0 && !periksa.galatReg.length && (
            <p className="galat">Tidak ada baris register dengan tanggal ukur di {labelPeriode(periode)}.</p>
          )}
          <button className="tombol" disabled={!bisaRekonsiliasi} onClick={jalankanRekonsiliasi}>Jalankan rekonsiliasi</button>
        </Langkah>
      )}

      {hasil && (
        <Langkah no={5} judul={`Hasil audit · ${namaPosyandu} · ${labelPeriode(periode)}`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Indikator label="Kelengkapan" nilai={ind.kelengkapan}
              ket={`${ringkasan.jumlah_tercatat_asik} dari ${ringkasan.jumlah_sampel} balita ada di ASIK`} />
            <Indikator label="Kesesuaian" nilai={ind.kesesuaian}
              ket={`${ringkasan.jumlah_tercatat_asik - ringkasan.jml_tidak_sesuai} dari ${ringkasan.jumlah_tercatat_asik} data identik`} />
            <Indikator label="Ketepatan waktu" nilai={ind.ketepatan}
              ket={`${ringkasan.jumlah_tercatat_asik - ringkasan.jml_terlambat} dari ${ringkasan.jumlah_tercatat_asik} diinput ≤ ${BATAS_HARI_INPUT} hari`} />
          </div>
          <p className="text-sm text-slate-600">
            Tidak ada di ASIK: <b>{ringkasan.jml_tidak_ada_di_asik}</b> · Selisih tanggal: <b>{ringkasan.jml_selisih_tanggal}</b> ·
            BB: <b>{ringkasan.jml_selisih_bb}</b> · PB/TB: <b>{ringkasan.jml_selisih_tb}</b> · Terlambat: <b>{ringkasan.jml_terlambat}</b>
          </p>

          <div className="kartu space-y-3 p-0">
            <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hanyaMasalah} onChange={(e) => setHanyaMasalah(e.target.checked)} />
                Hanya data bermasalah
              </label>
              <button className="tombol-garis ml-auto" disabled={!hasil.some((h) => h.masalah.length)}
                onClick={() => unduhMasalah(hasil, { posyandu: namaPosyandu, periode })}>
                Unduh daftar masalah (Excel)
              </button>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="tabel">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th>Baris</th><th>Nama</th><th>Tgl ukur buku / ASIK</th><th>BB buku / ASIK</th>
                    <th>PB/TB buku / ASIK</th><th>Hari s.d. input</th><th>Masalah</th>
                  </tr>
                </thead>
                <tbody>
                  {barisTampil.map((h) => (
                    <tr key={h.baris} className={h.masalah.length ? "" : "text-slate-500"}>
                      <td className="tabular-nums">{h.baris}</td>
                      <td>
                        {h.nama}
                        {h.cara && <span className="block text-xs text-slate-400">cocok via {h.cara}</span>}
                      </td>
                      <td className={`whitespace-nowrap ${h.selisih_tanggal ? "font-medium text-red-700" : ""}`}>
                        {labelTanggal(h.tgl_ukur_buku)} / {labelTanggal(h.tgl_ukur_asik)}
                      </td>
                      <td className={`whitespace-nowrap tabular-nums ${h.selisih_bb ? "font-medium text-red-700" : ""}`}>
                        {h.bb_buku} / {h.bb_asik ?? "–"}
                      </td>
                      <td className={`whitespace-nowrap tabular-nums ${h.selisih_tb ? "font-medium text-red-700" : ""}`}>
                        {h.tb_buku} / {h.tb_asik ?? "–"}
                      </td>
                      <td className={`tabular-nums ${h.terlambat ? "font-medium text-red-700" : ""}`}>{h.hari_input ?? "–"}</td>
                      <td>{h.masalah.join("; ") || "Sesuai"}</td>
                    </tr>
                  ))}
                  {barisTampil.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-500">Tidak ada data bermasalah.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Langkah>
      )}

      {payload && (
        <Langkah no={6} judul="Simpan ringkasan ke server">
          <div className="kartu space-y-3">
            <p className="text-sm text-slate-600">Hanya data berikut yang dikirim. Tidak ada nama, NIK, tanggal lahir, BB, atau TB.</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              {JSON.stringify(payload, null, 2)}
            </pre>
            <div>
              <label className="label" htmlFor="catatan">Catatan (opsional, maks 200 karakter, jangan menulis nama/NIK balita)</label>
              <input id="catatan" className="input" maxLength={200} value={catatan} disabled={simpan.status === "selesai"}
                onChange={(e) => setCatatan(e.target.value)} placeholder="mis. sampel 20 dari 63 balita" />
            </div>
            {simpan.error && <p className="galat">{simpan.error}</p>}
            {simpan.status === "selesai" ? (
              <p className="sukses">
                Ringkasan tersimpan. <Link to="/" className="underline">Lihat dashboard</Link>
              </p>
            ) : (
              <button className="tombol" disabled={simpan.status === "proses"} onClick={kirim}>
                {simpan.status === "proses" ? "Menyimpan…" : "Simpan ringkasan"}
              </button>
            )}
          </div>
        </Langkah>
      )}
    </div>
  );
}
