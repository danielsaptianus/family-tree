# 🌳 Family Tree Backend Engine (NestJS + PostgreSQL + D3.js)

<div align="center">
  <p><strong>High-Performance Family Tree Rendering Engine & Directed Acyclic Graph (DAG) Traversal</strong></p>
  <p>Built with <strong>NestJS</strong>, <strong>PostgreSQL 16 (btree_gist & Recursive CTE)</strong>, <strong>Prisma 7</strong>, and <strong>D3.js Tree Generator</strong>.</p>
</div>

---

## 🌟 Key Engineering Highlights

- ⚡ **Zero N+1 Query Architecture**: Seluruh pohon silsilah keluarga, berapa pun besarnya, dirender dalam **maksimal 4 kueri database batch** (NFR-02 SLA).
- 🚀 **High-Performance Benchmark**: Teruji *stress-test* pada dataset sintetis **5.000 anggota keluarga lintas 10 generasi** dengan waktu respons **p95 = 314 ms** (target SLA < 500 ms) dan rata-rata latency **233 ms**.
- 🛡️ **Anti-Overlap Marriage Constraint**: Menggunakan ekstensi PostgreSQL `btree_gist` dan constraint `EXCLUDE USING gist` untuk mencegah periode pernikahan bertubrukan langsung di level *database engine*.
- 🔄 **Recursive Common Table Expressions (CTE)**: Traversal garis keturunan (*descendants*) dan leluhur (*ancestors*) berkecepatan tinggi dengan pengaman array `path` untuk deteksi siklus real-time.
- 🎨 **D3-Ready Output Formats**: Menghasilkan 2 format data visualisasi:
  - **`hierarchy`**: Struktur JSON bersarang (*nested*) untuk `d3.hierarchy()` dan `d3.tree()`.
  - **`graph`**: Struktur datar (*flat*) `nodes` & `links` untuk visualisasi jejaring fisika `d3-force` dan `d3-dag`.
- 🧬 **Kompleksitas Kekerabatan Dunia Nyata**:
  - Dukungan poligami aktif (`allow_concurrent_partnerships`).
  - Menikah ulang dengan orang yang sama (cerai lalu rujuk).
  - Resolusi dinamis anak tiri (*stepchildren*) dengan penanda `isDerived: true`.
  - Pernikahan antar-sepupu (*consanguinity*) tanpa duplikasi node pada format graf.
  - Otomatisasi penghubungan kedua orang tua kandung (Ayah & Ibu) dalam satu request.
- 🔒 **Keamanan & Guardrails**:
  - Proteksi batas memori: Menolak permintaan render > 10.000 node dengan aman (`HTTP 422 TREE_TOO_LARGE`).
  - Rate Limiter: Batas 100 request/menit per IP via `@nestjs/throttler` (`HTTP 429 Too Many Requests`).
  - Role-Based Access Control (RBAC) dengan JWT dan otentikasi admin.

---

## ⚙️ Persyaratan Sistem

- **Node.js**: `>= 20.x`
- **PostgreSQL**: `>= 16.x` (dengan ekstensi `btree_gist` aktif)
- **Docker & Docker Compose** (opsional untuk containerized deployment)

---

## 🚀 Panduan Menjalankan Sistem

### Opsi A: Menggunakan Docker Compose (Paling Cepat & Direkomendasikan)

1. **Jalankan Container Database & Backend:**
```bash
docker compose up -d --build
```
2. Aplikasi otomatis berjalan di:
   - **Backend API**: `http://localhost:3000/`
   - **Swagger Docs**: `http://localhost:3000/docs` atau `http://localhost:3000/api/docs`
   - **Health Check**: `http://localhost:3000/health`

---

### Opsi B: Menjalankan Secara Lokal (Local Environment)

1. **Install Dependencies:**
```bash
npm install
```

2. **Konfigurasi Environment:**
Salin template konfigurasi:
```bash
cp .env.example .env
```
Pastikan variabel `DATABASE_URL` mengarah ke database PostgreSQL lokalmu.

3. **Migrasi Database & Seeder:**
```bash
# Generate Prisma Client
npm run prisma:generate

# Jalankan migrasi skema tabel & GiST constraint
npx prisma migrate dev

# Seed database dengan data role dan akun admin bawaan
npm run prisma:seed
```

4. **Jalankan Aplikasi:**
```bash
# Mode Development (Hot-Reload)
npm run start:dev

# Mode Production Build
npm run build
npm run start:prod
```

---

## 📖 Dokumentasi API & Swagger UI

Dokumentasi interaktif OpenAPI / Swagger dapat diakses langsung melalui browser di:
👉 **[http://localhost:3000/docs](http://localhost:3000/docs)** atau **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

### Akun Bawaan Seeder:
- **Email**: `admin@gmail.com`
- **Password**: `password123`

---

## 🧪 Pengujian & Benchmarking

Project ini dilengkapi test suite terotomatisasi untuk memverifikasi performa dan kasus-kasus silsilah ekstrem:

```bash
# 1. Jalankan Suite 11 Skenario Silsilah Ekstrem (Edge Cases)
npx ts-node -r tsconfig-paths/register scratch/test_milestone5_all_edge_cases.ts

# 2. Jalankan Stress-Test & Benchmark Performa (5.000 Nodes, p95 Latency)
npx ts-node -r tsconfig-paths/register scratch/benchmark_tree_performance.ts

# 3. Jalankan Pengujian Unit & E2E NestJS
npm run test
```

---

## 📊 Hasil Pengujian Benchmark (NFR-01 SLA)

Hasil pengujian stress-test render 30 iterasi berturut-turut pada **5.000 nodes dan depth 10**:

| Metrik | Hasil Aktual | Target SLA | Status |
|---|---|---|---|
| **Min Latency** | 189.45 ms | - | ✅ Sangat Cepat |
| **Average Latency** | 233.16 ms | - | ✅ Sangat Cepat |
| **p50 (Median)** | 226.59 ms | - | ✅ Sangat Cepat |
| **p90 Latency** | 307.97 ms | - | ✅ Stabil |
| **p95 Latency** | **314.07 ms** | **< 500 ms** | **PASSED (37% lebih cepat dari SLA) ✅** |
| **Database Queries**| **4 queries** | **<= 4 queries**| **Zero N+1 Problem ✅** |
| **Node Guardrail** | **HTTP 422** | **> 10.000 nodes** | **`TREE_TOO_LARGE` Proteksi Memori ✅** |

---

## 🗺️ Arsitektur Endpoint Inti

- `POST /api/v1/auth/login`: Otentikasi dan penerbitan access token JWT.
- `POST /api/v1/trees`: Membuat pohon silsilah keluarga baru.
- `POST /api/v1/trees/:treeId/persons`: Menambahkan person baru ke pohon.
- `POST /api/v1/trees/:treeId/partnerships`: Mendaftarkan pernikahan/pasangan (anti-overlap).
- `POST /api/v1/trees/:treeId/parent-child`: Menghubungkan orang tua dan anak (mendukung otomatisasi kedua orang tua kandung).
- `GET /api/v1/trees/:treeId/my-view`: Tampilan silsilah terfokus user (2 generasi ke atas, saudara selevel, paman/bibi, dan seluruh keturunan ke bawah).
- `GET /api/v1/trees/:treeId/render`: Mesin render pohon D3.js:
  - Query params: `direction` (`descendants`/`ancestors`), `format` (`hierarchy`/`graph`), `depth` (1–20), `includeStepChildren`, `includePartners`, `relationTypes`, `unionStatuses`.

---

## 📜 Lisensi

Project ini dilisensikan di bawah lisensi MIT.