import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, StatusBar, Dimensions, Image, Animated, PanResponder, Modal } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ref, onValue } from 'firebase/database';
import { db } from '../../utils/firebaseConfig';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as turf from '@turf/helpers';
import bezierSpline from '@turf/bezier-spline';

const { width, height } = Dimensions.get('window');

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getRegionForCoordinates = (points) => {
  if (!points || points.length === 0) return null;
  let minX = points[0].latitude, maxX = points[0].latitude;
  let minY = points[0].longitude, maxY = points[0].longitude;
  
  points.forEach((point) => {
    minX = Math.min(minX, point.latitude);
    maxX = Math.max(maxX, point.latitude);
    minY = Math.min(minY, point.longitude);
    maxY = Math.max(maxY, point.longitude);
  });
  
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const deltaX = (maxX - minX) * 1.5 || 0.005;
  const deltaY = (maxY - minY) * 1.5 || 0.005;
  return { latitude: midX, longitude: midY, latitudeDelta: deltaX, longitudeDelta: deltaY };
};

const categorizePath = (path) => {
  if (path.length < 2) return [{ type: 'walk', coordinates: path }];
  const subPaths = [];
  let currentType = null;
  let currentCoordinates = [path[0]];

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const timeDiffHours = (p2.timestamp - p1.timestamp) / 3600000;
    const distKm = getDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    const speed = timeDiffHours > 0 ? distKm / timeDiffHours : 0;
    const type = speed > 12 ? 'car' : 'walk';

    if (currentType === null) currentType = type;
    if (type === currentType) {
      currentCoordinates.push(p2);
    } else {
      subPaths.push({ type: currentType, coordinates: currentCoordinates });
      currentCoordinates = [p1, p2];
      currentType = type;
    }
  }
  if (currentCoordinates.length > 1) {
    subPaths.push({ type: currentType, coordinates: currentCoordinates });
  }
  return subPaths;
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];

