package controllers

import (
	"strings"
	"time"
	"unicode/utf8"

	models "selaras/Models"
	utils "selaras/Utils"

	"github.com/gofiber/fiber/v2"
	"github.com/uptrace/bun"
)

// AdminHandler melayani /api/admin/* (panel admin). Berbeda dari handler lain,
// query di sini SENGAJA tidak dibatasi puskesmas_id: admin mengelola semua
// puskesmas. Seluruh route-nya dijaga middleware.AdminSaja.
//
// Audit hanya bisa dilihat dan dihapus, tidak bisa diubah, supaya angkanya
// selalu berasal dari hasil rekonsiliasi.
type AdminHandler struct {
	DB *bun.DB
}

func NewAdminHandler(db *bun.DB) *AdminHandler {
	return &AdminHandler{DB: db}
}

func (h *AdminHandler) Ringkasan(c *fiber.Ctx) error {
	out := new(struct {
		Puskesmas int `bun:"puskesmas" json:"puskesmas"`
		Posyandu  int `bun:"posyandu" json:"posyandu"`
		Petugas   int `bun:"petugas" json:"petugas"`
		Audit     int `bun:"audit" json:"audit"`
	})
	err := h.DB.NewRaw(`
		select (select count(*) from puskesmas) as puskesmas,
		       (select count(*) from posyandu)  as posyandu,
		       (select count(*) from petugas)   as petugas,
		       (select count(*) from audit_run) as audit`).Scan(c.Context(), out)
	if err != nil {
		return galatServer(c, err)
	}
	return c.JSON(fiber.Map{"data": out})
}

// ---------------------------------------------------------------------
// Puskesmas
// ---------------------------------------------------------------------

type puskesmasRequest struct {
	Nama string `json:"nama"`
	Kota string `json:"kota"`
}

func (r *puskesmasRequest) rapikan() string {
	r.Nama = strings.TrimSpace(r.Nama)
	r.Kota = strings.TrimSpace(r.Kota)
	if r.Nama == "" || utf8.RuneCountInString(r.Nama) > 150 {
		return "Nama puskesmas wajib diisi (maks 150 karakter)"
	}
	if r.Kota == "" || utf8.RuneCountInString(r.Kota) > 100 {
		return "Kota wajib diisi (maks 100 karakter)"
	}
	return ""
}

func (h *AdminHandler) DaftarPuskesmas(c *fiber.Ctx) error {
	type baris struct {
		ID             string `bun:"id" json:"id"`
		Nama           string `bun:"nama" json:"nama"`
		Kota           string `bun:"kota" json:"kota"`
		JumlahPosyandu int    `bun:"jumlah_posyandu" json:"jumlah_posyandu"`
		JumlahPetugas  int    `bun:"jumlah_petugas" json:"jumlah_petugas"`
	}
	rows := []baris{}
	err := h.DB.NewRaw(`
		select p.id, p.nama, p.kota,
		       (select count(*) from posyandu s where s.puskesmas_id = p.id) as jumlah_posyandu,
		       (select count(*) from petugas  t where t.puskesmas_id = p.id) as jumlah_petugas
		from puskesmas p
		order by p.nama, p.kota`).Scan(c.Context(), &rows)
	if err != nil {
		return galatServer(c, err)
	}
	return c.JSON(fiber.Map{"data": rows})
}

