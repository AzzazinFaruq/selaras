// Memetakan kolom file ke field SELARAS. Format ekspor ASIK belum pasti,
// jadi nama kolom tidak dikunci; aplikasi hanya menebak dan petugas memastikan.
export default function KolomMapper({ judul, file, kolom, peta, onChange }) {
  const contoh = file.rows[0] ?? {};

  return (
    <div className="kartu min-w-0 space-y-3">
      <div>
        <h3 className="subjudul">{judul}</h3>
        <p className="mt-0.5 text-xs text-navy/75">
          {file.namaFile} · sheet “{file.namaSheet}” · {file.rows.length} baris
        </p>
      </div>
      <div className="-mx-5 -mb-5 overflow-x-auto border-t border-navy/10">
      <table className="tabel min-w-[26rem]">
        <thead>
          <tr><th>Data</th><th>Kolom di file</th><th title="Isi baris pertama di file">Contoh isi</th></tr>
        </thead>
        <tbody>
          {kolom.map((k) => (
            <tr key={k.kunci}>
              <td className="whitespace-nowrap">
                {k.label}
                {k.wajib ? <span className="font-semibold text-merah" title="Wajib"> *</span> : <span className="text-navy/55"> (opsional)</span>}
              </td>
              <td>
                <select
                  className="input min-w-36"
                  value={peta[k.kunci] ?? ""}
                  onChange={(e) => onChange({ ...peta, [k.kunci]: e.target.value || undefined })}
                >
                  <option value="">— tidak ada —</option>
                  {file.header.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </td>
              <td className="max-w-40 truncate text-navy/75">
                {peta[k.kunci] ? String(contoh[peta[k.kunci]] ?? "") : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
