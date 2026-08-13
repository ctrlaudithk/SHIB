// Excel/CSV import + CSV export utilities.
// Parses XLSX/XLS/CSV files using sheetjs (xlsx). All parsing runs in-JS,
// on-device (no server round trip).

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";

import type { MasterProduct, ScanEntry } from "./db";

export type ImportResult =
  | { ok: true; items: MasterProduct[] }
  | { ok: false; error: string };

/**
 * Ask the user to pick an xlsx/xls/csv file, parse the first sheet.
 * Column layout: A = Barcode, B = Kode Produk, C = Nama Produk.
 * First row is treated as header IF it doesn't look like a real barcode row.
 */
export async function importMasterFromFile(): Promise<ImportResult> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "text/comma-separated-values",
        "*/*",
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (res.canceled || !res.assets?.[0]) {
      return { ok: false, error: "Dibatalkan pengguna" };
    }

    const asset = res.assets[0];
    const uri = asset.uri;
    const nameLower = (asset.name || "").toLowerCase();
    const isCsv = nameLower.endsWith(".csv") || asset.mimeType?.includes("csv");

    let workbook: XLSX.WorkBook;

    if (isCsv) {
      const text = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      workbook = XLSX.read(text, { type: "string" });
    } else {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      workbook = XLSX.read(b64, { type: "base64" });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { ok: false, error: "File kosong" };

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (!rows.length) return { ok: false, error: "Tidak ada baris data" };

    // Skip a header row heuristically (if first row contains word "barcode"/"kode"/"nama")
    let startIdx = 0;
    const first = (rows[0] || []).map((v: any) => String(v).toLowerCase());
    if (
      first.some((c: string) => c.includes("barcode")) ||
      first.some((c: string) => c.includes("kode")) ||
      first.some((c: string) => c.includes("nama"))
    ) {
      startIdx = 1;
    }

    const items: MasterProduct[] = [];
    for (let i = startIdx; i < rows.length; i++) {
      const r = rows[i] || [];
      const barcode = String(r[0] ?? "").trim();
      const code = String(r[1] ?? "").trim();
      const name = String(r[2] ?? "").trim();
      if (!barcode && !code && !name) continue;
      if (!barcode || !code) continue;
      items.push({ barcode, code, name });
    }

    if (!items.length) return { ok: false, error: "Tidak ditemukan data valid" };
    return { ok: true, items };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Gagal membaca file" };
  }
}

/**
 * Export scan entries to CSV and open the native share sheet.
 */
export async function exportEntriesToCSV(entries: ScanEntry[], username: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!entries.length) return { ok: false, error: "Belum ada data scan" };

    // Order the export by sequence ascending (nice for reading)
    const ordered = [...entries].sort((a, b) => a.sequence - b.sequence);
    const header = ["No", "Barcode", "Kode Produk", "Nama Produk", "Karton", "Lusin", "Pcs", "Waktu Input", "Pengguna"];
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [header.join(",")];
    for (const e of ordered) {
      const t = new Date(e.createdAt).toISOString();
      lines.push([
        e.sequence,
        escape(e.barcode),
        escape(e.code),
        escape(e.name),
        e.karton,
        e.lusin,
        e.pcs,
        escape(t),
        escape(username || ""),
      ].join(","));
    }
    const csv = "\uFEFF" + lines.join("\n"); // BOM for Excel

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileUri = `${FileSystem.cacheDirectory}gudangscan-${ts}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Simpan hasil scan",
        UTI: "public.comma-separated-values-text",
      });
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Gagal export" };
  }
}
