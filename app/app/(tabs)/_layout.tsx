// app/(tabs)/_layout.tsx — tab bar flotante construida a mano (no la de por defecto),
// para poder darle tolerancia táctil real (hitSlop) más allá del área visible.
import { Tabs } from 'expo-router';
import { View, Pressable, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../src/theme';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  chat: 'chatbubble',
  history: 'time',
  settings: 'settings-sharp',
};
const LABELS: Record<string, string> = {
  index: 'Inicio', chat: 'Chat', history: 'Historial', settings: 'Ajustes',
};

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={{
      position: 'absolute',
      left: 34,
      right: 34,
      // Bien pegada al borde seguro — poco margen a propósito, y como el ancho
      // ya es estrecho, no se mete en la curva de las esquinas del dispositivo.
      bottom: Math.max(insets.bottom - 10, 2),
      height: 64,
      borderRadius: 26,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: T.stroke,
      shadowColor: '#000',
      shadowOpacity: 0.45,
      shadowRadius: 30,
      elevation: 12,
    }}>
      <BlurView intensity={40} tint="dark"
        style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(13,21,37,0.8)' }}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const color = focused ? T.mint : T.steelDim;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              // El toque registra aunque no des exactamente en el icono — sube
              // mucho la precisión percibida sin tener que agrandar la barra.
              hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={ICONS[route.name]} size={22} color={color} />
              <Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.5, color, marginTop: 3 }}>
                {LABELS[route.name]}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
