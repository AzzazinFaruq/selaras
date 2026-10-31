-- =====================================================================
-- SELARAS - skema basis data (MySQL 8.0.17+)
-- Dijalankan otomatis setiap server start (Setup/migration.go), satu
-- statement per eksekusi, dan aman dijalankan berulang (IF NOT EXISTS /
-- OR REPLACE).
--
-- Prinsip:
--   * Hanya angka agregat per posyandu per periode. Tidak ada kolom atau
--     tabel per balita, tidak ada hash identitas.
--   * Isolasi antar puskesmas ditegakkan backend: setiap query memakai
--     puskesmas_id milik petugas yang login.
--   * Persentase dihitung basis data (generated column), bukan klien.
--   * Aplikasi tidak pernah meng-update audit_run. Salah input: hapus
--     (maks 24 jam, hanya pembuatnya) lalu audit ulang.
--
-- Aturan menulis file ini (dipotong per titik koma di akhir baris):
--   * Titik koma hanya di akhir statement, tidak di dalam komentar.
--   * Jangan memakai tanda tanya, karena bun menganggapnya placeholder.
--   * ID (UUID) dibuat di Go, default UUID() hanya cadangan.
-- =====================================================================

CREATE TABLE IF NOT EXISTS puskesmas (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  nama        VARCHAR(150) NOT NULL,
  kota        VARCHAR(100) NOT NULL,
  dibuat_pada DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS posyandu (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()),
  puskesmas_id CHAR(36)     NOT NULL,
  nama         VARCHAR(100) NOT NULL,
  kelurahan    VARCHAR(100) NULL,
  dibuat_pada  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- nama boleh sama di puskesmas berbeda, tidak boleh kembar dalam satu puskesmas
  -- (collation _ci: "Melati" dan "melati" dianggap kembar)
  UNIQUE KEY posyandu_nama_unik (puskesmas_id, nama),
  CONSTRAINT posyandu_puskesmas_fk FOREIGN KEY (puskesmas_id) REFERENCES puskesmas (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Akun petugas gizi. Dibuat admin lewat perintah CLI, tidak ada pendaftaran publik.
CREATE TABLE IF NOT EXISTS petugas (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  puskesmas_id  CHAR(36)     NOT NULL,
  nama          VARCHAR(150) NOT NULL,
  -- unik tanpa membedakan huruf besar-kecil (collation _ci), Go menyimpan huruf kecil
  email         VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  aktif         BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Dinaikkan saat logout / ganti password / reset / nonaktif, sehingga
  -- semua token lama langsung tidak berlaku.
  token_versi   INT          NOT NULL DEFAULT 0,
  dibuat_pada   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY petugas_email_unik (email),
  KEY petugas_puskesmas_idx (puskesmas_id),
  CONSTRAINT petugas_puskesmas_fk FOREIGN KEY (puskesmas_id) REFERENCES puskesmas (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Satu baris per audit. HANYA angka agregat.
CREATE TABLE IF NOT EXISTS audit_run (
  id                    CHAR(36)    NOT NULL DEFAULT (UUID()),
  posyandu_id           CHAR(36)    NOT NULL,
  petugas_id            CHAR(36)    NOT NULL,
  periode               DATE        NOT NULL,
  jumlah_sampel         INT         NOT NULL,
  jumlah_tercatat_asik  INT         NOT NULL,
  jml_tidak_ada_di_asik INT         NOT NULL,
  jml_tidak_sesuai      INT         NOT NULL,
  jml_selisih_tanggal   INT         NOT NULL,
  jml_selisih_bb        INT         NOT NULL,
  jml_selisih_tb        INT         NOT NULL,
  jml_terlambat         INT         NOT NULL,

  -- NULLIF membuat pembagi nol menghasilkan NULL, bukan error.
  persen_kelengkapan DECIMAL(5,2) GENERATED ALWAYS AS (
    ROUND(jumlah_tercatat_asik * 100 / NULLIF(jumlah_sampel, 0), 2)
  ) STORED,
  persen_kesesuaian  DECIMAL(5,2) GENERATED ALWAYS AS (
    ROUND((jumlah_tercatat_asik - jml_tidak_sesuai) * 100 / NULLIF(jumlah_tercatat_asik, 0), 2)
  ) STORED,
  persen_ketepatan   DECIMAL(5,2) GENERATED ALWAYS AS (
    ROUND((jumlah_tercatat_asik - jml_terlambat) * 100 / NULLIF(jumlah_tercatat_asik, 0), 2)
  ) STORED,

  -- Satu-satunya kolom teks bebas, dibatasi agar tidak bisa menampung daftar balita.
  catatan     VARCHAR(200) NULL,
  dibuat_pada DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  -- Dashboard: baris terbaru per periode per posyandu
  KEY audit_run_posyandu_periode_idx (posyandu_id, periode, dibuat_pada),
  KEY audit_run_petugas_idx (petugas_id),
  CONSTRAINT audit_posyandu_fk FOREIGN KEY (posyandu_id) REFERENCES posyandu (id) ON DELETE RESTRICT,
  CONSTRAINT audit_petugas_fk  FOREIGN KEY (petugas_id)  REFERENCES petugas (id)  ON DELETE RESTRICT,

  CONSTRAINT audit_periode_tanggal_1   CHECK (DAY(periode) = 1),
  CONSTRAINT audit_sampel_positif      CHECK (jumlah_sampel > 0),
  CONSTRAINT audit_angka_tidak_negatif CHECK (
        jumlah_tercatat_asik  >= 0 AND jml_tidak_ada_di_asik >= 0
    AND jml_tidak_sesuai      >= 0 AND jml_selisih_tanggal   >= 0
    AND jml_selisih_bb        >= 0 AND jml_selisih_tb        >= 0
    AND jml_terlambat         >= 0),
  CONSTRAINT audit_sampel_terbagi      CHECK (jumlah_tercatat_asik + jml_tidak_ada_di_asik = jumlah_sampel),
  CONSTRAINT audit_tidak_sesuai_le_tercatat CHECK (jml_tidak_sesuai <= jumlah_tercatat_asik),
  CONSTRAINT audit_terlambat_le_tercatat    CHECK (jml_terlambat    <= jumlah_tercatat_asik),
  -- Satu balita bisa selisih BB dan TB sekaligus, maka
  --   rincian terbesar <= jml_tidak_sesuai <= jumlah seluruh rincian
  CONSTRAINT audit_rincian_selisih     CHECK (
        GREATEST(jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb) <= jml_tidak_sesuai
    AND jml_tidak_sesuai <= jml_selisih_tanggal + jml_selisih_bb + jml_selisih_tb)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Hasil audit agregat per posyandu per periode. Dilarang menyimpan data per balita.';

-- Dashboard: satu baris per (posyandu, periode), yaitu audit terbaru.
-- View ini TIDAK memfilter puskesmas. Query backend wajib menambah
-- WHERE puskesmas_id = ... sendiri.
CREATE OR REPLACE VIEW v_tren_kualitas AS
SELECT
  s.puskesmas_id,
  pk.nama AS puskesmas_nama,
  a.posyandu_id,
  s.nama  AS posyandu_nama,
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
  a.id AS audit_run_id
FROM (
  SELECT r.*,
         ROW_NUMBER() OVER (PARTITION BY r.posyandu_id, r.periode
                            ORDER BY r.dibuat_pada DESC, r.id DESC) AS urutan
  FROM audit_run r
) a
JOIN posyandu  s  ON s.id  = a.posyandu_id
JOIN puskesmas pk ON pk.id = s.puskesmas_id
WHERE a.urutan = 1;
