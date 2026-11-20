import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import usePosyanduStore from "../stores/posyanduStore";
import useAuditStore from "../stores/auditStore";
import { pesanGalat } from "../api/axios";
import KolomMapper from "../components/KolomMapper";
import Ikon from "../components/Ikon";
import Dialog from "../components/Dialog";
import { bacaFile, unduhMasalah, unduhTemplate } from "../lib/excel";
import { INDIKATOR, TEMUAN } from "../lib/indikator";
import { daftarPeriode, labelPeriode, labelPersen, labelTanggal, periodeSekarang } from "../lib/format";
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

const LANGKAH = ["Posyandu & periode", "Buka file", "Cocokkan kolom", "Pemeriksaan", "Hasil audit", "Simpan"];
const PILIHAN_PERIODE = daftarPeriode();

// Peta langkah di atas halaman: langkah berikutnya baru muncul setelah langkah
// sebelumnya selesai, jadi petugas perlu tahu sedang di mana dan sisa berapa.
function Alur({ selesai }) {
  const tuntas = selesai >= LANGKAH.length;
  return (
    <>
    {/* Layar sempit: enam langkah tidak muat sebaris, jadi diringkas. */}
    <div className="kartu space-y-2 p-3 text-sm xl:hidden" role="status">
      <p>
        {tuntas ? <b>Semua langkah selesai</b> : (
          <><span className="text-navy/75">Langkah {selesai + 1} dari {LANGKAH.length}</span> · <b>{LANGKAH[selesai]}</b></>
        )}
      </p>
      <div className="flex gap-1" aria-hidden="true">
        {LANGKAH.map((nama, i) => (
          <span key={nama} className={`h-1.5 flex-1 rounded-full ${i < selesai ? "bg-aksen" : i === selesai ? "bg-navy" : "bg-navy/15"}`} />
        ))}
      </div>
    </div>
    <ol className="kartu hidden gap-1 overflow-x-auto p-2 text-sm xl:flex" aria-label="Langkah audit">
      {LANGKAH.map((nama, i) => {
        const status = i < selesai ? "selesai" : i === selesai ? "aktif" : "belum";
        const bulat = { selesai: "bg-aksen text-tinta", aktif: "bg-navy text-white", belum: "border border-navy/30" }[status];
        const baris = { selesai: "", aktif: "bg-latar font-semibold", belum: "text-navy/55" }[status];
        return (
          <li
            key={nama} aria-current={status === "aktif" ? "step" : undefined}
            className={`flex flex-1 items-center gap-2 rounded-sm px-2 py-1.5 whitespace-nowrap ${baris}`}
          >
            <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${bulat}`}>
              {status === "selesai" ? <Ikon nama="cek" className="size-3.5" /> : i + 1}
            </span>
            {nama}
            {status === "selesai" && <span className="sr-only">(selesai)</span>}
          </li>
        );
      })}
    </ol>
    </>
  );
}

function Langkah({ no, judul, children }) {
  return (
    <section className="space-y-3">
      <h2 className="subjudul flex items-center gap-2.5">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-navy font-sans text-sm font-semibold text-white">{no}</span>
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

function Indikator({ seri, nilai, ket }) {
  return (
    <div className="kartu">
      <p className="subjudul flex items-center gap-2">
        <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: seri.warna }} />
        {seri.label}
      </p>
      <p className="mt-2 font-label text-4xl leading-none font-semibold tabular-nums xl:text-5xl">{labelPersen(nilai)}</p>
      <p className="mt-3 text-sm font-medium">{ket}</p>
    </div>
  );
}

// Nilai buku register di atas, nilai ASIK di bawah; yang berbeda diberi warna.
function Banding({ buku, asik, beda }) {
  return (
    <td className="whitespace-nowrap tabular-nums">
      <span className="block"><span className="mr-1.5 text-xs text-navy/55">Buku</span>{buku}</span>
      <span className={`block ${beda ? "font-semibold text-merah" : ""}`}>
        <span className={`mr-1.5 text-xs ${beda ? "text-merah" : "text-navy/55"}`}>ASIK</span>{asik}
      </span>
    </td>
  );
}

const kurang = (kolom, peta) => kolom.filter((k) => k.wajib && !peta[k.kunci]).map((k) => k.label);

// `ulangi` mengosongkan seluruh isian untuk memulai audit posyandu lain.
function FormAudit({ ulangi }) {
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
  const [dialog, setDialog] = useState(false);
  const [errorFile, setErrorFile] = useState(null);

  useEffect(() => {
    fetchPosyandu();
  }, [fetchPosyandu]);

  // Perubahan di langkah awal membatalkan hasil langkah berikutnya.
  const ulang = () => {
    setPeriksa(null);
    setHasil(null);
    setSimpan({ status: "belum", error: null });
    setDialog(false);
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

  // Jumlah langkah yang sudah selesai; hasil audit (langkah 5) hanya untuk dibaca.
  const selesai = !(posyanduId && periode) ? 0
    : !(fileReg && fileAsik) ? 1
    : !periksa ? 2
    : !hasil ? 3
    : simpan.status !== "selesai" ? 5
    : 6;

  const tersimpan = simpan.status === "selesai";

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
      <div className="space-y-4">
        <h1 className="judul">Audit baru</h1>
        <Alur selesai={selesai} />
      </div>

      <Langkah no={1} judul="Posyandu dan periode">
        {posyandu.length === 0 ? (
          <p className="kartu text-sm">
            Belum ada posyandu. <Link to="/posyandu" className="tautan">Tambahkan dulu</Link>.
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
              <select id="periode" className="input" value={periode} onChange={(e) => { setPeriode(e.target.value); ulang(); }}>
                {PILIHAN_PERIODE.map((p) => <option key={p} value={p}>{labelPeriode(p)}</option>)}
              </select>
            </div>
          </div>
        )}
      </Langkah>

      <Langkah no={2} judul="Buka file">
        <div className="kartu grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="file-reg">Rekap buku register (sampel balita)</label>
            <input id="file-reg" type="file" accept=".xlsx,.xls,.csv" className="input" onChange={(e) => bukaFile(e, "register")} />
            <button type="button" className="tautan mt-2 text-sm" onClick={unduhTemplate}>
              Unduh template register
            </button>
          </div>
          <div>
            <label className="label" htmlFor="file-asik">Ekspor data ASIK</label>
            <input id="file-asik" type="file" accept=".xlsx,.xls,.csv" className="input" onChange={(e) => bukaFile(e, "asik")} />
          </div>
        </div>
        {errorFile && <p className="galat">{errorFile}</p>}
      </Langkah>

      {(fileReg || fileAsik) && (
        <Langkah no={3} judul="Cocokkan kolom">
          <div className="grid gap-4 min-[1400px]:grid-cols-2">
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
            <p className="peringatan">Kolom wajib belum dipilih: {[...new Set([...kurangReg, ...kurangAsik])].join(", ")}.</p>
          )}
          <button className="tombol" disabled={!bisaPeriksa} onClick={jalankanPeriksa}>Periksa data</button>
        </Langkah>
      )}

      {periksa && (
        <Langkah no={4} judul="Pemeriksaan data">
          <div className="kartu space-y-1 text-sm">
            <p><b>{periksa.sampel.length}</b> balita sampel di buku register untuk {labelPeriode(periode)}.</p>
            {periksa.diluarPeriode > 0 && (
              <p className="text-navy/75">{periksa.diluarPeriode} baris register di luar periode ini diabaikan.</p>
            )}
            <p><b>{periksa.asik.length}</b> baris ASIK terbaca.</p>
          </div>
          <DaftarGalat judul="Perbaiki file register lalu buka ulang" galat={periksa.galatReg} />
          {periksa.galatAsik.length > 0 && (
            <div className="peringatan">
              {periksa.galatAsik.length} baris ASIK dilewati karena identitas atau tanggal tidak terbaca
              (contoh: baris {periksa.galatAsik.slice(0, 5).map((g) => g.baris).join(", ")}).
            </div>
          )}
          {periksa.sampel.length === 0 && !periksa.galatReg.length && (
            <p className="galat">Tidak ada baris register dengan tanggal ukur di {labelPeriode(periode)}.</p>
          )}
          <button className="tombol" disabled={!bisaRekonsiliasi} onClick={jalankanRekonsiliasi}>Bandingkan dengan ASIK</button>
        </Langkah>
      )}

      {hasil && (
        <Langkah no={5} judul={`Hasil audit · ${namaPosyandu} · ${labelPeriode(periode)}`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Indikator seri={INDIKATOR[0]} nilai={ind.kelengkapan}
              ket={`${ringkasan.jumlah_tercatat_asik} dari ${ringkasan.jumlah_sampel} balita ada di ASIK`} />
            <Indikator seri={INDIKATOR[1]} nilai={ind.kesesuaian}
              ket={`${ringkasan.jumlah_tercatat_asik - ringkasan.jml_tidak_sesuai} dari ${ringkasan.jumlah_tercatat_asik} data identik`} />
            <Indikator seri={INDIKATOR[2]} nilai={ind.ketepatan}
              ket={`${ringkasan.jumlah_tercatat_asik - ringkasan.jml_terlambat} dari ${ringkasan.jumlah_tercatat_asik} diinput ≤ ${BATAS_HARI_INPUT} hari`} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Temuan (jumlah balita)</h3>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {TEMUAN.map((t) => (
                <div key={t.kunci} className={`rounded border px-3 py-2 ${ringkasan[t.kunci] ? "border-turun/40 bg-white" : "border-navy/15 bg-white/60"}`}>
                  <dt className="text-xs text-navy/75">{t.label}</dt>
                  <dd className={`text-2xl font-semibold tabular-nums ${ringkasan[t.kunci] ? "text-merah" : "text-navy/45"}`}>{ringkasan[t.kunci]}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="kartu overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-4 accent-navy" checked={hanyaMasalah} onChange={(e) => setHanyaMasalah(e.target.checked)} />
                Hanya data bermasalah
              </label>
              <button className="tombol-garis w-full sm:ml-auto sm:w-auto" disabled={!hasil.some((h) => h.masalah.length)}
                onClick={() => unduhMasalah(hasil, { posyandu: namaPosyandu, periode })}>
                Unduh daftar masalah (Excel)
              </button>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="tabel">
                <thead className="sticky top-0">
                  <tr>
                    <th>Baris</th><th>Nama</th><th>Tanggal ukur</th><th>BB (kg)</th>
                    <th>PB/TB (cm)</th><th title="Jumlah hari dari hari posyandu sampai diinput ke ASIK">Jeda input (hari)</th><th>Masalah</th>
                  </tr>
                </thead>
                <tbody>
                  {barisTampil.map((h) => (
                    <tr key={h.baris} className={h.masalah.length ? "" : "text-navy/75"}>
                      <td className="tabular-nums">{h.baris}</td>
                      <td>
                        {h.nama}
                        {h.cara && <span className="block text-xs text-navy/55">cocok lewat {h.cara}</span>}
                      </td>
                      <Banding buku={labelTanggal(h.tgl_ukur_buku)} asik={labelTanggal(h.tgl_ukur_asik)} beda={h.selisih_tanggal} />
                      <Banding buku={h.bb_buku} asik={h.bb_asik ?? "–"} beda={h.selisih_bb} />
                      <Banding buku={h.tb_buku} asik={h.tb_asik ?? "–"} beda={h.selisih_tb} />
                      <td className={`tabular-nums ${h.terlambat ? "font-semibold text-merah" : ""}`}>{h.hari_input ?? "–"}</td>
                      <td>
                        {h.masalah.length === 0 ? "Sesuai" : (
                          <span className="flex flex-wrap gap-1">
                            {h.masalah.map((m) => <span key={m} className="lencana bg-turun/15 text-merah">{m}</span>)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {barisTampil.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-navy/75">Tidak ada data bermasalah.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Langkah>
      )}

      {payload && (
        <Langkah no={6} judul="Simpan ringkasan">
          <div className="kartu flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {tersimpan ? (
              <>
                <p className="flex items-center gap-2 text-sm font-medium text-hijau">
                  <Ikon nama="cek" />
                  Ringkasan tersimpan
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link to="/" className="tombol-garis">Lihat dashboard</Link>
                  <button type="button" className="tombol" onClick={ulangi}>Audit posyandu lain</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-navy/75">Data balita tidak ikut disimpan.</p>
                <button type="button" className="tombol shrink-0" onClick={() => setDialog(true)}>Simpan ringkasan</button>
              </>
            )}
          </div>
        </Langkah>
      )}

      <Dialog
        buka={dialog && !!ringkasan} onTutup={() => setDialog(false)} terkunci={simpan.status === "proses"}
        judul={tersimpan ? "Ringkasan tersimpan" : "Simpan ringkasan audit"}
      >
        {ringkasan && (tersimpan ? (
          <>
            <p className="flex items-start gap-3 text-sm">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-naik/30 text-hijau">
                <Ikon nama="cek" />
              </span>
              <span>
<b>{namaPosyandu}</b>, {labelPeriode(periode)}
              </span>
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link to="/" className="tombol-garis">Lihat dashboard</Link>
              <button type="button" className="tombol" onClick={ulangi}>Audit posyandu lain</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-navy/75">
              <b className="text-navy">{namaPosyandu}</b> · {labelPeriode(periode)} · sampel {ringkasan.jumlah_sampel} balita
            </p>
            <dl className="grid grid-cols-3 gap-2">
              {INDIKATOR.map((s, i) => (
                <div key={s.kunci} className="rounded border border-navy/15 px-3 py-2">
                  <dt className="text-xs text-navy/75">{s.label}</dt>
                  <dd className="font-label text-xl font-semibold tabular-nums sm:text-2xl">
                    {labelPersen([ind.kelengkapan, ind.kesesuaian, ind.ketepatan][i])}
                  </dd>
                </div>
              ))}
            </dl>
            <dl className="divide-y divide-navy/10 rounded border border-navy/15 text-sm">
              {TEMUAN.map((t) => (
                <div key={t.kunci} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <dt className="text-navy/75">{t.label}</dt>
                  <dd className={`tabular-nums ${ringkasan[t.kunci] ? "font-semibold" : "text-navy/55"}`}>{ringkasan[t.kunci]} balita</dd>
                </div>
              ))}
            </dl>
            <div>
              <label className="label" htmlFor="catatan">Catatan (opsional)</label>
              <input id="catatan" className="input" maxLength={200} value={catatan} disabled={simpan.status === "proses"}
                onChange={(e) => setCatatan(e.target.value)} placeholder="mis. sampel 20 dari 63 balita" />
              <p className="mt-1 text-xs text-navy/75">Jangan menulis nama atau NIK balita.</p>
            </div>
            {simpan.error && <p className="galat" role="alert">{simpan.error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="tombol-garis" disabled={simpan.status === "proses"} onClick={() => setDialog(false)}>Batal</button>
              <button type="button" className="tombol" data-fokus disabled={simpan.status === "proses"} onClick={kirim}>
                {simpan.status === "proses" ? "Menyimpan…" : "Simpan ringkasan"}
              </button>
            </div>
          </>
        ))}
      </Dialog>
    </div>
  );
}

export default function AuditBaru() {
  const [putaran, setPutaran] = useState(0);
  return <FormAudit key={putaran} ulangi={() => setPutaran((n) => n + 1)} />;
}
