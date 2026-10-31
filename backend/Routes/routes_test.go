package routes

// Uji integrasi API + skema terhadap PostgreSQL sungguhan.
//
//   TEST_DATABASE_URL=postgres://.../selaras_test?sslmode=disable go test ./...
//
// PERINGATAN: skema public di database itu DIHAPUS dan dibuat ulang.
// Pakai database khusus uji, jangan database produksi.
// Tanpa TEST_DATABASE_URL, uji ini dilewati.

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	models "selaras/Models"
	setupdb "selaras/Setup"
	utils "selaras/Utils"

	"github.com/gofiber/fiber/v2"
	"github.com/uptrace/bun"
)

const (
	pkA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	pkB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	pwd = "password-uji-123"
)

type respons struct {
	status int
	body   map[string]any
	cookie string // nilai "selaras_token=..." dari Set-Cookie, bila ada
	header http.Header
}

type klien struct {
	t   *testing.T
	app *fiber.App
}

func (k klien) kirim(method, path string, body any, cookie string) respons {
	k.t.Helper()
	var r io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, r)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	res, err := k.app.Test(req, -1)
	if err != nil {
		k.t.Fatal(err)
	}
	defer res.Body.Close()

	out := respons{status: res.StatusCode, header: res.Header}
	raw, _ := io.ReadAll(res.Body)
	_ = json.Unmarshal(raw, &out.body)
	for _, c := range res.Cookies() {
		if c.Name == utils.NamaCookie {
			out.cookie = c.Name + "=" + c.Value
		}
	}
	return out
}

func (k klien) login(email string) string {
	k.t.Helper()
	r := k.kirim("POST", "/api/login", map[string]string{"email": email, "password": pwd}, "")
	if r.status != 200 || r.cookie == "" {
		k.t.Fatalf("login %s gagal: %d %v", email, r.status, r.body)
	}
	return r.cookie
}

func harap(t *testing.T, label string, aktual, harapan any) {
	t.Helper()
	if aktual != harapan {
		t.Errorf("%s: aktual=%v harapan=%v", label, aktual, harapan)
	}
}

func siapkanDB(t *testing.T) *bun.DB {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL kosong; uji integrasi dilewati")
	}
	t.Setenv("DATABASE_URL", dsn)
	t.Setenv("JWT_SECRET", strings.Repeat("r", 40))
	t.Setenv("APP_ENV", "development")
	utils.InitJWT()

	setupdb.Connect()
	ctx := context.Background()
	if _, err := setupdb.DB.ExecContext(ctx, "drop schema public cascade; create schema public;"); err != nil {
		t.Fatal(err)
	}
	setupdb.Migrate()
	setupdb.Migrate() // harus aman dijalankan dua kali

	db := setupdb.DB
	hash, _ := utils.HashPassword(pwd)
	db.NewInsert().Model(&[]models.Puskesmas{
		{ID: pkA, Nama: "Puskesmas A", Kota: "Surabaya"},
		{ID: pkB, Nama: "Puskesmas B", Kota: "Surabaya"},
	}).Exec(ctx)
	_, err := db.NewInsert().Model(&[]models.Petugas{
		{PuskesmasID: pkA, Nama: "Petugas A1", Email: "a1@uji.id", PasswordHash: hash, Aktif: true},
		{PuskesmasID: pkA, Nama: "Petugas A2", Email: "a2@uji.id", PasswordHash: hash, Aktif: true},
		{PuskesmasID: pkB, Nama: "Petugas B1", Email: "b1@uji.id", PasswordHash: hash, Aktif: true},
	}).Exec(ctx)
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func auditL1(posyanduID string) map[string]any {
	// Angka Tabel L.1 proposal
	return map[string]any{
		"posyandu_id": posyanduID, "periode": "2026-10",
		"jumlah_sampel": 20, "jumlah_tercatat_asik": 17, "jml_tidak_ada_di_asik": 3,
		"jml_tidak_sesuai": 3, "jml_selisih_tanggal": 0, "jml_selisih_bb": 2, "jml_selisih_tb": 1,
		"jml_terlambat": 4, "catatan": "sampel 20 dari 63 balita",
	}
}

