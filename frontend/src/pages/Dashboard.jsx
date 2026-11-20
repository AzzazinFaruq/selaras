import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useAuditStore from "../stores/auditStore";
import usePaginasi from "../lib/usePaginasi";
import Paginasi from "../components/Paginasi";
import LegendaAmbang from "../components/LegendaAmbang";
import { INDIKATOR, TEMUAN, kelasPersen } from "../lib/indikator";
import { labelPeriode, labelPersen } from "../lib/format";

// Warna kartu: isi titik data supaya menyatu dengan permukaan.
const PERMUKAAN = "#ffffff";
const NAVY = "13 48 101"; // --color-navy, untuk garis bantu dan teks sumbu

function TooltipTren({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border border-navy/20 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold">{labelPeriode(label)}</p>
      {INDIKATOR.map((s) => (
        <p key={s.kunci} className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full" style={{ background: s.warna }} />
          <span className="text-navy/75">{s.label}</span>
          <span className="ml-auto pl-4 font-medium tabular-nums">{labelPersen(d[s.kunci])}</span>
        </p>
      ))}
      <p className="mt-1 text-xs text-navy/75">Sampel {d.jumlah_sampel} balita</p>
    </div>
  );
}

function Tile({ seri, nilai, sebelum }) {
  const beda = nilai !== null && sebelum !== null && sebelum !== undefined ? nilai - sebelum : null;
  const angka = beda === null ? "" : Math.abs(beda).toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return (
    <div className="kartu">
      <p className="subjudul flex items-center gap-2">
        <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: seri.warna }} />
        {seri.label}
      </p>
      <p className="mt-2 font-label text-4xl leading-none font-semibold tabular-nums xl:text-5xl">{labelPersen(nilai)}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy/75">
        {beda === null && "Periode sebelumnya belum ada"}
        {beda === 0 && "Sama dengan periode sebelumnya"}
        {beda > 0 && <><span className="lencana bg-naik/30 text-hijau tabular-nums">▲ {angka}</span> poin dari periode sebelumnya</>}
        {beda < 0 && <><span className="lencana bg-turun/20 text-merah tabular-nums">▼ {angka}</span> poin dari periode sebelumnya</>}
      </p>
    </div>
  );
}

// Jumlah temuan: 0 dibuat pudar supaya angka yang perlu ditindaklanjuti menonjol.
function Jumlah({ n }) {
  if (!n) return <span className="text-navy/45">0</span>;
  return <span className="lencana bg-navy/10 text-navy tabular-nums">{n}</span>;
}

// Di tabel, tiga jenis selisih digabung jadi satu kolom "tgl/BB/TB" (seperti
// tabel di desain) supaya tabel muat tanpa digeser di layar laptop.
const SELISIH = ["jml_selisih_tanggal", "jml_selisih_bb", "jml_selisih_tb"];