const ChildLocationHistoryScreen = ({ route, navigation }) => {
  const { childUid } = route.params;
  const mapRef = useRef(null);
  const detailMapRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(false); 
  const [mapType, setMapType] = useState('standard');
  const [selectedRoute, setSelectedRoute] = useState(null); 

  const theme = useMemo(() => ({
    bg: isDarkMode ? '#020617' : '#f4f4f5',
    surface: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    textPrimary: isDarkMode ? '#f8fafc' : '#111827',
    textSecondary: isDarkMode ? '#94a3b8' : '#6b7280',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    routeLine: '#0056D2',
    pillBg: isDarkMode ? '#334155' : '#e5e7eb',
    pillText: isDarkMode ? '#f8fafc' : '#374151',
    modalOverlay: isDarkMode ? '#0f172a' : '#ffffff'
  }), [isDarkMode]);

  const panY = useRef(new Animated.Value(height * 0.4)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.moveY > 100 && gestureState.moveY < height - 50) {
          panY.setValue(gestureState.moveY);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          Animated.spring(panY, { toValue: 120, useNativeDriver: false }).start();
        } else if (gestureState.dy > 50) {
          Animated.spring(panY, { toValue: height * 0.6, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [locations, setLocations] = useState([]);
  const [childName, setChildName] = useState('Yükleniyor...');
  const [childAvatar, setChildAvatar] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [timelineEvents, setTimelineEvents] = useState([]);

  const triggerHaptic = (style = 'Light') => Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]).catch(() => {});

  useEffect(() => {
    const infoRef = ref(db, `users/${childUid}`);
    const unsub = onValue(infoRef, (snap) => {
      const val = snap.val();
      setChildName(val?.displayName || val?.email || 'İsimsiz');
      setChildAvatar(val?.profileImage || null);
    });
    return () => unsub();
  }, [childUid]);

  useEffect(() => {
    const today = new Date();
    const last7Days = [];
    for(let i = 0; i < 7; i++) {
       const d = new Date(today);
       d.setDate(today.getDate() - i);
       const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
       last7Days.push(dateStr);
    }
    setDates(last7Days);
    setSelectedDate(last7Days[0]);
    setLoading(false);
  }, [childUid]);

  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    const locRef = ref(db, `users/${childUid}/locationHistory/${selectedDate}`);
    const unsub = onValue(locRef, (snap) => {
      const val = snap.val();
      if (val) {
        const points = Object.values(val)
          .filter(p => p && p.latitude && p.longitude)
          .sort((a, b) => a.timestamp - b.timestamp);
        setLocations(points);
        processRouteData(points);
      } else {
        setLocations([]);
        setTimelineEvents([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [childUid, selectedDate]);

// 🚀 AKILLI ROTA VE DURAKLAMA (STOP) İŞLEME FONKSİYONU
  const processRouteData = (coords) => {
    if (!coords || coords.length < 2) {
      // 🚀 YENİ EKLENTİ: Eğer sadece 1 konum varsa ama orada uzun süre kalmışsa (Yeni backend mantığı)
      if (coords && coords.length === 1 && coords[0].endTime) {
        const single = coords[0];
        const stayMins = (single.endTime - single.timestamp) / 60000;
        if (stayMins >= 15) {
          setTimelineEvents([{
            type: 'STOP',
            startTime: single.timestamp,
            endTime: single.endTime,
            duration: Math.round(stayMins),
            coordinate: single,
            address: single.address || "Konum Çözümleniyor..."
          }]);
          return;
        }
      }
      setTimelineEvents([]); 
      return;
    }
    
    const segments = [];
    let currentSegment = { type: 'MOVE', startTime: coords[0].timestamp, path: [coords[0]], distance: 0, maxSpeed: 0 };

    for (let i = 0; i < coords.length - 1; i++) {
      const current = coords[i];
      const next = coords[i + 1];
      
      const d = getDistance(current.latitude, current.longitude, next.latitude, next.longitude);
      
      // 🚀 YENİ EKLENTİ: Backend'den gelen explicit endTime verisini hesaba katıyoruz!
      const timeToNextMins = (next.timestamp - current.timestamp) / 60000;
      const stayByEndTimeMins = current.endTime ? (current.endTime - current.timestamp) / 60000 : 0;
      
      // Gerçek bekleme süresi: İki nokta arasındaki boşluk veya backend'in ölçtüğü endTime'dan büyük olanı al.
      const effectiveWaitMins = Math.max(timeToNextMins, stayByEndTimeMins);
      const timeDiffHours = timeToNextMins / 60;
      
      const speed = timeDiffHours > 0 ? (d / timeDiffHours) : 0;
      
      if (speed > 160 && timeToNextMins < 5) continue; 
      if (d < 0.01 && timeToNextMins < 2) continue; 

      if (speed > currentSegment.maxSpeed) {
          currentSegment.maxSpeed = speed;
      }

      if (effectiveWaitMins >= 10) { // 10 dakikadan fazla aynı yerdeyse
        currentSegment.endTime = current.timestamp;
        
        const startPt = currentSegment.path[0];
        const endPt = currentSegment.path[currentSegment.path.length - 1];
        const displacement = getDistance(startPt.latitude, startPt.longitude, endPt.latitude, endPt.longitude);
        
        const isValidMove = currentSegment.path.length > 2 && currentSegment.distance > 0.15 && (displacement > 0.05 || currentSegment.maxSpeed > 2);

        if (isValidMove) {
            currentSegment.duration = Math.round((currentSegment.endTime - currentSegment.startTime) / 60000);
            currentSegment.subPaths = categorizePath(currentSegment.path);
            segments.push({ ...currentSegment });
        }

        // 🛑 AKILLI DURAKLAMA KARTI (STOP)
        if (effectiveWaitMins >= 15) {
            segments.push({
                type: 'STOP',
                startTime: current.timestamp,
                endTime: current.endTime || next.timestamp, // 🚀 Backend verisi varsa onu kullan
                duration: Math.round(effectiveWaitMins),
                coordinate: current,
                address: current.address || "Konum Çözümleniyor..."
            });
        }
        
        currentSegment = { type: 'MOVE', startTime: next.timestamp, path: [next], distance: 0, maxSpeed: 0 };
      } else {
        currentSegment.path.push(next);
        currentSegment.distance += d;
      }
    }
    
    // Son yarım kalan MOVE segmentini kaydet
    if (currentSegment.path.length > 2) {
        currentSegment.endTime = coords[coords.length - 1].timestamp;
        const startPt = currentSegment.path[0];
        const endPt = currentSegment.path[currentSegment.path.length - 1];
        const displacement = getDistance(startPt.latitude, startPt.longitude, endPt.latitude, endPt.longitude);
        
        const isValidMove = currentSegment.distance > 0.15 && (displacement > 0.05 || currentSegment.maxSpeed > 2);

        if (isValidMove) {
          currentSegment.duration = Math.round((currentSegment.endTime - currentSegment.startTime) / 60000);
          currentSegment.subPaths = categorizePath(currentSegment.path);
          segments.push({ ...currentSegment });
        }
    }

    // 🚀 ÇOK KRİTİK EKLENTİ: Eğer kullanıcı ŞU AN sabit duruyorsa!
    // Döngü son elemana bakmadığı için şu anki sabit kalma durumunu arayüze ekliyoruz.
    const lastPt = coords[coords.length - 1];
    if (lastPt && lastPt.endTime) {
        const finalStayMins = (lastPt.endTime - lastPt.timestamp) / 60000;
        if (finalStayMins >= 15) {
            segments.push({
                type: 'STOP',
                startTime: lastPt.timestamp,
                endTime: lastPt.endTime,
                duration: Math.round(finalStayMins),
                coordinate: lastPt,
                address: lastPt.address || "Konum Çözümleniyor..."
            });
        }
    }

    setTimelineEvents(segments.reverse());
  };

  const formatTime = (timestamp) => timestamp ? new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
  const formatDateHeader = (dateString) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', weekday: 'long' });
  };

  const formatDuration = (totalMinutes) => {
    if (!totalMinutes) return '0 dk';
    if (totalMinutes < 60) return `${totalMinutes} dk`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours} sa`;
    return `${hours} sa ${minutes} dk`;
  };

  const focusOnLatestLocation = () => {
    triggerHaptic('Medium');
    if (locations.length > 0 && mapRef.current) {
       const latest = locations[locations.length - 1];
       mapRef.current.animateToRegion({
         latitude: latest.latitude, longitude: latest.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005,
       }, 1000);
    }
  };

  useEffect(() => {
    if (selectedRoute && detailMapRef.current) {
       setTimeout(() => {
         detailMapRef.current.fitToCoordinates(selectedRoute.path, {
           edgePadding: { top: 80, right: 50, bottom: height * 0.4, left: 50 }, animated: true
         });
       }, 400);
    }
  }, [selectedRoute]);

  if (loading && !selectedDate) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.routeLine} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      {/* ARKA PLAN ANA HARİTA */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType={mapType}
        customMapStyle={isDarkMode ? darkMapStyle : []}
        showsCompass={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {locations.length > 0 && (
          <Marker coordinate={locations[locations.length - 1]} zIndex={20}>
            <View style={styles.markerPulse}>
               {childAvatar ? (
                 <Image source={{ uri: childAvatar }} style={styles.childAvatarPin} />
               ) : (
                 <View style={[styles.childAvatarPin, { backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="person" size={16} color="#fff" />
                 </View>
               )}
            </View>
          </Marker>
        )}
      </MapView>

      {/* ÜST BİLGİ PANELİ */}
      <View style={[styles.floatingHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        
        {childAvatar ? (
          <Image source={{ uri: childAvatar }} style={[styles.headerAvatar, { borderColor: theme.routeLine }]} />
        ) : (
          <View style={[styles.headerAvatar, { borderColor: theme.routeLine, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' }]}>
             <Ionicons name="person" size={20} color="#64748b" />
          </View>
        )}

        <View style={styles.headerTextWrap}>
          <Text style={[styles.childTitle, { color: theme.textPrimary }]} numberOfLines={1}>{childName}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>GÜNLÜK ÖZET</Text>
        </View>

        <TouchableOpacity style={[styles.themeToggle, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]} onPress={() => { triggerHaptic(); setIsDarkMode(!isDarkMode); }}>
          <Ionicons name={isDarkMode ? "sunny" : "moon"} size={20} color={isDarkMode ? "#fbbf24" : "#4f46e5"} />
        </TouchableOpacity>
      </View>

      {/* SAĞ HARİTA KONTROLLERİ */}
      <View style={[styles.rightControls, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity style={styles.typeBtn} onPress={() => { triggerHaptic(); setMapType(mapType === 'standard' ? 'hybrid' : 'standard'); }}>
          <Ionicons name="layers" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={[styles.controlSeparator, { backgroundColor: theme.border }]} />
        <TouchableOpacity style={styles.typeBtn} onPress={focusOnLatestLocation}>
          <MaterialCommunityIcons name="crosshairs-gps" size={20} color={theme.routeLine} />
        </TouchableOpacity>
      </View>

      {/* ALT PANEL */}
      <Animated.View style={[styles.bottomSheet, { top: panY, backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
          <View style={[styles.dragIndicator, { backgroundColor: theme.textSecondary }]} />
        </View>
        
        <View style={{ marginBottom: 15 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScrollContainer}>
             {dates.map(date => (
               <TouchableOpacity key={date} onPress={() => { triggerHaptic(); setSelectedDate(date); }} style={[styles.datePill, { backgroundColor: selectedDate === date ? theme.routeLine : theme.pillBg }]}>
                  <Text style={[styles.datePillText, { color: selectedDate === date ? '#fff' : theme.pillText }]}>{formatDateHeader(date)}</Text>
               </TouchableOpacity>
             ))}
          </ScrollView>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.timelineScrollContent}>
          {timelineEvents.map((item, index) => {
            
            // 🛑 DURAKLAMA (STOP) KARTI RENDERI
            if (item.type === 'STOP') {
                return (
                  <View key={index} style={[styles.stopCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <View style={[styles.stopIconWrap, { backgroundColor: theme.pillBg }]}>
                      <Ionicons name="location" size={24} color={theme.textSecondary} />
                    </View>
                    <View style={styles.stopDetails}>
                      <Text style={[styles.stopTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.address || "Konum"}
                      </Text>
                      <Text style={[styles.stopTime, { color: theme.textSecondary }]}>
                        {formatTime(item.startTime)} — {formatTime(item.endTime)} ({formatDuration(item.duration)})
                      </Text>
                    </View>
                  </View>
                );
            }

            // 🚙 HAREKET (MOVE) KARTI RENDERI
            const mapRegion = getRegionForCoordinates(item.path);
            const startCoord = item.path[0];
            const endCoord = item.path[item.path.length - 1];

            return (
              <View key={index} style={[styles.moveCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                {/* Mini Harita Alanı */}
                <View style={styles.miniMapContainer}>
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.miniMap}
                    initialRegion={mapRegion}
                    customMapStyle={isDarkMode ? darkMapStyle : []}
                    scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false} liteMode={true} 
                  >
                    {/* Parçalanmış Rotaları Farklı Renklerle Çiz */}
                    {item.subPaths && item.subPaths.map((sub, i) => (
                      <Polyline key={i} coordinates={sub.coordinates} strokeWidth={5} strokeColor={sub.type === 'car' ? '#3b82f6' : '#10b981'} lineJoin="round" lineCap="round" />
                    ))}
                    
                    <Marker coordinate={startCoord} anchor={{x: 0.5, y: 1}}>
                      <View style={styles.startMarker}><Text style={styles.markerText}>START</Text></View>
                    </Marker>
                    <Marker coordinate={endCoord} anchor={{x: 0.5, y: 1}}>
                      <View style={styles.finishMarker}><Text style={styles.markerText}>FINISH</Text></View>
                    </Marker>
                  </MapView>

                  <View style={styles.mapOverlayPills}>
                    <View style={[styles.mapPill, { backgroundColor: theme.surface }]}>
                      <Text style={[styles.mapPillText, { color: theme.textPrimary }]}>Mesafe: {item.distance.toFixed(1)} km</Text>
                    </View>
                  </View>
                </View>

                {/* Alt Metin Alanı */}
                <View style={styles.moveCardBody}>
                  <View style={styles.moveHeaderRow}>
                    <View style={styles.timeWrap}>
                      <Text style={[styles.timeMainText, { color: theme.textPrimary }]}>
                        {formatTime(item.startTime)} <Ionicons name="arrow-forward" size={14} color={theme.textPrimary}/> {formatTime(item.endTime)}
                      </Text>
                      <Text style={[styles.durationText, { color: theme.textSecondary }]}>({formatDuration(item.duration)})</Text>
                    </View>
                    <TouchableOpacity onPress={() => { triggerHaptic('Medium'); setSelectedRoute(item); }} style={[styles.learnMoreBtn, { backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff' }]}>
                      <Text style={styles.learnMoreText}>Daha fazlasını öğren</Text>
                      <Ionicons name="chevron-forward" size={14} color="#0056D2"/>
                    </TouchableOpacity>
                  </View>

                  {/* 📍 YENİ: Başlangıç ve Bitiş Adresleri (Find My Kids Tarzı) */}
                  <View style={styles.routePoints}>
                    <View style={styles.routePointRow}>
                      <View style={[styles.routeDot, {backgroundColor: '#10b981'}]} />
                      <Text style={[styles.routeAddressText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {startCoord.address || "Bilinmeyen Konum"}
                      </Text>
                    </View>
                    <View style={styles.routeLineConnector} />
                    <View style={styles.routePointRow}>
                      <View style={[styles.routeDot, {backgroundColor: '#ef4444'}]} />
                      <Text style={[styles.routeAddressText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {endCoord.address || "Bilinmeyen Konum"}
                      </Text>
                    </View>
                  </View>

                </View>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* DETAY MODAL EKRANI */}
      <Modal visible={!!selectedRoute} animationType="slide" transparent={false} onRequestClose={() => setSelectedRoute(null)}>
        {selectedRoute && (
          <View style={[styles.modalContainer, { backgroundColor: theme.modalOverlay }]}>
            <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedRoute(null)}>
                <Ionicons name="close" size={28} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Hareket Detayı</Text>
              <View style={{ width: 44 }} /> 
            </View>

            <MapView
              ref={detailMapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.modalMap}
              mapType={mapType}
              customMapStyle={isDarkMode ? darkMapStyle : []}
            >
              {/* Modal İçinde Karma Rotaları Çiz */}
              {selectedRoute.subPaths && selectedRoute.subPaths.map((sub, i) => (
                 <Polyline key={i} coordinates={sub.coordinates} strokeWidth={7} strokeColor={sub.type === 'car' ? '#3b82f6' : '#10b981'} lineJoin="round" lineCap="round" />
              ))}

              <Marker coordinate={selectedRoute.path[0]} anchor={{x: 0.5, y: 1}}>
                <View style={styles.startMarker}><Text style={styles.markerText}>START</Text></View>
              </Marker>
              <Marker coordinate={selectedRoute.path[selectedRoute.path.length - 1]} anchor={{x: 0.5, y: 1}}>
                <View style={styles.finishMarker}><Text style={styles.markerText}>FINISH</Text></View>
              </Marker>
            </MapView>

            <View style={[styles.modalBottomPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              
              <View style={styles.modalTransportTypeRow}>
                {/* Dinamik Teşhis: Hem yürümüş hem arabaya binmişse Multi-Mode göster */}
                {(() => {
                  const hasCar = selectedRoute.subPaths.some(s => s.type === 'car');
                  const hasWalk = selectedRoute.subPaths.some(s => s.type === 'walk');
                  
                  let icon = "walk"; let bgColor = "#dcfce7"; let color = "#15803d"; let title = "Yürüyüş";
                  if (hasCar && hasWalk) { icon = "swap-horizontal"; bgColor = "#e0e7ff"; color = "#4338ca"; title = "Karma Yolculuk"; }
                  else if (hasCar) { icon = "car"; bgColor = "#dbeafe"; color = "#1d4ed8"; title = "Araç ile yolculuk"; }

                  return (
                    <>
                      <View style={[styles.transportIconWrap, { backgroundColor: isDarkMode ? color : bgColor }]}>
                        <Ionicons name={icon} size={26} color={isDarkMode ? '#fff' : color} />
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <Text style={[styles.transportTitle, { color: theme.textPrimary }]}>{title}</Text>
                        <Text style={[styles.transportTime, { color: theme.textSecondary }]}>
                          {formatTime(selectedRoute.startTime)} - {formatTime(selectedRoute.endTime)}
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </View>

              <View style={[styles.modalDivider, { backgroundColor: theme.border }]} />

              {/* Yolculuk Özeti Grid */}
              <View style={styles.modalStatsGrid}>
                <View style={styles.modalStatItem}>
                  <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>MESAFE</Text>
                  <Text style={[styles.modalStatValue, { color: theme.textPrimary }]}>{selectedRoute.distance.toFixed(1)} km</Text>
                </View>
                <View style={styles.modalStatItem}>
                  <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>SÜRE</Text>
                  <Text style={[styles.modalStatValue, { color: theme.textPrimary }]}>{formatDuration(selectedRoute.duration)}</Text>
                </View>
                <View style={styles.modalStatItem}>
                  <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>MAKS HIZ</Text>
                  <Text style={[styles.modalStatValue, { color: theme.textPrimary }]}>{Math.round(selectedRoute.maxSpeed)} km/s</Text>
                </View>
              </View>

              {/* Rota Lejantı (Renklerin anlamı) */}
              <View style={styles.legendContainer}>
                 <View style={styles.legendItem}>
                    <View style={[styles.legendDot, {backgroundColor: '#10b981'}]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>Yürüme</Text>
                 </View>
                 <View style={styles.legendItem}>
                    <View style={[styles.legendDot, {backgroundColor: '#3b82f6'}]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>Araç</Text>
                 </View>
              </View>

            </View>
          </View>
        )}
      </Modal>

    </View>
  );
};

export default ChildLocationHistoryScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { width: width, height: height },
  markerPulse: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(59, 130, 246, 0.3)', justifyContent: 'center', alignItems: 'center' },
  childAvatarPin: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#fff' },

  floatingHeader: { position: 'absolute', top: 50, left: 15, right: 15, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 25, borderWidth: 1, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  backButton: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, marginLeft: 12, borderWidth: 2 },
  headerTextWrap: { flex: 1, marginLeft: 15 },
  childTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 10, fontWeight: '800', marginTop: 2, letterSpacing: 1 },
  themeToggle: { width: 42, height: 42, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },

  rightControls: { position: 'absolute', top: 130, right: 15, alignItems: 'center', borderRadius: 20, padding: 5, borderWidth: 1, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  typeBtn: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  controlSeparator: { height: 1, width: '60%', alignSelf: 'center', marginVertical: 2 },

  bottomSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.9,
    borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 15, elevation: 20,
  },
  dragHandleArea: { width: '100%', height: 30, justifyContent: 'center', alignItems: 'center' },
  dragIndicator: { width: 40, height: 5, borderRadius: 3, opacity: 0.3 },
  dateScrollContainer: { paddingHorizontal: 20, alignItems: 'center' },
  datePill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginHorizontal: 5 },
  datePillText: { fontWeight: '700', fontSize: 13 },
  timelineScrollContent: { paddingHorizontal: 15, paddingBottom: 100 },

  /* 🛑 DURAKLAMA KARTI STİLLERİ */
  stopCard: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderWidth: 1 },
  stopIconWrap: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  stopDetails: { flex: 1 },
  stopTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  stopTime: { fontSize: 13, fontWeight: '600' },

  /* 🚙 HAREKET KARTI STİLLERİ */
  moveCard: { borderRadius: 20, marginBottom: 15, overflow: 'hidden', borderWidth: 1 },
  miniMapContainer: { width: '100%', height: 180, position: 'relative' },
  miniMap: { width: '100%', height: '100%' },
  mapOverlayPills: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 8 },
  mapPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  mapPillText: { fontSize: 11, fontWeight: '700' },
  startMarker: { backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1.5, borderColor: '#fff' },
  finishMarker: { backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1.5, borderColor: '#fff' },
  markerText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  moveCardBody: { padding: 16 },
  moveHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  timeWrap: { flexDirection: 'column' },
  timeMainText: { fontSize: 16, fontWeight: '900' },
  durationText: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  learnMoreBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  learnMoreText: { color: '#0056D2', fontSize: 12, fontWeight: '700', marginRight: 4 },

  /* 📍 ADRES NOKTALARI STİLLERİ */
  routePoints: { paddingLeft: 5 },
  routePointRow: { flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  routeLineConnector: { width: 2, height: 15, backgroundColor: '#cbd5e1', marginLeft: 4, marginVertical: 2 },
  routeAddressText: { fontSize: 14, fontWeight: '600', flex: 1 },

  modalContainer: { flex: 1 },
  modalHeader: { position: 'absolute', top: 50, left: 15, right: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  modalCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 5 },
  modalTitle: { fontSize: 16, fontWeight: '800', backgroundColor: 'rgba(255,255,255,0.9)', color: '#111827', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, overflow: 'hidden' },
  modalMap: { width: width, height: height * 0.75 },
  modalBottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 30 },
  modalTransportTypeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  transportIconWrap: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  transportTitle: { fontSize: 18, fontWeight: '900' },
  transportTime: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  modalDivider: { height: 1, width: '100%', marginBottom: 20 },
  modalStatsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 15 },
  modalStatItem: { alignItems: 'center' },
  modalStatLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 5 },
  modalStatValue: { fontSize: 18, fontWeight: '900' },
  
  legendContainer: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, fontWeight: '600' }
});