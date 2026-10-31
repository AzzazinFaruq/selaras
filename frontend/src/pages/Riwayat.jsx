import { useEffect } from "react";
import useAuditStore from "../stores/auditStore";
import { labelPeriode, labelPersen } from "../lib/format";

export default function Riwayat() {
  const { riwayat, fetchRiwayat, deleteAudit, error } = useAuditStore();

  useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  const hapus = async (a) => {
    if (confirm(`Hapus audit ${a.posyandu_nama} ${labelPeriode(a.periode)}?`)) await deleteAudit(a.id);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Riwayat audit</h1>
        <p className="text-sm text-slate-500">
          Audit yang salah bisa dihapus pembuatnya dalam 24 jam, lalu diulang. Dashboard memakai audit terbaru per periode.
        </p>
      </div>
      {error && <p className="galat">{error}</p>}

      <div className="kartu overflow-x-auto p-0">
        <table className="tabel">
          <thead>
            <tr>
              <th>Dibuat</th><th>Posyandu</th><th>Periode</th><th className="text-right">Sampel</th>
              <th className="text-right">Kelengkapan</th><th className="text-right">Kesesuaian</th>
              <th className="text-right">Ketepatan</th><th>Petugas</th><th>Catatan</th><th></th>
            </tr>
          </thead>
          <tbody>
            {riwayat.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap">
                  {new Date(a.dibuat_pada).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td>{a.posyandu_nama}</td>
                <td className="whitespace-nowrap">{labelPeriode(a.periode)}</td>
                <td className="text-right tabular-nums">{a.jumlah_sampel}</td>
                <td className="text-right tabular-nums">{labelPersen(a.persen_kelengkapan)}</td>
                <td className="text-right tabular-nums">{labelPersen(a.persen_kesesuaian)}</td>
                <td className="text-right tabular-nums">{labelPersen(a.persen_ketepatan)}</td>
                <td>{a.petugas_nama}</td>
                <td className="max-w-48 truncate" title={a.catatan ?? ""}>{a.catatan ?? ""}</td>
                <td className="text-right">
                  {a.bisa_dihapus && (
                    <button className="text-sm text-red-700 hover:underline" onClick={() => hapus(a)}>Hapus</button>
                  )}
                </td>
              </tr>
            ))}
            {riwayat.length === 0 && (
              <tr><td colSpan={10} className="py-6 text-center text-slate-500">Belum ada audit.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
