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
        <td className="font-medium">{p.nama}</td>
        <td className={p.kelurahan ? "" : "text-navy/55"}>{p.kelurahan ?? "–"}</td>
        <td className="text-right">
          <button className="tautan text-sm" aria-label={`Ubah ${p.nama}`} onClick={() => setEdit(true)}>Ubah</button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="bg-latar">
      <td><input className="input min-w-36" aria-label="Nama posyandu" maxLength={100} value={nama} onChange={(e) => setNama(e.target.value)} /></td>
      <td><input className="input min-w-36" aria-label="Kelurahan" maxLength={100} value={kelurahan} onChange={(e) => setKelurahan(e.target.value)} /></td>
      <td className="space-x-2 text-right whitespace-nowrap">
        <button className="tombol" onClick={simpan}>Simpan</button>
        <button className="tombol-garis" onClick={() => setEdit(false)}>Batal</button>
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
      <div>
        <h1 className="judul">Posyandu</h1>
        <p className="mt-1 text-sm text-navy/75">Daftar posyandu di wilayah puskesmas ini, dipakai saat membuat audit.</p>
      </div>
      {error && <p className="galat">{error}</p>}

      <form onSubmit={tambah} className="kartu grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <h2 className="subjudul sm:col-span-3">Tambah posyandu</h2>
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
        <p className="px-4 py-3 text-sm text-navy/75 sm:px-5">
          <b className="text-navy tabular-nums">{posyandu.length}</b> posyandu terdaftar
        </p>
        <table className="tabel">
          <thead>
            <tr><th>Nama</th><th>Kelurahan</th><th></th></tr>
          </thead>
          <tbody>
            {posyandu.map((p) => <BarisPosyandu key={p.id} p={p} />)}
            {posyandu.length === 0 && (
              <tr><td colSpan={3} className="py-6 text-center text-navy/75">Belum ada posyandu.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
