import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useAuth } from "../context/AuthContext";
import type { BodyType, Pronouns } from "../types";
import NumberPickerModal from "../components/NumberPickerModal";

const PRONOUNS: Pronouns[] = ["she/her", "he/him", "they/them", "prefer-not-to-say"];
const BODY_TYPES: BodyType[] = ["skinny", "fit", "muscular", "bulk", "pear", "hourglass", "rectangle"];

export default function SettingsScreen() {
  const { user, updateProfile } = useAuth();
  const p = user?.profile || {};

  // --- view/edit mode ---
  const [editing, setEditing] = useState(false);

  // --- editable copies ---
  const [preferredName, setPreferredName] = useState(p.preferredName || "");
  const [pronouns, setPronouns] = useState<Pronouns | undefined>(p.pronouns);
  const [heightCm, setHeightCm] = useState<number | undefined>(p.heightCm);
  const [weightLb, setWeightLb] = useState<number | undefined>(p.weightLb);
  const [bodyType, setBodyType] = useState<BodyType | undefined>(p.bodyType);

  // pickers
  const [showHeight, setShowHeight] = useState(false);
  const [showWeight, setShowWeight] = useState(false);

  // re-sync local state with server/profile when entering edit
  function startEdit() {
    setPreferredName(p.preferredName || "");
    setPronouns(p.pronouns);
    setHeightCm(p.heightCm);
    setWeightLb(p.weightLb);
    setBodyType(p.bodyType);
    setEditing(true);
  }

  function cancelEdit() {
    // revert to profile values
    setPreferredName(p.preferredName || "");
    setPronouns(p.pronouns);
    setHeightCm(p.heightCm);
    setWeightLb(p.weightLb);
    setBodyType(p.bodyType);
    setEditing(false);
  }

  function saveEdit() {
    updateProfile({
      preferredName: preferredName || undefined,
      pronouns,
      heightCm,
      weightLb,
      bodyType,
    });
    setEditing(false);
  }

  const pronounsText = useMemo(() => pronouns || p.pronouns || "—", [pronouns, p.pronouns]);
  const bodyTypeText = useMemo(() => bodyType || p.bodyType || "—", [bodyType, p.bodyType]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 14 }}>
      {/* Title + actions */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>Settings</Text>
        {!editing ? (
          <Pressable onPress={startEdit} style={[btnStyles.btnHollow, { marginLeft: "auto" }]}>
            <Text style={btnStyles.hollowText}>Edit</Text>
          </Pressable>
        ) : (
          <View style={{ marginLeft: "auto", flexDirection: "row", gap: 8 }}>
            <Pressable onPress={cancelEdit} style={btnStyles.btnHollow}>
              <Text style={btnStyles.hollowText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={saveEdit} style={btnStyles.btnSolid}>
              <Text style={btnStyles.solidText}>Save</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* EMAIL (always read-only) */}
      <Field label="Email">
        <Text style={{ opacity: 0.9 }}>{user?.email || "—"}</Text>
      </Field>

      {/* NAME */}
      <Field label="Preferred name">
        {!editing ? (
          <Text style={{ opacity: 0.9 }}>{p.preferredName || "—"}</Text>
        ) : (
          <TextInput
            value={preferredName}
            onChangeText={setPreferredName}
            placeholder="Your name"
            style={styles.input}
          />
        )}
      </Field>

      {/* PRONOUNS */}
      <Field label="Pronouns">
        {!editing ? (
          <Text style={{ opacity: 0.9 }}>{String(pronounsText)}</Text>
        ) : (
          <Row>
            {PRONOUNS.map((pp) => (
              <Chip key={pp} label={pp} active={pronouns === pp} onPress={() => setPronouns(pp)} />
            ))}
          </Row>
        )}
      </Field>

      {/* MEASUREMENTS */}
      <Field label="Measurements">
        {!editing ? (
          <Text style={{ opacity: 0.9 }}>
            {p.heightCm ? `${p.heightCm} cm` : "—"} · {p.weightLb ? `${p.weightLb} lb` : "—"}
          </Text>
        ) : (
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
        )}
      </Field>

      {/* BODY TYPE */}
      <Field label="Body type">
        {!editing ? (
          <Text style={{ opacity: 0.9 }}>{String(bodyTypeText)}</Text>
        ) : (
          <Row>
            {BODY_TYPES.map((b) => (
              <Chip key={b} label={b} active={bodyType === b} onPress={() => setBodyType(b)} />
            ))}
          </Row>
        )}
      </Field>

      {/* Pickers (only matter in edit mode) */}
      <NumberPickerModal
        visible={editing && showHeight}
        title="Select Height"
        min={140}
        max={210}
        unit="cm"
        value={heightCm ?? 170}
        onConfirm={(v) => setHeightCm(v)}
        onClose={() => setShowHeight(false)}
      />
      <NumberPickerModal
        visible={editing && showWeight}
        title="Select Weight"
        min={90}
        max={350}
        unit="lb"
        value={weightLb ?? 150}
        onConfirm={(v) => setWeightLb(v)}
        onClose={() => setShowWeight(false)}
      />
    </View>
  );
}

/* --------- small UI helpers ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <View>{children}</View>
    </View>
  );
}

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
      <Text style={styles.subLabel}>{label}</Text>
      <View style={styles.selectRow}>
        <Text style={{ fontWeight: "700" }}>{value}</Text>
        <Text>⌄</Text>
      </View>
    </Pressable>
  );
}

/* --------- styles ---------- */

const styles = {
  label: { fontWeight: "800" as const },
  subLabel: { fontWeight: "700" as const, marginBottom: 6 },
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
};

const btnStyles = {
  btnHollow: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  hollowText: { fontWeight: "700" as const },
  btnSolid: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  solidText: { color: "#fff", fontWeight: "700" as const },
};

const chipStyles = {
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 999 },
  chipActive: { backgroundColor: "#111", borderColor: "#111" },
  text: { fontWeight: "600" },
  textActive: { color: "#fff", fontWeight: "700" },
};
