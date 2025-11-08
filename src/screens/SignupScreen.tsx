// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   Pressable,
//   Image,
//   ScrollView,
//   KeyboardAvoidingView,
//   Platform,
//   StyleSheet,
//   StatusBar,
//   Dimensions,
// } from "react-native";
// import type { NativeStackScreenProps } from "@react-navigation/native-stack";
// import type { RootStackParamList } from "../navigation/RootNavigator";
// import { useAuth } from "../context/AuthContext";
// import { useTheme } from "../context/ThemeContext";
// import { Ionicons } from "@expo/vector-icons";
// import { LinearGradient } from 'expo-linear-gradient';
// import type { BodyType, Pronouns } from "../types";
// import NumberPickerModal from "../components/NumberPickerModal";

// const { width, height } = Dimensions.get('window');

// // ---- Options ----
// const PRONOUNS: Pronouns[] = ["she/her", "he/him", "they/them", "prefer-not-to-say"];
// const BODY_TYPES: { key: BodyType; label: string }[] = [
//   { key: "skinny", label: "Slim" },
//   { key: "fit", label: "Fit" },
//   { key: "muscular", label: "Muscular" },
//   { key: "bulk", label: "Bulk" },
//   { key: "pear", label: "Pear" },
//   { key: "hourglass", label: "Hourglass" },
//   { key: "rectangle", label: "Rectangle" },
// ];

// const PLACEHOLDER = require("../../assets/icon.png");
// const BODY_IMAGES: Record<BodyType, any> = {
//   skinny: PLACEHOLDER,
//   fit: PLACEHOLDER,
//   muscular: PLACEHOLDER,
//   bulk: PLACEHOLDER,
//   pear: PLACEHOLDER,
//   hourglass: PLACEHOLDER,
//   rectangle: PLACEHOLDER,
// };

// export default function SignupScreen({
//   navigation,
// }: NativeStackScreenProps<RootStackParamList, "Signup">) {
//   const { signup, loginWithGoogle, loginWithApple, loginWithPhone } = useAuth();
//   const theme = useTheme();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [preferredName, setPreferredName] = useState("");
//   const [pronouns, setPronouns] = useState<Pronouns | undefined>();
//   const [heightCm, setHeightCm] = useState<number | undefined>();
//   const [weightLb, setWeightLb] = useState<number | undefined>();
//   const [bodyType, setBodyType] = useState<BodyType | undefined>();
//   const [consent, setConsent] = useState(false);

//   const [showHeight, setShowHeight] = useState(false);
//   const [showWeight, setShowWeight] = useState(false);
//   const [loading, setLoading] = useState(false);

//   const styles = createStyles(theme);

//   async function onSignup() {
//     if (!consent) return;
//     setLoading(true);
//     await signup(email, password, {
//       preferredName: preferredName || undefined,
//       pronouns,
//       heightCm,
//       weightLb,
//       bodyType,
//       privacyConsent: consent,
//     });
//     setLoading(false);
//     navigation.replace("Main");
//   }

//   async function onGoogle() { await loginWithGoogle(); navigation.replace("Main"); }
//   async function onApple()  { await loginWithApple();  navigation.replace("Main"); }
//   async function onPhone()  { await loginWithPhone("555-0100"); navigation.replace("Main"); }

//   return (
//     <KeyboardAvoidingView
//       style={styles.container}
//       behavior={Platform.OS === "ios" ? "padding" : "height"}
//       keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
//     >
//       <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
//       {/* Background Gradient */}
//       <LinearGradient
//         colors={['#000000', '#1a1a1a', '#000000']}
//         style={styles.backgroundGradient}
//       />
      
