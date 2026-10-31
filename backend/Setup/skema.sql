-- =====================================================================
-- SELARAS · skema basis data (PostgreSQL 13+)
-- Dijalankan otomatis setiap server start (Setup/migration.go) dan aman
-- dijalankan berulang kali (IF NOT EXISTS / OR REPLACE).
--
-- Prinsip:
--   * Hanya angka agregat per posyandu per periode. Tidak ada kolom atau
--     tabel per balita, tidak ada hash identitas.
--   * Isolasi antar puskesmas ditegakkan backend: setiap query memakai
--     puskesmas_id milik petugas yang login (pengganti RLS Supabase).
--   * Persentase dihitung basis data (generated column), bukan klien.
--   * Aplikasi tidak pernah meng-update audit_run. Salah input: hapus
--     (maks 24 jam, hanya pembuatnya) lalu audit ulang.
-- Catatan: jangan memakai tanda tanya di file ini; bun menganggapnya
-- placeholder.
-- =====================================================================

create table if not exists puskesmas (
  id          uuid        primary key default gen_random_uuid(),
  nama        text        not null,
  kota        text        not null,
  dibuat_pada timestamptz not null default now()
);

create table if not exists posyandu (
  id           uuid        primary key default gen_random_uuid(),
  puskesmas_id uuid        not null references puskesmas (id) on delete restrict,
  nama         text        not null,
  kelurahan    text,
  dibuat_pada  timestamptz not null default now(),
  -- nama boleh sama di puskesmas berbeda, tidak boleh kembar dalam satu puskesmas
  constraint posyandu_nama_unik unique (puskesmas_id, nama)
);

-- Akun petugas gizi. Dibuat admin lewat perintah CLI, tidak ada pendaftaran publik.
create table if not exists petugas (
  id            uuid        primary key default gen_random_uuid(),
  puskesmas_id  uuid        not null references puskesmas (id) on delete restrict,
  nama          text        not null,
  email         text        not null unique,
  password_hash text        not null,
  aktif         boolean     not null default true,
  -- Dinaikkan saat logout / ganti password / reset / nonaktif, sehingga
  -- semua token lama langsung tidak berlaku.
  token_versi   int         not null default 0,
  dibuat_pada   timestamptz not null default now(),
  constraint petugas_email_huruf_kecil check (email = lower(email))
);
create index if not exists petugas_puskesmas_id_idx on petugas (puskesmas_id);

-- Satu baris per audit. HANYA angka agregat.
create table if not exists audit_run (
  id                    uuid        primary key default gen_random_uuid(),
  posyandu_id           uuid        not null references posyandu (id) on delete restrict,
  petugas_id            uuid        not null references petugas (id) on delete restrict,
  periode               date        not null,
  jumlah_sampel         int         not null,
  jumlah_tercatat_asik  int         not null,
  jml_tidak_ada_di_asik int         not null,
  jml_tidak_sesuai      int         not null,
  jml_selisih_tanggal   int         not null,
  jml_selisih_bb        int         not null,
  jml_selisih_tb        int         not null,
  jml_terlambat         int         not null,

  -- nullif() membuat pembagi nol menghasilkan NULL, bukan error.
  persen_kelengkapan numeric(5,2) generated always as (
    round(jumlah_tercatat_asik::numeric * 100 / nullif(jumlah_sampel, 0), 2)
  ) stored,
  persen_kesesuaian  numeric(5,2) generated always as (
    round((jumlah_tercatat_asik - jml_tidak_sesuai)::numeric * 100
          / nullif(jumlah_tercatat_asik, 0), 2)
  ) stored,
  persen_ketepatan   numeric(5,2) generated always as (
    round((jumlah_tercatat_asik - jml_terlambat)::numeric * 100
          / nullif(jumlah_tercatat_asik, 0), 2)
  ) stored,

  catatan     text,
  dibuat_pada timestamptz not null default now(),

  constraint audit_periode_tanggal_1    check (extract(day from periode) = 1),
  constraint audit_sampel_positif       check (jumlah_sampel > 0),
  constraint audit_angka_tidak_negatif  check (
        jumlah_tercatat_asik  >= 0 and jml_tidak_ada_di_asik >= 0
    and jml_tidak_sesuai      >= 0 and jml_selisih_tanggal   >= 0
    and jml_selisih_bb        >= 0 and jml_selisih_tb        >= 0
    and jml_terlambat         >= 0),
  constraint audit_sampel_terbagi       check (jumlah_tercatat_asik + jml_tidak_ada_di_asik = jumlah_sampel),
  constraint audit_tidak_sesuai_le_tercatat check (jml_tidak_sesuai <= jumlah_tercatat_asik),
  constraint audit_terlambat_le_tercatat    check (jml_terlambat    <= jumlah_tercatat_asik),
  -- Satu balita bisa selisih BB dan TB sekaligus, maka:
  --   rincian terbesar <= jml_tidak_sesuai <= jumlah seluruh rincian
  constraint audit_rincian_selisih      check (
        greatest(jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb) <= jml_tidak_sesuai
    and jml_tidak_sesuai <= jml_selisih_tanggal + jml_selisih_bb + jml_selisih_tb),
  -- Satu-satunya kolom teks bebas; dibatasi agar tidak bisa menampung daftar balita.
  constraint audit_catatan_pendek       check (catatan is null or char_length(catatan) <= 200)
);

create index if not exists audit_run_posyandu_periode_idx
  on audit_run (posyandu_id, periode desc, dibuat_pada desc);

comment on table audit_run is
  'Hasil audit agregat per posyandu per periode. Dilarang menyimpan data per balita.';

-- Dashboard: satu baris per (posyandu, periode), yaitu audit terbaru.
-- View ini TIDAK memfilter puskesmas; query backend wajib menambah
-- "where puskesmas_id = ..." sendiri.
create or replace view v_tren_kualitas as
select distinct on (a.posyandu_id, a.periode)
  s.puskesmas_id,
  pk.nama           as puskesmas_nama,
  a.posyandu_id,
  s.nama            as posyandu_nama,
  a.periode,
  a.jumlah_sampel,
  a.persen_kelengkapan,
  a.persen_kesesuaian,
  a.persen_ketepatan,
  a.jml_tidak_ada_di_asik,
  a.jml_selisih_tanggal,
  a.jml_selisih_bb,
  a.jml_selisih_tb,
  a.jml_terlambat,
  a.dibuat_pada,
  s.kelurahan,
  a.jumlah_tercatat_asik,
  a.jml_tidak_sesuai,
  a.id              as audit_run_id
from audit_run a
join posyandu  s  on s.id  = a.posyandu_id
join puskesmas pk on pk.id = s.puskesmas_id
order by a.posyandu_id, a.periode, a.dibuat_pada desc, a.id desc;
