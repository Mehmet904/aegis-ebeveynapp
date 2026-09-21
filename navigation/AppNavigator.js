import React from 'react';
import { StatusBar } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';

// SADECE EBEVEYN EKRANLARI
import AuthLoader from '../components/loader/AuthLoader';
import LoginScreen from '../components/auth/LoginScreen';
import ParentHomeScreen from '../components/parent/ParentHomeScreen';
import ParentPairingScreen from '../components/parent/ParentPairingScreen';
import ChildMapScreen from '../components/parent/ChildMapScreen';
import GeofenceMapScreen from '../components/parent/GeofenceMapScreen';
import ChildLocationHistoryScreen from '../components/parent/ChildLocationHistoryScreen';
import AlertsScreen from '../components/parent/AlertsScreen';
import AppUsageScreen from '../components/parent/AppUsageScreen';
import ChatScreen from '../components/chat/ChatScreen';
import ProfileScreen from '../components/parent/ProfileScreen';
import RegisterScreen from '../components/auth/RegisterScreen';
import CallHistoryScreen from '../components/parent/CallHistoryScreen';
import AudioListeningScreen from '../components/parent/AudioListeningScreen'; // Kendi klasör yoluna göre düzelt


export const navigationRef = createNavigationContainerRef();
const Stack = createNativeStackNavigator();

const AegisTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#020617' },
};

const AppNavigator = () => {
  return (
    <NavigationContainer theme={AegisTheme} ref={navigationRef}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Stack.Navigator
        initialRouteName="AuthLoader"
        screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#020617' } }}
      >
        {/* Sistem Başlatma */}
        <Stack.Group screenOptions={{ animation: 'fade' }}>
          <Stack.Screen name="AuthLoader" component={AuthLoader} />
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Group>

        {/* Ana Komuta Merkezi */}
        <Stack.Group screenOptions={{ animation: 'fade' }}>
          <Stack.Screen name="ParentHome" component={ParentHomeScreen} />
        </Stack.Group>

        {/* Eşleştirme (Aşağıdan Yukarı) */}
        <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
          <Stack.Screen name="ParentPairing" component={ParentPairingScreen} />
        </Stack.Group>

        {/* Taktiksel Ekranlar */}
        <Stack.Group>
          <Stack.Screen name="ChildMapScreen" component={ChildMapScreen} />
          <Stack.Screen name="GeofenceMapScreen" component={GeofenceMapScreen} />
          <Stack.Screen name="ChildLocationHistoryScreen" component={ChildLocationHistoryScreen} />
          <Stack.Screen name="AlertsScreen" component={AlertsScreen} />
          <Stack.Screen name="AppUsageScreen" component={AppUsageScreen} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="CallHistoryScreen" component={CallHistoryScreen} />
          <Stack.Screen
            name="AudioListeningScreen"
            component={AudioListeningScreen}
            options={{ headerShown: false }}
          />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;