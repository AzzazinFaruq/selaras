package Setup

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	models "selaras/Models"
	utils "selaras/Utils"

	"github.com/google/uuid"
)

// Perintah admin lewat terminal di homeserver. Sengaja tidak ada halaman
// admin di web: lebih sedikit permukaan serangan.
const bantuan = `Perintah admin SELARAS:
  selaras                                          menjalankan server
  selaras puskesmas-baru "<nama>" "<kota>"
  selaras petugas-baru <email> "<nama>" <puskesmas_id>
  selaras reset-password <email>
  selaras nonaktifkan <email>
  selaras daftar                                   daftar puskesmas & petugas`

func JalankanPerintah(args []string) {
	ctx := context.Background()
	var err error

	switch {
	case args[0] == "puskesmas-baru" && len(args) == 3:
		err = puskesmasBaru(ctx, args[1], args[2])
	case args[0] == "petugas-baru" && len(args) == 4:
		err = petugasBaru(ctx, args[1], args[2], args[3])
	case args[0] == "reset-password" && len(args) == 2:
		err = resetPassword(ctx, args[1])
	case args[0] == "nonaktifkan" && len(args) == 2:
		err = nonaktifkan(ctx, args[1])
	case args[0] == "daftar" && len(args) == 1:
		err = daftar(ctx)
	default:
		fmt.Println(bantuan)
		os.Exit(2)
	}

	if err != nil {
		fmt.Fprintln(os.Stderr, "Gagal:", err)
		os.Exit(1)
	}
}

func puskesmasBaru(ctx context.Context, nama, kota string) error {
	p := &models.Puskesmas{ID: uuid.NewString(), Nama: strings.TrimSpace(nama), Kota: strings.TrimSpace(kota)}
	if p.Nama == "" || p.Kota == "" {
		return errors.New("nama dan kota wajib diisi")
	}
	if _, err := DB.NewInsert().Model(p).Exec(ctx); err != nil {
		return err
	}
	fmt.Printf("Puskesmas dibuat.\n  id: %s\n", p.ID)
	return nil
}

func petugasBaru(ctx context.Context, email, nama, puskesmasID string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") || strings.TrimSpace(nama) == "" {
		return errors.New("email atau nama tidak valid")
	}

	password := utils.PasswordAcak()
	hash, err := utils.HashPassword(password)
	if err != nil {
		return err
	}

	p := &models.Petugas{
		ID:           uuid.NewString(),
		PuskesmasID:  puskesmasID,
		Nama:         strings.TrimSpace(nama),
		Email:        email,
		PasswordHash: hash,
		Aktif:        true,
	}
	if _, err := DB.NewInsert().Model(p).Exec(ctx); err != nil {
		return err
	}
	fmt.Printf("Petugas dibuat.\n  email   : %s\n  password: %s\n", email, password)
	fmt.Println("Berikan password ini secara langsung, lalu minta petugas menggantinya di menu Akun.")
	return nil
}

func resetPassword(ctx context.Context, email string) error {
	password := utils.PasswordAcak()
	hash, err := utils.HashPassword(password)
	if err != nil {
		return err
	}
	res, err := DB.NewUpdate().
		Model((*models.Petugas)(nil)).
		Set("password_hash = ?", hash).
		Set("token_versi = token_versi + 1").
		Where("email = ?", strings.ToLower(strings.TrimSpace(email))).
		Exec(ctx)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	fmt.Printf("Password baru untuk %s: %s\n", email, password)
	return nil
}

func nonaktifkan(ctx context.Context, email string) error {
	res, err := DB.NewUpdate().
		Model((*models.Petugas)(nil)).
		Set("aktif = false").
		Set("token_versi = token_versi + 1").
		Where("email = ?", strings.ToLower(strings.TrimSpace(email))).
		Exec(ctx)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	fmt.Println("Akun dinonaktifkan dan semua sesinya diakhiri.")
	return nil
}

func daftar(ctx context.Context) error {
	var puskesmas []models.Puskesmas
	if err := DB.NewSelect().Model(&puskesmas).Order("nama").Scan(ctx); err != nil {
		return err
	}
	var petugas []models.Petugas
	if err := DB.NewSelect().Model(&petugas).Order("email").Scan(ctx); err != nil {
		return err
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "PUSKESMAS ID\tNAMA\tKOTA")
	for _, p := range puskesmas {
		fmt.Fprintf(w, "%s\t%s\t%s\n", p.ID, p.Nama, p.Kota)
	}
	fmt.Fprintln(w, "\nEMAIL PETUGAS\tNAMA\tPUSKESMAS ID\tAKTIF")
	for _, p := range petugas {
		fmt.Fprintf(w, "%s\t%s\t%s\t%v\n", p.Email, p.Nama, p.PuskesmasID, p.Aktif)
	}
	return w.Flush()
}
