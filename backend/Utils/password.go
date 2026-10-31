package utils

import (
	"crypto/rand"
	"encoding/base64"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = 12

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

var (
	dummyOnce sync.Once
	dummyHash []byte
)

// CheckPasswordPalsu dipanggil saat email tidak ditemukan, supaya waktu
// respons login sama dengan email yang ada (tidak bisa dipakai menebak email).
func CheckPasswordPalsu(password string) {
	dummyOnce.Do(func() {
		dummyHash, _ = bcrypt.GenerateFromPassword([]byte("bukan-password"), bcryptCost)
	})
	_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
}

// PasswordAcak membuat password awal 16 karakter untuk akun baru / reset.
func PasswordAcak() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
