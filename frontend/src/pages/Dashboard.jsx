import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useAuditStore from "../stores/auditStore";
import { labelPeriode, labelPersen } from "../lib/format";

// Warna seri tetap per indikator (tidak berubah walau filter berubah).
// Palet tervalidasi untuk buta warna; teal di bawah 3:1 sehingga ada legenda + tabel.
const SERI = [
  { kunci: "persen_kelengkapan", label: "Kelengkapan", warna: "#2a78d6" },
  { kunci: "persen_kesesuaian", label: "Kesesuaian", warna: "#eb6834" },
  { kunci: "persen_ketepatan", label: "Ketepatan waktu", warna: "#1baf7a" },
];

function TooltipTren({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{labelPeriode(label)}</p>
      {SERI.map((s) => (
        <p key={s.kunci} className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full" style={{ background: s.warna }} />
          <span className="text-slate-600">{s.label}</span>
          <span className="ml-auto pl-4 tabular-nums">{labelPersen(d[s.kunci])}</span>
        </p>
      ))}
      <p className="mt-1 text-xs text-slate-500">Sampel {d.jumlah_sampel} balita</p>
    </div>
  );
}

function Tile({ label, nilai, sebelum }) {
  const beda = nilai !== null && sebelum !== null && sebelum !== undefined ? nilai - sebelum : null;
  return (
    <div className="kartu">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{labelPersen(nilai)}</p>
      <p className="text-xs text-slate-500">
        {beda === null ? "periode sebelumnya belum ada" : `${beda >= 0 ? "▲" : "▼"} ${Math.abs(beda).toLocaleString("id-ID", { maximumFractionDigits: 2 })} poin dari periode sebelumnya`}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { tren, fetchTren, loading, error } = useAuditStore();
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

  const posyanduId = pilihan || daftar[0]?.id || "";
  const data = tren.filter((r) => r.posyandu_id === posyanduId);
  const akhir = data.at(-1);
  const sebelum = data.at(-2);

  if (!loading && tren.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Dashboard tren kualitas data</h1>
        {error && <p className="galat">{error}</p>}
        <div className="kartu text-sm">
          Belum ada audit tersimpan. <Link to="/audit-baru" className="text-teal-700 underline">Mulai audit pertama</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">Dashboard tren kualitas data</h1>
          <p className="text-sm text-slate-500">Audit terbaru per posyandu per bulan</p>
        </div>
        <div>
          <label className="label" htmlFor="pilih-posyandu">Posyandu</label>
          <select id="pilih-posyandu" className="input min-w-52" value={posyanduId} onChange={(e) => setPilihan(e.target.value)}>
            {daftar.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="galat">{error}</p>}

      {akhir && (
        <>
          <p className="text-sm text-slate-600">Periode terakhir: <b>{labelPeriode(akhir.periode)}</b> · sampel {akhir.jumlah_sampel} balita</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {SERI.map((s) => (
              <Tile key={s.kunci} label={s.label} nilai={akhir[s.kunci]} sebelum={sebelum?.[s.kunci]} />
            ))}
          </div>

          <div className="kartu">
            <h2 className="mb-3 text-sm font-medium text-slate-600">Tren indikator (%)</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="periode" tickFormatter={labelPeriode} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipTren />} cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 13, color: "#334155" }} />
                  {SERI.map((s) => (
                    <Line
                      key={s.kunci}
                      type="linear"
                      dataKey={s.kunci}
                      name={s.label}
                      stroke={s.warna}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                      activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
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

      <div className="kartu overflow-x-auto p-0">
        <table className="tabel">
          <thead>
            <tr>
              <th>Periode</th><th>Posyandu</th><th className="text-right">Sampel</th>
              <th className="text-right">Kelengkapan</th><th className="text-right">Kesesuaian</th><th className="text-right">Ketepatan</th>
              <th className="text-right">Tidak di ASIK</th><th className="text-right">Selisih tgl/BB/TB</th><th className="text-right">Terlambat</th>
            </tr>
          </thead>
          <tbody>
            {[...tren].reverse().map((r) => (
              <tr key={`${r.posyandu_id}-${r.periode}`} className={r.posyandu_id === posyanduId ? "bg-teal-50/40" : ""}>
                <td className="whitespace-nowrap">{labelPeriode(r.periode)}</td>
                <td>{r.posyandu_nama}</td>
                <td className="text-right tabular-nums">{r.jumlah_sampel}</td>
                <td className="text-right tabular-nums">{labelPersen(r.persen_kelengkapan)}</td>
                <td className="text-right tabular-nums">{labelPersen(r.persen_kesesuaian)}</td>
                <td className="text-right tabular-nums">{labelPersen(r.persen_ketepatan)}</td>
                <td className="text-right tabular-nums">{r.jml_tidak_ada_di_asik}</td>
                <td className="text-right tabular-nums">{r.jml_selisih_tanggal}/{r.jml_selisih_bb}/{r.jml_selisih_tb}</td>
                <td className="text-right tabular-nums">{r.jml_terlambat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
