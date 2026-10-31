package routes

import (
	"errors"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	controllers "selaras/Controllers"
	"selaras/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/uptrace/bun"
)

// NewApp membuat aplikasi Fiber lengkap dengan konfigurasi dan middleware.
// Dipakai main.go dan uji integrasi, jadi keduanya selalu sama.
func NewApp(db *bun.DB, proxyHeader string) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName: "SELARAS",
		// API hanya menerima angka agregat. Batas kecil ini memastikan file
		// register/ASIK tidak mungkin terunggah ke server.
		BodyLimit: 16 * 1024,
		// Isi hanya bila server berada di belakang proxy/tunnel, misalnya
		// CF-Connecting-IP untuk Cloudflare Tunnel. Dipakai rate limit login.
		ProxyHeader:  proxyHeader,
		ErrorHandler: errorHandler,
	})
	app.Use(recover.New())
	app.Use(middleware.SecurityMiddleware())
	Setup(app, db)
	return app
}

// errorHandler tidak membocorkan detail error internal ke klien.
func errorHandler(c *fiber.Ctx, err error) error {
	var fe *fiber.Error
	if errors.As(err, &fe) {
		return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
	}
	log.Printf("ERROR %s %s: %v", c.Method(), c.Path(), err)
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Terjadi kesalahan di server"})
}

func Setup(app *fiber.App, db *bun.DB) {
	authHandler := controllers.NewAuthHandler(db)
	posyanduHandler := controllers.NewPosyanduHandler(db)
	auditHandler := controllers.NewAuditHandler(db)

	api := app.Group("/api")

	// --- publik ---
	api.Get("/sehat", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})
	// Maks 10 percobaan login per 15 menit per IP.
	api.Post("/login", limiter.New(limiter.Config{
		Max:        10,
		Expiration: 15 * time.Minute,
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).
				JSON(fiber.Map{"error": "Terlalu banyak percobaan login. Coba lagi 15 menit lagi."})
		},
	}), authHandler.Login)

	// --- perlu login --- (semua route /api di bawah baris ini)
	api.Use(middleware.AuthMiddleware(db))

	api.Post("/logout", authHandler.Logout)
	api.Get("/saya", authHandler.Saya)
	api.Put("/password", authHandler.GantiPassword)

	api.Get("/posyandu", posyanduHandler.GetPosyandu)
	api.Post("/posyandu", posyanduHandler.CreatePosyandu)
	api.Put("/posyandu/:id", posyanduHandler.UpdatePosyandu)

	api.Get("/tren", auditHandler.GetTren)
	api.Get("/audit", auditHandler.GetRiwayat)
	api.Post("/audit", auditHandler.CreateAudit)
	api.Delete("/audit/:id", auditHandler.DeleteAudit)

	api.Use(func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Endpoint tidak ditemukan"})
	})
}

// Frontend menyajikan hasil build React (frontend/dist) dari origin yang sama
// dengan API. Path selain file statis dikembalikan ke index.html (SPA).
func Frontend(app *fiber.App, dir string) {
	if dir == "" {
		return
	}
	index := filepath.Join(dir, "index.html")
	if _, err := os.Stat(index); err != nil {
		panic("STATIC_DIR tidak berisi index.html (jalankan `npm run build` di frontend): " + dir)
	}

	app.Static("/", dir, fiber.Static{Compress: true})
	app.Use(func(c *fiber.Ctx) error {
		if c.Method() != fiber.MethodGet || strings.HasPrefix(c.Path(), "/api") {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return c.SendFile(index)
	})
}
