package middleware

import (
	models "selaras/Models"
	utils "selaras/Utils"

	"github.com/gofiber/fiber/v2"
	"github.com/uptrace/bun"
)

// AuthMiddleware membaca token dari cookie HttpOnly, lalu memuat petugas dari
// basis data. Akun nonaktif atau token versi lama (sesudah logout / ganti
// password) langsung ditolak. Petugas disimpan di c.Locals("petugas").
func AuthMiddleware(db *bun.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tokenString := c.Cookies(utils.NamaCookie)
		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Silakan login"})
		}

		klaim, err := utils.ValidateJWT(tokenString)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid, silakan login ulang"})
		}

		petugas := new(models.Petugas)
		err = db.NewSelect().
			Model(petugas).
			Where("id = ?", klaim.Subject).
			Where("aktif").
			Limit(1).
			Scan(c.Context())
		if err != nil || petugas.TokenVersi != klaim.Versi {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi berakhir, silakan login ulang"})
		}

		c.Locals("petugas", petugas)
		return c.Next()
	}
}