//       {/* Fashion Background Elements */}
//       <View style={styles.fashionElements}>
//         <View style={[styles.fashionElement, { top: height * 0.1, left: width * 0.1 }]}>
//           <Text style={styles.fashionEmoji}>👗</Text>
//         </View>
//         <View style={[styles.fashionElement, { top: height * 0.2, right: width * 0.1 }]}>
//           <Text style={styles.fashionEmoji}>👠</Text>
//         </View>
//         <View style={[styles.fashionElement, { top: height * 0.3, left: width * 0.2 }]}>
//           <Text style={styles.fashionEmoji}>👜</Text>
//         </View>
//         <View style={[styles.fashionElement, { top: height * 0.4, right: width * 0.2 }]}>
//           <Text style={styles.fashionEmoji}>💄</Text>
//         </View>
//         <View style={[styles.fashionElement, { top: height * 0.5, left: width * 0.15 }]}>
//           <Text style={styles.fashionEmoji}>👑</Text>
//         </View>
//         <View style={[styles.fashionElement, { top: height * 0.6, right: width * 0.15 }]}>
//           <Text style={styles.fashionEmoji}>🕶️</Text>
//         </View>
//       </View>

//       <ScrollView
//         contentContainerStyle={styles.scrollContent}
//         keyboardShouldPersistTaps="handled"
//         showsVerticalScrollIndicator={false}
//       >
//         {/* Header */}
//         <View style={styles.header}>
//           <View style={styles.logoContainer}>
//             <View style={styles.logoCircle}>
//               <Text style={styles.logoText}>M</Text>
//             </View>
//             <View style={styles.logoGlow} />
//           </View>
          
//           <Text style={styles.brandName}>MYRA</Text>
//           <Text style={styles.tagline}>Join the Style Revolution</Text>
//           <Text style={styles.subTagline}>Create your personalized fashion profile</Text>
//         </View>

//         {/* Signup Form */}
//         <View style={styles.formContainer}>
//           <View style={styles.formHeader}>
//             <Text style={styles.formTitle}>Create Account</Text>
//             <Text style={styles.formSubtitle}>Let's get to know your style</Text>
//           </View>

//           {/* Personal Information */}
//           <View style={styles.section}>
//             <Text style={styles.sectionTitle}>Personal Information</Text>
            
//             <View style={styles.inputContainer}>
//               <View style={styles.inputIcon}>
//                 <Ionicons name="person-outline" size={20} color={theme.colors.textTertiary} />
//               </View>
//               <TextInput
//                 placeholder="Preferred name"
//                 placeholderTextColor={theme.colors.textTertiary}
//                 value={preferredName}
//                 onChangeText={setPreferredName}
//                 style={styles.input}
//               />
//             </View>

//             <Text style={styles.label}>Pronouns</Text>
//             <Row>
//               {PRONOUNS.map((p) => (
//                 <Chip key={p} label={p} active={pronouns === p} onPress={() => setPronouns(p)} />
//               ))}
//             </Row>
//           </View>

//           {/* Measurements */}
//           <View style={styles.section}>
//             <Text style={styles.sectionTitle}>Measurements</Text>
//             <Row>
//               <PickerField
//                 label="Height (cm)"
//                 value={heightCm ? `${heightCm} cm` : "Select"}
//                 onPress={() => setShowHeight(true)}
//               />
//               <PickerField
//                 label="Weight (lb)"
//                 value={weightLb ? `${weightLb} lb` : "Select"}
//                 onPress={() => setShowWeight(true)}
//               />
//             </Row>
//           </View>

//           {/* Body Type */}
//           <View style={styles.section}>
//             <Text style={styles.sectionTitle}>Body Type</Text>
//             <View style={styles.bodyTypeGrid}>
//               {BODY_TYPES.map((b) => (
//                 <BodyTile
//                   key={b.key}
//                   label={b.label}
//                   image={BODY_IMAGES[b.key]}
//                   active={bodyType === b.key}
//                   onPress={() => setBodyType(b.key)}
//                 />
//               ))}
//             </View>
//           </View>

//           {/* Account Information */}
//           <View style={styles.section}>
//             <Text style={styles.sectionTitle}>Account Information</Text>
            
