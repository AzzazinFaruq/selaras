-- =====================================================================
-- SELARAS · Migrasi 1: skema basis data, constraint, RLS, trigger, view
-- Sumber : "Skema Basis Data SELARAS" v1.0 (30 Okt 2026)
-- Target : Supabase / PostgreSQL 15+
--
-- Prinsip yang ditegakkan di sini (bukan di kode klien):
--   * Hanya angka agregat per posyandu per periode. Tidak ada kolom/tabel
--     per balita, tidak ada hash identitas.
--   * Petugas hanya melihat data puskesmasnya sendiri (RLS).
--   * Persentase dihitung basis data (generated column).
--   * audit_run tidak bisa di-update; salah input -> hapus (<24 jam) lalu ulang.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. TABEL
-- ---------------------------------------------------------------------

-- Master puskesmas. Diisi admin lewat Supabase Studio / service role.
create table public.puskesmas (
  id          uuid        primary key default gen_random_uuid(),
  nama        text        not null,
  kota        text        not null,
  dibuat_pada timestamptz not null default now()
);

-- Posyandu balita di wilayah kerja satu puskesmas.
create table public.posyandu (
  id           uuid        primary key default gen_random_uuid(),
  puskesmas_id uuid        not null references public.puskesmas (id) on delete restrict,
  nama         text        not null,
  kelurahan    text,
  dibuat_pada  timestamptz not null default now(),
  -- nama boleh sama di puskesmas berbeda, tidak boleh kembar dalam satu puskesmas
  constraint posyandu_nama_unik unique (puskesmas_id, nama)
);

-- Profil petugas gizi. Satu baris per akun login (auth.users milik Supabase).
create table public.petugas (
  id           uuid        primary key references auth.users (id) on delete cascade,
  puskesmas_id uuid        not null references public.puskesmas (id) on delete restrict,
  nama         text        not null,
  email        text        not null unique,
  dibuat_pada  timestamptz not null default now()
);
create index petugas_puskesmas_id_idx on public.petugas (puskesmas_id);

-- Satu baris per audit. HANYA angka agregat.
create table public.audit_run (
  id                    uuid        primary key default gen_random_uuid(),
  posyandu_id           uuid        not null references public.posyandu (id) on delete restrict,
  -- diisi auth.uid() saat insert; klien tidak diberi hak menulis kolom ini
  petugas_id            uuid        not null default auth.uid()
                                    references public.petugas (id) on delete restrict,
  periode               date        not null,
  jumlah_sampel         int         not null,
  jumlah_tercatat_asik  int         not null,
  jml_tidak_ada_di_asik int         not null,
  jml_tidak_sesuai      int         not null,
  jml_selisih_tanggal   int         not null,
  jml_selisih_bb        int         not null,
  jml_selisih_tb        int         not null,
  jml_terlambat         int         not null,

  -- Dihitung basis data. nullif() menjaga agar pembagi nol menghasilkan NULL
  -- (dan constraint di bawah yang menolak barisnya), bukan error pembagian nol.
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

  -- Rentang dasar
  constraint audit_periode_tanggal_1    check (extract(day from periode) = 1),
  constraint audit_sampel_positif       check (jumlah_sampel > 0),
  constraint audit_angka_tidak_negatif  check (
        jumlah_tercatat_asik  >= 0 and jml_tidak_ada_di_asik >= 0
    and jml_tidak_sesuai      >= 0 and jml_selisih_tanggal   >= 0
    and jml_selisih_bb        >= 0 and jml_selisih_tb        >= 0
    and jml_terlambat         >= 0),

  -- Konsistensi antar-angka
  constraint audit_sampel_terbagi       check (jumlah_tercatat_asik + jml_tidak_ada_di_asik = jumlah_sampel),
  constraint audit_tidak_sesuai_le_tercatat check (jml_tidak_sesuai <= jumlah_tercatat_asik),
  constraint audit_terlambat_le_tercatat    check (jml_terlambat    <= jumlah_tercatat_asik),
  -- Rincian boleh tumpang tindih (satu balita bisa selisih BB dan TB), maka:
  --   terbesar dari rincian <= jml_tidak_sesuai <= jumlah seluruh rincian
  constraint audit_rincian_selisih      check (
        greatest(jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb) <= jml_tidak_sesuai
    and jml_tidak_sesuai <= jml_selisih_tanggal + jml_selisih_bb + jml_selisih_tb),

  -- Catatan bebas adalah satu-satunya kolom teks; dibatasi agar tidak bisa
  -- dipakai menampung daftar balita.
  constraint audit_catatan_pendek       check (catatan is null or char_length(catatan) <= 200)
);

