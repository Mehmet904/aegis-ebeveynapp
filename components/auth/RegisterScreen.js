import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, ScrollView, Keyboard } from 'react-native';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth'; 
import { ref, set } from 'firebase/database';
import { auth, db } from '../../utils/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants'; 

const CustomInput = ({ icon, placeholder, value, onChangeText, isSecure, secure, onToggleSecure, keyboardType, autoCapitalize, isFocused, onFocus, onBlur, themeColor, maxLength }) => (
  <View style={[styles.inputWrapper, isFocused && { borderColor: themeColor, backgroundColor: '#fff' }]}>
    <View style={styles.iconBox}><Ionicons name={icon} size={20} color={isFocused ? themeColor : "#94a3b8"} /></View>
    <TextInput placeholder={placeholder} placeholderTextColor="#94a3b8" value={value} maxLength={maxLength} onChangeText={onChangeText} secureTextEntry={isSecure && secure} keyboardType={keyboardType || 'default'} autoCapitalize={autoCapitalize || 'words'} style={styles.inputField} onFocus={onFocus} onBlur={onBlur} />
    {isSecure && <TouchableOpacity onPress={onToggleSecure} style={styles.eyeBtn}><Ionicons name={secure ? "eye-off" : "eye"} size={22} color="#94a3b8" /></TouchableOpacity>}
  </View>
);

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({ name: '', surname: '', phone: '', email: '', password: '' });
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  
  // 🚀 SÖZLEŞME STATE'İ EKLENDİ
  const [agreed, setAgreed] = useState(false); 

  const themeColor = "#6366f1";
  const triggerHaptic = (type = 'Light') => Haptics.impactAsync(Haptics.ImpactFeedbackStyle[type]).catch(() => {});

  const formatPhoneNumber = (text) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 4) formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    if (cleaned.length > 7) formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    if (cleaned.length > 9) formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9, 11)}`;
    return formatted;
  };

  const calculatePasswordStrength = (pass) => {
    let score = 0;
    if (pass.length > 7) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const passStrength = calculatePasswordStrength(formData.password);
  
  const getStrengthConfig = () => {
    if (formData.password.length === 0) return { color: 'transparent', text: '', width: '0%' };
    if (passStrength <= 1) return { color: '#ef4444', text: 'Zayıf', width: '33%' };
    if (passStrength === 2) return { color: '#f59e0b', text: 'Orta', width: '66%' };
    return { color: '#6366f1', text: 'Güçlü', width: '100%' };
  };

  const strengthConfig = getStrengthConfig();

  const handleRegister = async () => {
    Keyboard.dismiss();
    const { name, surname, phone, email, password } = formData;

    // 🚀 SÖZLEŞME KONTROLÜ
    if (!agreed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return Alert.alert('Yasal Uyarı', 'Devam etmek için Gizlilik Politikası ve Kullanım Koşullarını kabul etmelisiniz.');
    }

    if (!name || !surname || !phone || !email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return Alert.alert('Eksik Bilgi', 'Lütfen tüm alanları eksiksiz doldurun.');
    }

    if (passStrength < 2) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return Alert.alert('Güvenlik Uyarısı', 'Şifreniz çok zayıf. En az 8 karakter, 1 büyük harf ve 1 rakam içermelidir.');
    }

    triggerHaptic('Heavy');
    setLoading(true);
    
try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 🚀 DÜZELTME 1: Ebeveynin GERÇEK adını ve soyadını kaydediyoruz.
      const fullName = `${name} ${surname}`.trim();
      await updateProfile(user, { displayName: fullName }); 

      // 🚀 DÜZELTME 2: Veritabanına rolünü anında 'parent' olarak işliyoruz.
      const userRef = ref(db, `users/${user.uid}`);
      await set(userRef, {
        email: user.email,
        role: 'parent',
        displayName: fullName,
        createdAt: new Date().toISOString()
      });

      await sendEmailVerification(user);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Onay Gerekiyor', 'Yönetici ağımıza katılmak için e-posta adresinize bir doğrulama bağlantısı gönderdik. Lütfen onayladıktan sonra giriş yapın.', [
        { text: 'Giriş Yap', onPress: () => navigation.replace('Login') }
      ]);
      
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      let errorMessage = 'Kayıt sırasında bir sorun oluştu.';
      switch (error.code) {
        case 'auth/email-already-in-use': errorMessage = 'Bu e-posta adresi zaten kullanımda. Lütfen giriş yapmayı deneyin.'; break;
        case 'auth/invalid-email': errorMessage = 'Geçersiz bir e-posta adresi girdiniz.'; break;
        case 'auth/network-request-failed': errorMessage = 'İnternet bağlantınızı kontrol edin.'; break;
      }
      Alert.alert('Kayıt Başarısız', errorMessage);
    } finally { setLoading(false); }
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
          
          <TouchableOpacity style={styles.backBtn} onPress={() => { triggerHaptic('Light'); navigation.goBack(); }}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>

          <View style={styles.headerArea}><Text style={styles.titleText}>Yönetici Kaydı</Text><Text style={styles.subText}>Komuta merkezine katıl</Text></View>

          <BlurView intensity={80} tint="light" style={styles.formAreaWrapper}>
            <View style={styles.formArea}>
              
              <View style={styles.rowInputs}>
                <View style={{flex: 1, marginRight: 10}}><CustomInput icon="person" placeholder="Ad" value={formData.name} onChangeText={(t) => setFormData({...formData, name: t})} isFocused={focusedInput === 'name'} onFocus={() => setFocusedInput('name')} onBlur={() => setFocusedInput(null)} themeColor={themeColor} /></View>
                <View style={{flex: 1}}><CustomInput icon="people" placeholder="Soyad" value={formData.surname} onChangeText={(t) => setFormData({...formData, surname: t})} isFocused={focusedInput === 'surname'} onFocus={() => setFocusedInput('surname')} onBlur={() => setFocusedInput(null)} themeColor={themeColor} /></View>
              </View>

              <CustomInput icon="call" placeholder="Telefon Numarası" value={formData.phone} maxLength={14} onChangeText={(t) => setFormData({...formData, phone: formatPhoneNumber(t)})} keyboardType="phone-pad" isFocused={focusedInput === 'phone'} onFocus={() => setFocusedInput('phone')} onBlur={() => setFocusedInput(null)} themeColor={themeColor} />
              <CustomInput icon="mail" placeholder="E-posta Adresi" value={formData.email} onChangeText={(t) => setFormData({...formData, email: t})} keyboardType="email-address" autoCapitalize="none" isFocused={focusedInput === 'email'} onFocus={() => setFocusedInput('email')} onBlur={() => setFocusedInput(null)} themeColor={themeColor} />
              
              <View style={[styles.inputWrapper, focusedInput === 'password' && { borderColor: themeColor, backgroundColor: '#fff' }]}>
                <View style={styles.iconBox}><Ionicons name="lock-closed" size={20} color={focusedInput === 'password' ? themeColor : "#94a3b8"} /></View>
                <TextInput placeholder="Güvenlik Şifresi" placeholderTextColor="#94a3b8" value={formData.password} onChangeText={(t) => setFormData({...formData, password: t})} secureTextEntry={secure} style={styles.inputField} onFocus={() => setFocusedInput('password')} onBlur={() => setFocusedInput(null)} />
                <TouchableOpacity onPress={() => { triggerHaptic('Light'); setSecure(!secure); }} style={styles.eyeBtn} activeOpacity={0.7}><Ionicons name={secure ? "eye-off" : "eye"} size={22} color="#94a3b8" /></TouchableOpacity>
              </View>

              {formData.password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBarBg}><View style={[styles.strengthBarFill, { width: strengthConfig.width, backgroundColor: strengthConfig.color }]} /></View>
                  <Text style={[styles.strengthText, { color: strengthConfig.color }]}>{strengthConfig.text}</Text>
                </View>
              )}

              {/* 🚀 SÖZLEŞME ONAY KUTUSU BURAYA EKLENDİ */}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 }} activeOpacity={0.7} onPress={() => { triggerHaptic('Light'); setAgreed(!agreed); }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: agreed ? themeColor : '#94a3b8', backgroundColor: agreed ? themeColor : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  {agreed && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: '#64748b', fontWeight: '600' }}>
                  <Text style={{ color: themeColor, fontWeight: '800' }}>Kullanım Koşulları</Text> ve <Text style={{ color: themeColor, fontWeight: '800' }}>Gizlilik Politikası</Text>'nı okudum, kabul ediyorum.
                </Text>
              </TouchableOpacity>

              {loading ? <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 20 }} /> : (
                <TouchableOpacity style={styles.loginBtn} activeOpacity={0.8} onPress={handleRegister}>
                  <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.gradientBtn}>
                    <Text style={styles.loginBtnText}>Yönetici Hesabını Oluştur</Text><Ionicons name="finger-print" size={22} color="#fff" style={{ marginLeft: 8 }} />
                  </LinearGradient>
                </TouchableOpacity>
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
  flexContainer: { flex: 1 }, scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 50 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 5 },
  headerArea: { marginBottom: 30 }, titleText: { fontSize: 36, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 },
  subText: { fontSize: 14, color: '#6366f1', marginTop: 5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  formAreaWrapper: { borderRadius: 35, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', elevation: 15 },
  formArea: { backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: 25 }, rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 15, borderWidth: 1.5, borderColor: '#e2e8f0' },
  iconBox: { padding: 16, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }, inputField: { flex: 1, paddingVertical: 16, color: '#1e293b', fontSize: 15, fontWeight: '700' },
  eyeBtn: { padding: 15 }, strengthContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
  strengthBarBg: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginRight: 10 },
  strengthBarFill: { height: '100%', borderRadius: 3 }, strengthText: { fontSize: 12, fontWeight: '800', width: 60, textAlign: 'right' },
  loginBtn: { borderRadius: 20, elevation: 10, marginTop: 10 }, gradientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 20 },
  loginBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }
});
export default RegisterScreen;