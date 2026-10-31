// Generator data tiruan untuk mencoba SELARAS tanpa data asli.
//
//   npm run data-tiruan -- [periode YYYY-MM] [jumlah balita]
//   contoh: npm run data-tiruan -- 2026-10 20
//
// Menulis data-tiruan/register-<periode>.xlsx dan data-tiruan/asik-<periode>.xlsx
// dengan kesalahan yang disengaja, lalu mencetak angka yang SEHARUSNYA keluar
// di aplikasi. Semua nama dan NIK fiktif. Hasil selalu sama (seed tetap).
import * as fs from 'node:fs'
import * as XLSX from 'xlsx'

XLSX.set_fs(fs) // SheetJS versi ESM butuh akses fs untuk writeFile di Node

const periode = process.argv[2] ?? '2026-10'
const jumlah = Number(process.argv[3] ?? 20)
if (!/^\d{4}-\d{2}$/.test(periode) || !(jumlah >= 10)) {
  console.error('Pemakaian: npm run data-tiruan -- YYYY-MM [jumlah >= 10]')
  process.exit(1)
}

// PRNG sederhana dengan seed tetap supaya hasil bisa diulang.
let seed = 20261031
const acak = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const pilih = (arr) => arr[Math.floor(acak() * arr.length)]

const DEPAN = ['Aisyah', 'Bima', 'Citra', 'Dimas', 'Elsa', 'Fajar', 'Gita', 'Hana', 'Ilham', 'Jihan', 'Kevin', 'Laila', 'Naufal', 'Putri', 'Raka', 'Salsa', 'Tegar', 'Wulan', 'Yusuf', 'Zahra']
const BELAKANG = ['Pratama', 'Ramadhani', 'Saputra', 'Lestari', 'Nugroho', 'Maharani', 'Kurniawan', 'Anggraini', 'Hidayat', 'Permata']

const [y, m] = periode.split('-').map(Number)
const hariBuka = `${periode}-05` // hari buka posyandu
const tgl = (d) => d.toISOString().slice(0, 10)
const tambahHari = (s, n) => tgl(new Date(Date.parse(s) + n * 86400000))
const keDMY = (s) => s.split('-').reverse().join('/')

const balita = Array.from({ length: jumlah }, (_, i) => {
  const umurBulan = 3 + Math.floor(acak() * 54)
  const lahir = tgl(new Date(Date.UTC(y, m - 1 - umurBulan, 1 + Math.floor(acak() * 27))))
  return {
    nik: `3578${String(Math.floor(acak() * 1e12)).padStart(12, '0')}`,
    nama: `${pilih(DEPAN)} ${pilih(BELAKANG)}`,
    lahir,
    bb: Math.round((5 + umurBulan * 0.2 + acak() * 2) * 10) / 10,
    tb: Math.round(55 + umurBulan * 0.9 + acak() * 4),
  }
})

// Kesalahan yang disisipkan (indeks balita, tidak tumpang tindih)
const tidakDiinput = [0, 1, 2] //                  -> tidak ada di ASIK
const salahBB = [3, 4] //                          -> BB berbeda
const salahTB = [5] //                             -> PB/TB berbeda
const salahTanggal = [6] //                        -> tanggal ukur berbeda
const terlambat = [7, 8, 9, 3] //                  -> input > 7 hari (indeks 3 juga salah BB)
const tanpaNikDiBuku = [10] //                     -> dicocokkan lewat nama + tgl lahir

const register = balita.map((b, i) => ({
  NIK: tanpaNikDiBuku.includes(i) ? '' : b.nik,
  'Nama Balita': b.nama,
  'Tanggal Lahir': keDMY(b.lahir),
  'Tanggal Ukur': keDMY(hariBuka),
  'BB (kg)': String(b.bb).replace('.', ','),
  'PB/TB (cm)': b.tb,
}))

const asik = []
balita.forEach((b, i) => {
  if (tidakDiinput.includes(i)) return
  asik.push({
    nik_anak: b.nik,
    nama_anak: b.nama.toUpperCase(),
    tanggal_lahir: b.lahir,
    tanggal_pengukuran: salahTanggal.includes(i) ? tambahHari(hariBuka, 1) : hariBuka,
    berat_badan: salahBB.includes(i) ? Math.round((b.bb + 1.2) * 10) / 10 : b.bb,
    tinggi_badan: salahTB.includes(i) ? b.tb + 10 : b.tb,
    tanggal_input: `${tambahHari(hariBuka, terlambat.includes(i) ? 12 : 2)} 10:15:00`,
  })
  // kunjungan bulan sebelumnya, untuk menguji pemilihan kunjungan terdekat
  asik.push({ ...asik.at(-1), tanggal_pengukuran: tambahHari(hariBuka, -28), tanggal_input: `${tambahHari(hariBuka, -27)} 09:00:00` })
})

function tulis(rows, file) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Data')
  XLSX.writeFile(wb, file)
}

fs.mkdirSync('data-tiruan', { recursive: true })
tulis(register, `data-tiruan/register-${periode}.xlsx`)
tulis(asik, `data-tiruan/asik-${periode}.xlsx`)

const tercatat = jumlah - tidakDiinput.length
const tidakSesuai = new Set([...salahBB, ...salahTB, ...salahTanggal]).size
const p = (a, b) => `${(Math.round((a * 10000) / b) / 100).toLocaleString('id-ID')}%`
console.log(`Ditulis: data-tiruan/register-${periode}.xlsx (${jumlah} balita), data-tiruan/asik-${periode}.xlsx (${asik.length} baris)`)
console.log('Hasil yang diharapkan di aplikasi:')
console.log(`  sampel ${jumlah}, tercatat ${tercatat}, tidak ada ${tidakDiinput.length}`)
console.log(`  selisih tanggal/BB/TB ${salahTanggal.length}/${salahBB.length}/${salahTB.length}, tidak sesuai ${tidakSesuai}, terlambat ${terlambat.length}`)
console.log(`  kelengkapan ${p(tercatat, jumlah)}, kesesuaian ${p(tercatat - tidakSesuai, tercatat)}, ketepatan ${p(tercatat - terlambat.length, tercatat)}`)
