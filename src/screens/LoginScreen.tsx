import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Image } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Login">) {
  const { login, loginWithGoogle, loginWithApple, loginWithPhone } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    setLoading(true);
    await login(email, password);
    setLoading(false);
    navigation.replace("Main");
  }

  async function onGoogle() {
    await loginWithGoogle();
    navigation.replace("Main");
  }
  async function onApple() {
    await loginWithApple();
    navigation.replace("Main");
  }
  async function onPhone() {
    await loginWithPhone("555-0100");
    navigation.replace("Main");
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: "700", textAlign: "center" }}>AI Wardrobe</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <Pressable onPress={onLogin} style={({ pressed }) => [styles.btn, { opacity: pressed || loading ? 0.7 : 1 }]}>
        <Text style={styles.btnText}>{loading ? "Logging in…" : "Log in"}</Text>
      </Pressable>

      <Text style={{ textAlign: "center", marginVertical: 8, color: "#999" }}>or</Text>

      <SocialBtn brand="google" label="Continue with Google" onPress={onGoogle} />
      <SocialBtn icon="logo-apple" label="Continue with Apple" onPress={onApple} />
      <SocialBtn icon="call-outline" label="Continue with Phone" onPress={onPhone} />

      <Pressable onPress={() => navigation.navigate("Signup")}>
        <Text style={{ textAlign: "center" }}>
          No account? <Text style={{ fontWeight: "700" }}>Sign up</Text>
        </Text>
      </Pressable>
    </View>
  );
}

function SocialBtn({
  brand,
  icon,
  label,
  onPress,
}: {
  brand?: "google" | "apple" | "phone";
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.btnHollow}>
      {brand === "google" ? (
        <Image
          source={require("../../assets/google_g.png")}
          style={{ width: 18, height: 18 }}
          resizeMode="contain"
        />
      ) : (
        <Ionicons name={icon as any} size={18} />
      )}
      <Text style={styles.btnHollowText}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12 },
  btn: { backgroundColor: "#111", borderRadius: 12, padding: 14, alignItems: "center" as const },
  btnText: { color: "white", fontWeight: "700" },
  btnHollow: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 12,
    padding: 12,
    alignItems: "center" as const,
    flexDirection: "row" as const,
    gap: 8,
    justifyContent: "center" as const,
  },
  btnHollowText: { fontWeight: "700" },
};
