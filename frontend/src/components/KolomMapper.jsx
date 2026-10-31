// Memetakan kolom file ke field SELARAS. Format ekspor ASIK belum pasti,
// jadi nama kolom tidak dikunci; aplikasi hanya menebak dan petugas memastikan.
export default function KolomMapper({ judul, file, kolom, peta, onChange }) {
  const contoh = file.rows[0] ?? {};

  return (
    <div className="kartu space-y-3">
      <div>
        <h3 className="font-medium">{judul}</h3>
        <p className="text-xs text-slate-500">
          {file.namaFile} · sheet “{file.namaSheet}” · {file.rows.length} baris
        </p>
      </div>
      <table className="tabel">
        <thead>
          <tr><th>Data</th><th>Kolom di file</th><th>Contoh baris pertama</th></tr>
        </thead>
        <tbody>
          {kolom.map((k) => (
            <tr key={k.kunci}>
              <td className="whitespace-nowrap">
                {k.label}
                {k.wajib ? <span className="text-red-600"> *</span> : <span className="text-slate-400"> (opsional)</span>}
              </td>
              <td>
                <select
                  className="input"
                  value={peta[k.kunci] ?? ""}
                  onChange={(e) => onChange({ ...peta, [k.kunci]: e.target.value || undefined })}
                >
                  <option value="">— tidak ada —</option>
                  {file.header.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </td>
              <td className="max-w-40 truncate text-slate-500">
                {peta[k.kunci] ? String(contoh[peta[k.kunci]] ?? "") : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
