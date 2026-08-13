# GudangScan — Product Requirements Doc

## Ringkasan
Aplikasi Android/mobile offline-first untuk scan barcode produk dan input qty (Karton/Lusin/Pcs) di gudang. Semua data disimpan lokal di HP. Support import master produk dari Excel/CSV dan export hasil scan ke CSV.

## Fitur Utama (v1.0 MVP)
- Onboarding sekali pakai untuk memasukkan nama pengguna (disimpan lokal).
- Scan barcode via kamera (expo-camera) + input manual barcode dengan tombol CARI.
- Lookup ke master produk lokal (AsyncStorage): 
  - 1 kandidat → auto-select kode & langsung ke input qty.
  - 2+ kandidat → chip horizontal scroll untuk pilih kode.
  - 0 kandidat → auto-open sheet "Produk Baru" (prefilled barcode).
- Menampilkan info produk terpilih: KODE, NAMA + total kumulatif Karton/Lusin/Pcs untuk kode itu + jumlah input sebelumnya.
- Input qty Karton, Lusin, Pcs (numeric only) → SIMPAN.
- List hasil scan di bagian bawah, data terbaru di atas, dengan nomor urut.
- Double-tap row → sheet dengan opsi EDIT / HAPUS.
  - EDIT: memuat data ke form atas, nomor urut tetap.
  - HAPUS: re-sequence otomatis agar tidak ada lompatan nomor.
- Menu:
  - Import Master (XLSX / XLS / CSV) — kolom: A=Barcode, B=Kode, C=Nama.
  - Lihat/kelola Master Produk (search, hapus per baris, reset semua).
  - Tambah Produk Manual.
  - Export CSV → share ke aplikasi lain (WhatsApp, Drive, Email).
  - Reset sesi scan.
- Halaman Master Produk terpisah dengan search + hapus per baris + reset.

## Tech Stack
- Expo SDK 54 + Expo Router (file-based routing).
- React Native 0.81, TypeScript.
- expo-camera untuk barcode scanning (semua tipe: EAN, UPC, Code128, QR, dsb).
- @react-native-async-storage/async-storage untuk penyimpanan lokal.
- xlsx (sheetjs) untuk parsing XLSX/XLS/CSV.
- expo-document-picker untuk pilih file.
- expo-file-system + expo-sharing untuk export CSV.
- @gorhom/bottom-sheet untuk sheet menu, add master, edit/delete.
- expo-haptics untuk feedback taktil (scan success, save, delete).

## Design
- Brutalist Mobile LIGHT: putih, hitam, aksen Signal Green (#00E676).
- 2pt border hitam untuk semua elemen struktural.
- 0px border-radius (tegas, block).
- Space Grotesk & Space Mono (fallback: system + monospace).

## File Utama
- `/app/frontend/app/_layout.tsx` — root Stack + GestureHandlerRootView + SafeAreaProvider.
- `/app/frontend/app/index.tsx` — boot router, redirect ke onboarding / scan.
- `/app/frontend/app/onboarding.tsx` — input nama pengguna.
- `/app/frontend/app/scan.tsx` — main split-screen (kamera + form di atas, list di bawah).
- `/app/frontend/app/master.tsx` — kelola master produk.
- `/app/frontend/src/lib/theme.ts` — design tokens.
- `/app/frontend/src/lib/db.ts` — AsyncStorage CRUD (user, master, entries).
- `/app/frontend/src/lib/excel.ts` — import XLSX/CSV + export CSV.
- `/app/frontend/src/lib/fonts.ts` — font family helpers.

## Roadmap Berikutnya
- Icon kamera + torch (flashlight) toggle.
- Statistik ringkas: total scan hari ini, jumlah kode unik.
- Filter list hasil scan.
- Undo delete (5 detik).
- Multi-session (label sesi, arsip export).
