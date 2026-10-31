package main

import (
	"log"
	"os"

	config "selaras/Config"
	routes "selaras/Routes"
	"selaras/Setup"
	utils "selaras/Utils"
)

func main() {
	config.Load()
	Setup.Connect()
	Setup.Migrate()

	// Ada argumen -> perintah admin (lihat Setup/admin.go), bukan server.
	if len(os.Args) > 1 {
		Setup.JalankanPerintah(os.Args[1:])
		return
	}

	utils.InitJWT()

	app := routes.NewApp(Setup.DB, config.Get("PROXY_HEADER"))
	routes.Frontend(app, config.Get("STATIC_DIR"))

	// Default hanya mendengar di localhost. Akses dari luar lewat tunnel/proxy.
	addr := config.GetDefault("APP_ADDR", "127.0.0.1:8080")
	log.Fatal(app.Listen(addr))
}
