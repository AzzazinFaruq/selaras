package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

func Load() {
	_ = godotenv.Load()
}

func Get(key string) string {
	return os.Getenv(key)
}

// GetDefault mengembalikan nilai env, atau def bila kosong.
func GetDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// Wajib menghentikan program bila nilai belum diisi. Dipakai untuk rahasia
// (DATABASE_URL, JWT_SECRET) supaya tidak pernah jatuh ke nilai default.
func Wajib(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s wajib diisi di .env", key)
	}
	return v
}

// IsDev bernilai true hanya bila APP_ENV=development. Selain itu dianggap
// produksi (cookie Secure, HSTS).
func IsDev() bool {
	return os.Getenv("APP_ENV") == "development"
}
