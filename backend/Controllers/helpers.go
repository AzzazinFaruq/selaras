package controllers

import (
	"errors"
	"log"
	"time"

	config "selaras/Config"
	models "selaras/Models"
	utils "selaras/Utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/uptrace/bun/driver/pgdriver"
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

// kodePg mengambil SQLSTATE dari error PostgreSQL, misalnya 23505 (unik)
// atau 23514 (check constraint).
func kodePg(err error) string {
	var pgErr pgdriver.Error
	if errors.As(err, &pgErr) {
		return pgErr.Field('C')
	}
	return ""
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
