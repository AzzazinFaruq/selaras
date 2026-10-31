package Setup

import (
	"context"
	_ "embed"
	"log"
)

// Skema ditulis sebagai SQL biasa (bukan dari model bun) karena memakai
// CHECK constraint, generated column, dan view yang tidak bisa diwakili tag bun.
//
//go:embed skema.sql
var skema string

func Migrate() {
	if _, err := DB.ExecContext(context.Background(), skema); err != nil {
		log.Fatalf("Migrasi skema gagal: %v", err)
	}
	log.Println("Skema basis data siap")
}
