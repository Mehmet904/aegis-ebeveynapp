import 'dotenv/config';

export default {
  expo: {
    name: 'Aegis Ebeveyn', 
    slug: 'aegis-parent', 
    scheme: 'aegisparent', 
    version: '1.0.1',
    sdkVersion: '52.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic', 
    icon: "./assets/icon.png",
    jsEngine: 'hermes', 
    splash: { image: "./assets/icon.png", resizeMode: "contain", backgroundColor: "#020617" },
    extra: {
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
      FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
      FIREBASE_APP_ID: process.env.FIREBASE_APP_ID, 
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
      SIGNALING_SERVER_URL: process.env.SIGNALING_SERVER_URL,
   eas: { projectId: "d77a6021-5c92-4b75-9f9f-bbefe6ac1d51" }
    },
    android: {
      package: 'com.aegis.parent', // 🚀 EBEVEYN PAKET ADI
      googleServicesFile: "./google-services.json",
      allowBackup: false,
      permissions: [
        "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", 
        "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS", "CAMERA",
        "WAKE_LOCK", "INTERNET", "VIBRATE", "RECEIVE_BOOT_COMPLETED",
        "USE_FULL_SCREEN_INTENT", 
        "DISABLE_KEYGUARD",       
        "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
        "REORDER_TASKS", 
      ],
  
      config: { googleMaps: { apiKey: "AIzaSyAjj5orF-5TmfwRCUSAld4zsDbp7LLfqvE" } },
    },
    plugins: [
      "expo-notifications",
      "expo-task-manager",
      "expo-secure-store",
      "@react-native-google-signin/google-signin",
      [ "expo-location", { "locationAlwaysAndWhenInUsePermission": "Aegis Kalkanı için izin verin.", "locationAlwaysPermission": "Konum için gereklidir.", "isAndroidBackgroundLocationEnabled": false } ], // ❌ Arka plan konumu Ebeveynde kapatıldı
      [ "@config-plugins/react-native-webrtc", { "cameraPermission": "Kamera erişimine izin verin.", "microphonePermission": "Mikrofona izin verin." } ],
      [ "expo-build-properties", { "android": { "minSdkVersion": 24, "compileSdkVersion": 34, "targetSdkVersion": 34, "usesCleartextTraffic": true }, "ios": { "deploymentTarget": "15.1" } } ],
     
    ],
  },
};