package controllers

import (
	"database/sql"
	"errors"
	"strings"

	models "selaras/Models"
	utils "selaras/Utils"

	"github.com/gofiber/fiber/v2"
	"github.com/uptrace/bun"
)

type AuthHandler struct {
	DB *bun.DB
}

func NewAuthHandler(db *bun.DB) *AuthHandler {
	return &AuthHandler{DB: db}
}

// Tidak ada endpoint register. Akun petugas dibuat admin lewat CLI
// (lihat Setup/admin.go).

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	req := new(struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	})
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" {
		return gagal(c, fiber.StatusBadRequest, "Email dan password wajib diisi")
	}

	petugas := new(models.Petugas)
	err := h.DB.NewSelect().
		Model(petugas).
		Where("email = ?", email).
		Where("aktif").
		Limit(1).
		Scan(c.Context())
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return galatServer(c, err)
		}
		utils.CheckPasswordPalsu(req.Password)
		return gagal(c, fiber.StatusUnauthorized, "Email atau password salah")
	}

	if !utils.CheckPasswordHash(req.Password, petugas.PasswordHash) {
		return gagal(c, fiber.StatusUnauthorized, "Email atau password salah")
	}

	token, exp, err := utils.GenerateJWT(petugas.ID, petugas.TokenVersi)
	if err != nil {
		return galatServer(c, err)
	}
	pasangCookie(c, token, exp)

	return h.kirimProfil(c, petugas)
}

// Logout menaikkan token_versi sehingga token yang mungkin tersalin di tempat
// lain ikut tidak berlaku (berlaku untuk semua perangkat petugas ini).
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	_, err := h.DB.NewUpdate().
		Model((*models.Petugas)(nil)).
		Set("token_versi = token_versi + 1").
		Where("id = ?", saya(c).ID).
		Exec(c.Context())
	if err != nil {
		return galatServer(c, err)
	}
	hapusCookie(c)
	return c.JSON(fiber.Map{"message": "Logout berhasil"})
}

func (h *AuthHandler) Saya(c *fiber.Ctx) error {
	return h.kirimProfil(c, saya(c))
}

func (h *AuthHandler) GantiPassword(c *fiber.Ctx) error {
	req := new(struct {
		PasswordLama string `json:"password_lama"`
		PasswordBaru string `json:"password_baru"`
	})
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}
	if len(req.PasswordBaru) < 10 || len(req.PasswordBaru) > 72 {
		return gagal(c, fiber.StatusBadRequest, "Password baru harus 10 sampai 72 karakter")
	}

	petugas := saya(c)
	if !utils.CheckPasswordHash(req.PasswordLama, petugas.PasswordHash) {
		return gagal(c, fiber.StatusBadRequest, "Password lama salah")
	}

	hash, err := utils.HashPassword(req.PasswordBaru)
	if err != nil {
		return galatServer(c, err)
	}

	_, err = h.DB.NewUpdate().
		Model((*models.Petugas)(nil)).
		Set("password_hash = ?", hash).
		Set("token_versi = token_versi + 1").
		Where("id = ?", petugas.ID).
		Exec(c.Context())
	if err != nil {
		return galatServer(c, err)
	}

	hapusCookie(c)
	return c.JSON(fiber.Map{"message": "Password diganti. Silakan login ulang."})
}

func (h *AuthHandler) kirimProfil(c *fiber.Ctx, petugas *models.Petugas) error {
	puskesmas := new(models.Puskesmas)
	err := h.DB.NewSelect().
		Model(puskesmas).
		Where("id = ?", petugas.PuskesmasID).
		Scan(c.Context())
	if err != nil {
		return galatServer(c, err)
	}

	return c.JSON(fiber.Map{
		"user": fiber.Map{
			"id":        petugas.ID,
			"nama":      petugas.Nama,
			"email":     petugas.Email,
			"puskesmas": puskesmas,
		},
	})
}
