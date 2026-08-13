// src/components/index.tsx — componentes compartidos
import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ViewStyle, TextInputProps } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming, withDelay, withRepeat, Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { T, LEVEL, shadowCard } from '../theme';
import { ecoFromSpecs, ECO_META, type EcoCode } from '../lib/eco';
import { useVigilante, type MaintenanceItem, type Vehicle } from '../store';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: T.cardA, borderRadius: 22, borderWidth: 1, borderColor: T.stroke, ...shadowCard }, style]}>
      {children}
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return <Text style={{ color: T.steelDim, fontSize: 10.5, fontWeight: '700', letterSpacing: 2.4, textTransform: 'uppercase' }}>{children}</Text>;
}

export function ScreenTitle({ children }: { children: string }) {
  return <Text style={{ color: T.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.9 }}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={T.steelDim}
      {...props}
      style={[{
        height: 48, borderRadius: 14, borderWidth: 1, borderColor: T.stroke,
        backgroundColor: T.card, paddingHorizontal: 15, color: T.ink, fontSize: 14,
      }, props.style]}
    />
  );
}

// ---------- Etiqueta ambiental ----------
export function EcoBadge({ car, code, suffix }: { car?: Vehicle; code?: EcoCode; suffix?: string }) {
  const c = code ?? (car ? car.label ?? ecoFromSpecs(car.fuel, car.year) : 'NONE');
  const meta = ECO_META[c];
  const [c1, c2] = meta.colors;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: 'rgba(116,138,176,0.1)', borderWidth: 1, borderColor: T.stroke,
      paddingVertical: 4, paddingLeft: 6, paddingRight: 10, borderRadius: 99,
    }}>
      <EcoDot c1={c1} c2={c2} />
      <Text style={{ color: T.ink2, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>
        {meta.label}{suffix ?? ''}
      </Text>
    </View>
  );
}

/** Círculo de etiqueta dibujado en SVG — evita artefactos de recorte de overflow:hidden
 * a tamaños tan pequeños (14px) en pantallas de alta densidad. */
function EcoDot({ c1, c2, size = 14 }: { c1: string; c2: string; size?: number }) {
  const r = size / 2;
  const inner = r - 0.75; // deja sitio al borde de 1.5px
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={r} cy={r} r={inner} fill={c1} />
      {c1 !== c2 && (
        <Path d={`M ${r} ${r - inner} A ${inner} ${inner} 0 0 1 ${r} ${r + inner} Z`} fill={c2} />
      )}
      <Circle cx={r} cy={r} r={inner} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
    </Svg>
  );
}

// ---------- Gauge de salud ----------
export function HealthGauge({ score, size = 118 }: { score: number; size?: number }) {
  const r = size / 2 - 9;
  const circ = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(200, withTiming(score, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - progress.value) }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGrad id="g" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={T.mint} /><Stop offset="1" stopColor={T.accent} />
          </SvgGrad>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(116,138,176,0.14)" strokeWidth={10} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke="url(#g)" strokeWidth={10}
          strokeLinecap="round" fill="none" strokeDasharray={circ} animatedProps={animatedProps} />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: T.ink, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{Math.round(score * 100)}%</Text>
        <Text style={{ color: T.steel, fontSize: 9, fontWeight: '700', letterSpacing: 2, marginTop: 2 }}>SALUD</Text>
      </View>
    </View>
  );
}

// ---------- Tarjeta de mantenimiento ----------
function UrgencyBar({ progress, level }: { progress: number; level: keyof typeof LEVEL }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(300, withTiming(progress, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [progress]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height: 4, borderRadius: 99, backgroundColor: 'rgba(116,138,176,0.14)', marginTop: 8, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: 99, backgroundColor: LEVEL[level].color }, style]} />
    </View>
  );
}