//             <View style={styles.inputContainer}>
//               <View style={styles.inputIcon}>
//                 <Ionicons name="mail-outline" size={20} color={theme.colors.textTertiary} />
//               </View>
//               <TextInput
//                 placeholder="Email address"
//                 placeholderTextColor={theme.colors.textTertiary}
//                 autoCapitalize="none"
//                 keyboardType="email-address"
//                 value={email}
//                 onChangeText={setEmail}
//                 style={styles.input}
//               />
//             </View>

//             <View style={styles.inputContainer}>
//               <View style={styles.inputIcon}>
//                 <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textTertiary} />
//               </View>
//               <TextInput
//                 placeholder="Password"
//                 placeholderTextColor={theme.colors.textTertiary}
//                 secureTextEntry
//                 value={password}
//                 onChangeText={setPassword}
//                 style={styles.input}
//               />
//             </View>
//           </View>

//           {/* Privacy Consent */}
//           <Pressable
//             onPress={() => setConsent((c) => !c)}
//             style={styles.consentContainer}
//           >
//             <View style={styles.checkbox}>
//               {consent && <Ionicons name="checkmark" size={16} color={theme.colors.white} />}
//             </View>
//             <Text style={styles.consentText}>
//               I agree to MYRA's privacy policy and terms of service
//             </Text>
//           </Pressable>

//           {/* Signup Button */}
//           <Pressable
//             onPress={onSignup}
//             disabled={!consent}
//             style={({ pressed }) => [
//               styles.signupButton,
//               { opacity: !consent || pressed || loading ? 0.6 : 1 }
//             ]}
//           >
//             <LinearGradient
//               colors={['#FF6B6B', '#FF8E8E', '#FF6B6B']}
//               style={styles.signupButtonGradient}
//             >
//               <Text style={styles.signupButtonText}>
//                 {loading ? "Creating Account..." : "Create Account"}
//               </Text>
//             </LinearGradient>
//           </Pressable>

//           {/* Divider */}
//           <View style={styles.divider}>
//             <View style={styles.dividerLine} />
//             <Text style={styles.dividerText}>or continue with</Text>
//             <View style={styles.dividerLine} />
//           </View>

//           {/* Social Login Buttons */}
//           <View style={styles.socialButtons}>
//             <SocialButton
//               icon="logo-google"
//               label="Google"
//               onPress={onGoogle}
//               style={styles.socialButton}
//             />
//             <SocialButton
//               icon="logo-apple"
//               label="Apple"
//               onPress={onApple}
//               style={styles.socialButton}
//             />
//           </View>

//           {/* Phone Login */}
//           <Pressable onPress={onPhone} style={styles.phoneButton}>
//             <Ionicons name="call-outline" size={20} color={theme.colors.textPrimary} />
//             <Text style={styles.phoneButtonText}>Continue with Phone</Text>
//           </Pressable>
//         </View>

//         {/* Login Link */}
//         <View style={styles.loginContainer}>
//           <Text style={styles.loginText}>Already have an account? </Text>
//           <Pressable onPress={() => navigation.goBack()}>
//             <Text style={styles.loginLink}>Sign In</Text>
//           </Pressable>
//         </View>
//       </ScrollView>

//       {/* Pickers */}
//       <NumberPickerModal
//         visible={showHeight}
//         title="Select Height"
//         min={140}
//         max={210}
//         step={1}
//         unit="cm"
//         value={heightCm ?? 170}
//         onConfirm={(v) => setHeightCm(v)}
//         onClose={() => setShowHeight(false)}
//       />
//       <NumberPickerModal
//         visible={showWeight}
//         title="Select Weight"
//         min={90}
//         max={350}
//         step={1}
//         unit="lb"
//         value={weightLb ?? 150}
//         onConfirm={(v) => setWeightLb(v)}
//         onClose={() => setShowWeight(false)}
//       />
//     </KeyboardAvoidingView>
//   );
// }

// /* ---------- UI helpers ---------- */

// function Row({ children }: { children: React.ReactNode }) {
//   return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
// }

// function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
//   const theme = useTheme();
//   const chipStyles = createStyles(theme);
  