func salin(m map[string]any, ubah map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range m {
		out[k] = v
	}
	for k, v := range ubah {
		out[k] = v
	}
	return out
}

func TestAPI(t *testing.T) {
	db := siapkanDB(t)
	ctx := context.Background()
	k := klien{t: t, app: NewApp(db, "")}

	// ---------------- autentikasi ----------------
	r := k.kirim("GET", "/api/sehat", nil, "")
	harap(t, "sehat", r.status, 200)
	harap(t, "header CSP ada", r.header.Get("Content-Security-Policy") != "", true)
	harap(t, "API no-store", r.header.Get("Cache-Control"), "no-store")

	harap(t, "tanpa cookie", k.kirim("GET", "/api/saya", nil, "").status, 401)
	harap(t, "cookie palsu", k.kirim("GET", "/api/saya", nil, utils.NamaCookie+"=abc.def.ghi").status, 401)
	harap(t, "password salah", k.kirim("POST", "/api/login", map[string]string{"email": "a1@uji.id", "password": "salah"}, "").status, 401)
	harap(t, "email tidak ada", k.kirim("POST", "/api/login", map[string]string{"email": "x@uji.id", "password": pwd}, "").status, 401)

	r = k.kirim("POST", "/api/login", map[string]string{"email": "  A1@Uji.ID ", "password": pwd}, "")
	harap(t, "login (email dinormalisasi)", r.status, 200)
	_, adaToken := r.body["token"]
	harap(t, "token TIDAK dikirim di body", adaToken, false)
	sc := r.header.Get("Set-Cookie")
	harap(t, "cookie HttpOnly", strings.Contains(sc, "HttpOnly"), true)
	harap(t, "cookie SameSite=Strict", strings.Contains(strings.ToLower(sc), "samesite=strict"), true)

	a1 := k.login("a1@uji.id")
	a2 := k.login("a2@uji.id")
	b1 := k.login("b1@uji.id")

	r = k.kirim("GET", "/api/saya", nil, a1)
	user := r.body["user"].(map[string]any)
	harap(t, "saya.puskesmas", user["puskesmas"].(map[string]any)["nama"], "Puskesmas A")
	_, adaHash := user["password_hash"]
	harap(t, "hash password tidak bocor", adaHash, false)

	// Form HTML lintas situs tidak bisa mengirim JSON
	req := httptest.NewRequest("POST", "/api/posyandu", strings.NewReader("nama=x"))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Cookie", a1)
	res, _ := k.app.Test(req, -1)
	harap(t, "POST form-urlencoded ditolak", res.StatusCode, 415)

	// ---------------- posyandu & isolasi ----------------
	r = k.kirim("POST", "/api/posyandu", map[string]string{"nama": " Melati ", "kelurahan": "Keputih"}, a1)
	harap(t, "a1 tambah posyandu", r.status, 201)
	melatiA := r.body["data"].(map[string]any)["id"].(string)

	harap(t, "nama kembar satu puskesmas", k.kirim("POST", "/api/posyandu", map[string]string{"nama": "Melati"}, a2).status, 409)
	harap(t, "nama kosong", k.kirim("POST", "/api/posyandu", map[string]string{"nama": "  "}, a1).status, 400)

	r = k.kirim("POST", "/api/posyandu", map[string]string{"nama": "Melati"}, b1)
	harap(t, "nama sama di puskesmas lain boleh", r.status, 201)
	melatiB := r.body["data"].(map[string]any)["id"].(string)

	r = k.kirim("GET", "/api/posyandu", nil, a1)
	daftar := r.body["data"].([]any)
	harap(t, "a1 hanya melihat 1 posyandu", len(daftar), 1)
	harap(t, "posyandu a1 = milik A", daftar[0].(map[string]any)["id"], melatiA)
	_, adaPk := daftar[0].(map[string]any)["puskesmas_id"]
	harap(t, "puskesmas_id tidak diekspos", adaPk, false)

	harap(t, "b1 ubah posyandu A", k.kirim("PUT", "/api/posyandu/"+melatiA, map[string]string{"nama": "Diretas"}, b1).status, 404)
	harap(t, "id bukan uuid", k.kirim("PUT", "/api/posyandu/bukan-uuid", map[string]string{"nama": "X"}, a1).status, 404)
	harap(t, "a2 ubah posyandu puskesmasnya", k.kirim("PUT", "/api/posyandu/"+melatiA, map[string]string{"nama": "Melati", "kelurahan": "Sukolilo"}, a2).status, 200)

	// ---------------- audit ----------------
	body := salin(auditL1(melatiA), map[string]any{
		// field yang tidak boleh diisi klien: harus diabaikan
		"persen_kelengkapan": 99, "petugas_id": "33333333-3333-3333-3333-333333333333",
	})
	r = k.kirim("POST", "/api/audit", body, a1)
	harap(t, "a1 simpan audit L.1", r.status, 201)
	auditPertama := r.body["data"].(map[string]any)["id"].(string)

	harap(t, "b1 audit ke posyandu A", k.kirim("POST", "/api/audit", auditL1(melatiA), b1).status, 404)
	harap(t, "angka tidak konsisten", k.kirim("POST", "/api/audit", salin(auditL1(melatiA), map[string]any{"jml_tidak_ada_di_asik": 2}), a1).status, 400)
	harap(t, "rincian > tidak_sesuai", k.kirim("POST", "/api/audit", salin(auditL1(melatiA), map[string]any{"jml_tidak_sesuai": 1}), a1).status, 400)
	harap(t, "angka negatif", k.kirim("POST", "/api/audit", salin(auditL1(melatiA), map[string]any{"jml_terlambat": -1}), a1).status, 400)
	harap(t, "angka di luar int", k.kirim("POST", "/api/audit", salin(auditL1(melatiA), map[string]any{"jumlah_sampel": 5000000000, "jml_tidak_ada_di_asik": 4999999983}), a1).status, 400)
	harap(t, "periode masa depan", k.kirim("POST", "/api/audit", salin(auditL1(melatiA), map[string]any{"periode": "2999-01"}), a1).status, 400)
	harap(t, "periode format salah", k.kirim("POST", "/api/audit", salin(auditL1(melatiA), map[string]any{"periode": "10/2026"}), a1).status, 400)
	harap(t, "catatan > 200", k.kirim("POST", "/api/audit", salin(auditL1(melatiA), map[string]any{"catatan": strings.Repeat("x", 201)}), a1).status, 400)

	r = k.kirim("GET", "/api/tren", nil, a1)
	tren := r.body["data"].([]any)
	harap(t, "tren a1: 1 baris", len(tren), 1)
	baris := tren[0].(map[string]any)
	harap(t, "kelengkapan 85", baris["persen_kelengkapan"], 85.0)
	harap(t, "kesesuaian 82.35", baris["persen_kesesuaian"], 82.35)
	harap(t, "ketepatan 76.47", baris["persen_ketepatan"], 76.47)
	harap(t, "periode YYYY-MM", baris["periode"], "2026-10")

	var petugasAudit string
	db.NewRaw("select p.email from audit_run a join petugas p on p.id = a.petugas_id where a.id = ?", auditPertama).Scan(ctx, &petugasAudit)
	harap(t, "petugas_id dari sesi, bukan dari klien", petugasAudit, "a1@uji.id")

	harap(t, "b1 tidak melihat tren A", len(k.kirim("GET", "/api/tren", nil, b1).body["data"].([]any)), 0)
	harap(t, "b1 tidak melihat riwayat A", len(k.kirim("GET", "/api/audit", nil, b1).body["data"].([]any)), 0)
	harap(t, "b1 filter tren posyandu A", len(k.kirim("GET", "/api/tren?posyandu_id="+melatiA, nil, b1).body["data"].([]any)), 0)

	// Audit ulang periode sama: dashboard memakai yang terbaru
	ulang := salin(auditL1(melatiA), map[string]any{"jumlah_tercatat_asik": 18, "jml_tidak_ada_di_asik": 2})
	r = k.kirim("POST", "/api/audit", ulang, a1)
	harap(t, "audit ulang", r.status, 201)
	auditUlang := r.body["data"].(map[string]any)["id"].(string)
	tren = k.kirim("GET", "/api/tren", nil, a1).body["data"].([]any)
	harap(t, "tren tetap 1 baris per periode", len(tren), 1)
	harap(t, "tren memakai audit terbaru", tren[0].(map[string]any)["jumlah_tercatat_asik"], 18.0)

	riwayat := k.kirim("GET", "/api/audit", nil, a2).body["data"].([]any)
	harap(t, "a2 melihat 2 audit rekan", len(riwayat), 2)
	harap(t, "a2 tidak bisa menghapus audit a1", riwayat[0].(map[string]any)["bisa_dihapus"], false)

	harap(t, "a2 hapus audit a1", k.kirim("DELETE", "/api/audit/"+auditUlang, nil, a2).status, 404)
	harap(t, "b1 hapus audit a1", k.kirim("DELETE", "/api/audit/"+auditUlang, nil, b1).status, 404)
	harap(t, "a1 hapus audit sendiri < 24 jam", k.kirim("DELETE", "/api/audit/"+auditUlang, nil, a1).status, 200)
	tren = k.kirim("GET", "/api/tren", nil, a1).body["data"].([]any)
	harap(t, "tren kembali ke audit sebelumnya", tren[0].(map[string]any)["jumlah_tercatat_asik"], 17.0)

	db.NewRaw("update audit_run set dibuat_pada = now() - interval '30 hours' where id = ?", auditPertama).Exec(ctx)
	harap(t, "audit > 24 jam tidak bisa dihapus", k.kirim("DELETE", "/api/audit/"+auditPertama, nil, a1).status, 404)

	// kasus tepi: tidak ada balita di ASIK -> kesesuaian & ketepatan null
	nol := map[string]any{"posyandu_id": melatiB, "periode": "2026-09", "jumlah_sampel": 15, "jumlah_tercatat_asik": 0,
		"jml_tidak_ada_di_asik": 15, "jml_tidak_sesuai": 0, "jml_selisih_tanggal": 0, "jml_selisih_bb": 0, "jml_selisih_tb": 0, "jml_terlambat": 0}
	harap(t, "audit tercatat 0", k.kirim("POST", "/api/audit", nol, b1).status, 201)
	baris = k.kirim("GET", "/api/tren", nil, b1).body["data"].([]any)[0].(map[string]any)
	harap(t, "tercatat 0: kelengkapan 0", baris["persen_kelengkapan"], 0.0)
	harap(t, "tercatat 0: kesesuaian null", baris["persen_kesesuaian"], nil)

	// ---------------- batas body ----------------
	// Server sungguhan membalas 413; app.Test() Fiber mengembalikan error yang sama
	// sebelum handler mana pun berjalan.
	besar, _ := json.Marshal(salin(auditL1(melatiA), map[string]any{"catatan": strings.Repeat("x", 20*1024)}))
	req = httptest.NewRequest("POST", "/api/audit", bytes.NewReader(besar))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Cookie", a1)
	res, err := k.app.Test(req, -1)
	ditolak := (err != nil && strings.Contains(err.Error(), "body size exceeds")) || (err == nil && res.StatusCode == 413)
	harap(t, "body > 16 KB ditolak", ditolak, true)

	// ---------------- sesi ----------------
	harap(t, "a1 logout", k.kirim("POST", "/api/logout", map[string]any{}, a1).status, 200)
	harap(t, "token lama a1 setelah logout", k.kirim("GET", "/api/saya", nil, a1).status, 401)

	harap(t, "ganti password: lama salah", k.kirim("PUT", "/api/password", map[string]string{"password_lama": "salah", "password_baru": "password-baru-123"}, a2).status, 400)
	harap(t, "ganti password: terlalu pendek", k.kirim("PUT", "/api/password", map[string]string{"password_lama": pwd, "password_baru": "pendek"}, a2).status, 400)
	harap(t, "ganti password", k.kirim("PUT", "/api/password", map[string]string{"password_lama": pwd, "password_baru": "password-baru-123"}, a2).status, 200)
	harap(t, "token lama a2 setelah ganti password", k.kirim("GET", "/api/saya", nil, a2).status, 401)
	harap(t, "login password baru", k.kirim("POST", "/api/login", map[string]string{"email": "a2@uji.id", "password": "password-baru-123"}, "").status, 200)

	db.NewRaw("update petugas set aktif = false where email = 'b1@uji.id'").Exec(ctx)
	harap(t, "akun nonaktif: token ditolak", k.kirim("GET", "/api/saya", nil, b1).status, 401)
	harap(t, "akun nonaktif: login ditolak", k.kirim("POST", "/api/login", map[string]string{"email": "b1@uji.id", "password": pwd}, "").status, 401)

	// ---------------- rate limit login ----------------
	kodeTerakhir := 0
	for i := 0; i < 12; i++ {
		kodeTerakhir = k.kirim("POST", "/api/login", map[string]string{"email": "a1@uji.id", "password": "salah"}, "").status
	}
	harap(t, "login dibatasi setelah 10 percobaan", kodeTerakhir, 429)
}

