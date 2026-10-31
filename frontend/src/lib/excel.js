// Baca/tulis file Excel/CSV di browser dengan SheetJS. Tidak ada yang diunggah.
import * as XLSX from 'xlsx'

/**
 * Membaca sheet pertama. Baris 1 dianggap header.
 * raw: true supaya tanggal Excel tetap nomor seri dan teks CSV tidak ditebak
 * sebagai tanggal format Amerika (MM/DD); parseTanggal() yang menafsirkannya.
 */
export async function bacaFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', raw: true })
  const namaSheet = wb.SheetNames[0]
  const ws = wb.Sheets[namaSheet]
  const rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' })
  const header = rows.length ? Object.keys(rows[0]) : []
  return { namaFile: file.name, namaSheet, header, rows }
}

/** Daftar data bermasalah per balita untuk diperbaiki di ASIK. Hanya diunduh ke laptop. */
export function unduhMasalah(hasil, { posyandu, periode }) {
  const baris = hasil
    .filter((h) => h.masalah.length)
    .map((h, i) => ({
      No: i + 1,
      'Baris di file register': h.baris,
      NIK: h.nik,
      Nama: h.nama,
      'Tgl lahir': h.tgl_lahir,
      'Tgl ukur (buku)': h.tgl_ukur_buku,
      'Tgl ukur (ASIK)': h.tgl_ukur_asik ?? '',
      'BB buku (kg)': h.bb_buku,
      'BB ASIK (kg)': h.bb_asik ?? '',
      'PB/TB buku (cm)': h.tb_buku,
      'PB/TB ASIK (cm)': h.tb_asik ?? '',
      'Tgl input ASIK': h.tgl_input ?? '',
      'Hari sampai input': h.hari_input ?? '',
      Masalah: h.masalah.join('; '),
    }))

  const ws = XLSX.utils.json_to_sheet(baris)
  ws['!cols'] = [4, 8, 18, 24, 11, 13, 13, 9, 9, 10, 10, 13, 9, 40].map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data bermasalah')
  const aman = posyandu.replace(/[^\w-]+/g, '_')
  XLSX.writeFile(wb, `selaras-masalah-${aman}-${periode}.xlsx`)
}

/** Template rekap buku register. Kolom NIK diformat Teks agar 16 digit tidak terpotong Excel. */
export function unduhTemplate() {
  const header = ['NIK', 'Nama Balita', 'Tanggal Lahir', 'Tanggal Ukur', 'BB (kg)', 'PB/TB (cm)']
  const contoh = ['3578000000000000', 'Contoh Nama (hapus baris ini)', '15/03/2024', '05/10/2026', '10,5', '82']
  const ws = XLSX.utils.aoa_to_sheet([header, contoh])
  ws.A2.t = 's'
  ws.A2.z = '@'
  ws['!cols'] = [20, 28, 14, 14, 9, 11].map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Register')
  XLSX.writeFile(wb, 'template-register-selaras.xlsx')
}
