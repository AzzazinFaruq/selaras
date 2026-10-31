-- Uji skema SELARAS. Jalankan dengan psql SETELAH migrasi (memakai meta-command \set/\echo,
-- jadi bukan untuk SQL Editor di dashboard Supabase). Pada PostgreSQL biasa (bukan Supabase)
-- dibutuhkan role anon/authenticated serta auth.users dan auth.uid() tiruan.
-- Seluruh data uji dibuat di dalam transaksi dan di-ROLLBACK di akhir.
-- Dijalankan sebagai superuser/pemilik; identitas petugas ditiru dengan
--   set_config('request.jwt.claim.sub', ...) + SET LOCAL ROLE authenticated.
\set ON_ERROR_STOP on
\set VERBOSITY terse
\pset pager off
set client_min_messages = notice;

begin;

-- ---------- pembantu uji ----------
create schema uji;
grant usage on schema uji to anon, authenticated;

create function uji.sama(aktual text, harapan text, label text) returns void
language plpgsql as $$
begin
  if aktual is distinct from harapan then
    raise exception 'GAGAL [%]: aktual=% harapan=%', label, aktual, harapan;
  end if;
  raise notice 'OK    %', label;
end $$;

create function uji.gagal(q text, harapan text, label text) returns void
language plpgsql as $$
declare kode text;
begin
  begin
    execute q;
  exception when others then
    kode := sqlstate;
  end;
  if kode is null then
    raise exception 'GAGAL [%]: seharusnya ditolak tetapi berhasil', label;
  end if;
  if kode <> harapan then
    raise exception 'GAGAL [%]: kode % (harapan %)', label, kode, harapan;
  end if;
  raise notice 'OK    % (ditolak %)', label, kode;
end $$;

create function uji.terdampak(q text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end $$;

-- pembangun payload audit untuk posyandu A1
create function uji.q_audit(periode text, s int, t int, x int, ts int, st int, sb int, sk int, l int)
returns text language sql as $$
  select format($f$insert into public.audit_run
    (posyandu_id, periode, jumlah_sampel, jumlah_tercatat_asik, jml_tidak_ada_di_asik,
     jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat)
    values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', %L, %s, %s, %s, %s, %s, %s, %s, %s)$f$,
    periode, s, t, x, ts, st, sb, sk, l)
$$;

grant execute on all functions in schema uji to anon, authenticated;

-- ---------- data awal (sebagai pemilik) ----------
insert into public.puskesmas (id, nama, kota) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Puskesmas A', 'Surabaya'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Puskesmas B', 'Surabaya');

insert into public.posyandu (id, puskesmas_id, nama) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Melati'),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Mawar'),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Melati');

\echo '== 1. Trigger pendaftaran =='
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a1@uji.id', '{"nama":"Petugas A1","puskesmas_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}'),
  ('22222222-2222-2222-2222-222222222222', 'a2@uji.id', '{"nama":"Petugas A2","puskesmas_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}'),
  ('33333333-3333-3333-3333-333333333333', 'b1@uji.id', '{"nama":"Petugas B1","puskesmas_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}');

select uji.sama((select count(*) from public.petugas)::text, '3', 'trigger membuat 3 baris petugas');
select uji.sama((select puskesmas_id::text from public.petugas where email = 'b1@uji.id'),
                'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'puskesmas_id disalin dari metadata');
select uji.gagal($q$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'x@uji.id', '{}')$q$,
                 'P0001', 'akun tanpa puskesmas_id ditolak');
select uji.gagal($q$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'x@uji.id', '{"puskesmas_id":"bukan-uuid"}')$q$,
                 'P0001', 'puskesmas_id bukan UUID ditolak');
select uji.gagal($q$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'x@uji.id', '{"puskesmas_id":"cccccccc-cccc-cccc-cccc-cccccccccccc"}')$q$,
                 '23503', 'puskesmas_id tidak terdaftar ditolak (FK)');
select uji.sama((select count(*) from auth.users)::text, '3', 'akun yang ditolak tidak tersisa di auth.users');