export function MaintenanceCard({ item }: { item: MaintenanceItem }) {
  const lv = LEVEL[item.level];
  return (
    <Pressable
      onPress={() => router.push(`/maintenance/${item.id}`)}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.975 : 1 }], marginBottom: 10 })}
    >
      <Card style={{
        flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
        ...(item.level === 'urgent' ? { borderColor: 'rgba(255,100,120,0.32)' } : {}),
      }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: lv.dim, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 19 }}>{item.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.ink, fontSize: 14, fontWeight: '600' }}>{item.title}</Text>
          <Text style={{ color: T.steel, fontSize: 12, marginTop: 2 }}>{item.detail}</Text>
          <UrgencyBar progress={item.progress} level={item.level} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: lv.color, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{item.remainingText}</Text>
          <Text style={{ color: lv.color, fontSize: 9.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{lv.label}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

// ---------- Selector de garaje ----------
export function GarageSwitcher() {
  const { vehicles, currentVehicleId, switchVehicle } = useVigilante();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {vehicles.map(v => {
        const on = v.id === currentVehicleId;
        return (
          <Pressable key={v.id} onPress={() => switchVehicle(v.id)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingVertical: 8, paddingLeft: 9, paddingRight: 14, borderRadius: 99,
              backgroundColor: on ? 'rgba(52,232,164,0.10)' : T.card,
              borderWidth: 1, borderColor: on ? 'rgba(52,232,164,0.4)' : T.stroke,
            }}>
            <View style={{
              width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? T.mint : 'rgba(116,138,176,0.15)',
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#06281B' : T.steel }}>{v.initial}</Text>
            </View>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: on ? T.ink : T.steel }}>{v.name}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => router.push('/vehicle/form')}
        style={{
          flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14,
          borderRadius: 99, borderWidth: 1, borderStyle: 'dashed', borderColor: T.stroke,
        }}>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: T.steelDim }}>＋ Añadir</Text>
      </Pressable>
    </ScrollView>
  );
}

// ---------- Selector segmentado ----------
export function Segmented<Tv extends string>({ options, value, onChange }: {
  options: readonly Tv[]; value: Tv; onChange: (v: Tv) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)}
            style={{
              flexGrow: 1, minWidth: 70, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? T.mint : T.card,
              borderWidth: 1, borderColor: on ? T.mint : T.stroke,
            }}>
            <Text style={{ fontSize: 12, fontWeight: on ? '700' : '600', color: on ? '#06281B' : T.steel }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Anillo de onda para avisos urgentes ----------
export function PulseRing({ color = T.danger, size = 38, borderRadius = 12 }: {
  color?: string; size?: number; borderRadius?: number;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.55);

  React.useEffect(() => {
    scale.value = withRepeat(withTiming(1.4, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[{
      position: 'absolute', top: 0, left: 0, width: size, height: size,
      borderRadius, borderWidth: 1.5, borderColor: color,
    }, style]} />
  );
}

// ---------- Estado vacío: sin coches todavía ----------
export function EmptyGarage({ message }: { message?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 28 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 22, backgroundColor: T.mintDim,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(52,232,164,0.3)',
      }}>
        <Ionicons name="car-sport-outline" size={32} color={T.mint} />
      </View>
      <Text style={{ color: T.ink, fontSize: 19, fontWeight: '800', textAlign: 'center' }}>
        Tu garaje está vacío
      </Text>
      <Text style={{ color: T.steel, fontSize: 13.5, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
        {message ?? 'Añade tu primer vehículo y Vigilante empezará a seguirle la pista: mantenimientos, kilometraje y más.'}
      </Text>
      <Pressable onPress={() => router.push('/vehicle/form')}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }], marginTop: 8 })}>
        <LinearGradient colors={[T.mint, '#1FC987']}
          style={{ paddingHorizontal: 22, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
          <Ionicons name="add" size={18} color="#06281B" />
          <Text style={{ color: '#06281B', fontSize: 14, fontWeight: '750' as any }}>Añadir vehículo</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
