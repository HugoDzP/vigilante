// app/(tabs)/_layout.tsx — tab bar flotante con blur, respetando el safe-area real del dispositivo
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../src/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: T.mint,
        tabBarInactiveTintColor: T.steelDim,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
        // Centra icono+etiqueta dentro de cada pestaña, sin depender del padding
        // automático que React Navigation añade para el safe-area (que aquí gestionamos a mano).
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 6,
          paddingBottom: 0,
        },
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          // En vez de un número fijo, usamos el inset real del dispositivo (home indicator,
          // esquinas redondeadas...) + un margen — así en iPhones con un área segura más
          // grande (como el Air) la barra no queda pegada al borde ni se la "come" la curva.
          bottom: Math.max(insets.bottom, 8) + 10,
          height: 62,
          borderRadius: 26,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: T.stroke,
          backgroundColor: 'rgba(13,21,37,0.8)',
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 30,
          elevation: 12,
        },
        tabBarBackground: () => (
          <BlurView intensity={40} tint="dark" style={{ flex: 1, borderRadius: 26, overflow: 'hidden' }} />
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio',
        tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat',
        tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble" size={size} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Historial',
        tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes',
        tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" size={size} color={color} /> }} />
    </Tabs>
  );
}
