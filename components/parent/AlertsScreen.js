import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Modal, Alert as RNAlert } from 'react-native';
import { ref, onValue, remove, get, query, limitToLast, onChildAdded } from 'firebase/database';
import { auth, db } from '../../utils/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur'; 
import * as Haptics from 'expo-haptics'; 

const AlertsScreen = ({ navigation }) => {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  const isDarkMode = true; 
  const theme = {
    bg: isDarkMode ? '#020617' : '#f8fafc',
    surface: isDarkMode ? 'rgba(30, 41, 59, 0.45)' : '#ffffff',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9'
  };

  const triggerHaptic = (style = 'Light') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]).catch(() => {});
  };

  // 🚀 AKILLI TARİH FORMATLAYICI (Bugün 14:30, Dün 09:15, 19 Mar 18:40)
  const formatDateTime = (timestamp) => {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp);
    const now = new Date();
    
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return `Bugün, ${timeStr}`;
    if (isYesterday) return `Dün, ${timeStr}`;
    
    return `${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${timeStr}`;
  };

useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const linkedRef = ref(db, `users/${user.uid}/linkedChildren`);
    let alertUnsubs = [];

    const unsubLinked = onValue(linkedRef, async (snap) => {
      const val = snap.val();
      if (!val) {
        setAlerts([]);
        return;
      }
      
      const uids = Object.keys(val);
      
      // 1. Çocuk isimlerini al
      const childProfiles = {};
      for (const uid of uids) {
        const cSnap = await get(ref(db, `users/${uid}`));
        childProfiles[uid] = cSnap.val()?.displayName || 'Terminal';
      }

      // Eski dinleyicileri temizle
      alertUnsubs.forEach(unsub => unsub());
      alertUnsubs = [];
      
      // Mevcut listeyi sıfırla (Çocuk listesi değişirse temiz başlamak için)
      setAlerts([]);

      // 2. Her çocuk için onChildAdded dinleyicisi kur
      uids.forEach(uid => {
        const alertRef = ref(db, `alerts/${uid}`);
        const alertQuery = query(alertRef, limitToLast(50)); // Sadece son 50 kaydı izle

        const unsubChild = onChildAdded(alertQuery, (snapshot) => {
          const newAlert = {
            id: snapshot.key,
            childUid: uid,
            childName: childProfiles[uid],
            ...snapshot.val()
          };
          
          setAlerts(prev => {
            // Çift kayıt kontrolü
            if (prev.find(a => a.id === newAlert.id)) return prev;
            
            // Yeni geleni listeye ekle ve tarihe göre büyükten küçüğe sırala
            const updatedList = [newAlert, ...prev];
            return updatedList.sort((a, b) => b.timestamp - a.timestamp);
          });
        });

        alertUnsubs.push(unsubChild);
      });
    });

    return () => {
      unsubLinked();
      alertUnsubs.forEach(unsub => unsub());
    };
  }, []);

  const handleDeleteAlert = (childUid, alertId) => {
    triggerHaptic('Medium');
    RNAlert.alert("Kaydı Sil", "Bu bildirimi silmek istediğinize emin misiniz?", [
        { text: "İptal", style: "cancel" },
        { 
          text: "Sil", style: "destructive", 
          onPress: async () => {
            try {
await remove(ref(db, `alerts/${childUid}/${alertId}`));
setAlerts(prev => prev.filter(alert => alert.id !== alertId)); // 🚀 Ekranda anında silinmesini sağlar
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
if (modalVisible) setModalVisible(false);
            } catch (error) {
              RNAlert.alert("Hata", "Bildirim silinemedi.");
            }
          }
        }
      ]
    );
  };

  // 🚀 YENİ EKLENDİ: TÜM BİLDİRİMLERİ TEK TUŞLA TEMİZLEME
  const handleClearAll = () => {
    if (alerts.length === 0) return;
    triggerHaptic('Heavy');
    RNAlert.alert("Tümünü Temizle", "Tüm bildirim geçmişini kalıcı olarak silmek istediğinize emin misiniz?", [
        { text: "İptal", style: "cancel" },
        { 
          text: "Tümünü Sil", style: "destructive", 
          onPress: async () => {
            try {
              // Hangi çocukların bildirimi varsa o klasörleri sil
              const uids = [...new Set(alerts.map(a => a.childUid))];
for(let uid of uids) {
    await remove(ref(db, `alerts/${uid}`));
}
setAlerts([]); // 🚀 Ekrandaki tüm listeyi anında boşaltır
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              RNAlert.alert("Hata", "Temizleme işlemi başarısız.");
            }
          }
        }
      ]
    );
  };

  const openAlertDetails = (item) => {
    triggerHaptic('Light');
    setSelectedAlert(item);
    setModalVisible(true);
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'SOS': return { name: 'warning', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', title: 'ACİL DURUM' };
      case 'SPEED': return { name: 'speedometer', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', title: 'HIZ UYARISI' };
      case 'GEOFENCE_IN': return { name: 'enter', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', title: 'ALAN GİRİŞİ' };
      case 'GEOFENCE_OUT': return { name: 'exit', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', title: 'ALAN İHLALİ' };
      default: return { name: 'notifications', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.3)', title: 'SİSTEM BİLDİRİMİ' };
    }
  };

  const renderItem = ({ item }) => {
    const iconData = getAlertIcon(item.type);

    return (
      <TouchableOpacity 
        style={[styles.alertCard, { backgroundColor: theme.surface, borderColor: theme.border }]} 
        activeOpacity={0.8} 
        onPress={() => openAlertDetails(item)}
      >
        <View style={[styles.iconBox, { backgroundColor: iconData.bg, borderColor: iconData.border }]}>
          <Ionicons name={iconData.name} size={24} color={iconData.color} />
        </View>
        
        <View style={styles.alertInfo}>
          <View style={styles.alertHeaderRow}>
            {/* 🚀 YENİ TASARIM: Çocuk Adı Belirgin Etiket ve Akıllı Saat */}
            <View style={[styles.childBadge, {backgroundColor: iconData.bg, borderColor: iconData.border}]}>
                <Ionicons name="person" size={10} color={iconData.color} style={{marginRight: 4}} />
                <Text style={[styles.childNameText, { color: iconData.color }]} numberOfLines={1}>{item.childName}</Text>
            </View>
            <Text style={styles.timeText}>{formatDateTime(item.timestamp)}</Text>
          </View>
          
          <Text style={[styles.alertTitle, { color: iconData.color }]}>{iconData.title}</Text>
          <Text style={[styles.alertMessage, { color: theme.textPrimary }]} numberOfLines={2}>{item.message}</Text>
        </View>

        <TouchableOpacity style={styles.deleteBtnIcon} onPress={() => handleDeleteAlert(item.childUid, item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="trash" size={20} color="#64748b" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <View style={styles.absoluteBackground}>
        <LinearGradient colors={['#312e81', 'transparent']} style={styles.glowTopRight} />
        <LinearGradient colors={['#064e3b', 'transparent']} style={styles.glowBottomLeft} />
      </View>

      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => { triggerHaptic('Light'); navigation.goBack(); }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Sistem Kayıtları</Text>
            <Text style={styles.headerSub}>{alerts.length} Bildirim</Text>
        </View>
        
        {/* 🚀 YENİ EKLENDİ: TÜMÜNÜ SİL BUTONU */}
        <TouchableOpacity style={styles.clearAllBtn} activeOpacity={0.7} onPress={handleClearAll}>
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </LinearGradient>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconGlow}>
              <Ionicons name="shield-checkmark" size={60} color="#10b981" />
            </View>
            <Text style={styles.emptyText}>Tüm Sistemler Normal</Text>
            <Text style={styles.emptySubText}>Şu an için kaydedilmiş yeni bir güvenlik ihlali veya sistem uyarısı bulunmuyor.</Text>
          </View>
        }
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <BlurView intensity={60} tint="dark" style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            {selectedAlert && (
              <>
                <View style={[styles.modalIconBox, { backgroundColor: getAlertIcon(selectedAlert.type).bg, borderColor: getAlertIcon(selectedAlert.type).border }]}>
                  <Ionicons name={getAlertIcon(selectedAlert.type).name} size={40} color={getAlertIcon(selectedAlert.type).color} />
                </View>
                
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{selectedAlert.childName}</Text>
                <Text style={styles.modalDate}>{formatDateTime(selectedAlert.timestamp)}</Text>
                
                <View style={[styles.modalMessageContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.modalMessage, { color: theme.textPrimary }]}>{selectedAlert.message}</Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalDeleteBtn} activeOpacity={0.7} onPress={() => handleDeleteAlert(selectedAlert.childUid, selectedAlert.id)}>
                    <Ionicons name="trash" size={20} color="#ef4444" />
                    <Text style={styles.modalDeleteText}>Kaydı Sil</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modalCloseBtn} activeOpacity={0.8} onPress={() => { triggerHaptic('Light'); setModalVisible(false); }}>
                    <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.modalCloseGradient}>
                      <Text style={styles.modalCloseText}>Kapat</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </BlurView>
      </Modal>

    </View>
  );
};

export default AlertsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  absoluteBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  glowTopRight: { position: 'absolute', top: -50, right: -50, width: 350, height: 350, borderRadius: 175, opacity: 0.3 },
  glowBottomLeft: { position: 'absolute', bottom: '10%', left: -100, width: 300, height: 300, borderRadius: 150, opacity: 0.2 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, elevation: 15, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { color: '#10b981', fontSize: 11, fontWeight: '700', marginTop: 2 },
  clearAllBtn: { padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  
  listContent: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 50 },
  
  alertCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 28, padding: 18, marginBottom: 16, borderWidth: 1, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: {width: 0, height: 8} },
  iconBox: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  alertInfo: { flex: 1, marginLeft: 16 },
  alertHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  childBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, maxWidth: '60%' },
  childNameText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  timeText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  alertTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  alertMessage: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  deleteBtnIcon: { padding: 10, marginLeft: 5, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16 },

  emptyContainer: { alignItems: 'center', marginTop: 150, paddingHorizontal: 40 },
  emptyIconGlow: { padding: 25, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 60, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  emptyText: { fontSize: 24, fontWeight: '900', color: '#f8fafc', marginTop: 10, letterSpacing: 0.5 },
  emptySubText: { fontSize: 14, color: '#94a3b8', marginTop: 12, textAlign: 'center', lineHeight: 22, fontWeight: '500' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 },
  modalBox: { width: '100%', borderRadius: 40, padding: 30, alignItems: 'center', elevation: 25, borderWidth: 1 },
  modalIconBox: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginTop: -70, borderWidth: 4 },
  modalTitle: { fontSize: 24, fontWeight: '900', marginTop: 15, letterSpacing: 0.5 },
  modalDate: { fontSize: 13, color: '#64748b', fontWeight: '800', marginTop: 6, letterSpacing: 0.5 },
  modalMessageContainer: { width: '100%', padding: 25, borderRadius: 24, marginVertical: 30, borderWidth: 1 },
  modalMessage: { fontSize: 16, lineHeight: 24, textAlign: 'center', fontWeight: '600' },
  
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  modalDeleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 20, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  modalDeleteText: { color: '#ef4444', fontWeight: '900', marginLeft: 8, fontSize: 15 },
  modalCloseBtn: { flex: 1, marginLeft: 10, borderRadius: 20, elevation: 8, shadowColor: '#4f46e5', shadowOpacity: 0.5, shadowRadius: 15 },
  modalCloseGradient: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, borderRadius: 20 },
  modalCloseText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 }
});