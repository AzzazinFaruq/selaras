# SELARAS

Aplikasi web audit kualitas data pertumbuhan balita: membandingkan rekap buku register posyandu dengan ekspor ASIK, lalu menghitung kelengkapan, kesesuaian, dan ketepatan waktu.

**Prinsip utama:** file register dan ASIK hanya dibaca dan dicocokkan **di browser** petugas. Server hanya menerima dan menyimpan angka agregat per posyandu per bulan. Tidak ada tabel atau kolom per balita di basis data.

```
Browser petugas                                   Homeserver
┌──────────────────────────────────────┐          ┌─────────────────────────────┐
│ file register + ekspor ASIK          │          │ Go (Fiber)  ─── MySQL 8     │
│   → SheetJS → normalisasi → hash     │  HTTPS   │  /api/*  hanya angka        │
│   → rekonsiliasi → daftar masalah    │ ───────▶ │  /       frontend (dist)    │
│     (diunduh sebagai Excel)          │  angka   │                             │
│   → ringkasan angka ─────────────────┼──────────┤  audit_run (agregat)        │
└──────────────────────────────────────┘  saja    └─────────────────────────────┘
```

## Struktur

```
backend/                 Go 1.25, Fiber v2, bun (MySQL), golang-jwt, bcrypt
  main.go                server, atau perintah admin bila ada argumen
  Config/                baca .env
  Controllers/           auth, posyandu, audit
  Models/                model bun
  Routes/                daftar route + uji integrasi (routes_test.go)
  Setup/                 koneksi DB, skema.sql (dijalankan otomatis), perintah admin
  Utils/                 password (bcrypt), token (JWT)
  middleware/            header keamanan, auth
frontend/                React (Vite), Tailwind v4, react-router, axios, zustand, Recharts, SheetJS
  src/lib/rekonsiliasi.js  logika inti (murni, diuji dengan node --test)
  src/lib/excel.js       baca/tulis Excel di browser
  src/pages/             Login, Dashboard, AuditBaru, Riwayat, Posyandu, Akun
  scripts/data-tiruan.mjs  generator data tiruan berisi kesalahan yang disengaja
arsip-supabase/          skema & uji versi Supabase (tidak dipakai lagi)
```

## Keamanan (ringkas)

| Hal | Cara |
|---|---|
| Data balita | Tidak pernah dikirim ke server. Body API dibatasi 16 KB; skema hanya punya kolom angka + catatan ≤ 200 karakter. |
| Token login | JWT di cookie `HttpOnly; Secure; SameSite=Strict`. Tidak ada di body respons maupun localStorage. |
| Rahasia | `JWT_SECRET` (≥ 32 karakter), `DB_USER`, `DB_NAME` wajib. Server berhenti bila kosong; tidak ada nilai default. |
| Akun | Tidak ada pendaftaran publik. Admin membuat akun lewat CLI di server. |
| Isolasi puskesmas | Setiap query memakai `puskesmas_id` petugas dari sesi (pengganti RLS). `puskesmas_id`/`petugas_id` tidak pernah diambil dari input klien. |
| Cabut sesi | Kolom `token_versi`: logout, ganti password, reset, atau nonaktif langsung membatalkan semua token lama. |
| CSRF | Cookie SameSite=Strict + POST/PUT wajib `application/json`. Frontend satu origin dengan API, tanpa CORS. |
| Brute force | Login maks 10 kali per 15 menit per IP. bcrypt cost 12. Waktu respons sama untuk email yang ada/tidak. |
| Header | CSP ketat, X-Frame-Options DENY, HSTS (produksi), no-store untuk API. |
| Integritas angka | CHECK constraint di MySQL (koneksi memaksa mode ketat); persen dihitung basis data (generated column). Audit tidak bisa di-update, hanya dihapus pembuatnya ≤ 24 jam. |
| Akses database | User MySQL khusus aplikasi dengan hak hanya di satu database. Koneksi tanpa `multiStatements`. |

## Development

Butuh Go 1.25+, Node 20+, **MySQL 8.0.17+** (MySQL Laragon 8.0.30 sudah cukup). MariaDB tidak didukung karena perilaku CHECK, generated column, dan `CAST AS DOUBLE`-nya berbeda.

```bash
# 1. Database (di HeidiSQL / mysql -u root)
CREATE DATABASE selaras CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'selaras'@'127.0.0.1' IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES ON selaras.* TO 'selaras'@'127.0.0.1';

# 2. Backend
cd backend
cp .env.example .env             # isi DB_PASSWORD dan JWT_SECRET (openssl rand -hex 32)
go run . puskesmas-baru "Puskesmas Contoh" "Surabaya"     # catat id-nya
go run . petugas-baru saya@contoh.id "Nama Saya" <id-puskesmas>   # catat password
go run .                         # API di http://127.0.0.1:8080

# 3. Frontend (terminal lain)
cd frontend
npm install
npm run dev                      # http://localhost:5173, /api diteruskan ke backend
```

Coba dengan data tiruan:

```bash
cd frontend
npm run data-tiruan -- 2026-10 20
# -> data-tiruan/register-2026-10.xlsx dan asik-2026-10.xlsx, plus angka yang seharusnya keluar
```

Lalu di aplikasi: tambah posyandu → Audit baru → pilih periode Oktober 2026 → buka kedua file.

## Uji

