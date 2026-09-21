import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Dimensions, ActivityIndicator, ScrollView, Alert, Modal, RefreshControl, Animated } from 'react-native';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../../utils/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

const appIcons = {
  'YouTube': { name: 'logo-youtube', color: '#ef4444' },
  'Instagram': { name: 'logo-instagram', color: '#ec4899' },
  'TikTok': { name: 'musical-notes', color: '#f8fafc' }, 
  'WhatsApp': { name: 'logo-whatsapp', color: '#10b981' },
  'Roblox': { name: 'game-controller', color: '#8b5cf6' },
  'Snapchat': { name: 'logo-snapchat', color: '#eab308' },
  'PUBG Mobile': { name: 'game-controller-outline', color: '#f97316' },
  'Google Chrome': { name: 'globe-outline', color: '#3b82f6' },
  'Ayarlar': { name: 'settings', color: '#64748b' },
  'Dijital Denge': { name: 'leaf', color: '#10b981' },
  'Aegis Kalkanı': { name: 'shield-checkmark', color: '#6366f1' },
};

const getDynamicIcon = (appName) => {
  const colors = ['#14b8a6', '#f43f5e', '#8b5cf6', '#eab308', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < appName.length; i++) { hash = appName.charCodeAt(i) + ((hash << 5) - hash); }
  return { name: 'apps', color: colors[Math.abs(hash) % colors.length] };
};

