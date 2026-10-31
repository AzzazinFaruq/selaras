// Jalankan: npm test   (memakai node:test bawaan Node, tanpa library tambahan)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  KOLOM_ASIK,
  KOLOM_REGISTER,
  bacaBaris,
  hitungRingkasan,
  indikator,
  normalisasiNama,
  parseAngka,
  parseTanggal,
  rekonsiliasi,
  siapkanSampel,
  tebakPemetaan,
} from './rekonsiliasi.js'

test('parseTanggal: format umum', () => {
  assert.equal(parseTanggal('2026-10-05'), '2026-10-05')
  assert.equal(parseTanggal('05/10/2026'), '2026-10-05') // DD/MM/YYYY, bukan format AS
  assert.equal(parseTanggal('5-10-2026'), '2026-10-05')
  assert.equal(parseTanggal('2026-10-05 14:30:00'), '2026-10-05')
  assert.equal(parseTanggal('2026-10-05T14:30:00'), '2026-10-05')
  assert.equal(parseTanggal(45292), '2024-01-01') // nomor seri Excel
  assert.equal(parseTanggal(45292.75), '2024-01-01') // seri dengan jam
})

test('parseTanggal: menolak tanggal mustahil dan teks', () => {
  assert.equal(parseTanggal('31/02/2026'), null)
  assert.equal(parseTanggal('2026-13-01'), null)
  assert.equal(parseTanggal('kemarin'), null)
  assert.equal(parseTanggal(''), null)
  assert.equal(parseTanggal(null), null)
})

test('parseAngka: koma desimal dan satuan', () => {
  assert.equal(parseAngka('12,5'), 12.5)
  assert.equal(parseAngka('12.5 kg'), 12.5)
  assert.equal(parseAngka('87 cm'), 87)
  assert.equal(parseAngka(9.8), 9.8)
  assert.equal(parseAngka('dua belas'), null)
  assert.equal(parseAngka(''), null)
})

test('normalisasiNama', () => {
  assert.equal(normalisasiNama("  Nur'aini   PUTRI "), 'nuraini putri')
  assert.equal(normalisasiNama('Zoë Aurelia'), 'zoe aurelia')
  assert.equal(normalisasiNama('M. Rizky'), 'm rizky')
})

test('tebakPemetaan: header register dan ASIK', () => {
  const reg = tebakPemetaan(['No', 'NIK', 'Nama Balita', 'Nama Ibu', 'Tgl Lahir', 'Tanggal Ukur', 'BB (kg)', 'PB/TB (cm)'], KOLOM_REGISTER)
  assert.deepEqual(reg, { nik: 'NIK', nama: 'Nama Balita', tgl_lahir: 'Tgl Lahir', tgl_ukur: 'Tanggal Ukur', bb: 'BB (kg)', tb: 'PB/TB (cm)' })

  const asik = tebakPemetaan(['nik_anak', 'nama_anak', 'tanggal_lahir', 'tanggal_pengukuran', 'berat_badan', 'tinggi_badan', 'tanggal_input'], KOLOM_ASIK)
  assert.equal(asik.tgl_input, 'tanggal_input')
  assert.equal(asik.tgl_ukur, 'tanggal_pengukuran')
  assert.equal(asik.bb, 'berat_badan')
  assert.equal(asik.tb, 'tinggi_badan')
  assert.equal(asik.nik, 'nik_anak')
})

const PETA_REG = { nik: 'NIK', nama: 'Nama', tgl_lahir: 'Lahir', tgl_ukur: 'Ukur', bb: 'BB', tb: 'TB' }
const PETA_ASIK = { ...PETA_REG, tgl_input: 'Input' }

test('bacaBaris register: galat per baris, baris kosong dilewati', () => {
  const rows = [
    { NIK: '3578010101200001', Nama: 'Ani', Lahir: '01/01/2024', Ukur: '05/10/2026', BB: '10,2', TB: '80' },
    { NIK: '35780101', Nama: 'Budi', Lahir: '01/01/2024', Ukur: '05/10/2026', BB: '10', TB: '80' },
    { NIK: '', Nama: '', Lahir: '01/01/2024', Ukur: '31/02/2026', BB: '120', TB: '80' },
    { NIK: '', Nama: '', Lahir: '', Ukur: '', BB: '', TB: '' },
  ]
  const { data, galat } = bacaBaris(rows, PETA_REG, 'register')
  assert.equal(data.length, 1)
  assert.equal(data[0].bb, 10.2)
  assert.equal(galat.length, 2)
  assert.equal(galat[0].baris, 3)
  assert.match(galat[0].pesan, /NIK harus 16 digit/)
  assert.match(galat[1].pesan, /nama kosong/)
  assert.match(galat[1].pesan, /tanggal ukur tidak terbaca/)
  assert.match(galat[1].pesan, /BB tidak wajar/)
})

test('bacaBaris ASIK: NIK rusak diabaikan, BB kosong tetap dipakai', () => {
  const rows = [{ NIK: '123', Nama: 'Ani', Lahir: '2024-01-01', Ukur: '2026-10-05', BB: '', TB: '80', Input: '2026-10-06 09:00' }]
  const { data, galat } = bacaBaris(rows, PETA_ASIK, 'asik')
  assert.equal(galat.length, 0)
  assert.equal(data[0].nik, '')
  assert.equal(data[0].bb, null)
  assert.equal(data[0].tgl_input, '2026-10-06')
})

