import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, Dimensions, ScrollView, Keyboard } from 'react-native';
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';
import { auth, db } from '../../utils/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  const themeColor = "#6366f1"; 

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '1006923583455-3uid1vd3q79688s6bt47ppnv2ked25ma.apps.googleusercontent.com',
    });
    AsyncStorage.getItem('savedEmail').then(saved => { if(saved) setEmail(saved); });
  }, []);

  useEffect(() => {
    let timer;
    if (lockoutTime > 0) {
      timer = setInterval(() => setLockoutTime(prev => prev - 1), 1000);
    } else if (lockoutTime === 0 && failedAttempts >= 3) {
      setFailedAttempts(0);
    }
    return () => clearInterval(timer);
  }, [lockoutTime, failedAttempts]);

  const triggerHaptic = (type = 'Light') => Haptics.impactAsync(Haptics.ImpactFeedbackStyle[type]).catch(() => {});
  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

const processLogin = async (loginEmail, loginPassword) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      const user = userCredential.user;

      if (!user.emailVerified) {
        Alert.alert('Onay Gerekli', 'Yönetici onayı olmadan sisteme erişemezsiniz.');
        await auth.signOut();
        setLoading(false); return;
      }

      const userRef = ref(db, `users/${user.uid}`);
      const userSnap = await get(userRef);
      const currentDevice = Device.modelName || 'Bilinmeyen Cihaz';
      const userData = userSnap.val(); // Veriyi değişkene alalım

if (userSnap.exists() && userData && userData.role) {
        // 1. Durum: Rol veritabanında var, gerçek rolüne bak.
        if (userData.role !== 'parent') {
          await auth.signOut();
          Alert.alert('Erişim Engellendi', 'Bu bir çocuk hesabıdır. Yönetim paneline giremezsiniz.');
          setLoading(false); return;
        }

        const savedDevice = userData.lastDevice;
        if (savedDevice && savedDevice !== currentDevice) {
           Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
           Alert.alert('🚨 Güvenlik Uyarısı', `Hesabınıza yeni bir cihazdan (${currentDevice}) giriş yapıldı. (Önceki Cihaz: ${savedDevice}).`);
        }
await update(userRef, { lastDevice: currentDevice, lastLogin: new Date().toISOString() });

      } else {
        // 🚀 DÜZELTME 3: Eski karmaşık "profileRole" kontrollerini tamamen uçurduk.
        await update(userRef, {
          email: user.email, 
          role: 'parent', 
          displayName: user.displayName || 'Yönetici', 
          lastDevice: currentDevice, 
          createdAt: new Date().toISOString(),
        });
      }
await AsyncStorage.setItem('savedEmail', loginEmail.trim());
await SecureStore.setItemAsync('savedPassword', loginPassword);

      setFailedAttempts(0); 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('ParentHome');

} catch (error) {
      console.error("GİRİŞ HATASI:", error); // Terminalde hatayı net görmek için
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 3) setLockoutTime(30);

      // 🚀 Hata mesajına "error.message" ekliyoruz ki sorunun ne olduğunu görelim
      let userMessage = `Sisteme erişim sağlanamadı.\nDetay: ${error.message}`;
      
      switch (error.code) {
        case 'auth/invalid-credential': userMessage = 'E-posta adresi veya güvenlik şifresi hatalı.'; break;
        case 'auth/invalid-email': userMessage = 'Geçerli bir e-posta formatı girmediniz.'; break;
        case 'auth/too-many-requests': userMessage = 'Çok fazla hatalı deneme yaptınız.'; break;
        case 'auth/network-request-failed': userMessage = 'İnternet bağlantınız koptu.'; break;
      }
      Alert.alert('Güvenlik Uyarısı', userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    Keyboard.dismiss();
    if (lockoutTime > 0) {
        triggerHaptic('Error');
        return Alert.alert('Sistem Kilitli', `Çok fazla hatalı deneme. Lütfen ${lockoutTime} saniye bekleyin.`);
    }
    if (!email || !password) return Alert.alert('Eksik Bilgi', 'E-posta ve şifre girin.');
    if (!validateEmail(email.trim())) return Alert.alert('Hata', 'Geçerli bir e-posta girin.');
    triggerHaptic('Medium');
    processLogin(email, password);
  };

  const handleBiometricLogin = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return Alert.alert('Hata', 'Cihazınızda biyometrik okuyucu yok.');
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return Alert.alert('Hata', 'Cihazınıza kayıtlı parmak izi/yüz bulunamadı.');
    const savedEmail = await AsyncStorage.getItem('savedEmail');
