# SELARAS

SELARAS adalah aplikasi web untuk mengaudit kualitas data pertumbuhan balita. Aplikasi ini membandingkan catatan di **buku register posyandu** dengan data yang sudah diinput ke **ASIK** (Aplikasi Sehat IndonesiaKu), lalu menunjukkan seberapa lengkap, sesuai, dan tepat waktu data tersebut.

Aplikasi ini ditujukan bagi petugas gizi puskesmas yang perlu memeriksa secara berkala apakah hasil penimbangan di posyandu sudah masuk ke sistem dengan benar.

## Apa yang dilakukan

Petugas menyiapkan dua file Excel atau CSV untuk satu posyandu dan satu bulan:

1. **Rekap buku register**: daftar balita yang ditimbang, disalin dari buku register posyandu.
2. **Ekspor ASIK**: data balita yang sama, diunduh dari ASIK.

SELARAS mencocokkan keduanya balita demi balita dan menghitung tiga indikator:

| Indikator | Pertanyaan yang dijawab |
|---|---|
| **Kelengkapan** | Apakah semua balita di buku register sudah ada di ASIK? |
| **Kesesuaian** | Apakah tanggal ukur, berat badan, dan panjang/tinggi badan di ASIK sama dengan di buku register? |
| **Ketepatan waktu** | Apakah data diinput paling lambat 7 hari setelah hari posyandu? |

Hasilnya berupa daftar balita yang datanya bermasalah (bisa diunduh sebagai Excel untuk diperbaiki di ASIK) dan angka ringkasan yang disimpan untuk melihat tren dari bulan ke bulan.

## Fitur

- **Audit baru**: alur enam langkah, dari memilih posyandu sampai menyimpan ringkasan. Nama kolom di file tidak harus baku; aplikasi menebaknya dan petugas bisa membetulkan.
- **Dashboard**: tren tiga indikator per posyandu dan rekap seluruh posyandu per bulan.
- **Riwayat**: semua audit yang pernah disimpan, dengan pencarian dan filter.
- **Posyandu**: daftar posyandu di wilayah puskesmas.
- **Administrasi** (khusus admin): kelola puskesmas, posyandu, dan akun petugas.

## Privasi data

Data balita adalah data pribadi anak, jadi SELARAS dirancang supaya data itu **tidak pernah meninggalkan komputer petugas**:

- Kedua file dibaca dan dicocokkan di dalam browser. Isinya tidak diunggah ke server.
- Server hanya menerima dan menyimpan **angka ringkasan** per posyandu per bulan (misalnya "20 balita sampel, 17 ada di ASIK") dan catatan singkat.
- Basis data tidak punya tabel atau kolom per balita: tidak ada nama, NIK, tanggal lahir, berat, maupun tinggi badan.

```
Browser petugas                                   Server
┌──────────────────────────────────────┐          ┌─────────────────────────────┐
│ file register + ekspor ASIK          │          │ Go (Fiber)  ─── MySQL 8     │
│   → dibaca dan dicocokkan di sini    │  HTTPS   │  /api/*  hanya angka        │
│   → daftar masalah                   │ ───────▶ │  /       frontend           │
│     (diunduh sebagai Excel)          │  angka   │                             │
│   → ringkasan angka ─────────────────┼──────────┤  audit_run (agregat)        │
└──────────────────────────────────────┘  saja    └─────────────────────────────┘
```

## Menjalankan dengan Docker

Cara termudah untuk memasang SELARAS di server sendiri. Yang dibutuhkan hanya Docker Engine dan plugin Compose.

```bash
git clone https://github.com/AzzazinFaruq/selaras.git && cd selaras
cp .env.example .env && chmod 600 .env   # isi DB_PASSWORD, DB_ROOT_PASSWORD, JWT_SECRET
docker compose up -d --build
docker compose ps                        # tunggu sampai app berstatus "healthy"
```

Tidak ada pendaftaran publik, jadi akun pertama dibuat lewat perintah di server:

```bash
docker compose exec app /app/selaras puskesmas-baru "Puskesmas Contoh" "Kota Contoh"        # catat id-nya
docker compose exec app /app/selaras petugas-baru nama@contoh.id "Nama Petugas" <id-puskesmas>   # catat password
docker compose exec app /app/selaras jadikan-admin nama@contoh.id
```

Setelah satu akun menjadi admin, puskesmas, posyandu, dan akun petugas berikutnya bisa dikelola dari menu **Administrasi** di web.

### Akses dan HTTPS

Secara bawaan aplikasi hanya bisa dijangkau di `http://127.0.0.1:8080` dari server itu sendiri, dan cookie login hanya dikirim lewat HTTPS. Untuk diakses dari luar, pasang reverse proxy ber-HTTPS di depannya (misalnya Caddy, Nginx, atau Cloudflare Tunnel) yang diarahkan ke `http://127.0.0.1:8080`.

