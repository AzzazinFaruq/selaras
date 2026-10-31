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
	log.Println("Skema basis data siap")
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
