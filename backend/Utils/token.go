package utils

import (
	"errors"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Token hanya disimpan di cookie HttpOnly ini; tidak pernah dikirim di body
// respons, jadi JavaScript (termasuk script hasil XSS) tidak bisa membacanya.
const NamaCookie = "selaras_token"

const MasaBerlaku = 8 * time.Hour

var secret []byte

// InitJWT wajib dipanggil sebelum server jalan. Tidak ada secret default.
func InitJWT() {
	s := os.Getenv("JWT_SECRET")
	if len(s) < 32 {
		log.Fatal("JWT_SECRET wajib diisi di .env, minimal 32 karakter (contoh: openssl rand -hex 32)")
	}
	secret = []byte(s)
}

type Klaim struct {
	// Harus sama dengan petugas.token_versi; dinaikkan saat logout/ganti password.
	Versi int `json:"ver"`
	jwt.RegisteredClaims
}

func GenerateJWT(petugasID string, versi int) (string, time.Time, error) {
	if len(secret) == 0 {
		return "", time.Time{}, errors.New("JWT belum diinisialisasi")
	}
	now := time.Now()
	exp := now.Add(MasaBerlaku)
	klaim := Klaim{
		Versi: versi,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   petugasID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, klaim).SignedString(secret)
	return token, exp, err
}

func ValidateJWT(tokenString string) (*Klaim, error) {
	if len(secret) == 0 {
		return nil, errors.New("JWT belum diinisialisasi")
	}
	klaim := &Klaim{}
	_, err := jwt.ParseWithClaims(tokenString, klaim,
		func(*jwt.Token) (any, error) { return secret, nil },
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, err
	}
	return klaim, nil
}
