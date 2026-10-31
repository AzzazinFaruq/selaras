import { useEffect, useState } from "react";
import usePosyanduStore from "../stores/posyanduStore";

function BarisPosyandu({ p }) {
  const updatePosyandu = usePosyanduStore((s) => s.updatePosyandu);
  const [edit, setEdit] = useState(false);
  const [nama, setNama] = useState(p.nama);
  const [kelurahan, setKelurahan] = useState(p.kelurahan ?? "");

  const simpan = async () => {
    if (await updatePosyandu(p.id, { nama, kelurahan })) setEdit(false);
  };

  if (!edit) {
    return (
      <tr>
        <td>{p.nama}</td>
        <td>{p.kelurahan ?? "–"}</td>
        <td className="text-right">
          <button className="text-sm text-teal-700 hover:underline" onClick={() => setEdit(true)}>Ubah</button>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td><input className="input" maxLength={100} value={nama} onChange={(e) => setNama(e.target.value)} /></td>
      <td><input className="input" maxLength={100} value={kelurahan} onChange={(e) => setKelurahan(e.target.value)} /></td>
      <td className="space-x-2 text-right whitespace-nowrap">
        <button className="tombol py-1.5" onClick={simpan}>Simpan</button>
        <button className="tombol-garis py-1.5" onClick={() => setEdit(false)}>Batal</button>
      </td>
    </tr>
  );
}

export default function Posyandu() {
  const { posyandu, fetchPosyandu, createPosyandu, error, clearError } = usePosyanduStore();
  const [nama, setNama] = useState("");
  const [kelurahan, setKelurahan] = useState("");

  useEffect(() => {
    fetchPosyandu();
    return clearError;
  }, [fetchPosyandu, clearError]);

  const tambah = async (e) => {
    e.preventDefault();
    if (await createPosyandu({ nama, kelurahan })) {
      setNama("");
      setKelurahan("");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Posyandu</h1>
      {error && <p className="galat">{error}</p>}

      <form onSubmit={tambah} className="kartu grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="nama-posyandu">Nama posyandu</label>
          <input id="nama-posyandu" className="input" required maxLength={100} value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Posyandu Melati" />
        </div>
        <div>
          <label className="label" htmlFor="kelurahan">Kelurahan (opsional)</label>
          <input id="kelurahan" className="input" maxLength={100} value={kelurahan} onChange={(e) => setKelurahan(e.target.value)} />
        </div>
        <button className="tombol">Tambah</button>
      </form>

      <div className="kartu overflow-x-auto p-0">
        <table className="tabel">
          <thead>
            <tr><th>Nama</th><th>Kelurahan</th><th></th></tr>
          </thead>
          <tbody>
            {posyandu.map((p) => <BarisPosyandu key={p.id} p={p} />)}
            {posyandu.length === 0 && (
              <tr><td colSpan={3} className="py-6 text-center text-slate-500">Belum ada posyandu.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
