/**
 * Auth Screen (v1) — Login + Signup with required fields and validation.
 * Sign Up: username (required, min 3, letters/numbers/underscore), email, password (min 8).
 * Login: email + password valid; buttons disabled until valid.
 */
import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

type Tab = 'login' | 'signup';

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

export default function AuthScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Auth'>>();
  const { login, signup, sessionExpiredMessage, clearSessionMessage } = useAuth();
  const clearSessionRef = React.useRef(clearSessionMessage);
  clearSessionRef.current = clearSessionMessage;
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false, username: false });

  React.useEffect(() => {
    clearSessionRef.current?.();
  }, []);

  const loginEmailError = useMemo(() => (touched.email ? validateEmail(email) : null), [email, touched.email]);
  const loginPasswordError = useMemo(() => (touched.password ? validatePassword(password) : null), [password, touched.password]);
  const loginValid = !validateEmail(email.trim()) && !validatePassword(password);
  const loginDisabled = !loginValid || loading;

  const signupUsernameError = useMemo(() => (touched.username ? validateUsername(username) : null), [username, touched.username]);
  const signupEmailError = useMemo(() => (touched.email ? validateEmail(email) : null), [email, touched.email]);
  const signupPasswordError = useMemo(() => (touched.password ? validatePassword(password) : null), [password, touched.password]);
  const signupValid =
    !validateUsername(username) &&
    !validateEmail(email.trim()) &&
    !validatePassword(password);
  const signupDisabled = !signupValid || loading;

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
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message || 'Invalid credentials. Please try again.';
      setError(msg);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[Auth] Login failed', { status: err?.status, message: msg });
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
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err: any) {
      setLoading(false);
      let msg = err?.message || 'Signup failed. Please try again.';
      const data = err?.data;
      if (data && typeof data === 'object') {
        if (data.message) msg = data.message;
        if (Array.isArray(data.details) && data.details.length > 0) {
          const parts = data.details.map((d: { msg?: string }) => d.msg || '').filter(Boolean);
          if (parts.length) msg = parts.join('. ');
        }
      }
      setError(msg);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[Auth] Signup failed', { status: err?.status, message: msg });
      }
    }
  };

  const displayError = sessionExpiredMessage || error;
  const styles = createStyles(theme);
  const isLogin = tab === 'login';

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.title}>MYRA</Text>
            <Text style={styles.subtitle}>Your Personal Style Assistant</Text>

            <View style={styles.tabRow}>
              <Pressable style={[styles.tab, isLogin && styles.tabActive]} onPress={() => { setTab('login'); setError(''); }}>
                <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Login</Text>
              </Pressable>
              <Pressable style={[styles.tab, !isLogin && styles.tabActive]} onPress={() => { setTab('signup'); setError(''); }}>
                <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Sign up</Text>
              </Pressable>
            </View>

            {isLogin ? (
              <>
                <TextInput
                  style={[styles.input, loginEmailError ? styles.inputError : null]}
                  placeholder="Email"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(''); }}
                  onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
                {loginEmailError ? <Text style={styles.inlineError}>{loginEmailError}</Text> : null}
                <TextInput
                  style={[styles.input, loginPasswordError ? styles.inputError : null]}
                  placeholder={`Password (min ${PASSWORD_MIN})`}
                  placeholderTextColor={theme.colors.textTertiary}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(''); }}
                  onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                  secureTextEntry
                  editable={!loading}
                />
                {loginPasswordError ? <Text style={styles.inlineError}>{loginPasswordError}</Text> : null}
                <Pressable style={[styles.button, loginDisabled && styles.buttonDisabled]} onPress={handleLogin} disabled={loginDisabled}>
                  {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={[styles.input, signupUsernameError ? styles.inputError : null]}
                  placeholder={`Username (min ${USERNAME_MIN}, letters/numbers/underscore)`}
                  placeholderTextColor={theme.colors.textTertiary}
                  value={username}
                  onChangeText={(t) => { setUsername(t); setError(''); }}
                  onBlur={() => setTouched((p) => ({ ...p, username: true }))}
                  autoCapitalize="none"
                  editable={!loading}
                />
                {signupUsernameError ? <Text style={styles.inlineError}>{signupUsernameError}</Text> : null}
                <TextInput
                  style={[styles.input, signupEmailError ? styles.inputError : null]}
                  placeholder="Email"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(''); }}
                  onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
                {signupEmailError ? <Text style={styles.inlineError}>{signupEmailError}</Text> : null}
                <TextInput
                  style={[styles.input, signupPasswordError ? styles.inputError : null]}
                  placeholder={`Password (min ${PASSWORD_MIN})`}
                  placeholderTextColor={theme.colors.textTertiary}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(''); }}
                  onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                  secureTextEntry
                  editable={!loading}
                />
                {signupPasswordError ? <Text style={styles.inlineError}>{signupPasswordError}</Text> : null}
                <Pressable style={[styles.button, signupDisabled && styles.buttonDisabled]} onPress={handleSignup} disabled={signupDisabled}>
                  {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
                </Pressable>
              </>
            )}

            {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    keyboard: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xl },
    card: {
      maxWidth: 400,
      alignSelf: 'center',
      width: '100%',
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing['2xl'],
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    title: { fontSize: theme.typography['3xl'], fontWeight: theme.typography.bold, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: theme.spacing.xs },
    subtitle: { fontSize: theme.typography.sm, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.xl },
    tabRow: { flexDirection: 'row', marginBottom: theme.spacing.lg, gap: theme.spacing.sm },
    tab: { flex: 1, paddingVertical: theme.spacing.md, alignItems: 'center', borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.border },
    tabActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    tabText: { fontSize: theme.typography.base, fontWeight: theme.typography.medium, color: theme.colors.textSecondary },
    tabTextActive: { color: theme.colors.white },
    input: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      fontSize: theme.typography.base,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    inputError: { borderColor: theme.colors.error },
    inlineError: { fontSize: theme.typography.xs, color: theme.colors.error, marginBottom: theme.spacing.md },
    button: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.lg,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: theme.typography.base, fontWeight: theme.typography.bold, color: theme.colors.white },
    errorText: { fontSize: theme.typography.sm, color: theme.colors.error, marginTop: theme.spacing.md, textAlign: 'center' },
  });
}
