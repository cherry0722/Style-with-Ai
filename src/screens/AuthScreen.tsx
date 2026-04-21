/**
 * Auth Screen (v2) — Login + Signup, redesigned with MYRA editorial aesthetic.
 *
 * Visual/layout only — all authentication logic, validation, navigation,
 * loading/error state, and auth-context usage are preserved from v1.
 *
 * Sign Up: username (required, min 3, letters/numbers/underscore), email, password (min 8).
 * Login: email + password valid; buttons disabled until valid.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';

type Tab = 'login' | 'signup';

// ───────────────────────────────────────────────────────────────────────────
// Design tokens (Myra editorial palette)
// ───────────────────────────────────────────────────────────────────────────
const COLORS = {
  beige: '#F5F0E8',
  cream: '#FDFBF7',
  warmCream: '#FAF7F2',
  softCream: '#F0EBE2',
  gold: '#C4A882',
  goldSoft: 'rgba(196,168,130,0.08)',
  darkBrown: '#3D3426',
  muted: '#8C7E6A',
  mutedLight: '#B5A894',
  border: '#E8E0D0',
  error: '#C05A5A',
};

const FONT_SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const FONT_SERIF_ITALIC = Platform.select({
  ios: 'Georgia-Italic',
  android: 'serif',
  default: 'serif',
});

// ───────────────────────────────────────────────────────────────────────────
// Validation (unchanged from v1)
// ───────────────────────────────────────────────────────────────────────────
const USERNAME_MIN = 3;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const PASSWORD_MIN = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUsername(value: string): string | null {
  const t = value.trim();
  if (!t) return 'Username is required.';
  if (t.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (!USERNAME_REGEX.test(t)) return 'Username can only contain letters, numbers, and underscore.';
  return null;
}

function validateEmail(value: string): string | null {
  const t = value.trim();
  if (!t) return 'Email is required.';
  if (!EMAIL_REGEX.test(t)) return 'Please enter a valid email.';
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return 'Password is required.';
  if (value.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// FloatingLabelInput — editorial-style input with animated label + icon
// ───────────────────────────────────────────────────────────────────────────
type FloatingLabelInputProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  icon: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  hasError?: boolean;
  rightAccessory?: React.ReactNode;
  returnKeyType?: 'done' | 'next' | 'go';
  onSubmitEditing?: () => void;
};

function FloatingLabelInput({
  label,
  value,
  onChangeText,
  onBlur,
  icon,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  editable = true,
  hasError,
  rightAccessory,
  returnKeyType,
  onSubmitEditing,
}: FloatingLabelInputProps) {
  const [focused, setFocused] = useState(false);
  const isActive = focused || value.length > 0;
  const anim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isActive ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isActive, anim]);

  const labelTop = anim.interpolate({ inputRange: [0, 1], outputRange: [18, -8] });
  const labelFontSize = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 10] });

  const iconColor = focused ? COLORS.gold : COLORS.mutedLight;

  return (
    <View style={fieldStyles.wrap}>
      <View
        style={[
          fieldStyles.container,
          focused && fieldStyles.containerFocused,
          hasError && fieldStyles.containerError,
        ]}
      >
        {/*
          Decorative icon column — made non-interactive so taps on the icon
          still forward to the row's TextInput rather than dead-ending here.
        */}
        <View style={fieldStyles.iconCol} pointerEvents="none">
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>

        <View style={fieldStyles.inputCol} collapsable={false}>
          {/*
            FIX: the floating label must not swallow touches. `pointerEvents`
            is a View prop (not a Text prop), so applying it to <Animated.Text>
            had no effect — on Android the Text node was intercepting taps
            that sat over the label, leaving the TextInput unfocusable. We now
            wrap the label in an <Animated.View pointerEvents="none"> which
            RN honors, so touches fall through to the TextInput beneath.
          */}
          <Animated.View
            pointerEvents="none"
            style={[
              fieldStyles.labelWrap,
              { top: labelTop },
              isActive && fieldStyles.labelWrapActive,
            ]}
          >
            <Animated.Text
              style={[
                fieldStyles.labelBase,
                { fontSize: labelFontSize },
                isActive && fieldStyles.labelActiveText,
                { color: isActive ? COLORS.gold : COLORS.mutedLight },
              ]}
            >
              {label}
            </Animated.Text>
          </Animated.View>

          <TextInput
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            editable={editable}
            style={fieldStyles.input}
            selectionColor={COLORS.gold}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            // Android: prevent the Fabric/Paper renderer from collapsing this
            // View tree in a way that sometimes swallows focus events after
            // the parent row animates/re-layouts.
            underlineColorAndroid="transparent"
          />
        </View>

        {rightAccessory ? <View style={fieldStyles.accessoryCol}>{rightAccessory}</View> : null}
      </View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Animated primary / guest button (scale on press)
