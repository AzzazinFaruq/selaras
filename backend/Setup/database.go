package Setup

import (
	"database/sql"
	"log"

	config "selaras/Config"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
)

var DB *bun.DB

// Connect membuka koneksi PostgreSQL dari DATABASE_URL, contoh:
// postgres://selaras:rahasia@127.0.0.1:5432/selaras?sslmode=disable
func Connect() {
	dsn := config.Wajib("DATABASE_URL")

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	sqldb.SetMaxOpenConns(10)

	if err := sqldb.Ping(); err != nil {
		log.Fatalf("Gagal terhubung ke PostgreSQL: %v", err)
	}

	DB = bun.NewDB(sqldb, pgdialect.New())
	log.Println("PostgreSQL terhubung")
}
