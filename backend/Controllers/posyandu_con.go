package controllers

import (
	"strings"
	"unicode/utf8"

	models "selaras/Models"

	"github.com/gofiber/fiber/v2"
	"github.com/uptrace/bun"
)

type PosyanduHandler struct {
	DB *bun.DB
}

func NewPosyanduHandler(db *bun.DB) *PosyanduHandler {
	return &PosyanduHandler{DB: db}
}

type posyanduRequest struct {
	Nama      string `json:"nama"`
	Kelurahan string `json:"kelurahan"`
}

// rapikan memvalidasi input dan mengembalikan pesan galat (kosong = valid).
func (r *posyanduRequest) rapikan() string {
	r.Nama = strings.TrimSpace(r.Nama)
	r.Kelurahan = strings.TrimSpace(r.Kelurahan)
	if r.Nama == "" || utf8.RuneCountInString(r.Nama) > 100 {
		return "Nama posyandu wajib diisi (maks 100 karakter)"
	}
	if utf8.RuneCountInString(r.Kelurahan) > 100 {
		return "Kelurahan maks 100 karakter"
	}
	return ""
}

func (r *posyanduRequest) kelurahan() *string {
	if r.Kelurahan == "" {
		return nil
	}
	return &r.Kelurahan
}

func (h *PosyanduHandler) GetPosyandu(c *fiber.Ctx) error {
	var daftar []models.Posyandu
	err := h.DB.NewSelect().
		Model(&daftar).
		Where("puskesmas_id = ?", saya(c).PuskesmasID).
		Order("nama").
		Scan(c.Context())
	if err != nil {
		return galatServer(c, err)
	}
	if daftar == nil {
		daftar = []models.Posyandu{}
	}
	return c.JSON(fiber.Map{"data": daftar})
}

func (h *PosyanduHandler) CreatePosyandu(c *fiber.Ctx) error {
	req := new(posyanduRequest)
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}
	if pesan := req.rapikan(); pesan != "" {
		return gagal(c, fiber.StatusBadRequest, pesan)
	}

	posyandu := &models.Posyandu{
		PuskesmasID: saya(c).PuskesmasID, // selalu dari sesi, bukan dari klien
		Nama:        req.Nama,
		Kelurahan:   req.kelurahan(),
	}
	_, err := h.DB.NewInsert().Model(posyandu).Returning("id").Exec(c.Context())
	if err != nil {
		if kodePg(err) == "23505" {
			return gagal(c, fiber.StatusConflict, "Nama posyandu sudah ada di puskesmas ini")
		}
		return galatServer(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": posyandu})
}

func (h *PosyanduHandler) UpdatePosyandu(c *fiber.Ctx) error {
	id := c.Params("id")
	if !idValid(id) {
		return gagal(c, fiber.StatusNotFound, "Posyandu tidak ditemukan")
	}

	req := new(posyanduRequest)
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}
	if pesan := req.rapikan(); pesan != "" {
		return gagal(c, fiber.StatusBadRequest, pesan)
	}

	res, err := h.DB.NewUpdate().
		Model((*models.Posyandu)(nil)).
		Set("nama = ?", req.Nama).
		Set("kelurahan = ?", req.kelurahan()).
		Where("id = ?", id).
		Where("puskesmas_id = ?", saya(c).PuskesmasID).
		Exec(c.Context())
	if err != nil {
		if kodePg(err) == "23505" {
			return gagal(c, fiber.StatusConflict, "Nama posyandu sudah ada di puskesmas ini")
		}
		return galatServer(c, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return gagal(c, fiber.StatusNotFound, "Posyandu tidak ditemukan")
	}

	return c.JSON(fiber.Map{"message": "Posyandu diperbarui"})
}