//   return (
//     <Pressable onPress={onPress} style={[
//       chipStyles.chip, 
//       { 
//         backgroundColor: active ? theme.colors.accent : theme.colors.backgroundTertiary,
//         borderColor: active ? theme.colors.accent : theme.colors.border,
//       }
//     ]}>
//       <Text style={[
//         chipStyles.chipText, 
//         { color: active ? theme.colors.white : theme.colors.textPrimary }
//       ]}>
//         {label}
//       </Text>
//     </Pressable>
//   );
// }

// function PickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
//   const theme = useTheme();
//   const pickerStyles = createStyles(theme);
  
//   return (
//     <Pressable onPress={onPress} style={{ flex: 1 }}>
//       <Text style={[pickerStyles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
//       <View style={[pickerStyles.selectRow, { backgroundColor: theme.colors.backgroundTertiary, borderColor: theme.colors.border }]}>
//         <Text style={[pickerStyles.selectText, { color: theme.colors.textPrimary }]}>{value}</Text>
//         <Ionicons name="chevron-down" size={16} color={theme.colors.textTertiary} />
//       </View>
//     </Pressable>
//   );
// }

// function SocialButton({
//   icon,
//   label,
//   onPress,
//   style,
// }: {
//   icon: keyof typeof Ionicons.glyphMap;
//   label: string;
//   onPress: () => void;
//   style: any;
// }) {
//   const theme = useTheme();
//   const socialStyles = createStyles(theme);
  
//   return (
//     <Pressable onPress={onPress} style={[style, { backgroundColor: theme.colors.backgroundSecondary }]}>
//       <Ionicons name={icon as any} size={24} color={theme.colors.textPrimary} />
//       <Text style={[socialStyles.socialButtonText, { color: theme.colors.textPrimary }]}>{label}</Text>
//     </Pressable>
//   );
// }

// function BodyTile({
//   label,
//   image,
//   active,
//   onPress,
// }: {
//   label: string;
//   image: any;
//   active?: boolean;
//   onPress?: () => void;
// }) {
//   const theme = useTheme();
//   const bodyStyles = createStyles(theme);
  
//   return (
//     <Pressable onPress={onPress} style={[
//       bodyStyles.bodyTile, 
//       { 
//         backgroundColor: theme.colors.backgroundTertiary,
//         borderColor: active ? theme.colors.accent : theme.colors.border,
//       }
//     ]}>
//       <Image source={image} style={bodyStyles.bodyImage} resizeMode="contain" />
//       <Text style={[
//         bodyStyles.bodyLabel, 
//         { 
//           color: active ? theme.colors.accent : theme.colors.textPrimary,
//           fontWeight: active ? 'bold' : 'normal',
//         }
//       ]}>
//         {label}
//       </Text>
//       {active && (
//         <View style={bodyStyles.checkIcon}>
//           <Ionicons name="checkmark-circle" size={18} color={theme.colors.accent} />
//         </View>
//       )}
//     </Pressable>
//   );
// }

