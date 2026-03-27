# WhatsApp Bug-Payload API (Baileys-Based)

Dokumentasi API berbasis Node.js untuk mengelola sesi WhatsApp menggunakan library `@whiskeysockets/baileys`. Skrip ini mendukung autentikasi via Pairing Code, penyimpanan sesi di **Redis**, dan pengiriman berbagai jenis payload pesan (Crash, Freeze, Lag).

> **⚠️ Disclaimer:** Gunakan skrip ini hanya untuk tujuan edukasi atau pengujian penetrasi (pentesting) pada perangkat milik sendiri. Penyalahgunaan untuk merugikan orang lain adalah tanggung jawab pengguna sepenuhnya.

---

## 🚀 Fitur Utama

* **Session Management:** Menggunakan Redis untuk menyimpan state autentikasi secara persisten.
* **Pairing Code:** Login tanpa scan QR, cukup menggunakan nomor telepon.
* **Multi-Session Ready:** Menggunakan cookie-based session ID untuk memisahkan sesi antar pengguna.
* **Custom Payloads:** Tersedia fungsi `Crash Infinity`, `Blank Freeze`, dan `Lag Flood`.
* **Express API:** Endpoint yang siap diintegrasikan dengan frontend atau tools lain.

---

## 🛠️ Persyaratan Sistem

* **Node.js** v18 atau lebih tinggi.
* **Redis Server** (untuk penyimpanan sesi).
* **NPM** atau **Yarn**.

---

## 📦 Instalasi

1.  **Clone atau simpan skrip** ke direktori lokal Anda.
2.  **Instal dependensi** yang diperlukan:
    ```bash
    npm install express dotenv chalk ioredis pino @whiskeysockets/baileys crypto cookie-parser
    ```
3.  **Konfigurasi Environment:**
    Buat file `.env` di direktori root dan masukkan kredensial Redis Anda:
    ```env
    REDIS_HOST=your_link_host_redis
    REDIS_PORT=6379
    REDIS_PASSWORD=your_redis_password
    ```

---

## 📡 API Endpoints

Semua endpoint menggunakan cookie `whatsapp_session` untuk melacak sesi Anda secara otomatis.

### 1. Cek Status Sesi
Melihat apakah sesi Anda sudah terhubung ke WhatsApp atau belum.
* **URL:** `GET /api/status`
* **Response:**
    ```json
    { "success": true, "connected": false, "phone": null }
    ```

### 2. Pairing Device
Meminta kode pairing untuk menghubungkan nomor WhatsApp.
* **URL:** `POST /api/pair`
* **Body:** `{ "phone": "628123456789" }`
* **Response:**
    ```json
    { "success": true, "code": "ABCD-EFGH" }
    ```

### 3. Kirim Payload (Bug)
Mengirimkan pesan payload ke target tertentu.
* **URL:** `POST /api/send`
* **Body:** ```json
    { 
      "to": "628xxxxxx", 
      "bugType": "Crash Infinity" 
    }
    ```
* **Opsi `bugType`:** `Crash Infinity`, `Blank Freeze`, `Lag Flood`.

### 4. Reset Sesi
Menghapus sesi dari Redis dan memutus koneksi WhatsApp.
* **URL:** `POST /api/reset`

---

## 📂 Struktur Arsitektur Skrip

* **Redis Integration:** Menggunakan `getAuthState` kustom untuk membaca/menulis `creds` dan `keys` langsung ke Redis, sehingga sesi tidak hilang saat server restart.
* **Socket Manager:** Fungsi `getOrCreateSocket` memastikan hanya ada satu koneksi aktif per ID sesi.
* **Payload Logic:** Menggunakan `sock.relayMessage` dengan struktur protobuf manual untuk memicu glitch pada client WhatsApp target.

---

## 🛠️ Pengembangan
Jika Anda ingin menjalankan server ini, pastikan Anda memanggil `app.listen()` di file utama Anda:
```javascript
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
```

- Ilhamm
