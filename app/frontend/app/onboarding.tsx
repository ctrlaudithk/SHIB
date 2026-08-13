import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { setUsername } from "@/src/lib/db";
import { displayFont, monoFont } from "@/src/lib/fonts";
import { border, colors, spacing, type as t } from "@/src/lib/theme";

export default function Onboarding() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const canContinue = name.trim().length >= 2;

  const onContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    await setUsername(name.trim());
    router.replace("/scan");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.badge} testID="onboarding-badge">GUDANGSCAN</Text>
          <Text style={styles.subBadge}>V1 · OFFLINE</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} testID="onboarding-title">SIAPA{"\n"}NAMA{"\n"}ANDA?</Text>
          <Text style={styles.hint}>
            Nama pengguna akan dilampirkan di setiap data yang di-export.
          </Text>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>NAMA</Text>
            <TextInput
              testID="onboarding-name-input"
              value={name}
              onChangeText={setName}
              placeholder="cth: BUDI"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={onContinue}
            />
          </View>
        </View>

        <Pressable
          testID="onboarding-continue-btn"
          disabled={!canContinue || saving}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.cta,
            !canContinue && styles.ctaDisabled,
            pressed && canContinue && styles.ctaPressed,
          ]}
        >
          <Text style={styles.ctaText}>MULAI</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  },
  badge: {
    fontFamily: monoFont,
    fontSize: t.lg,
    fontWeight: "900",
    color: colors.onSurface,
    letterSpacing: 1,
  },
  subBadge: {
    fontFamily: monoFont,
    fontSize: t.sm,
    color: colors.onSurface,
    letterSpacing: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    fontFamily: displayFont,
    fontSize: 56,
    lineHeight: 60,
    fontWeight: "900",
    color: colors.onSurface,
    letterSpacing: -2,
  },
  hint: {
    marginTop: spacing.lg,
    fontFamily: monoFont,
    fontSize: t.base,
    color: colors.onSurface,
    lineHeight: 20,
  },
  inputWrap: { marginTop: spacing.xl },
  label: {
    fontFamily: monoFont,
    fontSize: t.sm,
    color: colors.onSurface,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  input: {
    borderWidth: border.thick,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: monoFont,
    fontSize: t.xl,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  cta: {
    borderTopWidth: border.thick,
    borderColor: colors.border,
    backgroundColor: colors.brand,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { backgroundColor: colors.surfaceTertiary },
  ctaPressed: { backgroundColor: "#00C853" },
  ctaText: {
    fontFamily: monoFont,
    fontSize: t.lg,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.onBrand,
  },
});