func (h *AdminHandler) BuatPuskesmas(c *fiber.Ctx) error {
	req := new(puskesmasRequest)
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}
	if pesan := req.rapikan(); pesan != "" {
		return gagal(c, fiber.StatusBadRequest, pesan)
	}
	p := &models.Puskesmas{ID: idBaru(), Nama: req.Nama, Kota: req.Kota}
	if _, err := h.DB.NewInsert().Model(p).Exec(c.Context()); err != nil {
		return galatServer(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": p})
}

func (h *AdminHandler) UbahPuskesmas(c *fiber.Ctx) error {
	id := c.Params("id")
	if !idValid(id) {
		return gagal(c, fiber.StatusNotFound, "Puskesmas tidak ditemukan")
	}
	req := new(puskesmasRequest)
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}
	if pesan := req.rapikan(); pesan != "" {
		return gagal(c, fiber.StatusBadRequest, pesan)
	}
	res, err := h.DB.NewUpdate().
		Model((*models.Puskesmas)(nil)).
		Set("nama = ?", req.Nama).
		Set("kota = ?", req.Kota).
		Where("id = ?", id).
		Exec(c.Context())
	if err != nil {
		return galatServer(c, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return gagal(c, fiber.StatusNotFound, "Puskesmas tidak ditemukan")
	}
	return c.JSON(fiber.Map{"message": "Puskesmas diperbarui"})
}

func (h *AdminHandler) HapusPuskesmas(c *fiber.Ctx) error {
	return h.hapus(c, (*models.Puskesmas)(nil), "Puskesmas",
		"Puskesmas masih punya posyandu atau petugas. Hapus atau pindahkan dulu.")
}

// ---------------------------------------------------------------------
// Posyandu (semua puskesmas)
// ---------------------------------------------------------------------

type posyanduAdminRequest struct {
	posyanduRequest
	PuskesmasID string `json:"puskesmas_id"`
}

func (h *AdminHandler) DaftarPosyandu(c *fiber.Ctx) error {
	type baris struct {
		ID            string  `bun:"id" json:"id"`
		PuskesmasID   string  `bun:"puskesmas_id" json:"puskesmas_id"`
		PuskesmasNama string  `bun:"puskesmas_nama" json:"puskesmas_nama"`
		Nama          string  `bun:"nama" json:"nama"`
		Kelurahan     *string `bun:"kelurahan" json:"kelurahan"`
		JumlahAudit   int     `bun:"jumlah_audit" json:"jumlah_audit"`
	}
	rows := []baris{}
	err := h.DB.NewRaw(`
		select s.id, s.puskesmas_id, p.nama as puskesmas_nama, s.nama, s.kelurahan,
		       (select count(*) from audit_run a where a.posyandu_id = s.id) as jumlah_audit
		from posyandu s
		join puskesmas p on p.id = s.puskesmas_id
		order by p.nama, s.nama`).Scan(c.Context(), &rows)
	if err != nil {
		return galatServer(c, err)
	}
	return c.JSON(fiber.Map{"data": rows})
}

func (h *AdminHandler) BuatPosyandu(c *fiber.Ctx) error {
	req := new(posyanduAdminRequest)
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}
	if pesan := req.rapikan(); pesan != "" {
		return gagal(c, fiber.StatusBadRequest, pesan)
	}
	if !idValid(req.PuskesmasID) {
		return gagal(c, fiber.StatusBadRequest, "Puskesmas wajib dipilih")
	}
	s := &models.Posyandu{ID: idBaru(), PuskesmasID: req.PuskesmasID, Nama: req.Nama, Kelurahan: req.kelurahan()}
	if _, err := h.DB.NewInsert().Model(s).Exec(c.Context()); err != nil {
		return h.galatPosyandu(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": s})
}

func (h *AdminHandler) UbahPosyandu(c *fiber.Ctx) error {
	id := c.Params("id")
	if !idValid(id) {
		return gagal(c, fiber.StatusNotFound, "Posyandu tidak ditemukan")
	}
	req := new(posyanduAdminRequest)
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}
	if pesan := req.rapikan(); pesan != "" {
		return gagal(c, fiber.StatusBadRequest, pesan)
	}
	if !idValid(req.PuskesmasID) {
		return gagal(c, fiber.StatusBadRequest, "Puskesmas wajib dipilih")
	}
	res, err := h.DB.NewUpdate().
		Model((*models.Posyandu)(nil)).
		Set("nama = ?", req.Nama).
		Set("kelurahan = ?", req.kelurahan()).
		Set("puskesmas_id = ?", req.PuskesmasID).
		Where("id = ?", id).
		Exec(c.Context())
	if err != nil {
		return h.galatPosyandu(c, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return gagal(c, fiber.StatusNotFound, "Posyandu tidak ditemukan")
	}
	return c.JSON(fiber.Map{"message": "Posyandu diperbarui"})
}

func (h *AdminHandler) galatPosyandu(c *fiber.Ctx, err error) error {
	switch kodeDB(err) {
	case errDuplikat:
		return gagal(c, fiber.StatusConflict, "Nama posyandu sudah ada di puskesmas itu")
	case errIndukTidakAda:
		return gagal(c, fiber.StatusBadRequest, "Puskesmas tidak ditemukan")
	}
	return galatServer(c, err)
}

func (h *AdminHandler) HapusPosyandu(c *fiber.Ctx) error {
	return h.hapus(c, (*models.Posyandu)(nil), "Posyandu",
		"Posyandu masih punya audit. Hapus auditnya dulu.")
}

// ---------------------------------------------------------------------
// Petugas
// ---------------------------------------------------------------------

type petugasRequest struct {
	Nama        string `json:"nama"`
	Email       string `json:"email"`
	PuskesmasID string `json:"puskesmas_id"`
	Peran       string `json:"peran"`
	Aktif       *bool  `json:"aktif"` // nil = aktif
}

func (r *petugasRequest) rapikan() string {
	r.Nama = strings.TrimSpace(r.Nama)
	r.Email = strings.ToLower(strings.TrimSpace(r.Email))
	if r.Nama == "" || utf8.RuneCountInString(r.Nama) > 150 {
		return "Nama wajib diisi (maks 150 karakter)"
	}
	at := strings.Index(r.Email, "@")
	if at < 1 || at == len(r.Email)-1 || strings.ContainsAny(r.Email, " \t\r\n") || len(r.Email) > 254 {
		return "Email tidak valid"
	}
	if !idValid(r.PuskesmasID) {
		return "Puskesmas wajib dipilih"
	}
	if r.Peran == "" {
		r.Peran = models.PeranPetugas
	}
	if r.Peran != models.PeranPetugas && r.Peran != models.PeranAdmin {
		return "Peran tidak valid"
	}
	return ""
}

func (r *petugasRequest) aktif() bool {
	return r.Aktif == nil || *r.Aktif
}

func (h *AdminHandler) DaftarPetugas(c *fiber.Ctx) error {
	type baris struct {
		ID            string    `bun:"id" json:"id"`
		Nama          string    `bun:"nama" json:"nama"`
		Email         string    `bun:"email" json:"email"`
		PuskesmasID   string    `bun:"puskesmas_id" json:"puskesmas_id"`
		PuskesmasNama string    `bun:"puskesmas_nama" json:"puskesmas_nama"`
		Peran         string    `bun:"peran" json:"peran"`
		Aktif         bool      `bun:"aktif" json:"aktif"`
		JumlahAudit   int       `bun:"jumlah_audit" json:"jumlah_audit"`
		DibuatPada    time.Time `bun:"dibuat_pada" json:"dibuat_pada"`
	}
	rows := []baris{}
	err := h.DB.NewRaw(`
		select t.id, t.nama, t.email, t.puskesmas_id, p.nama as puskesmas_nama, t.peran, t.aktif,
		       (select count(*) from audit_run a where a.petugas_id = t.id) as jumlah_audit,
		       t.dibuat_pada
		from petugas t
		join puskesmas p on p.id = t.puskesmas_id
		order by t.nama, t.email`).Scan(c.Context(), &rows)
	if err != nil {
		return galatServer(c, err)
	}
	return c.JSON(fiber.Map{"data": rows})
}

// BuatPetugas membuat akun dengan password acak. Password hanya dikirim sekali
// di respons ini; admin meneruskannya langsung ke petugas.
func (h *AdminHandler) BuatPetugas(c *fiber.Ctx) error {
	req := new(petugasRequest)
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}
	if pesan := req.rapikan(); pesan != "" {
		return gagal(c, fiber.StatusBadRequest, pesan)
	}

	password := utils.PasswordAcak()
	hash, err := utils.HashPassword(password)
	if err != nil {
		return galatServer(c, err)
	}
	p := &models.Petugas{
		ID:           idBaru(),
		PuskesmasID:  req.PuskesmasID,
		Nama:         req.Nama,
		Email:        req.Email,
		PasswordHash: hash,
		Aktif:        req.aktif(),
		Peran:        req.Peran,
	}
	if _, err := h.DB.NewInsert().Model(p).Exec(c.Context()); err != nil {
		return h.galatPetugas(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": fiber.Map{"id": p.ID, "email": p.Email, "password": password}})
}

// UbahPetugas: menonaktifkan akun ikut mengakhiri semua sesinya. Admin tidak
// bisa menonaktifkan atau mencabut peran admin dirinya sendiri, supaya panel
// tidak sampai kehilangan admin karena salah klik.
func (h *AdminHandler) UbahPetugas(c *fiber.Ctx) error {
	id := c.Params("id")
	if !idValid(id) {
		return gagal(c, fiber.StatusNotFound, "Petugas tidak ditemukan")
	}
	req := new(petugasRequest)
	if err := c.BodyParser(req); err != nil {
		return gagal(c, fiber.StatusBadRequest, "Input tidak valid")
	}
	if pesan := req.rapikan(); pesan != "" {
		return gagal(c, fiber.StatusBadRequest, pesan)
	}
	if id == saya(c).ID && (!req.aktif() || req.Peran != models.PeranAdmin) {
		return gagal(c, fiber.StatusBadRequest, "Tidak bisa menonaktifkan atau mencabut peran admin akun sendiri")
	}

	q := h.DB.NewUpdate().
		Model((*models.Petugas)(nil)).
		Set("nama = ?", req.Nama).
		Set("email = ?", req.Email).
		Set("puskesmas_id = ?", req.PuskesmasID).
		Set("peran = ?", req.Peran).
		Set("aktif = ?", req.aktif()).
		Where("id = ?", id)
	if !req.aktif() {
		q = q.Set("token_versi = token_versi + 1")
	}
	res, err := q.Exec(c.Context())
	if err != nil {
		return h.galatPetugas(c, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return gagal(c, fiber.StatusNotFound, "Petugas tidak ditemukan")
	}
	return c.JSON(fiber.Map{"message": "Petugas diperbarui"})
}

// ResetPassword membuat password acak baru dan mengakhiri semua sesi akun itu.
func (h *AdminHandler) ResetPassword(c *fiber.Ctx) error {
	id := c.Params("id")
	if !idValid(id) {
		return gagal(c, fiber.StatusNotFound, "Petugas tidak ditemukan")
	}
	if id == saya(c).ID {
		return gagal(c, fiber.StatusBadRequest, "Ganti password sendiri lewat menu Akun")
	}
	password := utils.PasswordAcak()
	hash, err := utils.HashPassword(password)
	if err != nil {
		return galatServer(c, err)
	}
	res, err := h.DB.NewUpdate().
		Model((*models.Petugas)(nil)).
		Set("password_hash = ?", hash).
		Set("token_versi = token_versi + 1").
		Where("id = ?", id).
		Exec(c.Context())
	if err != nil {
		return galatServer(c, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return gagal(c, fiber.StatusNotFound, "Petugas tidak ditemukan")
	}
	return c.JSON(fiber.Map{"data": fiber.Map{"password": password}})
}

func (h *AdminHandler) HapusPetugas(c *fiber.Ctx) error {
	if c.Params("id") == saya(c).ID {
		return gagal(c, fiber.StatusBadRequest, "Tidak bisa menghapus akun sendiri")
	}
	return h.hapus(c, (*models.Petugas)(nil), "Petugas",
		"Petugas ini sudah membuat audit, jadi tidak bisa dihapus. Nonaktifkan saja akunnya.")
}

func (h *AdminHandler) galatPetugas(c *fiber.Ctx, err error) error {
	switch kodeDB(err) {
	case errDuplikat:
		return gagal(c, fiber.StatusConflict, "Email sudah dipakai akun lain")
	case errIndukTidakAda:
		return gagal(c, fiber.StatusBadRequest, "Puskesmas tidak ditemukan")
	}
	return galatServer(c, err)
}

// ---------------------------------------------------------------------
// Audit (lihat + hapus)
// ---------------------------------------------------------------------

func (h *AdminHandler) DaftarAudit(c *fiber.Ctx) error {
	type baris struct {
		ID                string    `bun:"id" json:"id"`
		PuskesmasNama     string    `bun:"puskesmas_nama" json:"puskesmas_nama"`
		PosyanduNama      string    `bun:"posyandu_nama" json:"posyandu_nama"`
		Periode           string    `bun:"periode" json:"periode"`
		JumlahSampel      int       `bun:"jumlah_sampel" json:"jumlah_sampel"`
		PersenKelengkapan *float64  `bun:"persen_kelengkapan" json:"persen_kelengkapan"`
		PersenKesesuaian  *float64  `bun:"persen_kesesuaian" json:"persen_kesesuaian"`
		PersenKetepatan   *float64  `bun:"persen_ketepatan" json:"persen_ketepatan"`
		PetugasNama       string    `bun:"petugas_nama" json:"petugas_nama"`
		Catatan           *string   `bun:"catatan" json:"catatan"`
		DibuatPada        time.Time `bun:"dibuat_pada" json:"dibuat_pada"`
	}
	rows := []baris{}
	err := h.DB.NewRaw(`
		select a.id, p.nama as puskesmas_nama, s.nama as posyandu_nama,
		       date_format(a.periode, '%Y-%m') as periode, a.jumlah_sampel,
		       cast(a.persen_kelengkapan as double) as persen_kelengkapan,
		       cast(a.persen_kesesuaian  as double) as persen_kesesuaian,
		       cast(a.persen_ketepatan   as double) as persen_ketepatan,
		       t.nama as petugas_nama, a.catatan, a.dibuat_pada
		from audit_run a
		join posyandu  s on s.id = a.posyandu_id
		join puskesmas p on p.id = s.puskesmas_id
		join petugas   t on t.id = a.petugas_id
		order by a.dibuat_pada desc, a.id desc`).Scan(c.Context(), &rows)
	if err != nil {
		return galatServer(c, err)
	}
	return c.JSON(fiber.Map{"data": rows})
}

// HapusAudit: admin boleh menghapus audit siapa pun kapan saja (petugas biasa
// hanya miliknya sendiri dalam 24 jam).
func (h *AdminHandler) HapusAudit(c *fiber.Ctx) error {
	return h.hapus(c, (*models.AuditRun)(nil), "Audit", "")
}

// hapus menghapus satu baris menurut :id. Baris yang masih dirujuk tabel lain
// (foreign key RESTRICT) ditolak dengan pesanDipakai, tidak dihapus berantai.
func (h *AdminHandler) hapus(c *fiber.Ctx, model any, nama, pesanDipakai string) error {
	id := c.Params("id")
	if !idValid(id) {
		return gagal(c, fiber.StatusNotFound, nama+" tidak ditemukan")
	}
	res, err := h.DB.NewDelete().Model(model).Where("id = ?", id).Exec(c.Context())
	if err != nil {
		if kodeDB(err) == errMasihDipakai {
			return gagal(c, fiber.StatusConflict, pesanDipakai)
		}
		return galatServer(c, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return gagal(c, fiber.StatusNotFound, nama+" tidak ditemukan")
	}
	return c.JSON(fiber.Map{"message": nama + " dihapus"})
}