const savedPassword = await SecureStore.getItemAsync('savedPassword');
    if (!savedEmail || !savedPassword) return Alert.alert('Bilgi', 'Biyometrik girişi kullanabilmek için önce şifrenizle giriş yapmalısınız.');
    const authResult = await LocalAuthentication.authenticateAsync({ promptMessage: 'Yönetici Kimliğini Doğrula', fallbackLabel: 'Şifre Kullan', cancelLabel: 'İptal' });
    if (authResult.success) { setEmail(savedEmail); setPassword(savedPassword); processLogin(savedEmail, savedPassword); }
  };

  const handleGoogleLogin = async () => {
    try {
      triggerHaptic('Medium');
      setLoading(true);
      await GoogleSignin.signOut().catch(() => {});
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const googleCredential = GoogleAuthProvider.credential(userInfo.data.idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);
      const user = userCredential.user;
      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);
      const currentDevice = Device.modelName || 'Bilinmeyen Cihaz';

      if (!snapshot.exists()) {
        await set(userRef, { email: user.email, displayName: user.displayName || 'Yönetici', profileImage: user.photoURL || null, role: 'parent', lastDevice: currentDevice, createdAt: new Date().toISOString() });
      } else if (snapshot.val().role !== 'parent') {
         await auth.signOut();
         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
         Alert.alert('Erişim Reddedildi', 'Bu Google hesabı Çocuk olarak kaydedilmiş.');
         setLoading(false); return;
      } else {
         await update(userRef, { lastDevice: currentDevice, lastLogin: new Date().toISOString() });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('ParentHome');
    } catch (error) { setLoading(false); if (error.code !== 'SIGN_IN_CANCELLED') Alert.alert('Hata', 'Google servisiyle bağlantı kurulamadı.'); }
  };

  const handleForgotPassword = async () => {
    triggerHaptic('Light');
    if (!email || !validateEmail(email)) return Alert.alert('E-posta Gerekli', 'Lütfen geçerli bir e-posta adresi girin.');
    try { await sendPasswordResetEmail(auth, email.trim()); Alert.alert('Bağlantı Gönderildi', `${email} adresine şifre yenileme talimatları iletildi.`); } 
    catch (error) { Alert.alert('Hata', 'İşlem başarısız.'); }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.absoluteBackground}>
        <LinearGradient colors={['#0f172a', '#1e293b', '#f8fafc']} locations={[0, 0.4, 0.7]} style={{flex: 1}} />
        <LinearGradient colors={['#6366f1', 'transparent']} style={styles.glowTopRight} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flexContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.headerArea}>
            <View style={styles.logoOuterGlow}><View style={styles.logoCircle}><Ionicons name="finger-print" size={40} color="#6366f1" /></View></View>
            <Text style={styles.titleText}>Aegis Yönetim</Text><Text style={styles.subText}>Komuta Merkezine Giriş</Text>
          </View>
          <BlurView intensity={80} tint="light" style={styles.formAreaWrapper}>
            <View style={styles.formArea}>
              <View style={[styles.inputWrapper, focusedInput === 'email' && styles.inputWrapperFocused]}>
                <View style={styles.iconBox}><Ionicons name="mail" size={20} color={focusedInput === 'email' ? "#6366f1" : "#94a3b8"} /></View>
                <TextInput placeholder="Yönetici E-posta" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.inputField} onFocus={() => setFocusedInput('email')} onBlur={() => setFocusedInput(null)} />
              </View>
              <View style={[styles.inputWrapper, { marginBottom: 10 }, focusedInput === 'password' && styles.inputWrapperFocused]}>
                <View style={styles.iconBox}><Ionicons name="lock-closed" size={20} color={focusedInput === 'password' ? "#6366f1" : "#94a3b8"} /></View>
                <TextInput placeholder="Güvenlik Anahtarı" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry={secure} style={styles.inputField} onFocus={() => setFocusedInput('password')} onBlur={() => setFocusedInput(null)} />
                <TouchableOpacity onPress={() => { triggerHaptic(); setSecure(!secure); }} style={styles.eyeBtn}><Ionicons name={secure ? "eye-off" : "eye"} size={22} color="#94a3b8" /></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn}><Text style={styles.forgotText}>Anahtarımı Unuttum</Text></TouchableOpacity>

              {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 20 }} /> : (
                <View style={styles.buttonGroup}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <TouchableOpacity style={[styles.loginBtn, {flex: 1}]} activeOpacity={0.8} onPress={handleLogin}>
                        <LinearGradient colors={lockoutTime > 0 ? ['#94a3b8', '#64748b'] : ['#6366f1', '#4f46e5']} style={styles.gradientBtn}>
                          <Text style={styles.loginBtnText}>{lockoutTime > 0 ? `Kilitli (${lockoutTime}s)` : 'Ağa Bağlan'}</Text>
                          {lockoutTime === 0 && <Ionicons name="log-in-outline" size={22} color="#fff" style={{ marginLeft: 8 }} />}
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleBiometricLogin} style={styles.biometricBtn}><Ionicons name="scan-outline" size={28} color="#6366f1" /></TouchableOpacity>
                  </View>
                  <View style={styles.dividerBox}><View style={styles.dividerLine} /><Text style={styles.dividerText}>KISA YOL</Text><View style={styles.dividerLine} /></View>
                  <TouchableOpacity style={styles.googleBtn} activeOpacity={0.7} onPress={handleGoogleLogin}>
                    <Ionicons name="logo-google" size={20} color="#ef4444" style={{marginRight: 10}} /><Text style={styles.googleBtnText}>Google ile Hızlı Giriş</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.registerBtn} activeOpacity={0.7} onPress={() => { triggerHaptic(); navigation.navigate('Register'); }}>
                    <Text style={styles.registerBtnText}>Yönetici kaydın yok mu? <Text style={{color: '#6366f1', fontWeight: '900'}}>Oluştur</Text></Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1 }, absoluteBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  glowTopRight: { position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200, opacity: 0.3 },
  flexContainer: { flex: 1 }, scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 25, paddingBottom: 50 },
  headerArea: { alignItems: 'center', marginBottom: 40, marginTop: 40 }, logoOuterGlow: { padding: 18, backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: 50 },
  logoCircle: { width: 85, height: 85, backgroundColor: '#fff', borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 15 },
  titleText: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 20, letterSpacing: 0.5 }, subText: { fontSize: 14, color: '#cbd5e1', marginTop: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  formAreaWrapper: { borderRadius: 35, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', elevation: 20 },
  formArea: { backgroundColor: 'rgba(255, 255, 255, 0.85)', padding: 30 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 20, marginBottom: 15, borderWidth: 1.5, borderColor: '#e2e8f0' },
  inputWrapperFocused: { borderColor: '#6366f1', backgroundColor: '#fff' }, iconBox: { padding: 16, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  inputField: { flex: 1, paddingVertical: 18, color: '#1e293b', fontSize: 16, fontWeight: '700' }, eyeBtn: { padding: 15 }, forgotBtn: { alignSelf: 'flex-end', marginBottom: 25 },
  forgotText: { color: '#6366f1', fontSize: 13, fontWeight: '800' }, buttonGroup: { width: '100%' }, loginBtn: { borderRadius: 20, elevation: 5 },
  gradientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 20 },
  loginBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  biometricBtn: { marginLeft: 15, backgroundColor: '#f8fafc', padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2},
  dividerBox: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 }, dividerLine: { flex: 1, height: 1, backgroundColor: '#cbd5e1' },
  dividerText: { marginHorizontal: 15, color: '#64748b', fontSize: 11, fontWeight: '800' }, googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 16, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15 },
  googleBtnText: { color: '#1e293b', fontWeight: '800', fontSize: 15 }, registerBtn: { alignItems: 'center', paddingVertical: 10 }, registerBtnText: { color: '#475569', fontWeight: '600', fontSize: 14 }
});
export default LoginScreen;