export default function Dashboard() {
  const { tren, trenSiap, fetchTren, error } = useAuditStore();
  const [pilihan, setPilihan] = useState("");

  useEffect(() => {
    fetchTren();
  }, [fetchTren]);

  // Daftar posyandu yang punya audit, urut nama.
  const daftar = useMemo(() => {
    const m = new Map();
    for (const r of tren) m.set(r.posyandu_id, r.posyandu_nama);
    return [...m].map(([id, nama]) => ({ id, nama })).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [tren]);

  // Tabel: periode terbaru di atas.
  const terbaru = useMemo(
    () => [...tren].sort((a, b) => b.periode.localeCompare(a.periode) || a.posyandu_nama.localeCompare(b.posyandu_nama)),
    [tren]
  );
  const hal = usePaginasi(terbaru, 10);

  const posyanduId = pilihan || daftar[0]?.id || "";
  const data = tren.filter((r) => r.posyandu_id === posyanduId);
  const akhir = data.at(-1);
  const sebelum = data.at(-2);

  if (!trenSiap && tren.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="judul">Dashboard tren kualitas data</h1>
        <p className="text-sm text-navy/75" role="status">Memuat…</p>
      </div>
    );
  }

  if (tren.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="judul">Dashboard tren kualitas data</h1>
        {error && <p className="galat">{error}</p>}
        <div className="kartu flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="subjudul">Belum ada audit</h2>
          <Link to="/audit-baru" className="tombol w-full sm:w-auto">Audit baru</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="judul">Dashboard tren kualitas data</h1>
        </div>
        <div className="w-full sm:w-auto">
          <label className="label" htmlFor="pilih-posyandu">Posyandu</label>
          <select id="pilih-posyandu" className="input sm:min-w-52" value={posyanduId} onChange={(e) => setPilihan(e.target.value)}>
            {daftar.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="galat">{error}</p>}

      {akhir && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {INDIKATOR.map((s) => (
              <Tile key={s.kunci} seri={s} nilai={akhir[s.kunci]} sebelum={sebelum?.[s.kunci]} />
            ))}
          </div>
          <p className="-mt-3 text-sm text-navy/75">
            Periode terakhir <b className="text-navy">{labelPeriode(akhir.periode)}</b> · sampel {akhir.jumlah_sampel} balita
          </p>

          <div className="kartu px-2 sm:px-5">
            <h2 className="subjudul mb-3 px-3 sm:px-0">Tren indikator (%)</h2>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke={`rgb(${NAVY} / 0.12)`} vertical={false} />
                  <XAxis dataKey="periode" tickFormatter={labelPeriode} tick={{ fontSize: 12, fill: `rgb(${NAVY} / 0.75)` }} axisLine={{ stroke: `rgb(${NAVY} / 0.3)` }} tickLine={false} minTickGap={16} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 12, fill: `rgb(${NAVY} / 0.75)` }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipTren />} cursor={{ stroke: `rgb(${NAVY} / 0.5)`, strokeDasharray: "3 3" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} formatter={(nama) => <span className="text-navy">{nama}</span>} />
                  {INDIKATOR.map((s) => (
                    <Line
                      key={s.kunci}
                      type="linear"
                      dataKey={s.kunci}
                      name={s.label}
                      stroke={s.warna}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 2, fill: PERMUKAAN }}
                      activeDot={{ r: 6, stroke: PERMUKAAN, strokeWidth: 2 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <section className="kartu overflow-hidden p-0">
        <div className="space-y-2 px-4 pt-4 pb-3 sm:px-5">
          <h2 className="subjudul">Rekap per periode</h2>
          <LegendaAmbang />
        </div>

        {/* Layar lebar: tabel */}
        <div className="hidden overflow-x-auto md:block">
          <table className="tabel">
            <thead>
              <tr>
                <th colSpan={3} className="pb-0" />
                <th colSpan={3} className="border-l border-white/20 pb-0 text-center text-muda">Indikator (%)</th>
                <th colSpan={3} className="border-l border-white/20 pb-0 text-center text-muda">Temuan (jumlah balita)</th>
              </tr>
              <tr>
                <th>Periode</th><th>Posyandu</th><th className="text-right">Sampel</th>
                <th className="border-l border-white/20 text-right">Kelengkapan</th>
                <th className="text-right">Kesesuaian</th>
                <th className="text-right">Ketepatan</th>
                <th className="border-l border-white/20 text-right leading-tight">Tidak<br />di ASIK</th>
                <th className="text-right leading-tight" title="Jumlah balita yang tanggal ukur / BB / PB-TB-nya berbeda">Selisih<br />tgl/BB/TB</th>
                <th className="text-right">Terlambat</th>
              </tr>
            </thead>
            <tbody>
              {hal.potong.map((r) => (
                <tr key={`${r.posyandu_id}-${r.periode}`} className={r.posyandu_id === posyanduId ? "bg-latar" : ""}>
                  <td className="whitespace-nowrap">{labelPeriode(r.periode)}</td>
                  <td className="font-medium whitespace-nowrap">{r.posyandu_nama}</td>
                  <td className="text-right tabular-nums">{r.jumlah_sampel}</td>
                  {INDIKATOR.map((s, i) => (
                    <td key={s.kunci} className={`text-right font-semibold tabular-nums ${kelasPersen(r[s.kunci])} ${i === 0 ? "border-l border-navy/10" : ""}`}>
                      {labelPersen(r[s.kunci])}
                    </td>
                  ))}
                  <td className="border-l border-navy/10 text-right tabular-nums"><Jumlah n={r.jml_tidak_ada_di_asik} /></td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {SELISIH.map((k, i) => (
                      <span key={k}>
                        {i > 0 && <span className="px-0.5 text-navy/45">/</span>}
                        <span className={r[k] ? "font-semibold" : "text-navy/45"}>{r[k]}</span>
                      </span>
                    ))}
                  </td>
                  <td className="text-right tabular-nums"><Jumlah n={r.jml_terlambat} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ponsel: kartu per baris */}
        <ul className="divide-y divide-navy/10 border-t border-navy/10 md:hidden">
          {hal.potong.map((r) => (
            <li key={`${r.posyandu_id}-${r.periode}`} className={`space-y-3 px-4 py-3 ${r.posyandu_id === posyanduId ? "bg-latar" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate font-semibold">{r.posyandu_nama}</p>
                <p className="text-sm whitespace-nowrap text-navy/75">{labelPeriode(r.periode)} · {r.jumlah_sampel} balita</p>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                {INDIKATOR.map((s) => (
                  <div key={s.kunci}>
                    <dt className="text-xs text-navy/75">{s.label}</dt>
                    <dd className={`font-semibold tabular-nums ${kelasPersen(r[s.kunci])}`}>{labelPersen(r[s.kunci])}</dd>
                  </div>
                ))}
              </dl>
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy/75">
                {TEMUAN.map((t) => (
                  <div key={t.kunci} className="flex items-center gap-1.5">
                    <dt>{t.pendek}</dt>
                    <dd><Jumlah n={r[t.kunci]} /></dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>

        <div className="border-t border-navy/10">
          <Paginasi p={hal} satuan="rekap" />
        </div>
      </section>
    </div>
  );
}
