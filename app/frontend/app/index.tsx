import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { getUsername } from "@/src/lib/db";
import { colors } from "@/src/lib/theme";

export default function Index() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const name = await getUsername();
      setReady(true);
      if (name && name.trim().length > 0) {
        router.replace("/scan");
      } else {
        router.replace("/onboarding");
      }
    })();
  }, [router]);

  return (
    <View style={styles.container} testID="boot-screen">
      {!ready ? <ActivityIndicator color={colors.onSurface} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