\echo '== 2. Insert audit + generated column (angka proposal Tabel L.1) =='
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.audit_run
  (posyandu_id, periode, jumlah_sampel, jumlah_tercatat_asik, jml_tidak_ada_di_asik,
   jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat, catatan)
values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2026-10-01', 20, 17, 3, 3, 0, 2, 1, 4, 'sampel 20 dari 63 balita');

select uji.sama((select persen_kelengkapan::text from public.audit_run), '85.00', 'kelengkapan 17/20 = 85,00');
select uji.sama((select persen_kesesuaian::text  from public.audit_run), '82.35', 'kesesuaian (17-3)/17 = 82,35');
select uji.sama((select persen_ketepatan::text   from public.audit_run), '76.47', 'ketepatan (17-4)/17 = 76,47');
select uji.sama((select petugas_id::text from public.audit_run), '11111111-1111-1111-1111-111111111111', 'petugas_id otomatis = auth.uid()');

\echo '== 3. Constraint =='
select uji.gagal(uji.q_audit('2026-10-15', 20,17,3, 3,0,2,1, 4), '23514', 'periode bukan tanggal 1');
select uji.gagal(uji.q_audit('2026-09-01', 0,0,0, 0,0,0,0, 0),   '23514', 'jumlah_sampel = 0');
select uji.gagal(uji.q_audit('2026-09-01', 20,17,2, 3,0,2,1, 4), '23514', 'tercatat + tidak ada <> sampel');
select uji.gagal(uji.q_audit('2026-09-01', 20,25,0, 0,0,0,0, 0), '23514', 'tercatat > sampel');
select uji.gagal(uji.q_audit('2026-09-01', 20,17,3, 18,18,0,0, 0), '23514', 'tidak_sesuai > tercatat');
select uji.gagal(uji.q_audit('2026-09-01', 20,17,3, 0,0,0,0, 18), '23514', 'terlambat > tercatat');
select uji.gagal(uji.q_audit('2026-09-01', 20,17,3, 1,0,2,0, 0),  '23514', 'rincian terbesar > tidak_sesuai');
select uji.gagal(uji.q_audit('2026-09-01', 20,17,3, 3,1,1,0, 0),  '23514', 'tidak_sesuai > jumlah rincian');
select uji.gagal(uji.q_audit('2026-09-01', 20,17,3, -1,0,0,0, 0), '23514', 'angka negatif');
select uji.gagal($q$insert into public.audit_run (posyandu_id, periode, jumlah_sampel, jumlah_tercatat_asik, jml_tidak_ada_di_asik, jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat, catatan)
                    values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1','2026-09-01',20,17,3,0,0,0,0,0, repeat('x', 201))$q$,
                 '23514', 'catatan > 200 karakter');
select uji.gagal($q$insert into public.audit_run (posyandu_id, periode, jumlah_sampel, jumlah_tercatat_asik, jml_tidak_ada_di_asik, jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat, persen_kelengkapan)
                    values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1','2026-09-01',20,17,3,0,0,0,0,0, 99)$q$,
                 '428C9', 'klien tidak boleh mengisi kolom persen (generated column)');
select uji.gagal($q$insert into public.audit_run (posyandu_id, periode, jumlah_sampel, jumlah_tercatat_asik, jml_tidak_ada_di_asik, jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat, petugas_id)
                    values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1','2026-09-01',20,17,3,0,0,0,0,0, '22222222-2222-2222-2222-222222222222')$q$,
                 '42501', 'klien tidak boleh memalsukan petugas_id');
select uji.gagal($q$insert into public.audit_run (posyandu_id, periode, jumlah_sampel, jumlah_tercatat_asik, jml_tidak_ada_di_asik, jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat, dibuat_pada)
                    values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1','2026-09-01',20,17,3,0,0,0,0,0, now() + interval '30 days')$q$,
                 '42501', 'klien tidak boleh memalsukan dibuat_pada');

-- kasus tepi: tidak ada balita ditemukan di ASIK
insert into public.audit_run
  (posyandu_id, periode, jumlah_sampel, jumlah_tercatat_asik, jml_tidak_ada_di_asik,
   jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat)