// const createStyles = (theme: any) => StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: theme.colors.background,
//   },
//   backgroundGradient: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//   },
//   fashionElements: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//   },
//   fashionElement: {
//     position: 'absolute',
//     width: 40,
//     height: 40,
//     justifyContent: 'center',
//     alignItems: 'center',
//     opacity: 0.1,
//   },
//   fashionEmoji: {
//     fontSize: 24,
//   },
//   scrollContent: {
//     flexGrow: 1,
//     paddingHorizontal: theme.spacing.lg,
//     paddingTop: 60,
//     paddingBottom: theme.spacing.xl,
//   },
//   header: {
//     alignItems: 'center',
//     marginBottom: theme.spacing.xl,
//   },
//   logoContainer: {
//     position: 'relative',
//     marginBottom: theme.spacing.lg,
//   },
//   logoCircle: {
//     width: 80,
//     height: 80,
//     borderRadius: 40,
//     backgroundColor: theme.colors.accent,
//     justifyContent: 'center',
//     alignItems: 'center',
//     shadowColor: theme.colors.accent,
//     shadowOffset: { width: 0, height: 0 },
//     shadowOpacity: 0.3,
//     shadowRadius: 20,
//     elevation: 10,
//   },
//   logoText: {
//     fontSize: 32,
//     fontWeight: 'bold',
//     color: theme.colors.white,
//   },
//   logoGlow: {
//     position: 'absolute',
//     top: -5,
//     left: -5,
//     right: -5,
//     bottom: -5,
//     borderRadius: 45,
//     backgroundColor: theme.colors.accent,
//     opacity: 0.2,
//     zIndex: -1,
//   },
//   brandName: {
//     fontSize: 36,
//     fontWeight: 'bold',
//     color: theme.colors.textPrimary,
//     marginBottom: theme.spacing.xs,
//     letterSpacing: 2,
//   },
//   tagline: {
//     fontSize: theme.typography.lg,
//     color: theme.colors.textSecondary,
//     marginBottom: theme.spacing.xs,
//     textAlign: 'center',
//   },
//   subTagline: {
//     fontSize: theme.typography.sm,
//     color: theme.colors.textTertiary,
//     textAlign: 'center',
//   },
//   formContainer: {
//     backgroundColor: theme.colors.backgroundSecondary,
//     borderRadius: theme.borderRadius.xl,
//     padding: theme.spacing.xl,
//     marginBottom: theme.spacing.xl,
//     ...theme.shadows.lg,
//   },
//   formHeader: {
//     marginBottom: theme.spacing.xl,
//     alignItems: 'center',
//   },
//   formTitle: {
//     fontSize: theme.typography['2xl'],
//     fontWeight: 'bold',
//     color: theme.colors.textPrimary,
//     marginBottom: theme.spacing.xs,
//   },
//   formSubtitle: {
//     fontSize: theme.typography.base,
//     color: theme.colors.textSecondary,
//     textAlign: 'center',
//   },
//   section: {
//     marginBottom: theme.spacing.xl,
//   },
//   sectionTitle: {
//     fontSize: theme.typography.lg,
//     fontWeight: 'bold',
//     color: theme.colors.textPrimary,
//     marginBottom: theme.spacing.md,
//   },
//   inputContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: theme.colors.backgroundTertiary,
//     borderRadius: theme.borderRadius.lg,
//     marginBottom: theme.spacing.md,
//     borderWidth: 1,
//     borderColor: theme.colors.border,
//   },
//   inputIcon: {
//     padding: theme.spacing.md,
//   },
//   input: {
//     flex: 1,
//     fontSize: theme.typography.base,
//     color: theme.colors.textPrimary,
//     paddingVertical: theme.spacing.md,
//     paddingRight: theme.spacing.md,
//   },
//   label: {
//     fontSize: theme.typography.sm,
//     fontWeight: '600',
//     color: theme.colors.textSecondary,
//     marginBottom: theme.spacing.sm,
//   },
//   chip: {
//     paddingHorizontal: theme.spacing.md,
//     paddingVertical: theme.spacing.sm,
//     borderRadius: theme.borderRadius.full,
//     borderWidth: 1,
//   },
//   chipText: {
//     fontSize: theme.typography.sm,
//     fontWeight: '600',
//   },
//   selectRow: {
//     borderRadius: theme.borderRadius.lg,
//     padding: theme.spacing.md,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     borderWidth: 1,
//   },
//   selectText: {
//     fontSize: theme.typography.base,
//     fontWeight: '600',
//   },
//   bodyTypeGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: theme.spacing.md,
//   },
//   bodyTile: {
//     width: (width - theme.spacing.lg * 2 - theme.spacing.xl * 2 - theme.spacing.md * 2) / 3,
//     borderRadius: theme.borderRadius.lg,
//     padding: theme.spacing.md,
//     alignItems: 'center',
//     justifyContent: 'center',
//     position: 'relative',
//     borderWidth: 1,
//   },
//   bodyImage: {
//     width: 50,
//     height: 50,
//   },
//   bodyLabel: {
//     marginTop: theme.spacing.sm,
//     fontSize: theme.typography.xs,
//     textAlign: 'center',
//   },
//   checkIcon: {
//     position: 'absolute',
//     top: theme.spacing.sm,
//     right: theme.spacing.sm,
//   },
//   consentContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: theme.spacing.xl,
//     gap: theme.spacing.md,
//   },
//   checkbox: {
//     width: 24,
//     height: 24,
//     borderRadius: 4,
//     borderWidth: 2,
//     borderColor: theme.colors.accent,
//     backgroundColor: theme.colors.accent,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   consentText: {
//     flex: 1,
//     fontSize: theme.typography.sm,
//     color: theme.colors.textSecondary,
//     lineHeight: 20,
//   },
//   signupButton: {
//     borderRadius: theme.borderRadius.lg,
//     marginBottom: theme.spacing.xl,
//     overflow: 'hidden',
//   },
//   signupButtonGradient: {
//     paddingVertical: theme.spacing.lg,
//     alignItems: 'center',
//   },
//   signupButtonText: {
//     fontSize: theme.typography.lg,
//     fontWeight: 'bold',
//     color: theme.colors.white,
//   },
//   divider: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: theme.spacing.lg,
//   },
//   dividerLine: {
//     flex: 1,
//     height: 1,
//     backgroundColor: theme.colors.border,
//   },
//   dividerText: {
//     fontSize: theme.typography.sm,
//     color: theme.colors.textTertiary,
//     marginHorizontal: theme.spacing.md,
//   },
//   socialButtons: {
//     flexDirection: 'row',
//     gap: theme.spacing.md,
//     marginBottom: theme.spacing.lg,
//   },
//   socialButton: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: theme.spacing.md,
//     borderRadius: theme.borderRadius.lg,
//     borderWidth: 1,
//     borderColor: theme.colors.border,
//     gap: theme.spacing.sm,
//   },
//   socialButtonText: {
//     fontSize: theme.typography.base,
//     fontWeight: '600',
//   },
//   phoneButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: theme.spacing.md,
//     borderRadius: theme.borderRadius.lg,
//     borderWidth: 1,
//     borderColor: theme.colors.border,
//     backgroundColor: theme.colors.backgroundTertiary,
//     gap: theme.spacing.sm,
//   },
//   phoneButtonText: {
//     fontSize: theme.typography.base,
//     fontWeight: '600',
//     color: theme.colors.textPrimary,
//   },
//   loginContainer: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   loginText: {
//     fontSize: theme.typography.base,
//     color: theme.colors.textSecondary,
//   },
//   loginLink: {
//     fontSize: theme.typography.base,
//     color: theme.colors.accent,
//     fontWeight: 'bold',
//   },
// });