-- Dashboard: baris terbaru per periode per posyandu.
create index audit_run_posyandu_periode_idx
  on public.audit_run (posyandu_id, periode desc, dibuat_pada desc);

comment on table public.audit_run is
  'Hasil audit agregat per posyandu per periode. Dilarang menyimpan data per balita.';
comment on column public.audit_run.catatan is
  'Catatan bebas (maks 200 karakter). Tidak boleh berisi nama/NIK balita.';

-- ---------------------------------------------------------------------
-- 2. FUNGSI BANTU
-- ---------------------------------------------------------------------

-- Puskesmas milik pengguna yang sedang login. SECURITY DEFINER agar membaca
-- petugas tidak memicu rekursi RLS; mengembalikan NULL bila bukan petugas.
create or replace function public.puskesmas_saya()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.puskesmas_id
  from public.petugas p
  where p.id = (select auth.uid())
$$;

revoke all on function public.puskesmas_saya() from public, anon;
grant execute on function public.puskesmas_saya() to authenticated;

-- ---------------------------------------------------------------------
-- 3. TRIGGER PENDAFTARAN: auth.users -> petugas
-- ---------------------------------------------------------------------
-- Admin membuat user lewat Supabase Auth dengan metadata:
--   { "nama": "...", "puskesmas_id": "<uuid puskesmas>" }
-- Tanpa puskesmas_id yang valid, pembuatan akun ditolak (rollback).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teks         text := new.raw_user_meta_data ->> 'puskesmas_id';
  v_puskesmas_id uuid;
  v_nama         text := nullif(btrim(new.raw_user_meta_data ->> 'nama'), '');
