// app/(tabs)/_layout.tsx — tab bar pegada al borde inferior (estilo WhatsApp), no
// flotante. Más robusta entre modelos de Android distintos que una píldora flotante
// con cálculos de posición/blur, que variaba de aspecto según el dispositivo.
import { Tabs } from 'expo-router';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../src/theme';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home', chat: 'chatbubble', history: 'time', settings: 'settings-sharp',
};
const LABELS: Record<string, string> = {
  index: 'Inicio', chat: 'Chat', history: 'Historial', settings: 'Ajustes',
};

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: T.bg1,
      borderTopWidth: 1,
      borderTopColor: T.stroke,
      paddingBottom: Math.max(insets.bottom, 10),
      paddingTop: 10,
    }}>
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
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 3 }}
          >
            <Ionicons name={ICONS[route.name]} size={23} color={color} />
            <Text style={{ fontSize: 10.5, fontWeight: '600', letterSpacing: 0.3, color }}>
              {LABELS[route.name]}
            </Text>
          </Pressable>
        );
      })}
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