import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../context/AuthContext";

export default function SignupScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Signup">) {
  const { signup } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSignup() {
    // Validation
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await signup(email, password, username, phone);
      setLoading(false);
      navigation.replace("Main");
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Signup failed. Please try again.");
      console.error("Signup error:", err);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" />

      <View style={styles.formContainer}>
        <Text style={styles.title}>Create Account</Text>

        <TextInput
          placeholder="Username"
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (error) setError("");
          }}
          style={styles.input}
        />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (error) setError("");
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (error) setError("");
          }}
          secureTextEntry
          style={styles.input}
        />
        <TextInput
          placeholder="Phone (optional)"
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            if (error) setError("");
          }}
          keyboardType="phone-pad"
          style={styles.input}
        />

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <Pressable
          onPress={onSignup}
          style={({ pressed }) => [
            styles.signupButton,
            { opacity: pressed || loading ? 0.6 : 1 },
          ]}
        >
          <Text style={styles.signupButtonText}>
            {loading ? "Creating Account..." : "Create Account"}
          </Text>
        </Pressable>

        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.loginLink}>Already have an account? Sign In</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  formContainer: {
    backgroundColor: "#f9f9f9",
    padding: 24,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  signupButton: {
    backgroundColor: "#FF6B6B",
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  signupButtonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 16,
  },
  loginLink: {
    color: "#FF6B6B",
    textAlign: "center",
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
});
