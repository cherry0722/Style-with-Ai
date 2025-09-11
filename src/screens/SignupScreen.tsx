import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import type { BodyType, Pronouns } from "../types";
import NumberPickerModal from "../components/NumberPickerModal";

// ---- Options ----
const PRONOUNS: Pronouns[] = ["she/her", "he/him", "they/them", "prefer-not-to-say"];
const BODY_TYPES: { key: BodyType; label: string }[] = [
  { key: "skinny", label: "Slim" },
  { key: "fit", label: "Fit" },
  { key: "muscular", label: "Muscular" },
  { key: "bulk", label: "Bulk" },
  { key: "pear", label: "Pear" },
  { key: "hourglass", label: "Hourglass" },
  { key: "rectangle", label: "Rectangle" },
];

/**
 * FIX: Your previous build failed because these files didn't exist:
 *   assets/bodytypes/*.png
 * For now we map ALL body types to a placeholder that DOES exist (assets/icon.png).
 * Later, replace PLACEHOLDER with real silhouettes and point each key to its PNG.
 */
const PLACEHOLDER = require("../../assets/icon.png");
const BODY_IMAGES: Record<BodyType, any> = {
  skinny: PLACEHOLDER,
  fit: PLACEHOLDER,
  muscular: PLACEHOLDER,
  bulk: PLACEHOLDER,
  pear: PLACEHOLDER,
  hourglass: PLACEHOLDER,
  rectangle: PLACEHOLDER,
};

export default function SignupScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Signup">) {
  const { signup, loginWithGoogle, loginWithApple, loginWithPhone } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [preferredName, setPreferredName] = useState("");
  const [pronouns, setPronouns] = useState<Pronouns | undefined>();
  const [heightCm, setHeightCm] = useState<number | undefined>();
  const [weightLb, setWeightLb] = useState<number | undefined>();
  const [bodyType, setBodyType] = useState<BodyType | undefined>();
  const [consent, setConsent] = useState(false);

  const [showHeight, setShowHeight] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    if (!consent) return;
    setLoading(true);
    await signup(email, password, {
      preferredName: preferredName || undefined,
      pronouns,
      heightCm,
      weightLb,
      bodyType,
      privacyConsent: consent,
    });
    setLoading(false);
    navigation.replace("Main");
  }

  async function onGoogle() { await loginWithGoogle(); navigation.replace("Main"); }
  async function onApple()  { await loginWithApple();  navigation.replace("Main"); }
  async function onPhone()  { await loginWithPhone("555-0100"); navigation.replace("Main"); }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 4 }}>
          Create account
        </Text>

        <TextInput
          placeholder="Preferred name"
          value={preferredName}
          onChangeText={setPreferredName}
          style={styles.input}
        />

        <Text style={styles.label}>Pronouns</Text>
        <Row>
          {PRONOUNS.map((p) => (
            <Chip key={p} label={p} active={pronouns === p} onPress={() => setPronouns(p)} />
          ))}
        </Row>

        <Text style={styles.label}>Measurements</Text>
        <Row>
          <PickerField
            label="Height (cm)"
            value={heightCm ? `${heightCm} cm` : "Select"}
            onPress={() => setShowHeight(true)}
          />
          <PickerField
            label="Weight (lb)"
            value={weightLb ? `${weightLb} lb` : "Select"}
            onPress={() => setShowWeight(true)}
          />
        </Row>

        <Text style={styles.label}>Body type</Text>
        <View style={grid.grid}>
          {BODY_TYPES.map((b) => (
            <BodyTile
              key={b.key}
              label={b.label}
              image={BODY_IMAGES[b.key]}
              active={bodyType === b.key}
              onPress={() => setBodyType(b.key)}
            />
          ))}
        </View>

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

        <Pressable
          onPress={() => setConsent((c) => !c)}
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Ionicons name={consent ? "checkbox" : "square-outline"} size={20} />
          <Text>I agree to the app’s privacy policy</Text>
        </Pressable>

        <Pressable
          onPress={onSignup}
          disabled={!consent}
          style={({ pressed }) => [styles.btn, { opacity: !consent || pressed || loading ? 0.6 : 1 }]}
        >
          <Text style={styles.btnText}>{loading ? "Creating…" : "Sign up"}</Text>
        </Pressable>

        <Text style={{ textAlign: "center", marginVertical: 8, color: "#999" }}>or</Text>

        <SocialBtn brand="google" label="Continue with Google" onPress={onGoogle} />
        <SocialBtn icon="logo-apple" label="Continue with Apple" onPress={onApple} />
        <SocialBtn icon="call-outline" label="Continue with Phone" onPress={onPhone} />

        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 6 }}>
          <Text style={{ textAlign: "center" }}>
            Have an account? <Text style={{ fontWeight: "700" }}>Log in</Text>
          </Text>
        </Pressable>
      </ScrollView>

      {/* Pickers */}
      <NumberPickerModal
        visible={showHeight}
        title="Select Height"
        min={140}
        max={210}
        step={1}
        unit="cm"
        value={heightCm ?? 170}
        onConfirm={(v) => setHeightCm(v)}
        onClose={() => setShowHeight(false)}
      />
      <NumberPickerModal
        visible={showWeight}
        title="Select Weight"
        min={90}
        max={350}
        step={1}
        unit="lb"
        value={weightLb ?? 150}
        onConfirm={(v) => setWeightLb(v)}
        onClose={() => setShowWeight(false)}
      />
    </KeyboardAvoidingView>
  );
}

/* ---------- UI helpers ---------- */

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}
function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[chipStyles.chip, active && chipStyles.chipActive]}>
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>{label}</Text>
    </Pressable>
  );
}
function PickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Text style={styles.labelSmall}>{label}</Text>
      <View style={styles.selectRow}>
        <Text style={{ fontWeight: "700" }}>{value}</Text>
        <Ionicons name="chevron-down" size={16} />
      </View>
    </Pressable>
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
function BodyTile({
  label,
  image,
  active,
  onPress,
}: {
  label: string;
  image: any;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[grid.tile, active && grid.tileActive]}>
      <Image source={image} style={grid.img} resizeMode="contain" />
      <Text style={[grid.caption, active && grid.captionActive]}>{label}</Text>
      {active && (
        <View style={grid.check}>
          <Ionicons name="checkmark-circle" size={18} />
        </View>
      )}
    </Pressable>
  );
}

/* ---------- Styles ---------- */

const styles = {
  label: { fontWeight: "700" as const, marginTop: 6 },
  labelSmall: { fontWeight: "700" as const, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12 },
  selectRow: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
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

const chipStyles = {
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 999 },
  chipActive: { backgroundColor: "#111", borderColor: "#111" },
  text: { fontWeight: "600" },
  textActive: { color: "#fff", fontWeight: "700" },
};

const grid = {
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 12 },
  tile: {
    width: 100,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    position: "relative" as const,
    backgroundColor: "#fff",
  },
  tileActive: { borderColor: "#111" },
  img: { width: 70, height: 70 },
  caption: { marginTop: 6, fontSize: 12, color: "#333" },
  captionActive: { fontWeight: "700" },
  check: { position: "absolute" as const, top: 6, right: 6 },
};