test('siapkanSampel: filter periode dan deteksi duplikat', () => {
  const reg = [
    { baris: 2, nik: '1', nama: 'a', tgl_lahir: '2024-01-01', tgl_ukur: '2026-10-05' },
    { baris: 3, nik: '1', nama: 'a', tgl_lahir: '2024-01-01', tgl_ukur: '2026-10-20' },
    { baris: 4, nik: '2', nama: 'b', tgl_lahir: '2024-01-01', tgl_ukur: '2026-09-05' },
  ]
  const { sampel, diluarPeriode, galat } = siapkanSampel(reg, '2026-10')
  assert.equal(sampel.length, 2)
  assert.equal(diluarPeriode, 1)
  assert.equal(galat.length, 1)
  assert.equal(galat[0].baris, 3)
})

// ---------------------------------------------------------------------
// Skenario Tabel L.1 proposal: 20 sampel, 17 di ASIK, selisih BB 2, TB 1,
// tanggal 0, terlambat 4 -> 85% / 82,35% / 76,47%
// ---------------------------------------------------------------------

function balita(i) {
  return {
    baris: i + 2,
    nik: `35780101012000${String(i).padStart(2, '0')}`,
    nama: `balita ${String.fromCharCode(97 + i)}`,
    tgl_lahir: '2024-03-15',
    tgl_ukur: '2026-10-05',
    bb: 10 + i / 10,
    tb: 80 + i,
    tgl_input: null,
    nik_asli: '',
    nama_asli: `Balita ${i}`,
  }
}

test('rekonsiliasi: selisih BB + TB pada balita yang sama dihitung satu tidak_sesuai', async () => {
  const register = Array.from({ length: 20 }, (_, i) => balita(i))
  const asik = register.slice(0, 17).map((r) => ({ ...r, tgl_input: '2026-10-06' }))
  asik[0].bb += 0.5 // selisih BB
  asik[1].bb -= 0.3 // selisih BB
  asik[1].tb += 1 // selisih TB pada balita yang sama -> tidak_sesuai tetap dihitung 1
  asik[2].bb += 0.04 // dibulatkan ke 0,1 kg -> dianggap sama
  for (const i of [3, 4, 5, 6]) asik[i].tgl_input = '2026-10-20' // 15 hari -> terlambat
  asik[7].tgl_input = '2026-10-12' // tepat 7 hari -> tidak terlambat

  const hasil = await rekonsiliasi(register, asik)
  const r = hitungRingkasan(hasil)

  assert.deepEqual(r, {
    jumlah_sampel: 20,
    jumlah_tercatat_asik: 17,
    jml_tidak_ada_di_asik: 3,
    jml_tidak_sesuai: 2,
    jml_selisih_tanggal: 0,
    jml_selisih_bb: 2,
    jml_selisih_tb: 1,
    jml_terlambat: 4,
  })
  assert.deepEqual(indikator(r), { kelengkapan: 85, kesesuaian: 88.24, ketepatan: 76.47 })

  // 3 balita terakhir tidak ada di ASIK
  assert.deepEqual(hasil.filter((h) => !h.ada).map((h) => h.baris), [19, 20, 21])
})

test('rekonsiliasi: angka persis Tabel L.1 (tidak_sesuai = 3)', async () => {
  const register = Array.from({ length: 20 }, (_, i) => balita(i))
  const asik = register.slice(0, 17).map((r) => ({ ...r, tgl_input: '2026-10-06' }))
  asik[0].bb += 0.5
  asik[1].bb += 0.5
  asik[2].tb += 1
  for (const i of [3, 4, 5, 6]) asik[i].tgl_input = '2026-10-15'

  const r = hitungRingkasan(await rekonsiliasi(register, asik))
  assert.equal(r.jml_tidak_sesuai, 3)
  assert.deepEqual(indikator(r), { kelengkapan: 85, kesesuaian: 82.35, ketepatan: 76.47 })
})

test('rekonsiliasi: NIK salah ketik tetap cocok lewat nama + tanggal lahir', async () => {
  const reg = { ...balita(0), nik: '3578010101209999', nama: 'nuraini putri' }
  const a = { ...balita(0), nama: 'nuraini putri', tgl_input: '2026-10-05' }
  const [h] = await rekonsiliasi([reg], [a])
  assert.equal(h.ada, true)
  assert.equal(h.cara, 'nama + tgl lahir')
})

test('rekonsiliasi: register tanpa NIK cocok dengan ASIK ber-NIK', async () => {
  const reg = { ...balita(0), nik: '' }
  const a = { ...balita(0), tgl_input: '2026-10-05' }
  const [h] = await rekonsiliasi([reg], [a])
  assert.equal(h.ada, true)
  assert.equal(h.cara, 'nama + tgl lahir')
})

test('rekonsiliasi: memilih kunjungan ASIK terdekat, tanggal berbeda terdeteksi', async () => {
  const reg = balita(0) // ukur 2026-10-05
  const sept = { ...balita(0), tgl_ukur: '2026-09-07', tgl_input: '2026-09-08' }
  const okt = { ...balita(0), tgl_ukur: '2026-10-06', tgl_input: '2026-10-07' }
  const [h] = await rekonsiliasi([reg], [sept, okt])
  assert.equal(h.tgl_ukur_asik, '2026-10-06')
  assert.equal(h.selisih_tanggal, true)
  assert.deepEqual(h.masalah, ['Tanggal ukur berbeda'])
})

test('rekonsiliasi: kunjungan ASIK lebih dari 31 hari dianggap tidak ada', async () => {
  const reg = balita(0)
  const lama = { ...balita(0), tgl_ukur: '2026-08-01', tgl_input: '2026-08-01' }
  const [h] = await rekonsiliasi([reg], [lama])
  assert.equal(h.ada, false)
})

test('ringkasan tidak memuat data per balita', async () => {
  const r = hitungRingkasan(await rekonsiliasi([balita(0)], []))
  for (const v of Object.values(r)) assert.equal(typeof v, 'number')
})