const formatTime = (minutes) => {
  if (minutes === 0) return "0 dk.";
  if (typeof minutes === 'string') return minutes; 
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h} sa. ${m} dk.`;
  return `${m} dk.`;
};

// 🌟 YENİ: Animasyonlu Bar Bileşeni
const AnimatedBar = ({ isSelected, heightPercent, dayName, onPress }) => {
  const heightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(heightAnim, {
      toValue: heightPercent,
      friction: 6,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [heightPercent]);

  return (
    <TouchableOpacity style={styles.barCol} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.barTrack}>
        <Animated.View 
          style={[
            styles.barFill, 
            { 
              height: heightAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), 
              backgroundColor: isSelected ? '#4f46e5' : '#e0e7ff',
              shadowColor: isSelected ? '#4f46e5' : 'transparent',
              shadowOpacity: isSelected ? 0.4 : 0,
              shadowRadius: 6,
              elevation: isSelected ? 4 : 0
            }
          ]} 
        />
      </View>
      <Text style={[styles.barLabel, isSelected && {color: '#4f46e5', fontWeight: '900'}]}>{dayName}</Text>
    </TouchableOpacity>
  );
};

const AppUsageScreen = ({ route, navigation }) => {
  const { childUid, childName } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [allUsageData, setAllUsageData] = useState({});
  const [deviceLock, setDeviceLock] = useState({ isLocked: false, unlockTime: 0, lockedApps: {} });
  const [bonusModalVisible, setBonusModalVisible] = useState(false);

  const [daysList, setDaysList] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(6); 

  const triggerHaptic = (style = 'Light') => Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]).catch(() => {});

  useEffect(() => {
    const list = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${d.getFullYear()}-${month}-${day}`;
      
      const dayName = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][d.getDay()];
      const fullLabel = i === 0 ? `Bugün, ${d.getDate()} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][d.getMonth()]}` : `${d.getDate()} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][d.getMonth()]}`;
      list.push({ dateStr, dayName, fullLabel, isToday: i === 0 });
    }
    setDaysList(list);
  }, []);

  const fetchUsageData = () => {
    const lockRef = ref(db, `users/${childUid}/deviceLock`);
    onValue(lockRef, (snap) => setDeviceLock(snap.val() || { isLocked: false, unlockTime: 0, lockedApps: {} }));

    const usageRef = ref(db, `users/${childUid}/appUsage`);
    onValue(usageRef, (snap) => {
      setAllUsageData(snap.val() || {});
      setLoading(false);
      setRefreshing(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    fetchUsageData();
  }, [childUid]);

  const onRefresh = () => {
    triggerHaptic('Medium');
    setRefreshing(true);
    fetchUsageData();
  };

  const chartData = useMemo(() => {
    if (daysList.length === 0) return [];
    
    return daysList.map((day, index) => {
      const dayData = allUsageData[day.dateStr] || {};
      let totalMins = 0;
      Object.values(dayData).forEach(val => {
        if (typeof val === 'number') totalMins += val;
      });
      return { ...day, totalMins, index };
    });
  }, [allUsageData, daysList]);

  const selectedDayInfo = chartData[selectedIndex] || {};
  const selectedDayApps = useMemo(() => {
    if (!selectedDayInfo.dateStr) return [];
    const dayData = allUsageData[selectedDayInfo.dateStr] || {};
    const formatted = [];
    
    Object.keys(dayData).forEach(appName => {
      const val = dayData[appName];
      if (typeof val === 'number') formatted.push({ appName, duration: val, isText: false });
      else formatted.push({ appName, duration: 0, statusText: val, isText: true });
    });
    
    return formatted.sort((a, b) => b.duration - a.duration);
  }, [allUsageData, selectedDayInfo]);

  // 🌟 GRAFİK HESAPLAMALARI
  const maxMins = Math.max(...chartData.map(d => d.totalMins), 1); 
  const avgMins = chartData.reduce((acc, curr) => acc + curr.totalMins, 0) / 7;
  const avgPercent = (avgMins / maxMins) * 100;
  const formattedAvg = formatTime(Math.round(avgMins));

  const handlePrevDay = () => {
    if (selectedIndex > 0) { triggerHaptic('Light'); setSelectedIndex(selectedIndex - 1); }
  };
  const handleNextDay = () => {
    if (selectedIndex < 6) { triggerHaptic('Light'); setSelectedIndex(selectedIndex + 1); }
  };

  const toggleFullLock = async () => {
    triggerHaptic('Heavy');
    try {
        const currentState = deviceLock?.isLocked === true; 
        await set(ref(db, `users/${childUid}/deviceLock/isLocked`), !currentState);
        await set(ref(db, `users/${childUid}/deviceLock/unlockTime`), 0);
    } catch (error) { Alert.alert("Hata", "Komut iletilemedi."); }
  };

  const addBonusTime = async (minutes) => {
    triggerHaptic('Medium');
    try {
        const now = Date.now();
        const currentUnlock = (deviceLock?.unlockTime > now) ? deviceLock.unlockTime : now;
        await set(ref(db, `users/${childUid}/deviceLock/unlockTime`), currentUnlock + (minutes * 60000));
    } catch (error) {}
  };

  const toggleAppLock = async (appName) => {
    triggerHaptic('Light');
    try {
        const currentLockedApps = deviceLock?.lockedApps || {};
        if (currentLockedApps[appName]) {
            await set(ref(db, `users/${childUid}/deviceLock/lockedApps/${appName}`), null);
        } else {
            Alert.alert("Uygulama Kısıtlaması", `${appName} engellensin mi?`, [
                { text: "İptal", style: "cancel" },
                { text: "Tamamen Kilitle", style: "destructive", onPress: async () => await set(ref(db, `users/${childUid}/deviceLock/lockedApps/${appName}`), true) },
                { text: "15 Dk İzin Ver", onPress: async () => await set(ref(db, `users/${childUid}/deviceLock/lockedApps/${appName}`), Date.now() + (15 * 60000)) }
            ]);
        }
    } catch (error) {}
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={{color: '#94a3b8', marginTop: 10, fontWeight: '700'}}>Veriler Analiz Ediliyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <LinearGradient colors={['#020617', '#0f172a']} style={styles.headerBg}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => { triggerHaptic('Light'); navigation.goBack(); }}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cihaz Etkinliği</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartNavRow}>
            <TouchableOpacity onPress={handlePrevDay} style={[styles.navArrow, selectedIndex === 0 && {opacity: 0.3}]} disabled={selectedIndex === 0}>
              <Ionicons name="chevron-back" size={20} color="#64748b" />
            </TouchableOpacity>
            
            <View style={styles.chartTitleBox}>
              <Text style={styles.totalTimeText}>{formatTime(selectedDayInfo.totalMins)}</Text>
              <Text style={styles.dateLabel}>{selectedDayInfo.fullLabel}</Text>
            </View>

            <TouchableOpacity onPress={handleNextDay} style={[styles.navArrow, selectedIndex === 6 && {opacity: 0.3}]} disabled={selectedIndex === 6}>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* 🌟 YENİ GRAFİK ALANI */}
          <View style={styles.barChartContainer}>
             {/* Dinamik Ortalama Çizgisi */}
             <View style={[styles.avgLine, { bottom: `${avgPercent}%` }]}>
                <View style={styles.avgLineDash} />
                <View style={styles.avgBadge}>
                    <Text style={styles.avgText}>Ort. {formattedAvg}</Text>
                </View>
             </View>

             <View style={styles.barsWrapper}>
                {chartData.map((day, i) => {
                  const isSelected = i === selectedIndex;
                  const heightPercent = day.totalMins > 0 ? (day.totalMins / maxMins) * 100 : 0;
                  return (
                    <AnimatedBar 
                        key={i} 
                        isSelected={isSelected} 
                        heightPercent={heightPercent} 
                        dayName={day.dayName} 
                        onPress={() => { triggerHaptic('Light'); setSelectedIndex(i); }} 
                    />
                  );
                })}
             </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        <View style={styles.lockControlsRow}>
            <TouchableOpacity style={[styles.mainLockBtn, { backgroundColor: deviceLock.isLocked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', borderColor: deviceLock.isLocked ? '#ef4444' : '#10b981' }]} onPress={toggleFullLock}>
                <Ionicons name={deviceLock.isLocked ? "lock-closed" : "lock-open"} size={20} color={deviceLock.isLocked ? "#ef4444" : "#10b981"} />
                <Text style={[styles.mainLockText, { color: deviceLock.isLocked ? "#ef4444" : "#10b981" }]}>
                    {deviceLock.isLocked ? (deviceLock.unlockTime > Date.now() ? "EK SÜRE VERİLDİ" : "CİHAZI AÇ") : "CİHAZI KİLİTLE"}
                </Text>
            </TouchableOpacity>
           {deviceLock.isLocked && (
                <TouchableOpacity style={styles.bonusTimeBtn} onPress={() => { triggerHaptic('Light'); setBonusModalVisible(true); }}>
                    <Ionicons name="time" size={18} color="#38bdf8" />
                </TouchableOpacity>
            )}
        </View>

        <View style={styles.appListCard}>
          {selectedDayApps.length === 0 ? (
             <View style={styles.emptyBox}>
               <Ionicons name="moon-outline" size={40} color="#94a3b8" />
               <Text style={styles.emptyText}>Bu gün cihaz kullanılmamış.</Text>
             </View>
          ) : (
            selectedDayApps.map((item, index) => {
              const isAppLocked = deviceLock.lockedApps && deviceLock.lockedApps[item.appName];
              const iconData = appIcons[item.appName] || getDynamicIcon(item.appName);
              
              return (
                <View key={index} style={[styles.appRow, index === selectedDayApps.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.appIconBox, { backgroundColor: iconData.color + '15' }]}>
                    {appIcons[item.appName] ? (
                      <Ionicons name={iconData.name} size={24} color={iconData.color} />
                    ) : (
                      <Text style={[styles.unknownIconText, {color: iconData.color}]}>{item.appName.charAt(0)}</Text>
                    )}
                  </View>
                  
                  <View style={styles.appInfo}>
                    <Text style={styles.appName}>{item.appName}</Text>
                    <Text style={styles.appTime}>{item.isText ? item.statusText : formatTime(item.duration)}</Text>
                  </View>

                  {item.appName !== 'Aegis Kalkanı' && (
                    <TouchableOpacity onPress={() => toggleAppLock(item.appName)} style={styles.lockIconBtn}>
                      <Ionicons name={isAppLocked ? "lock-closed" : "lock-open-outline"} size={22} color={isAppLocked ? "#ef4444" : "#cbd5e1"} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

      </ScrollView>

      <Modal visible={bonusModalVisible} transparent animationType="slide">
        <BlurView intensity={40} tint="dark" style={styles.modalOverlay}>
          <View style={styles.bonusModalContent}>
            <View style={styles.modalDragIndicator} />
            <Text style={styles.bonusModalTitle}>Geçici Süre Tanımla</Text>
            <View style={styles.bonusGrid}>
              {[5, 15, 30, 60].map(mins => (
                <TouchableOpacity key={mins} style={styles.bonusChip} onPress={() => { addBonusTime(mins); setBonusModalVisible(false); }}>
                  <Text style={styles.bonusChipText}>+{mins} Dk</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.bonusCancelBtn} onPress={() => setBonusModalVisible(false)}>
              <Text style={styles.bonusCancelText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

    </View>
  );
};

export default AppUsageScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' }, 
  headerBg: { paddingTop: 60, paddingBottom: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  
  chartCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 28, padding: 22, elevation: 15, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: {width:0, height:8} },
  chartNavRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  navArrow: { padding: 10, backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  chartTitleBox: { alignItems: 'center' },
  totalTimeText: { fontSize: 28, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  dateLabel: { fontSize: 13, color: '#64748b', fontWeight: '700', marginTop: 2 },
  
  barChartContainer: { height: 180, position: 'relative', marginTop: 10 },
  
  // Ortalama Çizgisi Stilleri
  avgLine: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  avgLineDash: { flex: 1, height: 1, backgroundColor: '#a5b4fc', borderStyle: 'dashed' },
  avgBadge: { backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginLeft: 6, borderWidth: 1, borderColor: '#c7d2fe' },
  avgText: { fontSize: 10, color: '#4f46e5', fontWeight: '900' },
  
  barsWrapper: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 10 },
  barCol: { alignItems: 'center', flex: 1 },
  barTrack: { width: 28, height: 140, backgroundColor: '#f1f5f9', borderRadius: 14, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 14 },
  barLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '700', marginTop: 10 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 50 },
  
  lockControlsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 25, marginBottom: 15, gap: 10 },
  mainLockBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  mainLockText: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5, marginLeft: 8 },
  bonusTimeBtn: { padding: 14, backgroundColor: 'rgba(56, 189, 248, 0.1)', borderWidth: 1, borderColor: '#38bdf8', borderRadius: 16 },

  appListCard: { backgroundColor: '#fff', borderRadius: 28, padding: 15, elevation: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: {width:0, height:4} },
  appRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  appIconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  unknownIconText: { fontSize: 20, fontWeight: '900' },
  appInfo: { flex: 1 },
  appName: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  appTime: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  lockIconBtn: { padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#94a3b8', fontSize: 14, fontWeight: '700', marginTop: 10 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  bonusModalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, paddingBottom: 50 },
  modalDragIndicator: { width: 40, height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, alignSelf: 'center', marginBottom: 25 },
  bonusModalTitle: { fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 25 },
  bonusGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 15 },
  bonusChip: { width: '47%', backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.3)', borderWidth: 1, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  bonusChipText: { color: '#38bdf8', fontSize: 16, fontWeight: '900' },
  bonusCancelBtn: { marginTop: 30, paddingVertical: 18, borderRadius: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center' },
  bonusCancelText: { color: '#ef4444', fontSize: 15, fontWeight: '900' }
});