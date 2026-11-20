package Setup

import (
	"context"
	_ "embed"
	"log"
	"strings"
)

// Skema ditulis sebagai SQL biasa (bukan dari model bun) karena memakai
// CHECK constraint, generated column, dan view yang tidak bisa diwakili tag bun.
//
//go:embed skema.sql
var skema string

func Migrate() {
	ctx := context.Background()
	for _, stmt := range pecahStatement(skema) {
		if _, err := DB.ExecContext(ctx, stmt); err != nil {
			log.Fatalf("Migrasi skema gagal: %v\n%s", err, stmt)
		}
	}
	tambahKolom(ctx, "petugas", "peran",
		"alter table petugas add column peran varchar(10) not null default 'petugas' after aktif, "+
			"add constraint petugas_peran_valid check (peran in ('petugas', 'admin'))")
	log.Println("Skema basis data siap")
}

// tambahKolom menjalankan ALTER hanya bila kolomnya belum ada. Dipakai untuk
// basis data yang dibuat sebelum kolom itu masuk skema.sql (CREATE TABLE IF
// NOT EXISTS tidak mengubah tabel yang sudah ada, dan MySQL tidak punya
// ADD COLUMN IF NOT EXISTS).
func tambahKolom(ctx context.Context, tabel, kolom, alter string) {
	var ada int
	err := DB.NewRaw(
		"select count(*) from information_schema.columns where table_schema = database() and table_name = ? and column_name = ?",
		tabel, kolom).Scan(ctx, &ada)
	if err != nil {
		log.Fatalf("Migrasi skema gagal (cek kolom %s.%s): %v", tabel, kolom, err)
	}
	if ada > 0 {
		return
	}
	if _, err := DB.ExecContext(ctx, alter); err != nil {
		log.Fatalf("Migrasi skema gagal: %v\n%s", err, alter)
	}
	log.Printf("Kolom %s.%s ditambahkan", tabel, kolom)
}

// pecahStatement memotong skema per titik koma di akhir baris. Dipakai supaya
// koneksi tidak perlu multiStatements=true (yang memperbesar dampak SQL
// injection), jadi setiap statement dieksekusi sendiri.
func pecahStatement(sql string) []string {
	sql = strings.ReplaceAll(sql, "\r\n", "\n")
	var hasil []string
	for _, bagian := range strings.Split(sql, ";\n") {
		if adaIsi(bagian) {
			hasil = append(hasil, strings.TrimSuffix(strings.TrimSpace(bagian), ";"))
		}
	}
	return hasil
}

// adaIsi bernilai false bila potongan hanya berisi komentar / baris kosong.
func adaIsi(bagian string) bool {
	for _, baris := range strings.Split(bagian, "\n") {
		baris = strings.TrimSpace(baris)
		if baris != "" && !strings.HasPrefix(baris, "--") {
			return true
		}
	}
	return false
}
