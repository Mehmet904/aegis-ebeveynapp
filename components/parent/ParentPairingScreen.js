import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Animated
} from 'react-native';
import { ref, get, remove, update } from 'firebase/database';
import { auth, db } from '../../utils/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const ParentPairingScreen = ({ navigation }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // 🌀 İkon animasyonu için
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const handleCodeChange = (text) => {
    const formatted = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCode(formatted);
    if (formatted.length > code.length) {
       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePairing = async () => {
    if (code.length !== 6) {
      triggerHaptic('Error');
      Alert.alert('Hatalı Format', 'Güvenlik kodu tam 6 haneli olmalıdır.');
      return;
    }

    triggerHaptic('Medium');
    setLoading(true);
    const codeRef = ref(db, `pairingCodes/${code}`);
    
    try {
      const snapshot = await get(codeRef);

      if (!snapshot.exists()) {
        triggerHaptic('Error');
        Alert.alert('Eşleşme Başarısız', 'Girilen kod geçersiz veya süresi dolmuş olabilir.');
        setLoading(false);
        setCode('');
        return;
      }

      const childUid = snapshot.val();
      const parentUid = auth.currentUser.uid;

      // Karşılıklı eşleştirme kayıtlarını oluştur
      await update(ref(db, `users/${childUid}`), {
        linkedParent: parentUid,
      });

      await update(ref(db, `users/${parentUid}/linkedChildren`), {
        [childUid]: true,
      });

      // Kullanılan kodu sil
      await remove(codeRef);

      triggerHaptic('Success');
      Alert.alert('BAŞARILI', 'Hedef cihaz başarıyla Aegis ağına eklendi.', [
        {
          text: 'Komuta Paneline Dön',
          onPress: () => navigation.replace('ParentHome'),
        },
      ]);

      setCode('');
    } catch (error) {
      triggerHaptic('Error');
      Alert.alert('Bağlantı Hatası', 'İşlem sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const triggerHaptic = (style = 'Light') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]).catch(() => {});
  };

  // Kodu 6 ayrı kutucukta gösterme mantığı
  const renderCodeBoxes = () => {
    const boxes = [];
    for (let i = 0; i < 6; i++) {
      const char = code[i] || '';
      const isFocused = code.length === i;
      
      boxes.push(
        <View key={i} style={[styles.codeBox, isFocused && styles.codeBoxFocused, char && styles.codeBoxFilled]}>
          <Text style={styles.codeText}>{char}</Text>
        </View>
      );
    }
    return boxes;
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* 🌌 Premium Arka Plan Katmanları */}
      <View style={styles.absoluteBackground}>
        <LinearGradient colors={['#020617', '#0f172a']} style={{flex: 1}} />
        <LinearGradient colors={['#6366f1', 'transparent']} style={styles.glowTopRight} />
        <LinearGradient colors={['#10b981', 'transparent']} style={styles.glowBottomLeft} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flexContainer}>
        
        {/* 🌟 Header */}
        <BlurView intensity={40} tint="dark" style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => { triggerHaptic('Light'); navigation.goBack(); }}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Yeni Terminal Ekle</Text>
          <View style={{ width: 40 }} />
        </BlurView>

        <View style={styles.content}>
          <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
            <View style={styles.iconCircle}>
              <View style={styles.iconInner}>
                <Ionicons name="link" size={42} color="#fff" />
              </View>
            </View>
          </Animated.View>
          
          <Text style={styles.title}>Sistem Eşleştirmesi</Text>
          <Text style={styles.subtitle}>Hedef cihazdaki uygulamayı açıp "Kodu Al" butonuna basın. Üretilen <Text style={{color: '#6366f1', fontWeight: '800'}}>6 haneli</Text> güvenlik kodunu aşağıya girin.</Text>

          <BlurView intensity={30} tint="dark" style={styles.inputArea}>
            <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.boxesContainer}>
                {renderCodeBoxes()}
            </TouchableOpacity>

            {/* Gizli Gerçek Input */}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={handleCodeChange}
              maxLength={6}
              keyboardType="default"
              autoCapitalize="characters"
              style={styles.hiddenInput}
              editable={!loading}
              autoFocus
            />
          </BlurView>

          {loading ? (
            <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Ağ bağlantısı doğrulanıyor...</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.pairBtn, code.length !== 6 && styles.disabledBtn]} 
              onPress={handlePairing}
              disabled={code.length !== 6 || loading}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.btnGrad}>
                <Text style={styles.btnText}>BAĞLANTIYI ONAYLA</Text>
                <Ionicons name="finger-print" size={20} color="#fff" style={{marginLeft: 10}} />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#020617' },
  
  absoluteBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  glowTopRight: { position: 'absolute', top: -50, right: -50, width: 350, height: 350, borderRadius: 175, opacity: 0.4 },
  glowBottomLeft: { position: 'absolute', bottom: '10%', left: -100, width: 300, height: 300, borderRadius: 150, opacity: 0.2 },

  flexContainer: { flex: 1 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16 },
  
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25 },
  
  iconCircle: { padding: 15, backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: 40, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  iconInner: { width: 70, height: 70, backgroundColor: '#6366f1', borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 15, shadowColor: '#6366f1', shadowOpacity: 0.5, shadowRadius: 15 },
  
  title: { fontSize: 26, fontWeight: '900', color: '#f8fafc', marginBottom: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 24, marginBottom: 40, paddingHorizontal: 10 },
  
  inputArea: { width: '100%', padding: 25, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 30 },
  boxesContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  codeBox: { width: 45, height: 60, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  codeBoxFocused: { borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)' },
  codeBoxFilled: { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  codeText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },

  loadingBox: { alignItems: 'center', marginTop: 10 },
  loadingText: { color: '#6366f1', marginTop: 15, fontWeight: '800', letterSpacing: 1 },

  pairBtn: { width: '100%', height: 65, borderRadius: 20, overflow: 'hidden', elevation: 10, shadowColor: '#4f46e5', shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: {width: 0, height: 8} },
  disabledBtn: { opacity: 0.5, elevation: 0 },
  btnGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 }
});

export default ParentPairingScreen;