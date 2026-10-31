package models

import (
	"time"

	"github.com/uptrace/bun"
)

// Struktur tabel ada di Setup/skema.sql. Model di sini hanya untuk
// insert/select lewat bun.

type Puskesmas struct {
	bun.BaseModel `bun:"table:puskesmas"`

	ID         string    `bun:"id,pk,type:uuid,nullzero" json:"id"`
	Nama       string    `bun:"nama" json:"nama"`
	Kota       string    `bun:"kota" json:"kota"`
	DibuatPada time.Time `bun:"dibuat_pada,nullzero,notnull,default:current_timestamp" json:"-"`
}

type Posyandu struct {
	bun.BaseModel `bun:"table:posyandu"`

	ID          string    `bun:"id,pk,type:uuid,nullzero" json:"id"`
	PuskesmasID string    `bun:"puskesmas_id,type:uuid" json:"-"`
	Nama        string    `bun:"nama" json:"nama"`
	Kelurahan   *string   `bun:"kelurahan" json:"kelurahan"`
	DibuatPada  time.Time `bun:"dibuat_pada,nullzero,notnull,default:current_timestamp" json:"-"`
}

type Petugas struct {
	bun.BaseModel `bun:"table:petugas"`

	ID           string    `bun:"id,pk,type:uuid,nullzero" json:"id"`
	PuskesmasID  string    `bun:"puskesmas_id,type:uuid" json:"puskesmas_id"`
	Nama         string    `bun:"nama" json:"nama"`
	Email        string    `bun:"email" json:"email"`
	PasswordHash string    `bun:"password_hash" json:"-"`
	Aktif        bool      `bun:"aktif" json:"-"`
	TokenVersi   int       `bun:"token_versi" json:"-"`
	DibuatPada   time.Time `bun:"dibuat_pada,nullzero,notnull,default:current_timestamp" json:"-"`
}

// AuditRun hanya berisi angka agregat. Kolom persen_* dihitung basis data
// (generated column) sehingga sengaja tidak ada di model insert ini.
type AuditRun struct {
	bun.BaseModel `bun:"table:audit_run"`

	ID                 string    `bun:"id,pk,type:uuid,nullzero"`
	PosyanduID         string    `bun:"posyandu_id,type:uuid"`
	PetugasID          string    `bun:"petugas_id,type:uuid"`
	Periode            string    `bun:"periode,type:date"` // YYYY-MM-01
	JumlahSampel       int       `bun:"jumlah_sampel"`
	JumlahTercatatAsik int       `bun:"jumlah_tercatat_asik"`
	JmlTidakAdaDiAsik  int       `bun:"jml_tidak_ada_di_asik"`
	JmlTidakSesuai     int       `bun:"jml_tidak_sesuai"`
	JmlSelisihTanggal  int       `bun:"jml_selisih_tanggal"`
	JmlSelisihBB       int       `bun:"jml_selisih_bb"`
	JmlSelisihTB       int       `bun:"jml_selisih_tb"`
	JmlTerlambat       int       `bun:"jml_terlambat"`
	Catatan            *string   `bun:"catatan"`
	DibuatPada         time.Time `bun:"dibuat_pada,nullzero,notnull,default:current_timestamp"`
}

// TrenRow adalah satu baris v_tren_kualitas yang dikirim ke dashboard.
type TrenRow struct {
	PosyanduID         string   `bun:"posyandu_id" json:"posyandu_id"`
	PosyanduNama       string   `bun:"posyandu_nama" json:"posyandu_nama"`
	Periode            string   `bun:"periode" json:"periode"` // YYYY-MM
	JumlahSampel       int      `bun:"jumlah_sampel" json:"jumlah_sampel"`
	JumlahTercatatAsik int      `bun:"jumlah_tercatat_asik" json:"jumlah_tercatat_asik"`
	JmlTidakAdaDiAsik  int      `bun:"jml_tidak_ada_di_asik" json:"jml_tidak_ada_di_asik"`
	JmlTidakSesuai     int      `bun:"jml_tidak_sesuai" json:"jml_tidak_sesuai"`
	JmlSelisihTanggal  int      `bun:"jml_selisih_tanggal" json:"jml_selisih_tanggal"`
	JmlSelisihBB       int      `bun:"jml_selisih_bb" json:"jml_selisih_bb"`
	JmlSelisihTB       int      `bun:"jml_selisih_tb" json:"jml_selisih_tb"`
	JmlTerlambat       int      `bun:"jml_terlambat" json:"jml_terlambat"`
	PersenKelengkapan  *float64 `bun:"persen_kelengkapan" json:"persen_kelengkapan"`
	PersenKesesuaian   *float64 `bun:"persen_kesesuaian" json:"persen_kesesuaian"`
	PersenKetepatan    *float64 `bun:"persen_ketepatan" json:"persen_ketepatan"`
}

// RiwayatRow adalah satu audit (termasuk audit ulang) untuk halaman riwayat.
type RiwayatRow struct {
	ID                string    `bun:"id" json:"id"`
	PosyanduNama      string    `bun:"posyandu_nama" json:"posyandu_nama"`
	Periode           string    `bun:"periode" json:"periode"`
	JumlahSampel      int       `bun:"jumlah_sampel" json:"jumlah_sampel"`
	PersenKelengkapan *float64  `bun:"persen_kelengkapan" json:"persen_kelengkapan"`
	PersenKesesuaian  *float64  `bun:"persen_kesesuaian" json:"persen_kesesuaian"`
	PersenKetepatan   *float64  `bun:"persen_ketepatan" json:"persen_ketepatan"`
	PetugasNama       string    `bun:"petugas_nama" json:"petugas_nama"`
	Catatan           *string   `bun:"catatan" json:"catatan"`
	DibuatPada        time.Time `bun:"dibuat_pada" json:"dibuat_pada"`
	BisaDihapus       bool      `bun:"bisa_dihapus" json:"bisa_dihapus"`
}
