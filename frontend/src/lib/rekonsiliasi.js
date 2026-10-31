// =====================================================================
// Logika rekonsiliasi SELARAS: buku register (sumber) vs ekspor ASIK (sistem).
//
// Modul ini murni (tanpa React/SheetJS/jaringan) supaya bisa diuji dengan
// `npm test`. Semua data balita hanya ada di memori browser; yang dikirim ke
// server hanyalah hasil hitungRingkasan() (angka agregat).
// =====================================================================

export const BATAS_HARI_INPUT = 7 // Tabel 3.2: input <= 7 hari setelah hari buka posyandu
export const BATAS_HARI_COCOK = 31 // kunjungan ASIK lebih jauh dari ini dianggap kunjungan lain

export const KOLOM_REGISTER = [
  { kunci: 'nik', label: 'NIK', wajib: false },
  { kunci: 'nama', label: 'Nama balita', wajib: true },
  { kunci: 'tgl_lahir', label: 'Tanggal lahir', wajib: true },
  { kunci: 'tgl_ukur', label: 'Tanggal ukur', wajib: true },
  { kunci: 'bb', label: 'Berat badan (kg)', wajib: true },
  { kunci: 'tb', label: 'PB/TB (cm)', wajib: true },
]

export const KOLOM_ASIK = [
  ...KOLOM_REGISTER,
  { kunci: 'tgl_input', label: 'Tanggal input ke ASIK', wajib: true },
]

// Rentang wajar balita, untuk menangkap salah ketik saat menyalin buku register.
const RENTANG = { bb: [0.5, 40], tb: [30, 130] }

// ---------------------------------------------------------------------
// Pemetaan kolom otomatis (format ekspor ASIK belum pasti, jadi hanya tebakan;
// petugas tetap bisa mengubahnya di layar).
// ---------------------------------------------------------------------

export function normalisasiHeader(h) {
  return String(h ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// Urutan penting: tgl_input dicek sebelum tgl_ukur ("tgl input pengukuran").
const TEBAKAN = [
  ['nik', (h) => /\bnik\b/.test(h) && !/ibu|ayah|ortu|kk/.test(h)],
  ['nama', (h) => /\bnama\b/.test(h) && !/ibu|ayah|ortu|orang tua|posyandu|kader|petugas/.test(h)],
  ['tgl_lahir', (h) => /lahir/.test(h)],
  ['tgl_input', (h) => /input|entri|entry|dibuat|created/.test(h)],
  ['tgl_ukur', (h) => /ukur|timbang|kunjungan|periksa/.test(h)],
  ['bb', (h) => /berat|^bb\b/.test(h)],
  ['tb', (h) => /tinggi|panjang|^(pb|tb)\b/.test(h)],
]

export function tebakPemetaan(header, kolom) {
  const dipakai = new Set()
  const peta = {}
  for (const [kunci, cocok] of TEBAKAN) {
    if (!kolom.some((k) => k.kunci === kunci)) continue
    const h = header.find((x) => !dipakai.has(x) && cocok(normalisasiHeader(x)))
    if (h !== undefined) {
      peta[kunci] = h
      dipakai.add(h)
    }
  }
  return peta
}

// ---------------------------------------------------------------------
// Parsing nilai sel
// ---------------------------------------------------------------------

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function tanggalValid(y, m, d) {
  if (y < 1900 || y > 2100) return null
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  return ymd(y, m, d)
}

/**
 * Mengubah isi sel menjadi "YYYY-MM-DD" atau null.
 * Menerima nomor seri Excel, Date, "YYYY-MM-DD", dan "DD/MM/YYYY" (format Indonesia).
 * Jam di belakang tanggal (mis. tanggal input ASIK) diabaikan.
 */
export function parseTanggal(v) {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return tanggalValid(v.getFullYear(), v.getMonth() + 1, v.getDate())
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 1 || v > 73050) return null
    // 25569 = nomor seri Excel untuk 1970-01-01
    const t = new Date((Math.floor(v) - 25569) * 86400000)
    return tanggalValid(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
  }
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[\sT])/)
  if (m) return tanggalValid(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:$|\s)/)
  if (m) return tanggalValid(+m[3], +m[2], +m[1])
  return null
}

/** "12,5", "12.5 kg", 12.5 -> 12.5; selain itu null. */
export function parseAngka(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s*(kg|cm)$/, '')
    .replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  return parseFloat(s)
}

