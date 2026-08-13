// Font family helpers. Brutalist design calls for Space Grotesk / Space Mono
// but since we can't install @expo-google-fonts, we fall back to platform-safe
// system fonts that still convey the same brutalist / data-heavy feel.

import { Platform } from "react-native";

export const displayFont = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System",
});

export const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});
