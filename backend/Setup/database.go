package Setup

import (
	"database/sql"
	"log"
	"net"
	"time"

	config "selaras/Config"

	"github.com/go-sql-driver/mysql"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/mysqldialect"
)

var DB *bun.DB

// Connect membuka koneksi MySQL dari DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
func Connect() {
	cfg := mysql.NewConfig()
	cfg.Net = "tcp"
	cfg.Addr = net.JoinHostPort(config.GetDefault("DB_HOST", "127.0.0.1"), config.GetDefault("DB_PORT", "3306"))
	cfg.User = config.Wajib("DB_USER")
	cfg.Passwd = config.Get("DB_PASSWORD")
	cfg.DBName = config.Wajib("DB_NAME")
	cfg.ParseTime = true
	// UPDATE melaporkan baris yang COCOK, bukan yang berubah. Tanpa ini,
	// menyimpan data yang sama dianggap "tidak ditemukan".
	cfg.ClientFoundRows = true
	cfg.Loc = time.UTC
	cfg.Params = map[string]string{
		"charset": "utf8mb4",
		// Semua waktu disimpan dan dibandingkan dalam UTC.
		"time_zone": "'+00:00'",
		// Mode ketat: angka di luar rentang / teks terlalu panjang menjadi error,
		// bukan dipotong diam-diam, apa pun pengaturan server MySQL-nya.
		"sql_mode": "'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,ONLY_FULL_GROUP_BY'",
	}
	// multiStatements sengaja tidak diaktifkan (lihat migration.go).

	sqldb, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		log.Fatalf("Konfigurasi MySQL salah: %v", err)
	}
	sqldb.SetMaxOpenConns(10)
	sqldb.SetConnMaxLifetime(5 * time.Minute)

	if err := sqldb.Ping(); err != nil {
		log.Fatalf("Gagal terhubung ke MySQL: %v", err)
	}

	DB = bun.NewDB(sqldb, mysqldialect.New())
	log.Println("MySQL terhubung")
}