- Bila proxy meneruskan alamat IP pengunjung lewat header, isi nama headernya di `PROXY_HEADER` (contoh: `CF-Connecting-IP` untuk Cloudflare). Ini hanya aman selama port aplikasi tidak bisa dijangkau langsung dari luar.
- Untuk sekadar mencoba lewat `http://` di jaringan lokal, isi `APP_ENV=development` dan `APP_BIND=0.0.0.0:8080`. Jangan dipakai untuk data sungguhan.

### Perawatan

```bash
git pull && docker compose up -d --build     # memperbarui ke versi terbaru
docker compose logs -f app                   # melihat log
docker compose exec -T db sh -c 'mysqldump --single-transaction -uroot -p"$MYSQL_ROOT_PASSWORD" selaras' > selaras-$(date +%F).sql   # backup
```

Data MySQL tersimpan di volume `selaras_db-data`. `docker compose down` aman; `docker compose down -v` **menghapus seluruh data**. Password di `.env` hanya dipakai saat basis data pertama kali dibuat, jadi mengubahnya belakangan tidak mengubah password di MySQL.

## Perintah admin

Dijalankan di server. Dengan Docker, awali dengan `docker compose exec app /app/selaras`; tanpa Docker, jalankan binary `selaras` dari folder yang berisi `.env`.

```bash
selaras puskesmas-baru "<nama>" "<kota>"
selaras petugas-baru <email> "<nama>" <puskesmas_id>   # mencetak password awal satu kali
selaras reset-password <email>                         # password baru, semua sesi diakhiri
selaras nonaktifkan <email>
selaras jadikan-admin <email>                          # boleh membuka menu Administrasi
selaras cabut-admin <email>
selaras daftar                                         # daftar puskesmas dan petugas
```

## Pengembangan

Butuh Go 1.25+, Node 20.19+, dan **MySQL 8.0.17+**. MariaDB tidak didukung karena perilaku CHECK constraint, generated column, dan `CAST AS DOUBLE`-nya berbeda.

```bash
# 1. Basis data (lewat klien MySQL apa pun)
CREATE DATABASE selaras CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'selaras'@'127.0.0.1' IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES ON selaras.* TO 'selaras'@'127.0.0.1';

# 2. Backend
cd backend
cp .env.example .env             # isi DB_PASSWORD dan JWT_SECRET (openssl rand -hex 32)
go run . puskesmas-baru "Puskesmas Contoh" "Kota Contoh"          # catat id-nya
go run . petugas-baru nama@contoh.id "Nama Petugas" <id-puskesmas>   # catat password
go run .                         # API di http://127.0.0.1:8080

# 3. Frontend (terminal lain)
cd frontend
npm install
npm run dev                      # http://localhost:5173, /api diteruskan ke backend
```

Tabel dibuat otomatis saat backend pertama kali dijalankan.

### Mencoba dengan data tiruan

```bash
cd frontend
npm run data-tiruan -- 2026-10 20
# -> data-tiruan/register-2026-10.xlsx dan asik-2026-10.xlsx, plus angka yang seharusnya keluar
```

Lalu di aplikasi: tambah posyandu, buka **Audit baru**, pilih periode yang sama, dan buka kedua file. Semua nama dan NIK di file tiruan bersifat fiktif.

### Uji

```bash
cd frontend && npm test          # logika pencocokan data

cd backend
# Uji integrasi API dan skema. PERINGATAN: tabel SELARAS di basis data ini DIHAPUS,
# jadi nama basis datanya wajib mengandung kata "test".
TEST_DB_NAME=selaras_test DB_USER=selaras DB_PASSWORD=... go test ./...
```

Uji integrasi mencakup isolasi antar puskesmas, panel admin, cookie, pembatalan sesi, batas ukuran permintaan, pembatasan percobaan login, dan seluruh CHECK constraint.

### Dokumentasi API

Dokumentasi API berupa koleksi Postman di `postman/collections/SELARAS API/` (butuh Postman desktop v12+), yang sekaligus berfungsi sebagai uji: 23 permintaan dengan penjelasan, contoh respons, dan pemeriksaan otomatis.

1. Jalankan backend dengan `APP_ENV=development`, lalu impor `backend/data_dummy.sql`. **File ini mengosongkan semua tabel sebelum mengisi data contoh**, jadi hanya untuk basis data pengembangan. Akun contohnya tertulis di dalam file itu.
2. Di Postman, buka folder proyek ini, pilih environment **SELARAS Lokal**, lalu jalankan koleksinya.