// ───────────────────────────────────────────────────────────────────────────
type AnimatedButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  children: React.ReactNode;
};

function AnimatedButton({ onPress, disabled, style, children }: AnimatedButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// AuthScreen
// ───────────────────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { login, signup, sessionExpiredMessage, clearSessionMessage } = useAuth();
  const clearSessionRef = React.useRef(clearSessionMessage);
  clearSessionRef.current = clearSessionMessage;

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false, username: false });

  React.useEffect(() => {
    clearSessionRef.current?.();
  }, []);

  // ── Validation (identical behavior to v1) ────────────────────────────────
  const loginEmailError = useMemo(
    () => (touched.email ? validateEmail(email) : null),
    [email, touched.email],
  );
  const loginPasswordError = useMemo(
    () => (touched.password ? validatePassword(password) : null),
    [password, touched.password],
  );
  const loginValid = !validateEmail(email.trim()) && !validatePassword(password);
  const loginDisabled = !loginValid || loading;

  const signupUsernameError = useMemo(
    () => (touched.username ? validateUsername(username) : null),
    [username, touched.username],
  );
  const signupEmailError = useMemo(
    () => (touched.email ? validateEmail(email) : null),
    [email, touched.email],
  );
  const signupPasswordError = useMemo(
    () => (touched.password ? validatePassword(password) : null),
    [password, touched.password],
  );
  const signupValid =
    !validateUsername(username) &&
    !validateEmail(email.trim()) &&
    !validatePassword(password);
  const signupDisabled = !signupValid || loading;

  // ── Auth handlers (unchanged) ────────────────────────────────────────────
  const handleLogin = async () => {
    const emailErr = validateEmail(email.trim());
    const pwErr = validatePassword(password);
    if (emailErr || pwErr) {
      setTouched({ ...touched, email: true, password: true });
      setError(emailErr || pwErr || '');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      const status = err?.status ?? err?.response?.status;
      const msg =
        status === 401
          ? 'Invalid email or password. Please try again.'
          : status === 400
            ? (err?.message && typeof err.message === 'string' ? err.message : 'Invalid request. Please check your input.')
            : (err?.message && typeof err.message === 'string' ? err.message : 'Invalid credentials. Please try again.');
      setError(msg);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[Auth] Login failed', { status, message: msg });
      }
    }
  };

  const handleSignup = async () => {
    const u = username.trim();
    const e = email.trim();
    const userErr = validateUsername(username);
    const emailErr = validateEmail(email);
    const pwErr = validatePassword(password);
    if (userErr || emailErr || pwErr) {
      setTouched({ email: true, password: true, username: true });
      setError(userErr || emailErr || pwErr || '');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signup(e, password, u);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      const status = err?.status ?? err?.response?.status;
      let msg: string;
      if (status === 401) msg = 'Invalid email or password. Please try again.';
      else if (status === 400) {
        const data = err?.data;
        if (data && typeof data === 'object' && data.message && typeof data.message === 'string') msg = data.message;
        else if (data && typeof data === 'object' && Array.isArray(data.details) && data.details.length > 0) {
          const parts = data.details.map((d: { msg?: string }) => d.msg || '').filter(Boolean);
          msg = parts.length ? parts.join('. ') : 'Invalid request. Please check your input.';
        } else msg = err?.message && typeof err.message === 'string' ? err.message : 'Invalid request. Please check your input.';
      } else msg = err?.message && typeof err.message === 'string' ? err.message : 'Signup failed. Please try again.';
      setError(msg);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[Auth] Signup failed', { status, message: msg });
      }
    }
  };

  // ── Mount / transition animations ────────────────────────────────────────
  const topFade = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  // FIX: track whether the bottom-sheet slide-up is still running.
  // While true, we apply the Animated transform to the card. Once it settles,
  // we drop the transform entirely so the card is a plain, laid-out view —
  // this is required because on iOS, a persistent native-driven `transform`
  // on an ancestor of interactive children keeps the shadow-tree layout and
  // the native view's hit region out of sync, which causes <TextInput>s to
  // silently ignore taps (the exact symptom we saw).
  const [cardAnimating, setCardAnimating] = useState(true);

  useEffect(() => {
    Animated.timing(topFade, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 12,
        // CRITICAL: useNativeDriver MUST be false here. With the native
        // driver, iOS animates the CoreAnimation presentation layer while
        // doing hit-tests against the model layer — the two drift apart for
        // the lifetime of the view, and <TextInput>s inside this animated
        // container permanently stop receiving focus. JS-driven animation
        // keeps React's shadow tree and the native view's hit region in
        // sync on every frame, so inputs remain reliably focusable during
        // and after the slide-up.
        useNativeDriver: false,
      }).start(({ finished }) => {
        // Once the spring finishes, re-render without the transform style so
        // the card sub-tree is no longer considered "animated/transformed" by
        // the RN hit-test system. TextInputs become reliably focusable.
        if (finished) setCardAnimating(false);
      });
    }, 500);

    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 40000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    return () => clearTimeout(timer);
  }, [topFade, slideAnim, rotate]);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Toggle (Login / Sign up) animations ──────────────────────────────────
  const [toggleWidth, setToggleWidth] = useState(0);
  const toggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: tab === 'login' ? 0 : 1,
      duration: 400,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [tab, toggleAnim]);

  const TOGGLE_PAD = 5;
  const tabWidth = toggleWidth > 0 ? (toggleWidth - TOGGLE_PAD * 2) / 2 : 0;
  const indicatorTranslateX = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabWidth],
  });

  // ── Username slide-in animation ──────────────────────────────────────────
  const usernameAnim = useRef(new Animated.Value(tab === 'signup' ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(usernameAnim, {
      toValue: tab === 'signup' ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, usernameAnim]);
  const usernameTranslateY = usernameAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const switchTab = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
    setError('');
  };

  const displayError = sessionExpiredMessage || error;
  const isLogin = tab === 'login';

  // First inline error to show (prioritized) under the form
  const currentInlineError = isLogin
    ? loginEmailError || loginPasswordError
    : signupUsernameError || signupEmailError || signupPasswordError;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── TOP SECTION (beige) ──────────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <Animated.View style={[styles.topSection, { opacity: topFade }]}>
          {/* Decorative rotating circle — top-right */}
          <Animated.View
            style={[
              styles.decorCircle,
              { transform: [{ rotate: rotateInterpolate }] },
            ]}
            pointerEvents="none"
          >
            <View style={styles.decorDot} />
          </Animated.View>

          <View style={styles.brandWrap}>
            <Text style={styles.eyebrow}>Welcome to</Text>
            <Text style={styles.brand}>
              <Text style={styles.brandMy}>My</Text>
              <Text style={styles.brandRa}>ra</Text>
            </Text>

            <View style={styles.accentLine} />

            <Text style={styles.tagline}>Your personal style assistant.</Text>
            <Text style={styles.taglineAccent}>Dress with intention.</Text>
          </View>
        </Animated.View>
      </SafeAreaView>

      {/* ── BOTTOM CARD ──────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.cardWrap}
      >
        <Animated.View
          // collapsable={false} stops Fabric/Paper from flattening this view
          // into its parent — flattening is another known cause of focus
          // events being silently dropped on a descendant TextInput after
          // the parent's layout/props change. Keeping the node distinct
          // preserves a stable native view handle for hit-testing.
          collapsable={false}
          style={[
            styles.card,
            // Only apply the transform while the slide-up is in flight.
            // After it settles, the style is dropped entirely so the card
            // is a plain laid-out view again — a second layer of safety on
            // top of the useNativeDriver:false change above.
            cardAnimating ? { transform: [{ translateY: slideAnim }] } : null,
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.cardScroll}
            // "always" guarantees taps on inputs are delivered even if the
            // keyboard/responder tree is in an intermediate state (e.g. while
            // switching tabs or right after the slide-up finishes).
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            // Disable iOS view clipping of children that briefly sit outside
            // the ScrollView's bounds during layout — another source of lost
            // hit targets when parents have been transformed.
            removeClippedSubviews={false}
          >
            {/* Drag handle (decorative affordance) */}
            <View style={styles.dragHandle} />

            {/* Toggle (Login / Sign up) */}
            <View
              style={styles.toggleContainer}
              onLayout={(e) => setToggleWidth(e.nativeEvent.layout.width)}
            >
              {tabWidth > 0 ? (
                <Animated.View
                  style={[
                    styles.toggleIndicator,
                    {
                      width: tabWidth,
                      transform: [{ translateX: indicatorTranslateX }],
                    },
                  ]}
                />
              ) : null}
              <Pressable
                style={styles.toggleTab}
                onPress={() => switchTab('login')}
                accessibilityRole="button"
                accessibilityState={{ selected: isLogin }}
              >
                <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>
                  Login
                </Text>
              </Pressable>
              <Pressable
                style={styles.toggleTab}
                onPress={() => switchTab('signup')}
                accessibilityRole="button"
                accessibilityState={{ selected: !isLogin }}
              >
                <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>
                  Sign up
                </Text>
              </Pressable>
            </View>

            {/* Username (signup only) */}
            {!isLogin ? (
              <Animated.View
                style={{
                  opacity: usernameAnim,
                  transform: [{ translateY: usernameTranslateY }],
                }}
              >
                <FloatingLabelInput
                  label="Username"
                  value={username}
                  onChangeText={(t) => {
                    setUsername(t);
                    if (error) setError('');
                  }}
                  onBlur={() => setTouched((p) => ({ ...p, username: true }))}
                  icon="person-outline"
                  autoCapitalize="none"
                  editable={!loading}
                  hasError={!!signupUsernameError}
                />
              </Animated.View>
            ) : null}

            {/* Email */}
            <FloatingLabelInput
              label="Email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError('');
              }}
              onBlur={() => setTouched((p) => ({ ...p, email: true }))}
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              hasError={isLogin ? !!loginEmailError : !!signupEmailError}
            />

            {/* Password */}
            <FloatingLabelInput
              label="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError('');
              }}
              onBlur={() => setTouched((p) => ({ ...p, password: true }))}
              icon="lock-closed-outline"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
              hasError={isLogin ? !!loginPasswordError : !!signupPasswordError}
              rightAccessory={
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.showHideText}>
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </Text>
                </Pressable>
              }
            />

            {/* Forgot password (login only) — visual link, no handler wired */}
            {isLogin ? (
              <Pressable
                style={styles.forgotWrap}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => {}}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            ) : (
              <View style={styles.forgotSpacer} />
            )}

            {/* Inline validation hint or auth error */}
            {currentInlineError || displayError ? (
              <Text style={styles.errorText}>
                {displayError || currentInlineError}
              </Text>
            ) : null}

            {/* Primary CTA */}
            <AnimatedButton
              onPress={isLogin ? handleLogin : handleSignup}
              disabled={isLogin ? loginDisabled : signupDisabled}
              style={styles.primaryBtn}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.cream} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {isLogin ? 'LOG IN' : 'CREATE ACCOUNT'}
                </Text>
              )}
            </AnimatedButton>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, styles.dividerLineLeft]} />
              <Text style={styles.dividerText}>or</Text>
              <View style={[styles.dividerLine, styles.dividerLineRight]} />
            </View>

            {/* Guest CTA */}
            <AnimatedButton
              onPress={() => navigation.navigate('GuestHome')}
              style={styles.guestBtn}
            >
              <Text style={styles.guestBtnText}>CONTINUE AS GUEST</Text>
            </AnimatedButton>

            {/* Terms footer */}
            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.termsAccent}>Terms</Text>
              {' & '}
              <Text style={styles.termsAccent}>Privacy Policy</Text>
            </Text>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  topSafe: {
    backgroundColor: COLORS.beige,
  },
  topSection: {
    paddingHorizontal: 36,
    paddingTop: 24,
    paddingBottom: 32,
    minHeight: 220,
    justifyContent: 'center',
  },
  decorCircle: {
    position: 'absolute',
    top: 16,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  decorDot: {
    position: 'absolute',
    top: -3,
    left: 60 - 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
  },
  brandWrap: {
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 4,
    color: COLORS.gold,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 8,
  },
  brand: {
    color: COLORS.darkBrown,
    marginBottom: 14,
  },
  brandMy: {
    fontFamily: FONT_SERIF,
    fontSize: 72,
    fontWeight: '300',
    color: COLORS.darkBrown,
    letterSpacing: -2,
  },
  brandRa: {
    fontFamily: FONT_SERIF_ITALIC,
    fontStyle: 'italic',
    fontSize: 72,
    fontWeight: '400',
    color: COLORS.darkBrown,
    letterSpacing: -2,
  },
  accentLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.gold,
    opacity: 0.85,
    marginBottom: 14,
    borderRadius: 1,
  },
  tagline: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '400',
    marginBottom: 2,
  },
  taglineAccent: {
    fontSize: 13,
    color: COLORS.gold,
    fontWeight: '500',
    fontStyle: 'italic',
    fontFamily: FONT_SERIF_ITALIC,
  },

  // Card
  cardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 20,
    shadowOpacity: 0.08,
    elevation: 12,
    flexGrow: 1,
  },
  cardScroll: {
    paddingBottom: 24,
    // flexGrow ensures the content container always fills the card's height,
    // so hit regions for the inputs/buttons match their visible positions
    // even when the form is short (login mode has fewer fields).
    flexGrow: 1,
  },

  // Drag handle (decorative)
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 12,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.softCream,
    borderRadius: 20,
    padding: 5,
    marginBottom: 22,
    position: 'relative',
    overflow: 'hidden',
  },
  toggleIndicator: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    backgroundColor: COLORS.darkBrown,
    borderRadius: 16,
    shadowColor: '#3D3426',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    shadowOpacity: 0.2,
    elevation: 4,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  toggleTextActive: {
    color: COLORS.warmCream,
  },

  // Forgot password
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 18,
  },
  forgotSpacer: {
    height: 12,
  },
  forgotText: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '500',
  },

  // Error
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 14,
    marginTop: -4,
  },

  // Primary button
  primaryBtn: {
    backgroundColor: COLORS.darkBrown,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3D3426',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    shadowOpacity: 0.15,
    elevation: 6,
  },
  primaryBtnText: {
    color: COLORS.warmCream,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Show / Hide
  showHideText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: COLORS.gold,
    textTransform: 'uppercase',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerLineLeft: {
    opacity: 0.6,
  },
  dividerLineRight: {
    opacity: 0.6,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: COLORS.mutedLight,
    fontStyle: 'italic',
    fontFamily: FONT_SERIF_ITALIC,
  },

  // Guest button
  guestBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBtnText: {
    color: COLORS.darkBrown,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Terms footer
  termsText: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.mutedLight,
    marginTop: 22,
    lineHeight: 16,
  },
  termsAccent: {
    color: COLORS.gold,
    fontWeight: '500',
  },
});

const fieldStyles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.warmCream,
    paddingHorizontal: 16,
  },
  containerFocused: {
    borderColor: COLORS.gold,
    backgroundColor: '#FFFFFF',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  containerError: {
    borderColor: COLORS.error,
  },
  iconCol: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCol: {
    flex: 1,
    marginLeft: 10,
    position: 'relative',
    justifyContent: 'center',
    minHeight: 56,
  },
  accessoryCol: {
    marginLeft: 8,
    paddingLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Wrapper owns positioning + the "cutout" background in the active state.
  // pointerEvents="none" lives on this View (see FloatingLabelInput JSX) so
  // the label never intercepts taps meant for the TextInput.
  labelWrap: {
    position: 'absolute',
    left: 0,
  },
  labelWrapActive: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 6,
    // Pull left a touch so the padded background aligns with the input's edge
    left: -4,
    borderRadius: 2,
  },
  labelBase: {
    fontWeight: '400',
    color: COLORS.mutedLight,
  },
  labelActiveText: {
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  input: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.darkBrown,
    paddingVertical: 18,
    paddingHorizontal: 0,
    margin: 0,
  },
});