```bash
cd frontend && npm test          # logika rekonsiliasi (15 uji)

cd backend
# Uji integrasi API + skema. PERINGATAN: tabel SELARAS di database ini DIHAPUS.
# Nama database wajib mengandung "test". DB_HOST/DB_PORT/DB_USER/DB_PASSWORD dari environment.
CREATE DATABASE selaras_test ...; GRANT ALL PRIVILEGES ON selaras_test.* TO 'selaras'@'127.0.0.1';
TEST_DB_NAME=selaras_test DB_USER=selaras DB_PASSWORD=... go test ./...
```

Uji integrasi mencakup isolasi antar puskesmas, cookie, pembatalan sesi, batas body, rate limit, semua CHECK constraint, dan angka Tabel L.1 (85% / 82,35% / 76,47%).

## Dokumentasi API (Postman)

Dokumentasi API ada di koleksi `postman/collections/SELARAS API/` (format Native Git v3, butuh Postman desktop v12+), sekaligus berfungsi sebagai test. Isinya 23 request dengan penjelasan, contoh respons, dan assertion.

1. Jalankan backend dengan `APP_ENV=development`, lalu impor `backend/data_dummy.sql`. **File ini mengosongkan keempat tabel sebelum mengisi data**, jadi hanya untuk database development. Akun: `admin@selarass.id` / `Admin@12345`; petugas lain memakai password `Petugas@123`.
2. Di Postman, buka folder proyek ini, pilih environment **SELARAS Lokal**, lalu jalankan koleksinya.

Atau lewat terminal dengan [Postman CLI](https://learning.postman.com/docs/postman-cli/postman-cli-overview/):

```bash
postman collection run "postman/collections/SELARAS API" -e postman/environments/selaras-lokal.environment.yaml
```

Setiap run menambah satu posyandu karena API tidak punya endpoint hapus posyandu. Impor ulang `data_dummy.sql` untuk membersihkannya.

## Perintah admin

Dijalankan di server, dari folder yang berisi `.env`:

```bash
./selaras puskesmas-baru "<nama>" "<kota>"
./selaras petugas-baru <email> "<nama>" <puskesmas_id>   # mencetak password awal sekali
./selaras reset-password <email>                         # password baru + keluarkan semua sesi
./selaras nonaktifkan <email>
./selaras daftar
```

## Deploy ke homeserver (Linux)

```bash
# Di laptop: build
cd frontend && npm ci && npm run build
cd ../backend && GOOS=linux GOARCH=amd64 go build -o selaras .

# Salin ke server: backend/selaras, backend/.env, frontend/dist  ->  /opt/selaras/
#   /opt/selaras/selaras
#   /opt/selaras/.env        (chmod 600)
#   /opt/selaras/dist/
```

`.env` produksi:

```
APP_ADDR=127.0.0.1:8080
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=selaras
DB_PASSWORD=<password user MySQL>
DB_NAME=selaras
JWT_SECRET=<openssl rand -hex 32>
STATIC_DIR=/opt/selaras/dist
PROXY_HEADER=CF-Connecting-IP
```

`APP_ENV` dibiarkan kosong agar cookie `Secure` dan HSTS aktif. Karena itu aplikasi harus diakses lewat HTTPS.

Service systemd, `/etc/systemd/system/selaras.service`:

```ini
[Unit]
Description=SELARAS
After=network.target mysql.service

[Service]
User=selaras
WorkingDirectory=/opt/selaras
ExecStart=/opt/selaras/selaras
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd --system --no-create-home selaras
sudo chown -R selaras: /opt/selaras && sudo chmod 600 /opt/selaras/.env
sudo systemctl enable --now selaras
```

**HTTPS:** server hanya mendengar di `127.0.0.1`, jadi tidak ada port yang dibuka ke internet. Akses dari luar lewat Cloudflare Tunnel (`cloudflared`) yang diarahkan ke `http://127.0.0.1:8080`. `PROXY_HEADER=CF-Connecting-IP` hanya aman selama port 8080 tidak bisa dijangkau langsung.

**Backup** (opsional, satu baris cron harian):

```
0 2 * * * mysqldump --single-transaction selaras > /var/backups/selaras-$(date +\%F).sql
```

**Memindahkan database:** pakai `mysqldump`, atau biarkan aplikasi membuat tabelnya lalu impor datanya saja. Jangan memakai skema dari ekspor phpMyAdmin: hasil ekspornya kehilangan 7 CHECK constraint `audit_run`, dan aplikasi tidak menambahkannya kembali pada tabel yang sudah ada. Sumber skema yang benar adalah `backend/Setup/skema.sql`.

## Perbedaan dari proposal (Tabel 3.1)

| Proposal | Implementasi |
|---|---|
| Supabase (PostgreSQL, magic link, RLS) | MySQL 8 di homeserver; login email + password; isolasi di backend Go |
| Vercel | Homeserver; frontend disajikan oleh binary Go yang sama |
| shadcn/ui, Zod | Tailwind biasa; validasi manual di `rekonsiliasi.js` |
| Web Worker | Tidak dipakai; sampel 15–20 balita (atau ratusan baris) selesai dalam milidetik |
| React (Vite), SheetJS, Web Crypto, Recharts | Sama |

## Batasan yang perlu diketahui

- Hanya sheet pertama yang dibaca, dan baris 1 harus header.
- Tanggal teks dibaca sebagai `HH/BB/TTTT` atau `TTTT-BB-HH`. Format bulan-dulu (AS) akan salah baca.
- Pencocokan nama bersifat persis setelah normalisasi. "M. Rizky" dan "Muhammad Rizky" dianggap berbeda; NIK mengatasi ini bila tercatat.
- BB/TB dianggap sama bila sama setelah dibulatkan ke 0,1.
- Ketepatan waktu dihitung dari tanggal ukur di buku register (hari buka posyandu) sampai tanggal input ASIK.
