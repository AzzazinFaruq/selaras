package controllers

import (
	"strings"
	"time"
	"unicode/utf8"

	models "selaras/Models"

	"github.com/gofiber/fiber/v2"
	"github.com/uptrace/bun"
)

type AuditHandler struct {
	DB *bun.DB
}

func NewAuditHandler(db *bun.DB) *AuditHandler {
	return &AuditHandler{DB: db}
}

// GetTren: satu baris per posyandu per periode (audit terbaru), untuk dashboard.
// Query ?posyandu_id= opsional.
func (h *AuditHandler) GetTren(c *fiber.Ctx) error {
	q := `
		select posyandu_id, posyandu_nama, date_format(periode, '%Y-%m') as periode,
		       jumlah_sampel, jumlah_tercatat_asik, jml_tidak_ada_di_asik, jml_tidak_sesuai,
		       jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat,
		       cast(persen_kelengkapan as double) as persen_kelengkapan,
		       cast(persen_kesesuaian  as double) as persen_kesesuaian,
		       cast(persen_ketepatan   as double) as persen_ketepatan
		from v_tren_kualitas
		where puskesmas_id = ?`
	args := []any{saya(c).PuskesmasID}

	if id := c.Query("posyandu_id"); id != "" {
		if !idValid(id) {
			return gagal(c, fiber.StatusBadRequest, "posyandu_id tidak valid")
		}
		q += " and posyandu_id = ?"
		args = append(args, id)
	}
	q += " order by periode, posyandu_nama"

	rows := []models.TrenRow{}
	if err := h.DB.NewRaw(q, args...).Scan(c.Context(), &rows); err != nil {
		return galatServer(c, err)
	}
	return c.JSON(fiber.Map{"data": rows})
}

// GetRiwayat: semua audit puskesmas ini (termasuk audit ulang), terbaru dulu.
func (h *AuditHandler) GetRiwayat(c *fiber.Ctx) error {
	p := saya(c)
	rows := []models.RiwayatRow{}
	err := h.DB.NewRaw(`
		select a.id, s.nama as posyandu_nama, date_format(a.periode, '%Y-%m') as periode,
		       a.jumlah_sampel,
		       cast(a.persen_kelengkapan as double) as persen_kelengkapan,
		       cast(a.persen_kesesuaian  as double) as persen_kesesuaian,
		       cast(a.persen_ketepatan   as double) as persen_ketepatan,
		       pt.nama as petugas_nama, a.catatan, a.dibuat_pada,
		       (a.petugas_id = ? and a.dibuat_pada > now(3) - interval 24 hour) as bisa_dihapus
		from audit_run a
		join posyandu s  on s.id  = a.posyandu_id
		join petugas  pt on pt.id = a.petugas_id
		where s.puskesmas_id = ?
		order by a.dibuat_pada desc
		limit 200`, p.ID, p.PuskesmasID).Scan(c.Context(), &rows)
	if err != nil {
		return galatServer(c, err)
	}
	return c.JSON(fiber.Map{"data": rows})
}

// CreateAudit menerima HANYA angka agregat hasil rekonsiliasi di browser.
// Body dibatasi 16 KB (main.go), jadi file register/ASIK tidak mungkin ikut terkirim.
func (h *AuditHandler) CreateAudit(c *fiber.Ctx) error {
	req := new(struct {
		PosyanduID         string `json:"posyandu_id"`
		Periode            string `json:"periode"` // YYYY-MM
		JumlahSampel       int    `json:"jumlah_sampel"`
		JumlahTercatatAsik int    `json:"jumlah_tercatat_asik"`
		JmlTidakAdaDiAsik  int    `json:"jml_tidak_ada_di_asik"`
		JmlTidakSesuai     int    `json:"jml_tidak_sesuai"`
		JmlSelisihTanggal  int    `json:"jml_selisih_tanggal"`
		JmlSelisihBB       int    `json:"jml_selisih_bb"`
		JmlSelisihTB       int    `json:"jml_selisih_tb"`
		JmlTerlambat       int    `json:"jml_terlambat"`
		Catatan            string `json:"catatan"`
	})
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}

	periode, err := time.Parse("2006-01", req.Periode)
	if err != nil {
		return gagal(c, fiber.StatusBadRequest, "Periode harus berformat YYYY-MM")
	}
	if periode.After(time.Now()) {
		return gagal(c, fiber.StatusBadRequest, "Periode tidak boleh di masa depan")
	}

	catatan := strings.TrimSpace(req.Catatan)
	if utf8.RuneCountInString(catatan) > 200 {
		return gagal(c, fiber.StatusBadRequest, "Catatan maks 200 karakter")
	}

	p := saya(c)
	if !idValid(req.PosyanduID) {
		return gagal(c, fiber.StatusBadRequest, "Posyandu tidak valid")
	}
	milikSendiri, err := h.DB.NewSelect().
		Model((*models.Posyandu)(nil)).
		Where("id = ?", req.PosyanduID).
		Where("puskesmas_id = ?", p.PuskesmasID).
		Exists(c.Context())
	if err != nil {
		return galatServer(c, err)
	}
	if !milikSendiri {
		return gagal(c, fiber.StatusNotFound, "Posyandu tidak ditemukan")
	}

	audit := &models.AuditRun{
		ID:                 idBaru(),
		PosyanduID:         req.PosyanduID,
		PetugasID:          p.ID, // selalu dari sesi, bukan dari klien
		Periode:            periode.Format("2006-01-02"),
		JumlahSampel:       req.JumlahSampel,
		JumlahTercatatAsik: req.JumlahTercatatAsik,
		JmlTidakAdaDiAsik:  req.JmlTidakAdaDiAsik,
		JmlTidakSesuai:     req.JmlTidakSesuai,
		JmlSelisihTanggal:  req.JmlSelisihTanggal,
		JmlSelisihBB:       req.JmlSelisihBB,
		JmlSelisihTB:       req.JmlSelisihTB,
		JmlTerlambat:       req.JmlTerlambat,
	}
	if catatan != "" {
		audit.Catatan = &catatan
	}

	_, err = h.DB.NewInsert().Model(audit).Exec(c.Context())
	if err != nil {
		// CHECK constraint (angka tidak konsisten) atau angka di luar rentang INT.
		if k := kodeDB(err); k == errCheckConstraint || k == errAngkaRentang {
			return gagal(c, fiber.StatusBadRequest, "Angka audit tidak konsisten. Jalankan ulang rekonsiliasi.")
		}
		return galatServer(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": fiber.Map{"id": audit.ID}})
}

// DeleteAudit: hanya pembuatnya, dan hanya dalam 24 jam sejak dibuat.
func (h *AuditHandler) DeleteAudit(c *fiber.Ctx) error {
	id := c.Params("id")
	if !idValid(id) {
		return gagal(c, fiber.StatusNotFound, "Audit tidak ditemukan")
	}

	res, err := h.DB.NewDelete().
		Model((*models.AuditRun)(nil)).
		Where("id = ?", id).
		Where("petugas_id = ?", saya(c).ID).
		Where("dibuat_pada > now(3) - interval 24 hour").
		Exec(c.Context())
	if err != nil {
		return galatServer(c, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return gagal(c, fiber.StatusNotFound, "Audit tidak ditemukan, bukan milikmu, atau sudah lewat 24 jam")
	}

	return c.JSON(fiber.Map{"message": "Audit dihapus"})
}