values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2026-08-01', 20, 0, 20, 0, 0, 0, 0, 0);
select uji.sama((select persen_kelengkapan::text from public.audit_run where periode = '2026-08-01'), '0.00', 'tercatat=0: kelengkapan 0,00');
select uji.sama((select coalesce(persen_kesesuaian::text, 'NULL') from public.audit_run where periode = '2026-08-01'), 'NULL', 'tercatat=0: kesesuaian NULL');
select uji.sama((select coalesce(persen_ketepatan::text, 'NULL')  from public.audit_run where periode = '2026-08-01'), 'NULL', 'tercatat=0: ketepatan NULL');
reset role;

\echo '== 4. Isolasi antar puskesmas (RLS) =='
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select uji.sama((select count(*) from public.puskesmas)::text, '1', 'A melihat 1 puskesmas');
select uji.sama((select nama from public.puskesmas), 'Puskesmas A', 'puskesmas yang terlihat = A');
select uji.sama((select count(*) from public.posyandu)::text, '2', 'A melihat 2 posyandu');
select uji.sama((select count(*) from public.petugas)::text, '2', 'A melihat 2 petugas (rekan satu puskesmas)');
select uji.sama((select count(*) from public.audit_run)::text, '2', 'A melihat 2 audit miliknya');
select uji.gagal($q$insert into public.audit_run (posyandu_id, periode, jumlah_sampel, jumlah_tercatat_asik, jml_tidak_ada_di_asik, jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat)
                    values ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1','2026-10-01',20,17,3,0,0,0,0,0)$q$,
                 '42501', 'A tidak bisa menulis audit ke posyandu B');
select uji.gagal($q$insert into public.posyandu (puskesmas_id, nama) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Baru')$q$,
                 '42501', 'A tidak bisa membuat posyandu di puskesmas B');
