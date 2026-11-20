# syntax=docker/dockerfile:1
#
# Satu image berisi binary Go dan hasil build frontend (dist), sama seperti
# susunan deploy manual di README: binary yang sama menyajikan /api dan frontend.

# --- 1. Frontend ---------------------------------------------------------
# Debian (glibc), sama dengan lingkungan development, supaya binding native
# Vite/Tailwind yang terpasang sama dengan yang sudah teruji.
FROM node:22-slim AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- 2. Backend ----------------------------------------------------------
FROM golang:1.25-alpine AS backend
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
# CGO mati: binary statis, tidak bergantung pada libc image akhir.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /selaras .

# --- 3. Image akhir ------------------------------------------------------
FROM alpine:3.22
RUN adduser -D -H -u 10001 selaras
WORKDIR /app
COPY --from=backend /selaras /app/selaras
# dist dimiliki user aplikasi: Fiber menyimpan salinan terkompresi (.fiber.gz)
# di samping berkas aslinya saat pertama kali diminta.
COPY --from=frontend --chown=selaras:selaras /src/dist /app/dist

# Di dalam container server harus mendengar di semua antarmuka; pembatasan ke
# localhost dilakukan lewat pemetaan port di docker-compose.yml.
ENV APP_ADDR=0.0.0.0:8080 \
    STATIC_DIR=/app/dist
EXPOSE 8080
USER selaras

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/api/sehat || exit 1

# Tanpa argumen = server. Dengan argumen = perintah admin, mis.
#   docker compose exec app /app/selaras daftar
ENTRYPOINT ["/app/selaras"]