export function normalisasiNama(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['`’]/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

export function normalisasiNik(v) {
  return String(v ?? '').replace(/\D/g, '')
}

export function selisihHari(dari, ke) {
  return Math.round((Date.parse(ke) - Date.parse(dari)) / 86400000)
}

// ---------------------------------------------------------------------
// Membaca baris file menjadi data bersih + daftar galat
// ---------------------------------------------------------------------

function kosong(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

/**
 * @param rows   array objek dari SheetJS (kunci = header kolom)
 * @param peta   { nik: 'NIK', nama: 'Nama Balita', ... }
 * @param jenis  'register' | 'asik'
 * @returns { data, galat: [{ baris, pesan }] }
 *
 * Register (diketik ulang petugas) diperiksa ketat; galat harus diperbaiki.
 * ASIK: baris tanpa identitas/tanggal dilewati; BB/TB kosong tetap dipakai
 * dan nanti terhitung sebagai selisih.
 */
export function bacaBaris(rows, peta, jenis) {
  const data = []
  const galat = []
  const ambil = (row, k) => (peta[k] ? row[peta[k]] : undefined)

  rows.forEach((row, i) => {
    const baris = i + 2 // baris 1 = header di Excel
    const nilai = Object.values(peta).map((h) => row[h])
    if (nilai.every(kosong)) return // baris kosong di akhir file

    const pesan = []
    let nik = normalisasiNik(ambil(row, 'nik'))
    if (nik && nik.length !== 16) {
      if (jenis === 'register') pesan.push('NIK harus 16 digit')
      nik = ''
    }

    const nama = normalisasiNama(ambil(row, 'nama'))
    if (!nama) pesan.push('nama kosong')

    const tgl_lahir = parseTanggal(ambil(row, 'tgl_lahir'))
    if (!tgl_lahir) pesan.push('tanggal lahir tidak terbaca')

    const tgl_ukur = parseTanggal(ambil(row, 'tgl_ukur'))
    if (!tgl_ukur) pesan.push('tanggal ukur tidak terbaca')
    if (tgl_lahir && tgl_ukur && tgl_ukur < tgl_lahir) pesan.push('tanggal ukur sebelum tanggal lahir')

    const bb = parseAngka(ambil(row, 'bb'))
    const tb = parseAngka(ambil(row, 'tb'))
    let tgl_input = null

    if (jenis === 'register') {
      if (bb === null || bb < RENTANG.bb[0] || bb > RENTANG.bb[1]) pesan.push(`BB tidak wajar (${RENTANG.bb.join('–')} kg)`)
      if (tb === null || tb < RENTANG.tb[0] || tb > RENTANG.tb[1]) pesan.push(`PB/TB tidak wajar (${RENTANG.tb.join('–')} cm)`)
    } else {
      tgl_input = parseTanggal(ambil(row, 'tgl_input'))
      if (!tgl_input) pesan.push('tanggal input tidak terbaca')
    }

    if (pesan.length) {
      galat.push({ baris, pesan: pesan.join('; ') })
      return
    }

    data.push({
      baris,
      nik,
      nama,
      tgl_lahir,
      tgl_ukur,
      bb,
      tb,
      tgl_input,
      // nilai asli untuk ditampilkan di layar & file Excel masalah
      nik_asli: String(ambil(row, 'nik') ?? '').trim(),
      nama_asli: String(ambil(row, 'nama') ?? '').trim(),
    })
  })

  return { data, galat }
}

// ---------------------------------------------------------------------
// Sampel per periode
// ---------------------------------------------------------------------

function kunciIdentitas(r) {
  return r.nik ? `nik:${r.nik}` : `nama:${r.nama}|${r.tgl_lahir}`
}

/**
 * Mengambil baris register yang tanggal ukurnya di periode (YYYY-MM).
 * Balita yang muncul dua kali di periode yang sama dianggap galat.
 */
export function siapkanSampel(register, periode) {
  const sampel = register.filter((r) => r.tgl_ukur.startsWith(periode))
  const galat = []
  const lihat = new Map()
  for (const r of sampel) {
    const k = kunciIdentitas(r)
    if (lihat.has(k)) galat.push({ baris: r.baris, pesan: `balita sama dengan baris ${lihat.get(k)} di periode ini` })
    else lihat.set(k, r.baris)
  }
  return { sampel, diluarPeriode: register.length - sampel.length, galat }
}

// ---------------------------------------------------------------------
// Hash identitas (Web Crypto, tersedia di browser dan Node 20+)
// ---------------------------------------------------------------------

async function sha256(teks) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

const hashNik = (nik) => sha256(`nik:${nik}`)
const hashNama = (nama, tglLahir) => sha256(`nama:${nama}|${tglLahir}`)

// ---------------------------------------------------------------------
// Rekonsiliasi
// ---------------------------------------------------------------------

const samaAngka = (a, b) => a !== null && b !== null && Math.round(a * 10) === Math.round(b * 10)

/**
 * Mencocokkan setiap balita sampel dengan ASIK.
 * Kunci: hash NIK bila ada; bila tidak ada atau tidak ketemu, hash nama
 * ternormalisasi + tanggal lahir. Dari kunjungan ASIK balita itu, dipilih
 * yang tanggal ukurnya paling dekat (maks BATAS_HARI_COCOK hari).
 */
export async function rekonsiliasi(sampel, asik) {
  const indeks = new Map()
  const tambah = (k, a) => {
    if (!indeks.has(k)) indeks.set(k, [])
    indeks.get(k).push(a)
  }
  for (const a of asik) {
    if (a.nik) tambah(await hashNik(a.nik), a)
    tambah(await hashNama(a.nama, a.tgl_lahir), a)
  }

  const hasil = []
  for (const r of sampel) {
    let cara = 'NIK'
    let kandidat = r.nik ? (indeks.get(await hashNik(r.nik)) ?? []) : []
    if (!kandidat.length) {
      cara = 'nama + tgl lahir'
      kandidat = indeks.get(await hashNama(r.nama, r.tgl_lahir)) ?? []
    }

    let a = null
    let jarak = Infinity
    for (const k of kandidat) {
      const d = Math.abs(selisihHari(r.tgl_ukur, k.tgl_ukur))
      if (d < jarak) {
        a = k
        jarak = d
      }
    }
    if (jarak > BATAS_HARI_COCOK) a = null

    const h = {
      baris: r.baris,
      nik: r.nik_asli,
      nama: r.nama_asli,
      tgl_lahir: r.tgl_lahir,
      tgl_ukur_buku: r.tgl_ukur,
      bb_buku: r.bb,
      tb_buku: r.tb,
      ada: !!a,
      cara: a ? cara : null,
      tgl_ukur_asik: a?.tgl_ukur ?? null,
      bb_asik: a?.bb ?? null,
      tb_asik: a?.tb ?? null,
      tgl_input: a?.tgl_input ?? null,
      hari_input: null,
      selisih_tanggal: false,
      selisih_bb: false,
      selisih_tb: false,
      terlambat: false,
      masalah: [],
    }

    if (!a) {
      h.masalah.push('Tidak ada di ASIK')
    } else {
      h.selisih_tanggal = a.tgl_ukur !== r.tgl_ukur
      h.selisih_bb = !samaAngka(a.bb, r.bb)
      h.selisih_tb = !samaAngka(a.tb, r.tb)
      // hari buka posyandu = tanggal ukur di buku register
      h.hari_input = selisihHari(r.tgl_ukur, a.tgl_input)
      h.terlambat = h.hari_input > BATAS_HARI_INPUT

      if (h.selisih_tanggal) h.masalah.push('Tanggal ukur berbeda')
      if (h.selisih_bb) h.masalah.push('BB berbeda')
      if (h.selisih_tb) h.masalah.push('PB/TB berbeda')
      if (h.terlambat) h.masalah.push(`Input terlambat ${h.hari_input} hari`)
    }
    hasil.push(h)
  }
  return hasil
}

/** Angka agregat yang dikirim ke server (tabel audit_run). Tidak ada data per balita. */
export function hitungRingkasan(hasil) {
  const ada = hasil.filter((h) => h.ada)
  const hitung = (f) => ada.filter(f).length
  return {
    jumlah_sampel: hasil.length,
    jumlah_tercatat_asik: ada.length,
    jml_tidak_ada_di_asik: hasil.length - ada.length,
    jml_tidak_sesuai: hitung((h) => h.selisih_tanggal || h.selisih_bb || h.selisih_tb),
    jml_selisih_tanggal: hitung((h) => h.selisih_tanggal),
    jml_selisih_bb: hitung((h) => h.selisih_bb),
    jml_selisih_tb: hitung((h) => h.selisih_tb),
    jml_terlambat: hitung((h) => h.terlambat),
  }
}

/** Sama dengan generated column di basis data: round(a*100/b, 2), null bila b = 0. */
export function persen(a, b) {
  return b ? Math.round((a * 10000) / b) / 100 : null
}

export function indikator(r) {
  return {
    kelengkapan: persen(r.jumlah_tercatat_asik, r.jumlah_sampel),
    kesesuaian: persen(r.jumlah_tercatat_asik - r.jml_tidak_sesuai, r.jumlah_tercatat_asik),
    ketepatan: persen(r.jumlah_tercatat_asik - r.jml_terlambat, r.jumlah_tercatat_asik),
  }
}
