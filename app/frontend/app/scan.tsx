import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  addEntry,
  addMasterProduct,
  clearEntries,
  deleteEntry,
  findMastersByBarcode,
  getEntries,
  getUsername,
  totalsForCode,
  updateEntry,
  type MasterProduct,
  type ScanEntry,
} from "@/src/lib/db";
import { exportEntriesToCSV, importMasterFromFile } from "@/src/lib/excel";
import { displayFont, monoFont } from "@/src/lib/fonts";
import { border, colors, spacing, type as t } from "@/src/lib/theme";

type Totals = { karton: number; lusin: number; pcs: number; count: number };

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [scannerOn, setScannerOn] = useState(true);
  const [username, setUsernameState] = useState("");

  const [barcode, setBarcode] = useState("");
  const [candidates, setCandidates] = useState<MasterProduct[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [karton, setKarton] = useState("");
  const [lusin, setLusin] = useState("");
  const [pcs, setPcs] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals>({ karton: 0, lusin: 0, pcs: 0, count: 0 });

  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Sheets
  const menuSheetRef = useRef<BottomSheet>(null);
  const addMasterSheetRef = useRef<BottomSheet>(null);
  const rowSheetRef = useRef<BottomSheet>(null);
  const [rowTarget, setRowTarget] = useState<ScanEntry | null>(null);

  // Add-master sheet form
  const [newBarcode, setNewBarcode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const lastTapRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });

  const selectedProduct = useMemo(
    () => candidates.find((c) => c.code === selectedCode) || null,
    [candidates, selectedCode],
  );

  useEffect(() => {
    (async () => {
      const [name, list] = await Promise.all([getUsername(), getEntries()]);
      setUsernameState(name || "");
      setEntries(list);
    })();
  }, []);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!selectedCode) {
      setTotals({ karton: 0, lusin: 0, pcs: 0, count: 0 });
      return;
    }
    (async () => {
      const tot = await totalsForCode(selectedCode);
      setTotals(tot);
    })();
  }, [selectedCode, entries]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const resetForm = useCallback(() => {
    setBarcode("");
    setCandidates([]);
    setSelectedCode(null);
    setKarton("");
    setLusin("");
    setPcs("");
    setEditingId(null);
  }, []);

  const lookupBarcode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setCandidates([]);
      setSelectedCode(null);
      return;
    }
    const matches = await findMastersByBarcode(trimmed);
    setCandidates(matches);
    if (matches.length === 1) {
      setSelectedCode(matches[0].code);
    } else if (matches.length > 1) {
      setSelectedCode(null);
    } else {
      setSelectedCode(null);
      // Not found — open Add Master sheet, pre-fill barcode
      setNewBarcode(trimmed);
      setNewCode("");
      setNewName("");
      addMasterSheetRef.current?.expand();
    }
  }, []);

  const onBarcodeScanned = useCallback(
    async (result: { data: string }) => {
      const code = String(result?.data || "").trim();
      if (!code) return;
      const now = Date.now();
      if (lastScanRef.current.code === code && now - lastScanRef.current.at < 1500) return;
      lastScanRef.current = { code, at: now };
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setBarcode(code);
      await lookupBarcode(code);
    },
    [lookupBarcode],
  );

  const onManualLookup = () => {
    lookupBarcode(barcode);
  };

  const canSave = selectedCode && (parseInt(karton || "0") > 0 || parseInt(lusin || "0") > 0 || parseInt(pcs || "0") > 0);

  const onSave = async () => {
    if (!canSave || !selectedProduct) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const k = parseInt(karton || "0") || 0;
    const l = parseInt(lusin || "0") || 0;
    const p = parseInt(pcs || "0") || 0;

    let next: ScanEntry[];
    if (editingId) {
      next = await updateEntry(editingId, {
        barcode: selectedProduct.barcode,
        code: selectedProduct.code,
        name: selectedProduct.name,
        karton: k,
        lusin: l,
        pcs: p,
      });
      showToast("DATA DIPERBARUI");
    } else {
      next = await addEntry({
        barcode: selectedProduct.barcode,
        code: selectedProduct.code,
        name: selectedProduct.name,
        karton: k,
        lusin: l,
        pcs: p,
      });
      showToast("TERSIMPAN");
    }
    setEntries(next);
    resetForm();
  };

  const onRowTap = (row: ScanEntry) => {
    const now = Date.now();
    if (lastTapRef.current.id === row.id && now - lastTapRef.current.at < 350) {
      // double tap
      lastTapRef.current = { id: "", at: 0 };
      setRowTarget(row);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      rowSheetRef.current?.expand();
    } else {
      lastTapRef.current = { id: row.id, at: now };
    }
  };

  const startEdit = async (row: ScanEntry) => {
    rowSheetRef.current?.close();
    setBarcode(row.barcode);
    const matches = await findMastersByBarcode(row.barcode);
    // ensure the row's code is available in candidates even if master edited
    const list = matches.some((m) => m.code === row.code)
      ? matches
      : [...matches, { barcode: row.barcode, code: row.code, name: row.name }];
    setCandidates(list);
    setSelectedCode(row.code);
    setKarton(String(row.karton || ""));
    setLusin(String(row.lusin || ""));
    setPcs(String(row.pcs || ""));
    setEditingId(row.id);
  };

  const removeRow = async (row: ScanEntry) => {
    rowSheetRef.current?.close();
    const next = await deleteEntry(row.id);
    setEntries(next);
    showToast("DIHAPUS");
    if (editingId === row.id) resetForm();
  };

  const submitAddMaster = async () => {
    if (!newBarcode.trim() || !newCode.trim() || !newName.trim()) {
      showToast("LENGKAPI SEMUA KOLOM");
      return;
    }
    const item: MasterProduct = {
      barcode: newBarcode.trim(),
      code: newCode.trim(),
      name: newName.trim(),
    };
    await addMasterProduct(item);
    addMasterSheetRef.current?.close();
    setBarcode(item.barcode);
    await lookupBarcode(item.barcode);
    showToast("MASTER DITAMBAH");
  };

  const onImportMaster = async () => {
    menuSheetRef.current?.close();
    const res = await importMasterFromFile();
    if (!res.ok) {
      showToast(res.error.toUpperCase());
      return;
    }
    const { upsertMasterProducts } = await import("@/src/lib/db");
    await upsertMasterProducts(res.items);
    showToast(`IMPORT ${res.items.length} BARIS`);
  };

  const onExport = async () => {
    menuSheetRef.current?.close();
    const list = await getEntries();
    const res = await exportEntriesToCSV(list, username);
    if (!res.ok) showToast((res.error || "GAGAL").toUpperCase());
  };

  const onClearSession = async () => {
    menuSheetRef.current?.close();
    await clearEntries();
    setEntries([]);
    resetForm();
    showToast("SESI DIRESET");
  };

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} pressBehavior="close" />,
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle} testID="scan-header-title">GUDANGSCAN</Text>
            <Text style={styles.headerSub}>PENGGUNA: {username || "-"}</Text>
          </View>
          <Pressable
            testID="scan-menu-btn"
            onPress={() => menuSheetRef.current?.expand()}
            style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
          >
            <Text style={styles.menuBtnText}>MENU</Text>
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          {/* Scanner viewport */}
          <View style={styles.cameraWrap} testID="scan-camera-wrap">
            {permission?.granted && scannerOn ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                onBarcodeScanned={onBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: [
                    "aztec",
                    "ean13",
                    "ean8",
                    "qr",
                    "pdf417",
                    "upc_e",
                    "upc_a",
                    "datamatrix",
                    "code128",
                    "code39",
                    "code93",
                    "codabar",
                    "itf14",
                  ],
                }}
              />
            ) : (
              <View style={styles.cameraFallback}>
                <Text style={styles.cameraFallbackText}>
                  {permission?.granted ? "SCANNER OFF" : "IZIN KAMERA DIBUTUHKAN"}
                </Text>
                {!permission?.granted ? (
                  <Pressable style={styles.cameraFallbackBtn} onPress={requestPermission} testID="scan-camera-permission-btn">
                    <Text style={styles.cameraFallbackBtnText}>MINTA IZIN</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
            <View pointerEvents="none" style={styles.reticle} />
            <Pressable
              testID="scan-toggle-camera-btn"
              onPress={() => setScannerOn((v) => !v)}
              style={styles.scannerToggle}
            >
              <Text style={styles.scannerToggleText}>{scannerOn ? "OFF" : "ON"}</Text>
            </Pressable>
          </View>

          {/* Manual barcode input */}
          <View style={styles.formBlock}>
            <Text style={styles.label}>BARCODE</Text>
            <View style={styles.rowInput}>
              <TextInput
                testID="scan-barcode-input"
                value={barcode}
                onChangeText={setBarcode}
                onSubmitEditing={onManualLookup}
                placeholder="ketik atau scan..."
                placeholderTextColor="#9CA3AF"
                style={[styles.input, styles.inputFlex]}
                autoCapitalize="characters"
                returnKeyType="search"
              />
              <Pressable style={styles.rowBtn} onPress={onManualLookup} testID="scan-lookup-btn">
                <Text style={styles.rowBtnText}>CARI</Text>
              </Pressable>
            </View>

            {/* Code selector chips (2+ candidates) */}
            {candidates.length > 1 ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.label}>PILIH KODE ({candidates.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {candidates.map((c) => {
                    const active = c.code === selectedCode;
                    return (
                      <Pressable
                        key={`${c.code}-${c.name}`}
                        testID={`scan-code-chip-${c.code}`}
                        onPress={() => setSelectedCode(c.code)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.code}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {/* Selected product info + totals */}
            {selectedProduct ? (
              <View style={styles.infoBlock} testID="scan-selected-info">
                <View style={styles.infoLine}>
                  <Text style={styles.infoLabel}>KODE</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>{selectedProduct.code}</Text>
                </View>
                <View style={styles.infoLine}>
                  <Text style={styles.infoLabel}>NAMA</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>{selectedProduct.name}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Totals label="INPUT" value={totals.count} />
                  <Totals label="KTN" value={totals.karton} />
                  <Totals label="LSN" value={totals.lusin} />
                  <Totals label="PCS" value={totals.pcs} />
                </View>
              </View>
            ) : null}

            {/* Qty inputs */}
            {selectedProduct ? (
              <View style={styles.qtyRow}>
                <QtyInput testID="scan-qty-karton" label="KARTON" value={karton} onChange={setKarton} />
                <QtyInput testID="scan-qty-lusin" label="LUSIN" value={lusin} onChange={setLusin} />
                <QtyInput testID="scan-qty-pcs" label="PCS" value={pcs} onChange={setPcs} />
              </View>
            ) : null}

            {/* Save button */}
            {selectedProduct ? (
              <View style={styles.saveRow}>
                <Pressable
                  testID="scan-save-btn"
                  onPress={onSave}
                  disabled={!canSave}
                  style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                >
                  <Text style={styles.saveBtnText}>{editingId ? "SIMPAN EDIT" : "SIMPAN"}</Text>
                </Pressable>
                {editingId ? (
                  <Pressable testID="scan-cancel-edit-btn" onPress={resetForm} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>BATAL</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Results list header */}
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>HASIL SCAN</Text>
            <Text style={styles.listHeaderCount} testID="scan-list-count">{entries.length} DATA</Text>
          </View>

          {entries.length === 0 ? (
            <View style={styles.emptyBlock} testID="scan-empty">
              <Text style={styles.emptyText}>BELUM ADA DATA</Text>
              <Text style={styles.emptyHint}>Scan atau ketik barcode untuk mulai.</Text>
            </View>
          ) : (
            <View testID="scan-entries-list">
              {entries.map((row) => (
                <Pressable
                  key={row.id}
                  testID={`scan-entry-row-${row.id}`}
                  onPress={() => onRowTap(row)}
                  style={({ pressed }) => [styles.entryRow, pressed && styles.entryRowPressed, editingId === row.id && styles.entryRowEditing]}
                >
                  <View style={styles.entryIdxWrap}>
                    <Text style={styles.entryIdx}>{String(row.sequence).padStart(2, "0")}</Text>
                  </View>
                  <View style={styles.entryBody}>
                    <Text style={styles.entryCode} numberOfLines={1}>{row.code}</Text>
                    <Text style={styles.entryName} numberOfLines={2}>{row.name}</Text>
                    <Text style={styles.entryBarcode} numberOfLines={1}>{row.barcode}</Text>
                  </View>
                  <View style={styles.entryQtyWrap}>
                    <Text style={styles.entryQty}>K {row.karton}</Text>
                    <Text style={styles.entryQty}>L {row.lusin}</Text>
                    <Text style={styles.entryQty}>P {row.pcs}</Text>
                  </View>
                </Pressable>
              ))}
              <View style={styles.doubleTapHint}>
                <Text style={styles.doubleTapHintText}>DOUBLE TAP UNTUK EDIT / HAPUS</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Toast */}
        {toast ? (
          <View style={[styles.toast, { bottom: spacing.lg + insets.bottom }]} pointerEvents="none">
            <Text style={styles.toastText} testID="scan-toast">{toast}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {/* Menu Bottom Sheet */}
      <BottomSheet
        ref={menuSheetRef}
        index={-1}
        snapPoints={["55%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>MENU</Text>
          <SheetBtn label="IMPORT MASTER (XLSX/CSV)" onPress={onImportMaster} testID="menu-import-btn" />
          <SheetBtn label="LIHAT MASTER PRODUK" onPress={() => { menuSheetRef.current?.close(); router.push("/master"); }} testID="menu-master-btn" />
          <SheetBtn
            label="TAMBAH PRODUK MANUAL"
            onPress={() => {
              menuSheetRef.current?.close();
              setNewBarcode("");
              setNewCode("");
              setNewName("");
              setTimeout(() => addMasterSheetRef.current?.expand(), 200);
            }}
            testID="menu-add-manual-btn"
          />
          <SheetBtn label="EXPORT CSV" onPress={onExport} testID="menu-export-btn" variant="brand" />
          <SheetBtn label="RESET SESI SCAN" onPress={onClearSession} testID="menu-reset-btn" variant="danger" />
        </BottomSheetView>
      </BottomSheet>

      {/* Add Master Bottom Sheet */}
      <BottomSheet
        ref={addMasterSheetRef}
        index={-1}
        snapPoints={["70%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>PRODUK BARU</Text>
          <Text style={styles.sheetSub}>Tambahkan ke master produk.</Text>

          <Text style={styles.label}>BARCODE</Text>
          <TextInput
            testID="add-master-barcode"
            value={newBarcode}
            onChangeText={setNewBarcode}
            style={styles.input}
            autoCapitalize="characters"
            placeholder="cth: 8998989898989"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={styles.label}>KODE PRODUK</Text>
          <TextInput
            testID="add-master-code"
            value={newCode}
            onChangeText={setNewCode}
            style={styles.input}
            autoCapitalize="characters"
            placeholder="cth: SKU-001"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={styles.label}>NAMA PRODUK</Text>
          <TextInput
            testID="add-master-name"
            value={newName}
            onChangeText={setNewName}
            style={styles.input}
            placeholder="cth: SABUN CAIR 500ML"
            placeholderTextColor="#9CA3AF"
          />

          <View style={{ height: spacing.lg }} />
          <Pressable testID="add-master-save-btn" onPress={submitAddMaster} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>SIMPAN PRODUK</Text>
          </Pressable>
          <Pressable onPress={() => addMasterSheetRef.current?.close()} style={styles.cancelBtn} testID="add-master-cancel-btn">
            <Text style={styles.cancelBtnText}>BATAL</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheet>

      {/* Row action Sheet */}
      <BottomSheet
        ref={rowSheetRef}
        index={-1}
        snapPoints={["38%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>AKSI DATA #{rowTarget?.sequence}</Text>
          <Text style={styles.sheetSub} numberOfLines={2}>{rowTarget?.code} · {rowTarget?.name}</Text>
          <SheetBtn label="EDIT DATA" onPress={() => rowTarget && startEdit(rowTarget)} testID="row-edit-btn" variant="brand" />
          <SheetBtn label="HAPUS DATA" onPress={() => rowTarget && removeRow(rowTarget)} testID="row-delete-btn" variant="danger" />
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ---- Small subcomponents ----
function Totals({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.totalItem}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
  );
}

function QtyInput({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID?: string }) {
  return (
    <View style={styles.qtyCol}>
      <Text style={styles.qtyLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="#9CA3AF"
        style={styles.qtyInput}
        maxLength={5}
      />
    </View>
  );
}

function SheetBtn({ label, onPress, testID, variant }: { label: string; onPress: () => void; testID?: string; variant?: "brand" | "danger" }) {
  const bg = variant === "brand" ? colors.brand : variant === "danger" ? colors.error : colors.surface;
  const fg = variant === "danger" ? colors.onError : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.sheetBtn, { backgroundColor: bg }, pressed && { opacity: 0.85 }]}
    >
      <Text style={[styles.sheetBtnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    borderBottomWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontFamily: displayFont,
    fontSize: t.xl,
    fontWeight: "900",
    color: colors.onSurface,
    letterSpacing: 1,
  },
  headerSub: {
    fontFamily: monoFont,
    fontSize: t.sm,
    color: colors.onSurface,
    marginTop: 2,
  },
  menuBtn: {
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  menuBtnPressed: { backgroundColor: colors.onSurface },
  menuBtnText: {
    fontFamily: monoFont,
    fontSize: t.base,
    fontWeight: "900",
    color: colors.onSurface,
    letterSpacing: 1,
  },
  cameraWrap: {
    height: 190,
    backgroundColor: colors.onSurface,
    borderBottomWidth: border.thick,
    borderColor: colors.border,
    position: "relative",
    overflow: "hidden",
  },
  cameraFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  cameraFallbackText: {
    fontFamily: monoFont,
    color: colors.onSurfaceInverse,
    fontSize: t.base,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  cameraFallbackBtn: {
    borderWidth: border.thick,
    borderColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.brand,
  },
  cameraFallbackBtnText: { fontFamily: monoFont, color: colors.onBrand, fontWeight: "900", letterSpacing: 1 },
  reticle: {
    position: "absolute",
    top: spacing.xl,
    left: "20%",
    right: "20%",
    bottom: spacing.xl,
    borderWidth: border.thick,
    borderColor: colors.brand,
  },
  scannerToggle: {
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm,
    borderWidth: border.thick,
    borderColor: colors.brand,
    backgroundColor: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  scannerToggleText: {
    color: colors.brand,
    fontFamily: monoFont,
    fontSize: t.sm,
    fontWeight: "900",
    letterSpacing: 1,
  },
  formBlock: {
    padding: spacing.lg,
    borderBottomWidth: border.thick,
    borderColor: colors.border,
  },
  label: {
    fontFamily: monoFont,
    fontSize: t.sm,
    color: colors.onSurface,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    letterSpacing: 1,
    fontWeight: "700",
  },
  rowInput: { flexDirection: "row", alignItems: "stretch" },
  input: {
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm,
    fontFamily: monoFont,
    fontSize: t.lg,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  inputFlex: { flex: 1 },
  rowBtn: {
    marginLeft: -border.thick,
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.onSurface,
  },
  rowBtnText: {
    fontFamily: monoFont,
    color: colors.onSurfaceInverse,
    fontWeight: "900",
    letterSpacing: 1,
  },
  chipRow: { gap: spacing.sm, paddingRight: spacing.sm },
  chip: {
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.onSurface },
  chipText: { fontFamily: monoFont, fontSize: t.base, color: colors.onSurface, fontWeight: "900", letterSpacing: 1 },
  chipTextActive: { color: colors.onSurfaceInverse },
  infoBlock: {
    marginTop: spacing.md,
    borderWidth: border.thick,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
  },
  infoLine: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs },
  infoLabel: {
    fontFamily: monoFont,
    fontSize: t.sm,
    fontWeight: "900",
    color: colors.onSurface,
    width: 48,
    letterSpacing: 1,
  },
  infoValue: {
    fontFamily: monoFont,
    fontSize: t.base,
    color: colors.onSurface,
    flex: 1,
  },
  totalsRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    borderTopWidth: border.thick,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    justifyContent: "space-between",
  },
  totalItem: { alignItems: "flex-start" },
  totalLabel: { fontFamily: monoFont, fontSize: t.sm, color: colors.onSurface, letterSpacing: 1, fontWeight: "700" },
  totalValue: { fontFamily: monoFont, fontSize: t.xl, fontWeight: "900", color: colors.onSurface },
  qtyRow: { marginTop: spacing.md, flexDirection: "row", gap: 0 },
  qtyCol: { flex: 1, borderWidth: border.thick, borderColor: colors.border, marginLeft: -border.thick, padding: spacing.sm },
  qtyLabel: { fontFamily: monoFont, fontSize: t.sm, fontWeight: "900", color: colors.onSurface, letterSpacing: 1 },
  qtyInput: {
    fontFamily: monoFont,
    fontSize: 28,
    fontWeight: "900",
    color: colors.onSurface,
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    minHeight: 44,
  },
  saveRow: { flexDirection: "row", marginTop: spacing.md, gap: 0 },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.brand,
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: colors.surfaceTertiary },
  saveBtnText: {
    fontFamily: monoFont,
    fontSize: t.lg,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.onBrand,
  },
  cancelBtn: {
    marginLeft: -border.thick,
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  cancelBtnText: { fontFamily: monoFont, fontWeight: "900", color: colors.onSurface, letterSpacing: 1 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: border.thick,
    borderColor: colors.border,
    backgroundColor: colors.onSurface,
  },
  listHeaderTitle: { fontFamily: monoFont, fontWeight: "900", color: colors.onSurfaceInverse, letterSpacing: 2, fontSize: t.base },
  listHeaderCount: { fontFamily: monoFont, color: colors.brand, letterSpacing: 1, fontSize: t.base, fontWeight: "900" },
  emptyBlock: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: border.thick,
    borderColor: colors.border,
  },
  emptyText: { fontFamily: monoFont, fontSize: t.xl, fontWeight: "900", letterSpacing: 2, color: colors.onSurface },
  emptyHint: { fontFamily: monoFont, fontSize: t.sm, color: colors.muted, marginTop: spacing.sm },
  entryRow: {
    flexDirection: "row",
    borderBottomWidth: border.thin,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  entryRowPressed: { backgroundColor: colors.surfaceSecondary },
  entryRowEditing: { backgroundColor: colors.brand },
  entryIdxWrap: {
    width: 44,
    borderRightWidth: border.thick,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    paddingRight: spacing.sm,
  },
  entryIdx: { fontFamily: monoFont, fontSize: t.xxl, fontWeight: "900", color: colors.onSurface },
  entryBody: { flex: 1 },
  entryCode: { fontFamily: monoFont, fontSize: t.base, fontWeight: "900", color: colors.onSurface, letterSpacing: 1 },
  entryName: { fontFamily: monoFont, fontSize: t.sm, color: colors.onSurface, marginTop: 2 },
  entryBarcode: { fontFamily: monoFont, fontSize: t.sm, color: colors.muted, marginTop: 2 },
  entryQtyWrap: { alignItems: "flex-end", justifyContent: "center", minWidth: 56 },
  entryQty: { fontFamily: monoFont, fontSize: t.base, fontWeight: "900", color: colors.onSurface },
  doubleTapHint: { padding: spacing.md, alignItems: "center" },
  doubleTapHintText: { fontFamily: monoFont, fontSize: t.sm, color: colors.muted, letterSpacing: 1 },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.onSurface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: border.thick,
    borderColor: colors.brand,
  },
  toastText: { fontFamily: monoFont, color: colors.brand, fontSize: t.base, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  sheetBg: { backgroundColor: colors.surface, borderTopWidth: border.thick, borderColor: colors.border, borderRadius: 0 },
  sheetHandle: { backgroundColor: colors.onSurface, width: 48, height: 4 },
  sheetContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  sheetTitle: { fontFamily: displayFont, fontSize: t.xxl, fontWeight: "900", color: colors.onSurface, letterSpacing: 1 },
  sheetSub: { fontFamily: monoFont, fontSize: t.sm, color: colors.muted, marginBottom: spacing.sm },
  sheetBtn: {
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  sheetBtnText: { fontFamily: monoFont, fontSize: t.base, fontWeight: "900", letterSpacing: 1 },
});
