package middleware

import (
	"strings"

	config "selaras/Config"

	"github.com/gofiber/fiber/v2"
)

// Frontend disajikan dari origin yang sama dengan API, jadi tidak perlu CORS.
// Tanpa header CORS, browser menolak permintaan lintas-origin yang membaca respons.
func SecurityMiddleware() fiber.Handler {
	produksi := !config.IsDev()

	return func(c *fiber.Ctx) error {
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("Referrer-Policy", "no-referrer")
		c.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		// style-src 'unsafe-inline' dibutuhkan Recharts (atribut style inline).
		c.Set("Content-Security-Policy",
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; "+
				"base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
		if produksi {
			c.Set("Strict-Transport-Security", "max-age=31536000")
		}

		if strings.HasPrefix(c.Path(), "/api") {
			c.Set("Cache-Control", "no-store")

			// Lapisan CSRF kedua setelah cookie SameSite=Strict: form HTML
			// lintas situs tidak bisa mengirim Content-Type application/json.
			switch c.Method() {
			case fiber.MethodPost, fiber.MethodPut, fiber.MethodPatch:
				if !strings.HasPrefix(c.Get(fiber.HeaderContentType), fiber.MIMEApplicationJSON) {
					return c.Status(fiber.StatusUnsupportedMediaType).
						JSON(fiber.Map{"error": "Content-Type harus application/json"})
				}
			}
		}

		return c.Next()
	}
}
