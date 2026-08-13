import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getMasterProducts, setMasterProducts, type MasterProduct } from "@/src/lib/db";
import { importMasterFromFile } from "@/src/lib/excel";
import { displayFont, monoFont } from "@/src/lib/fonts";
import { border, colors, spacing, type as t } from "@/src/lib/theme";

export default function MasterScreen() {
  const router = useRouter();
  const [list, setList] = useState<MasterProduct[]>([]);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const items = await getMasterProducts();
    setList(items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      p.barcode.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q),
    );
  }, [list, query]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const onImport = async () => {
    const res = await importMasterFromFile();
    if (!res.ok) {
      showToast(res.error.toUpperCase());
      return;
    }
    const { upsertMasterProducts } = await import("@/src/lib/db");
    const merged = await upsertMasterProducts(res.items);
    setList(merged);
    showToast(`IMPORT ${res.items.length} BARIS`);
  };

  const onDelete = async (idx: number) => {
    const next = list.filter((_, i) => i !== idx);
    setList(next);
    await setMasterProducts(next);
    showToast("DIHAPUS");
  };

  const onClearAll = async () => {
    setList([]);
    await setMasterProducts([]);
    showToast("MASTER DIRESET");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable testID="master-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{"←"}</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>MASTER PRODUK</Text>
          <Text style={styles.sub} testID="master-count">{list.length} BARIS · {filtered.length} TAMPIL</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable testID="master-import-btn" onPress={onImport} style={[styles.actionBtn, { backgroundColor: colors.brand }]}>
          <Text style={styles.actionBtnText}>IMPORT XLSX/CSV</Text>
        </Pressable>
        <Pressable testID="master-clear-btn" onPress={onClearAll} style={[styles.actionBtn, { backgroundColor: colors.error, marginLeft: -border.thick }]}>
          <Text style={[styles.actionBtnText, { color: colors.onError }]}>RESET</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          testID="master-search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Cari barcode / kode / nama"
          placeholderTextColor="#9CA3AF"
          style={styles.search}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {filtered.length === 0 ? (
          <View style={styles.empty} testID="master-empty">
            <Text style={styles.emptyText}>MASTER PRODUK KOSONG</Text>
            <Text style={styles.emptyHint}>Klik IMPORT untuk unggah Excel/CSV.</Text>
          </View>
        ) : (
          filtered.map((p, i) => {
            // Find original index in unfiltered list to allow delete
            const realIdx = list.indexOf(p);
            return (
              <View key={`${p.barcode}-${p.code}-${i}`} style={styles.row} testID={`master-row-${i}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowCode}>{p.code}</Text>
                  <Text style={styles.rowName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.rowBarcode}>{p.barcode}</Text>
                </View>
                <Pressable
                  testID={`master-delete-${i}`}
                  onPress={() => onDelete(realIdx)}
                  style={styles.rowDeleteBtn}
                >
                  <Text style={styles.rowDeleteText}>HAPUS</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    borderBottomWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backBtn: {
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  backBtnText: { fontFamily: monoFont, fontSize: t.xl, fontWeight: "900", color: colors.onSurface },
  title: { fontFamily: displayFont, fontSize: t.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: 1 },
  sub: { fontFamily: monoFont, fontSize: t.sm, color: colors.onSurface, marginTop: 2 },
  actions: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  actionBtnText: { fontFamily: monoFont, fontSize: t.base, fontWeight: "900", color: colors.onBrand, letterSpacing: 1 },
  searchWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  search: {
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: monoFont,
    fontSize: t.base,
    color: colors.onSurface,
  },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyText: { fontFamily: monoFont, fontSize: t.lg, fontWeight: "900", color: colors.onSurface, letterSpacing: 1 },
  emptyHint: { fontFamily: monoFont, fontSize: t.sm, color: colors.muted, marginTop: spacing.sm, textAlign: "center" },
  row: {
    flexDirection: "row",
    borderBottomWidth: border.thin,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: "center",
  },
  rowCode: { fontFamily: monoFont, fontSize: t.base, fontWeight: "900", color: colors.onSurface, letterSpacing: 1 },
  rowName: { fontFamily: monoFont, fontSize: t.sm, color: colors.onSurface, marginTop: 2 },
  rowBarcode: { fontFamily: monoFont, fontSize: t.sm, color: colors.muted, marginTop: 2 },
  rowDeleteBtn: {
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.error,
  },
  rowDeleteText: { fontFamily: monoFont, fontSize: t.sm, color: colors.onError, fontWeight: "900", letterSpacing: 1 },
  toast: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.onSurface,
    paddingVertical: spacing.md,
    borderWidth: border.thick,
    borderColor: colors.brand,
  },
  toastText: { fontFamily: monoFont, color: colors.brand, textAlign: "center", fontWeight: "900", letterSpacing: 2 },
});