select uji.sama(uji.terdampak($q$update public.posyandu set nama = 'Diretas' where id = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1'$q$)::text,
                '0', 'A tidak bisa mengubah posyandu B (0 baris)');
reset role;

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select uji.sama((select count(*) from public.puskesmas)::text, '1', 'B melihat 1 puskesmas');
select uji.sama((select count(*) from public.posyandu)::text,  '1', 'B melihat 1 posyandu');
select uji.sama((select count(*) from public.petugas)::text,   '1', 'B melihat 1 petugas');
select uji.sama((select count(*) from public.audit_run)::text, '0', 'B tidak melihat audit milik A');
select uji.sama((select count(*) from public.v_tren_kualitas)::text, '0', 'B tidak melihat view tren milik A');
reset role;

select set_config('request.jwt.claim.sub', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);
set local role authenticated;
select uji.sama((select count(*) from public.posyandu)::text, '0', 'akun login tanpa baris petugas: 0 posyandu');
select uji.sama((select count(*) from public.audit_run)::text, '0', 'akun login tanpa baris petugas: 0 audit');
reset role;

\echo '== 5. Anonim =='
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select uji.gagal('select count(*) from public.puskesmas',        '42501', 'anon: puskesmas');
select uji.gagal('select count(*) from public.posyandu',         '42501', 'anon: posyandu');
select uji.gagal('select count(*) from public.petugas',          '42501', 'anon: petugas');
select uji.gagal('select count(*) from public.audit_run',        '42501', 'anon: audit_run');
select uji.gagal('select count(*) from public.v_tren_kualitas',  '42501', 'anon: v_tren_kualitas');
select uji.gagal('select public.puskesmas_saya()',               '42501', 'anon: puskesmas_saya()');
reset role;

\echo '== 6. Tabel master & petugas =='
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select uji.gagal($q$insert into public.puskesmas (nama, kota) values ('Liar', 'X')$q$,                      '42501', 'petugas tidak bisa insert puskesmas');
select uji.gagal($q$update public.puskesmas set nama = 'X'$q$,                                              '42501', 'petugas tidak bisa update puskesmas');
select uji.gagal($q$delete from public.puskesmas$q$,                                                        '42501', 'petugas tidak bisa delete puskesmas');
select uji.gagal($q$insert into public.petugas (id, puskesmas_id, nama, email) values (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Liar', 'l@uji.id')$q$,
                 '42501', 'petugas tidak bisa insert petugas (hanya lewat trigger)');
select uji.gagal($q$delete from public.petugas$q$,                                                          '42501', 'petugas tidak bisa delete petugas');
select uji.gagal($q$update public.petugas set puskesmas_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id = '11111111-1111-1111-1111-111111111111'$q$,
                 '42501', 'petugas tidak bisa pindah puskesmas sendiri (eskalasi)');
select uji.gagal($q$update public.petugas set email = 'lain@uji.id' where id = '11111111-1111-1111-1111-111111111111'$q$,
                 '42501', 'petugas tidak bisa ubah email');
select uji.sama(uji.terdampak($q$update public.petugas set nama = 'Nama Baru' where id = '11111111-1111-1111-1111-111111111111'$q$)::text,
                '1', 'petugas boleh ubah nama sendiri');
select uji.sama(uji.terdampak($q$update public.petugas set nama = 'Dibajak' where id = '22222222-2222-2222-2222-222222222222'$q$)::text,
                '0', 'petugas tidak bisa ubah nama rekan (0 baris)');
select uji.gagal($q$delete from public.posyandu$q$, '42501', 'petugas tidak bisa delete posyandu');
select uji.gagal($q$update public.posyandu set puskesmas_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'$q$,
                 '42501', 'petugas tidak bisa memindahkan posyandu');
select uji.gagal($q$insert into public.posyandu (puskesmas_id, nama) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Melati')$q$,
                 '23505', 'nama posyandu kembar dalam satu puskesmas ditolak');
select uji.sama(uji.terdampak($q$insert into public.posyandu (puskesmas_id, nama) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Anggrek')$q$)::text,
                '1', 'petugas boleh menambah posyandu di puskesmasnya');
reset role;
-- nama sama di puskesmas berbeda: B sudah punya "Melati" (lolos saat data awal)
select uji.sama((select count(*) from public.posyandu where nama = 'Melati')::text, '2', 'nama "Melati" boleh ada di dua puskesmas');

\echo '== 7. audit_run: tanpa update, hapus terbatas, view tren =='
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select uji.gagal($q$update public.audit_run set jumlah_sampel = 99$q$, '42501', 'audit_run tidak bisa di-update');
-- audit ulang periode yang sama = baris baru
insert into public.audit_run
  (posyandu_id, periode, jumlah_sampel, jumlah_tercatat_asik, jml_tidak_ada_di_asik,
   jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat)
values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '2026-10-01', 20, 18, 2, 1, 0, 1, 0, 2);
reset role;

-- audit pertama (17 tercatat) dianggap dibuat 2 jam lalu
update public.audit_run set dibuat_pada = now() - interval '2 hours'
 where periode = '2026-10-01' and jumlah_tercatat_asik = 17;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select uji.sama((select count(*) from public.audit_run where periode = '2026-10-01')::text, '2', 'audit ulang membuat baris baru (2 baris periode 2026-10)');
select uji.sama((select count(*) from public.v_tren_kualitas where periode = '2026-10-01')::text, '1', 'view: 1 baris per periode');
select uji.sama((select jumlah_tercatat_asik::text from public.v_tren_kualitas where periode = '2026-10-01'), '18', 'view: mengambil audit terbaru');
select uji.sama((select puskesmas_nama || '/' || posyandu_nama from public.v_tren_kualitas where periode = '2026-10-01'),
                'Puskesmas A/Melati', 'view: memuat puskesmas_nama dan posyandu_nama (sesuai dokumen bag. 07)');
select uji.sama((select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns
                  where table_schema = 'public' and table_name = 'v_tren_kualitas' and ordinal_position <= 15),
                'puskesmas_id,puskesmas_nama,posyandu_id,posyandu_nama,periode,jumlah_sampel,persen_kelengkapan,persen_kesesuaian,persen_ketepatan,jml_tidak_ada_di_asik,jml_selisih_tanggal,jml_selisih_bb,jml_selisih_tb,jml_terlambat,dibuat_pada',
                'view: 15 kolom pertama sesuai urutan dokumen');
reset role;

-- petugas A2 (rekan) tidak boleh menghapus audit milik A1
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select uji.sama(uji.terdampak($q$delete from public.audit_run where jumlah_tercatat_asik = 18$q$)::text, '0', 'rekan tidak bisa menghapus audit milik petugas lain');
reset role;

-- audit lama (> 24 jam) tidak bisa dihapus, pemiliknya sekalipun
update public.audit_run set dibuat_pada = now() - interval '30 hours'
 where periode = '2026-10-01' and jumlah_tercatat_asik = 17;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select uji.sama(uji.terdampak($q$delete from public.audit_run where jumlah_tercatat_asik = 17$q$)::text, '0', 'audit > 24 jam tidak bisa dihapus');
-- pemilik menghapus audit keliru yang baru dibuat -> view kembali ke audit sebelumnya
select uji.sama(uji.terdampak($q$delete from public.audit_run where jumlah_tercatat_asik = 18$q$)::text, '1', 'pemilik menghapus audit < 24 jam');
select uji.sama((select jumlah_tercatat_asik::text from public.v_tren_kualitas where periode = '2026-10-01'), '17', 'view kembali ke audit sebelumnya setelah penghapusan');
reset role;

\echo '== 8. Integritas referensial =='
select uji.gagal($q$delete from public.puskesmas where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$q$, '23503', 'puskesmas yang punya posyandu tidak bisa dihapus (RESTRICT)');
select uji.gagal($q$delete from public.posyandu where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'$q$, '23503', 'posyandu yang punya audit tidak bisa dihapus (RESTRICT)');
select uji.gagal($q$delete from auth.users where id = '11111111-1111-1111-1111-111111111111'$q$,       '23503', 'akun petugas yang punya audit tidak bisa dihapus (RESTRICT via petugas)');
select uji.sama(uji.terdampak($q$delete from auth.users where id = '33333333-3333-3333-3333-333333333333'$q$)::text, '1', 'akun tanpa audit bisa dihapus');
select uji.sama((select count(*) from public.petugas where id = '33333333-3333-3333-3333-333333333333')::text, '0', 'hapus akun -> baris petugas ikut terhapus (CASCADE)');

\echo '== 9. Tidak ada kolom/tabel per balita =='
-- (jml_selisih_bb / jml_selisih_tb adalah hitungan integer agregat, bukan data per balita,
--  jadi pemeriksaan berbasis nama diganti pemeriksaan berbasis tipe.)
select uji.sama((select string_agg(column_name, ',' order by column_name) from information_schema.columns
                  where table_schema = 'public' and table_name = 'audit_run'
                    and data_type in ('text', 'character varying', 'character', 'json', 'jsonb', 'bytea', 'ARRAY')),
                'catatan', 'audit_run: satu-satunya kolom teks bebas adalah catatan');
select uji.sama((select string_agg(column_name, ',' order by column_name) from information_schema.columns
                  where table_schema = 'public' and table_name = 'audit_run' and data_type = 'date'),
                'periode', 'audit_run: satu-satunya kolom tanggal adalah periode (bukan tanggal lahir/kunjungan)');
select uji.sama((select count(*) from information_schema.columns
                  where table_schema = 'public' and table_name = 'audit_run'
                    and column_name ~* '(nik|nama|hash|lahir|alamat)')::text,
                '0', 'audit_run: tidak ada kolom nik/nama/hash/lahir/alamat');
select uji.sama((select count(*) from information_schema.columns
                  where table_schema = 'public' and table_name = 'audit_run'
                    and data_type in ('integer', 'numeric'))::text,
                '11', 'audit_run: 8 hitungan + 3 persen = 11 kolom numerik');
select uji.sama((select string_agg(table_name, ',' order by table_name) from information_schema.tables
                  where table_schema = 'public' and table_type = 'BASE TABLE'),
                'audit_run,petugas,posyandu,puskesmas', 'schema public hanya berisi 4 tabel yang dirancang');

\echo '== SEMUA UJI LULUS =='
rollback;