func TestSkema(t *testing.T) {
	db := siapkanDB(t)
	ctx := context.Background()

	var posyanduID, petugasID string
	db.NewRaw("insert into posyandu (puskesmas_id, nama) values (?, 'Uji') returning id", pkA).Scan(ctx, &posyanduID)
	db.NewRaw("select id from petugas where email = 'a1@uji.id'").Scan(ctx, &petugasID)

	insert := func(periode string, n [8]int, catatan string) string {
		_, err := db.NewRaw(`insert into audit_run (posyandu_id, petugas_id, periode, jumlah_sampel, jumlah_tercatat_asik,
			jml_tidak_ada_di_asik, jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat, catatan)
			values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, nullif(?, ''))`,
			posyanduID, petugasID, periode, n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], catatan).Exec(ctx)
		if err == nil {
			return ""
		}
		var kode string
		if e, ok := err.(interface{ Field(byte) string }); ok {
			kode = e.Field('C')
		}
		return kode
	}

	kasus := []struct {
		label   string
		periode string
		n       [8]int // sampel, tercatat, tidak ada, tidak sesuai, sel tgl, sel bb, sel tb, terlambat
		catatan string
		harapan string
	}{
		{"valid (Tabel L.1)", "2026-10-01", [8]int{20, 17, 3, 3, 0, 2, 1, 4}, "", ""},
		{"periode bukan tanggal 1", "2026-10-15", [8]int{20, 17, 3, 3, 0, 2, 1, 4}, "", "23514"},
		{"sampel 0", "2026-09-01", [8]int{0, 0, 0, 0, 0, 0, 0, 0}, "", "23514"},
		{"tercatat + tidak ada <> sampel", "2026-09-01", [8]int{20, 17, 2, 3, 0, 2, 1, 4}, "", "23514"},
		{"tidak sesuai > tercatat", "2026-09-01", [8]int{20, 17, 3, 18, 18, 0, 0, 0}, "", "23514"},
		{"terlambat > tercatat", "2026-09-01", [8]int{20, 17, 3, 0, 0, 0, 0, 18}, "", "23514"},
		{"rincian terbesar > tidak sesuai", "2026-09-01", [8]int{20, 17, 3, 1, 0, 2, 0, 0}, "", "23514"},
		{"tidak sesuai > jumlah rincian", "2026-09-01", [8]int{20, 17, 3, 3, 1, 1, 0, 0}, "", "23514"},
		{"angka negatif", "2026-09-01", [8]int{20, 17, 3, -1, 0, 0, 0, 0}, "", "23514"},
		{"catatan > 200", "2026-09-01", [8]int{20, 17, 3, 0, 0, 0, 0, 0}, strings.Repeat("x", 201), "23514"},
	}
	for _, c := range kasus {
		harap(t, c.label, insert(c.periode, c.n, c.catatan), c.harapan)
	}

	_, err := db.NewRaw(`insert into audit_run (posyandu_id, petugas_id, periode, jumlah_sampel, jumlah_tercatat_asik,
		jml_tidak_ada_di_asik, jml_tidak_sesuai, jml_selisih_tanggal, jml_selisih_bb, jml_selisih_tb, jml_terlambat, persen_kelengkapan)
		values (?, ?, '2026-08-01', 20, 17, 3, 0, 0, 0, 0, 0, 99)`, posyanduID, petugasID).Exec(ctx)
	harap(t, "kolom persen tidak bisa diisi (generated)", err != nil, true)

	_, err = db.NewRaw("delete from posyandu where id = ?", posyanduID).Exec(ctx)
	harap(t, "posyandu ber-audit tidak bisa dihapus", err != nil, true)
	_, err = db.NewRaw("insert into petugas (puskesmas_id, nama, email, password_hash) values (?, 'X', 'Besar@uji.id', 'x')", pkA).Exec(ctx)
	harap(t, "email petugas wajib huruf kecil", err != nil, true)

	// Tidak ada kolom/tabel per balita
	var teks string
	db.NewRaw(`select string_agg(column_name, ',' order by column_name) from information_schema.columns
		where table_schema = 'public' and table_name = 'audit_run'
		and data_type in ('text', 'character varying', 'character', 'json', 'jsonb', 'bytea', 'ARRAY')`).Scan(ctx, &teks)
	harap(t, "audit_run: satu-satunya kolom teks = catatan", teks, "catatan")

	var tanggal string
	db.NewRaw(`select string_agg(column_name, ',') from information_schema.columns
		where table_schema = 'public' and table_name = 'audit_run' and data_type = 'date'`).Scan(ctx, &tanggal)
	harap(t, "audit_run: satu-satunya kolom date = periode", tanggal, "periode")

	var tabel string
	db.NewRaw(`select string_agg(table_name, ',' order by table_name) from information_schema.tables
		where table_schema = 'public' and table_type = 'BASE TABLE'`).Scan(ctx, &tabel)
	harap(t, "hanya 4 tabel", tabel, "audit_run,petugas,posyandu,puskesmas")
}

func TestFrontendFallback(t *testing.T) {
	db := siapkanDB(t)
	// Bukan t.TempDir(): di Windows file server Fiber masih memegang index.html
	// saat cleanup, sehingga penghapusan dibuat best-effort.
	dir, _ := os.MkdirTemp("", "selaras-static")
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("<!doctype html><title>SELARAS</title>"), 0o644)

	app := NewApp(db, "")
	Frontend(app, dir)
	k := klien{t: t, app: app}

	req := httptest.NewRequest("GET", "/riwayat", nil)
	res, _ := app.Test(req, -1)
	isi, _ := io.ReadAll(res.Body)
	harap(t, "route SPA -> index.html", res.StatusCode, 200)
	harap(t, "isi index.html", strings.Contains(string(isi), "SELARAS"), true)

	harap(t, "endpoint API tidak dikenal tetap JSON 404", k.kirim("GET", "/api/tidak-ada", nil, k.login("a1@uji.id")).status, 404)
}