begin
  if v_teks is null then
    raise exception 'Pendaftaran ditolak: metadata puskesmas_id tidak ada.';
  end if;

  begin
    v_puskesmas_id := v_teks::uuid;
  exception when invalid_text_representation then
    raise exception 'Pendaftaran ditolak: puskesmas_id bukan UUID yang valid.';
  end;

  -- FK ke puskesmas menolak id yang tidak terdaftar (23503).
  insert into public.petugas (id, puskesmas_id, nama, email)
  values (
    new.id,
    v_puskesmas_id,
    coalesce(v_nama, split_part(new.email, '@', 1)),
    new.email
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. HAK AKSES TINGKAT TABEL / KOLOM
--    (lapisan pertama; RLS di bagian 5 adalah lapisan kedua)
-- ---------------------------------------------------------------------
-- Supabase memberi hak penuh ke anon/authenticated secara default; cabut dulu.
revoke all on public.puskesmas, public.posyandu, public.petugas, public.audit_run
  from anon, authenticated;

-- puskesmas: baca saja
grant select on public.puskesmas to authenticated;

-- posyandu: baca, tambah, ubah (tanpa hapus). puskesmas_id tidak bisa diubah.
grant select on public.posyandu to authenticated;
grant insert (puskesmas_id, nama, kelurahan) on public.posyandu to authenticated;
grant update (nama, kelurahan)               on public.posyandu to authenticated;

-- petugas: baca; ubah nama sendiri. Baris dibuat trigger, bukan klien.
grant select on public.petugas to authenticated;
grant update (nama) on public.petugas to authenticated;

-- audit_run: baca, tambah, hapus. Tanpa update. id, petugas_id, dibuat_pada,
-- dan tiga kolom persen tidak bisa diisi klien (default / generated).
grant select on public.audit_run to authenticated;
grant insert (
  posyandu_id, periode, jumlah_sampel, jumlah_tercatat_asik,
  jml_tidak_ada_di_asik, jml_tidak_sesuai, jml_selisih_tanggal,
  jml_selisih_bb, jml_selisih_tb, jml_terlambat, catatan
) on public.audit_run to authenticated;
grant delete on public.audit_run to authenticated;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
--    Tidak ada kebijakan untuk anon -> anon tidak bisa apa-apa.
-- ---------------------------------------------------------------------
alter table public.puskesmas enable row level security;
alter table public.posyandu  enable row level security;
alter table public.petugas   enable row level security;
alter table public.audit_run enable row level security;

-- puskesmas ---------------------------------------------------------
create policy puskesmas_select on public.puskesmas
  for select to authenticated
  using (id = (select public.puskesmas_saya()));

-- posyandu ----------------------------------------------------------
create policy posyandu_select on public.posyandu
  for select to authenticated
  using (puskesmas_id = (select public.puskesmas_saya()));

create policy posyandu_insert on public.posyandu
  for insert to authenticated
  with check (puskesmas_id = (select public.puskesmas_saya()));

create policy posyandu_update on public.posyandu
  for update to authenticated
  using      (puskesmas_id = (select public.puskesmas_saya()))
  with check (puskesmas_id = (select public.puskesmas_saya()));

-- petugas -----------------------------------------------------------
create policy petugas_select on public.petugas
  for select to authenticated
  using (puskesmas_id = (select public.puskesmas_saya()));

create policy petugas_update_diri on public.petugas
  for update to authenticated
  using      (id = (select auth.uid()))
  with check (id = (select auth.uid())
              and puskesmas_id = (select public.puskesmas_saya()));

-- audit_run ---------------------------------------------------------
create policy audit_select on public.audit_run
  for select to authenticated
  using (posyandu_id in (
    select s.id from public.posyandu s
    where s.puskesmas_id = (select public.puskesmas_saya())));

create policy audit_insert on public.audit_run
  for insert to authenticated
  with check (
    petugas_id = (select auth.uid())
    and posyandu_id in (
      select s.id from public.posyandu s
      where s.puskesmas_id = (select public.puskesmas_saya())));

-- Hapus: hanya baris buatan sendiri, dalam 24 jam sejak dibuat.
create policy audit_delete on public.audit_run
  for delete to authenticated
  using (
    petugas_id = (select auth.uid())
    and dibuat_pada > now() - interval '24 hours'
    and posyandu_id in (
      select s.id from public.posyandu s
      where s.puskesmas_id = (select public.puskesmas_saya())));

-- ---------------------------------------------------------------------
-- 6. VIEW untuk dashboard
--    security_invoker = true -> RLS tabel dasar tetap berlaku.
--    Satu baris per (posyandu, periode): audit terbaru.
-- ---------------------------------------------------------------------
-- Urutan kolom mengikuti dokumen (bagian 07); kolom setelah dibuat_pada
-- adalah tambahan (kelurahan, rincian lain, id audit) yang tidak ada di dokumen.
create view public.v_tren_kualitas
with (security_invoker = true) as
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
  -- tambahan
  s.kelurahan,
  a.jumlah_tercatat_asik,
  a.jml_tidak_sesuai,
  a.id              as audit_run_id
from public.audit_run a
join public.posyandu  s  on s.id  = a.posyandu_id
join public.puskesmas pk on pk.id = s.puskesmas_id
order by a.posyandu_id, a.periode, a.dibuat_pada desc, a.id desc;

revoke all on public.v_tren_kualitas from anon, authenticated;
grant select on public.v_tren_kualitas to authenticated;

commit;
