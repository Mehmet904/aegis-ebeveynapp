import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Easing, Alert, Dimensions, StatusBar, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../utils/firebaseConfig';
import { ref, get } from 'firebase/database';
import WebRTCService from '../../utils/WebRTCService';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

// 🌊 SES DALGASI BİLEŞENİ (Her bir çubuk için)
const WaveBar = ({ active }) => {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let timer;
    if (active) {
      const animate = () => {
        // Ses varken rastgele yüksekliklere zıpla
        Animated.timing(anim, {
          toValue: Math.random() * 2.5 + 0.5,
          duration: Math.random() * 200 + 100,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }).start(() => animate());
      };
      animate();
    } else {
      // Ses yokken (bağlı değilken) düz çizgi/sabit boy
      Animated.spring(anim, {
        toValue: 0.2,
        useNativeDriver: true,
      }).start();
    }
    return () => anim.stopAnimation();
  }, [active]);

  return (
    <Animated.View 
      style={[
        styles.waveBar, 
        { transform: [{ scaleY: anim }], backgroundColor: active ? '#10b981' : '#334155' }
      ]} 
    />
  );
};

const AudioListeningScreen = ({ route, navigation }) => {
  const { childId, childName } = route.params;
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);

  const waveAnim = useRef(new Animated.Value(0)).current;
  const isListeningRef = useRef(isListening);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // 1. RADAR ANİMASYONU
  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2500,
        easing: Easing.out(Easing.ease), 
        useNativeDriver: true
      })
    ).start();
  }, []);

  // 2. SÜRE SAYACI
  useEffect(() => {
    const timer = setInterval(() => {
      if (isListeningRef.current) {
        setSessionTime(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. WEBRTC BAĞLANTI KONTROLÜ
  useEffect(() => {
    WebRTCService.onConnectionStateChange = (state) => {
      if (state === 'connected') {
        setIsConnecting(false);
        setIsListening(true);
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        setIsConnecting(false);
        setIsListening(false);
        setSessionTime(0);
      }
    };
    return () => {
        if (isListeningRef.current || isConnecting) {
            WebRTCService.stop();
        }
        WebRTCService.onConnectionStateChange = null;
    };
  }, []);

  const toggleListening = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isListening || isConnecting) {
        WebRTCService.stop();
        setIsListening(false);
        setIsConnecting(false);
        setSessionTime(0);
    } else {
        setIsConnecting(true);
        setSessionTime(0);
        try {
            await Audio.setAudioModeAsync({ 
                allowsRecordingIOS: true, 
                staysActiveInBackground: true, 
                playsInSilentModeIOS: true, 
                shouldDuckAndroid: true, 
                playThroughEarpieceAndroid: false 
            });

            const childSnap = await get(ref(db, `users/${childId}`));
            const childToken = childSnap.val()?.pushToken;
            
            if (childToken) {
              fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: childToken,
                  priority: 'high', 
                  data: { action: 'WAKE_UP_WEBRTC' } 
                }),
              }).catch(()=>{}); 
            }

            setTimeout(async () => {
              try {
                await WebRTCService.call(childId, 'audio');
              } catch (error) {
                setIsConnecting(false);
                Alert.alert("Hata", "Terminal yanıt vermiyor.");
              }
            }, 1500);

        } catch (error) {
            setIsConnecting(false);
        }
    }
  };

  const pulseScale = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 4] });
  const pulseOpacity = waveAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.2, 0] });

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#020617', '#0f172a']} style={StyleSheet.absoluteFillObject} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#f8fafc" />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>{childName}</Text>
            <Text style={styles.headerSub}>Canlı Ses Analizi</Text>
        </View>
        <View style={{width: 40}} />
      </View>

      {/* 🌊 DALGA GÖRSELLEŞTİRİCİ */}
      <View style={styles.visualizerContainer}>
        <View style={styles.sonarWrapper}>
            {(isListening || isConnecting) && (
              <Animated.View style={[styles.sonarRing, { backgroundColor: isListening ? '#10b981' : '#f59e0b', opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            )}
            
            {/* Dalga Çubukları */}
            <View style={styles.waveContainer}>
              {[...Array(15)].map((_, i) => (
                <WaveBar key={i} active={isListening} />
              ))}
            </View>
        </View>

        <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: isListening ? '#10b981' : (isConnecting ? '#f59e0b' : '#334155') }]} />
            <Text style={[styles.statusText, { color: isListening ? '#10b981' : (isConnecting ? '#f59e0b' : '#64748b') }]}>
                {isListening ? "CANLI VERİ AKIŞI" : (isConnecting ? "SİNYAL ARANIYOR" : "BEKLEMEDE")}
            </Text>
        </View>
      </View>

      {/* ALT PANEL */}
      <View style={styles.bottomPanel}>
        <View style={styles.dragIndicator} />

        <View style={styles.telemetryCard}>
            <View style={styles.telemetryRow}>
                <View style={styles.telemetryItem}>
                    <Feather name="mic" size={18} color={isListening ? "#10b981" : "#64748b"} />
                    <View style={{marginLeft: 10}}>
                        <Text style={styles.telemetryLabel}>Mikrofon</Text>
                        <Text style={[styles.telemetryValue, {color: isListening ? '#f8fafc' : '#64748b'}]}>
                            {isListening ? "Aktif" : "Kapalı"}
                        </Text>
                    </View>
                </View>
                <View style={styles.telemetryDivider} />
                <View style={styles.telemetryItem}>
                    <Feather name="shield" size={18} color="#10b981" />
                    <View style={{marginLeft: 10}}>
                        <Text style={styles.telemetryLabel}>Güvenlik</Text>
                        <Text style={[styles.telemetryValue, {color: '#10b981'}]}>AES-256</Text>
                    </View>
                </View>
            </View>
        </View>

        <View style={styles.timeContainer}>
            <Text style={styles.timeLabel}>OTURUM SÜRESİ</Text>
            <Text style={[styles.timeDisplay, { color: isListening ? '#f8fafc' : '#475569' }]}>
                {formatTime(sessionTime)}
            </Text>
        </View>

        <TouchableOpacity 
            style={[styles.mainButton, { backgroundColor: isListening ? 'rgba(239, 68, 68, 0.15)' : '#6366f1', borderColor: isListening ? '#ef4444' : '#6366f1' }]}
            onPress={toggleListening}
            disabled={isConnecting}
        >
            <Ionicons name={isListening ? "stop-circle" : "play-circle"} size={24} color={isListening ? "#ef4444" : "#fff"} />
            <Text style={[styles.mainButtonText, { color: isListening ? '#ef4444' : '#fff', marginLeft: 10 }]}>
                {isConnecting ? "BAĞLANILIYOR..." : (isListening ? "OTURUMU KAPAT" : "DİNLEMEYİ BAŞLAT")}
            </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 100, paddingTop: 45 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#f8fafc', letterSpacing: 1 },
  headerSub: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  
  visualizerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sonarWrapper: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center' },
  sonarRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50 },
  
  waveContainer: { flexDirection: 'row', alignItems: 'center', height: 100, gap: 4 },
  waveBar: { width: 4, height: 40, borderRadius: 2 },

  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginTop: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },

  bottomPanel: { backgroundColor: '#0f172a', borderTopLeftRadius: 35, borderTopRightRadius: 35, paddingHorizontal: 25, paddingTop: 15, paddingBottom: 40 },
  dragIndicator: { width: 35, height: 4, backgroundColor: '#1e293b', borderRadius: 2, alignSelf: 'center', marginBottom: 25 },
  
  telemetryCard: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 20 },
  telemetryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  telemetryItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  telemetryDivider: { width: 1, height: 25, backgroundColor: '#1e293b', marginHorizontal: 10 },
  telemetryLabel: { fontSize: 9, color: '#64748b', fontWeight: '800', textTransform: 'uppercase' },
  telemetryValue: { fontSize: 12, fontWeight: '800' },

  timeContainer: { alignItems: 'center', marginBottom: 25 },
  timeLabel: { fontSize: 10, color: '#64748b', fontWeight: '800', letterSpacing: 2 },
  timeDisplay: { fontSize: 50, fontWeight: '200', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  mainButton: { flexDirection: 'row', borderRadius: 18, paddingVertical: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  mainButtonText: { fontWeight: '900', fontSize: 13, letterSpacing: 1.5 }
});

export default AudioListeningScreen;