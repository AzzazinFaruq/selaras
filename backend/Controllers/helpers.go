package controllers

import (
	"errors"
	"log"
	"time"

	config "selaras/Config"
	models "selaras/Models"
	utils "selaras/Utils"

	"github.com/go-sql-driver/mysql"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// saya mengembalikan petugas yang sedang login (diisi AuthMiddleware).
// Semua query data WAJIB dibatasi ke saya(c).PuskesmasID.
func saya(c *fiber.Ctx) *models.Petugas {
	return c.Locals("petugas").(*models.Petugas)
}

func gagal(c *fiber.Ctx, status int, pesan string) error {
	return c.Status(status).JSON(fiber.Map{"error": pesan})
}

// galatServer mencatat detail error di log server dan hanya mengirim pesan
// umum ke klien.
func galatServer(c *fiber.Ctx, err error) error {
	log.Printf("ERROR %s %s: %v", c.Method(), c.Path(), err)
	return gagal(c, fiber.StatusInternalServerError, "Terjadi kesalahan di server")
}

func idValid(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

// Nomor error MySQL yang ditangani sebagai kesalahan input (400/409), bukan 500.
const (
	errDuplikat        = 1062 // unique key
	errAngkaRentang    = 1264 // angka di luar rentang INT
	errTeksPanjang     = 1406 // teks melebihi panjang kolom
	errCheckConstraint = 3819
)

// kodeDB mengambil nomor error MySQL (0 bila bukan error MySQL).
func kodeDB(err error) uint16 {
	var e *mysql.MySQLError
	if errors.As(err, &e) {
		return e.Number
	}
	return 0
}

// idBaru membuat UUID di Go karena MySQL tidak punya RETURNING.
func idBaru() string {
	return uuid.NewString()
}

func pasangCookie(c *fiber.Ctx, token string, exp time.Time) {
	c.Cookie(&fiber.Cookie{
		Name:     utils.NamaCookie,
		Value:    token,
		Path:     "/",
		Expires:  exp,
		HTTPOnly: true,
		Secure:   !config.IsDev(),
		SameSite: fiber.CookieSameSiteStrictMode,
	})
}

func hapusCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     utils.NamaCookie,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HTTPOnly: true,
		Secure:   !config.IsDev(),
		SameSite: fiber.CookieSameSiteStrictMode,
	})
}