Atau lewat terminal dengan [Postman CLI](https://learning.postman.com/docs/postman-cli/postman-cli-overview/):

```bash
postman collection run "postman/collections/SELARAS API" -e postman/environments/selaras-lokal.environment.yaml
```

## Struktur proyek

```
backend/                 Go, Fiber v2, bun (MySQL), golang-jwt, bcrypt
  main.go                server, atau perintah admin bila ada argumen
  Controllers/           auth, posyandu, audit, admin
  Routes/                daftar route + uji integrasi
  Setup/                 koneksi basis data, skema.sql (dijalankan otomatis), perintah admin
  middleware/            header keamanan, autentikasi
frontend/                React (Vite), Tailwind v4, zustand, Recharts, SheetJS
  src/lib/rekonsiliasi.js  logika pencocokan data (murni, punya uji sendiri)
  src/lib/excel.js       baca/tulis Excel di browser
  src/pages/             Login, Dashboard, AuditBaru, Riwayat, Posyandu, Akun, Admin
  scripts/data-tiruan.mjs  pembuat data tiruan berisi kesalahan yang disengaja
postman/                 koleksi dokumentasi dan uji API
Dockerfile, docker-compose.yml
```

## Keamanan

| Hal | Cara |
|---|---|
| Data balita | Tidak pernah dikirim ke server. Ukuran permintaan API dibatasi 16 KB; skema hanya punya kolom angka dan catatan ≤ 200 karakter. |
| Sesi login | Token di cookie `HttpOnly; Secure; SameSite=Strict`, tidak pernah ada di badan respons maupun `localStorage`. |
| Akun | Tidak ada pendaftaran publik. Akun dibuat admin; admin pertama hanya bisa ditunjuk lewat perintah di server. |
| Panel admin | Hanya untuk akun berperan admin, dan peran diperiksa di setiap permintaan. Audit hanya bisa dilihat dan dihapus, tidak bisa diubah. |
| Isolasi antar puskesmas | Petugas hanya bisa melihat dan mengubah data puskesmasnya sendiri; pembatasnya diambil dari sesi, bukan dari input. |
| Pencabutan sesi | Logout, ganti password, reset password, atau penonaktifan akun langsung membatalkan semua sesi lama. |
| CSRF | Cookie `SameSite=Strict` dan permintaan tulis wajib `application/json`. Frontend dan API berada di satu origin, tanpa CORS. |
| Tebak password | Login dibatasi 10 kali per 15 menit per alamat IP; password disimpan dengan bcrypt. |
| Header | CSP ketat, `X-Frame-Options: DENY`, HSTS, dan `no-store` untuk API. |
| Integritas angka | CHECK constraint di basis data menolak angka yang tidak konsisten; persentase dihitung oleh basis data. |
| Rahasia | `JWT_SECRET` dan kredensial basis data wajib diisi; server menolak berjalan bila kosong. |

## Batasan

- Hanya sheet pertama yang dibaca, dan baris pertama harus berisi nama kolom.
- Tanggal berbentuk teks dibaca sebagai `HH/BB/TTTT` atau `TTTT-BB-HH`. Format bulan-dulu (gaya Amerika) akan salah baca.
- Balita dicocokkan lewat NIK; bila NIK tidak ada, lewat nama dan tanggal lahir. Pencocokan nama harus persis setelah dirapikan: "M. Rizky" dan "Muhammad Rizky" dianggap dua anak berbeda.
- Berat dan tinggi badan dianggap sama bila sama setelah dibulatkan ke 0,1.
- Ketepatan waktu dihitung dari tanggal ukur di buku register sampai tanggal input di ASIK.
- Simpan NIK sebagai teks di Excel; angka 16 digit bisa terpotong bila disimpan sebagai angka.

## Memasang tanpa Docker

SELARAS berupa satu binary Go yang juga menyajikan frontend, jadi bisa dijalankan langsung di server Linux dengan MySQL yang sudah ada.

```bash
cd frontend && npm ci && npm run build
cd ../backend && GOOS=linux GOARCH=amd64 go build -o selaras .
# Salin ke server: backend/selaras, backend/.env, dan frontend/dist
```

Isi `.env` di server (contoh bila semuanya ditaruh di `/opt/selaras`):

```
APP_ADDR=127.0.0.1:8080
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=selaras
DB_PASSWORD=<password user MySQL>
DB_NAME=selaras
JWT_SECRET=<openssl rand -hex 32>
STATIC_DIR=/opt/selaras/dist
PROXY_HEADER=
```

Biarkan `APP_ENV` kosong supaya cookie `Secure` dan HSTS aktif, lalu jalankan binary itu sebagai layanan (misalnya dengan systemd) di belakang reverse proxy ber-HTTPS.

Saat memindahkan basis data, pakai `mysqldump`, atau biarkan aplikasi membuat tabelnya lalu impor datanya saja. Sumber skema yang benar adalah `backend/Setup/skema.sql`; skema hasil ekspor alat lain bisa kehilangan CHECK constraint, dan aplikasi tidak menambahkannya kembali pada tabel yang sudah ada.
