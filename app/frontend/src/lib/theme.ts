// Brutalist Mobile LIGHT design tokens for GudangScan.
// Keep numbers integer + zero radius everywhere per design_guidelines.json.

export const colors = {
  surface: "#FFFFFF",
  onSurface: "#000000",
  surfaceSecondary: "#F4F4F5",
  surfaceTertiary: "#E4E4E7",
  surfaceInverse: "#000000",
  onSurfaceInverse: "#FFFFFF",
  brand: "#00E676",
  onBrand: "#000000",
  warning: "#F59E0B",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#3B82F6",
  border: "#000000",
  muted: "#6B7280",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const font = {
  display: "SpaceGrotesk",
  mono: "SpaceMono",
} as const;

export const border = {
  thin: 1,
  thick: 2,
  extra: 3,
} as const;

export const type = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  huge: 32,
} as const;
