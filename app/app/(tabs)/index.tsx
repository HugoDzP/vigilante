// app/(tabs)/index.tsx — Dashboard
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ImageBackground, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { T } from '../../src/theme';
import { useVigilante } from '../../src/store';
import { pickAndCompress } from '../../src/lib/images';
import { sync, HAS_BACKEND } from '../../src/lib/api';
import { Card, HealthGauge, MaintenanceCard, GarageSwitcher, Eyebrow, ScreenTitle, EcoBadge, EmptyGarage, PulseRing } from '../../src/components';

const fmt = (n: number) => n.toLocaleString('es-ES');

export default function Dashboard() {
  const store = useVigilante();
  const car = store.currentVehicle();
  const [kmDraft, setKmDraft] = useState('');

  if (!car) {
    return (
      <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
        <EmptyGarage />
      </LinearGradient>
    );
  }

  const items = store.maintenanceFor(car.id);
  const urgent = items.find(m => m.level === 'urgent');
  const askDismissed = store.mileageAskDismissed[car.id];

  const pickHeroPhoto = async () => {
    const img = await pickAndCompress({ aspect: [16, 9] });
    if (img) store.setVehiclePhoto(car.id, img.remoteUrl ?? img.uri);
  };

  const submitKm = () => {
    const v = parseInt(kmDraft);
    if (!v) return;
    store.updateMileage(car.id, v);
    setKmDraft('');
    if (HAS_BACKEND) sync.pushMileage(car.id, v).catch(() => {});
  };

  return (
    <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 64, paddingBottom: 112 }}>

        <Animated.View entering={FadeInUp.duration(500)}>
          <Eyebrow>Buenos días, Hugo</Eyebrow>
          <ScreenTitle>Tu garaje</ScreenTitle>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(40).duration(500)} style={{ marginVertical: 13 }}>
          <GarageSwitcher />
        </Animated.View>

        {urgent && (
          <Animated.View entering={FadeInUp.delay(80).duration(500)}>
            <Pressable onPress={() => router.push(`/maintenance/${urgent.id}`)}>
              <LinearGradient colors={['rgba(255,100,120,0.14)', 'rgba(255,174,77,0.08)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 18,
                  marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,100,120,0.35)' }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: T.dangerDim,
                  alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <PulseRing color={T.danger} size={38} borderRadius={12} />
                  <Ionicons name="warning" size={18} color={T.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.ink, fontSize: 13, fontWeight: '700' }}>
                    {urgent.title} · {urgent.remainingText}
                  </Text>
                  <Text style={{ color: T.ink2, fontSize: 11.5 }}>Revísalo antes de tu próximo viaje</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={T.danger} />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {!askDismissed && (
          <Animated.View entering={FadeInUp.delay(100).duration(500)}>
            <LinearGradient colors={['rgba(77,141,255,0.12)', 'rgba(52,232,164,0.07)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ padding: 14, borderRadius: 18, marginBottom: 14, borderWidth: 1,
                borderColor: 'rgba(77,141,255,0.3)', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(77,141,255,0.15)',
                  alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15 }}>📍</Text>
                </View>
                <Text style={{ color: T.ink2, fontSize: 13, flex: 1 }}>
                  ¿Cuántos km marca el <Text style={{ color: T.ink, fontWeight: '700' }}>{car.short}</Text>?
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={kmDraft} onChangeText={setKmDraft} placeholder={String(car.mileage + 400)}
                  placeholderTextColor={T.steelDim} keyboardType="number-pad"
                  style={{ flex: 1, height: 42, borderRadius: 13, borderWidth: 1, borderColor: T.stroke,
                    backgroundColor: 'rgba(8,15,28,0.6)', paddingHorizontal: 14, color: T.ink, fontSize: 14 }} />
                <Pressable onPress={submitKm}
                  style={{ height: 42, paddingHorizontal: 16, borderRadius: 13, backgroundColor: T.accent,
                    alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>Actualizar</Text>
                </Pressable>
                <Pressable onPress={() => store.dismissMileageAsk(car.id)}
                  style={{ height: 42, paddingHorizontal: 8, justifyContent: 'center' }}>
                  <Text style={{ color: T.steelDim, fontSize: 12.5, fontWeight: '600' }}>Luego</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(120).duration(500)}>
          <Card style={{ overflow: 'hidden', borderRadius: 26, marginBottom: 16, padding: 0 }}>
            <ImageBackground source={car.photoUri ? { uri: car.photoUri } : undefined}
              style={{ height: 218 }} imageStyle={{ resizeMode: 'cover' }}>
              {!car.photoUri && (
                <LinearGradient colors={['#15233E', '#0B1322']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              )}
              <LinearGradient colors={['rgba(5,11,20,0.15)', 'transparent', 'rgba(5,11,20,0.78)']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <View style={{ position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(6,16,28,0.65)', borderWidth: 1, borderColor: 'rgba(52,232,164,0.3)',
                paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.mint }} />
                <Text style={{ color: T.mint, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.6 }}>VIGILANDO</Text>
              </View>
              <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 6 }}>
                {car.photoUri && (
                  <Pressable onPress={() => store.setVehiclePhoto(car.id, undefined)}
                    style={{ backgroundColor: 'rgba(6,16,28,0.65)', borderWidth: 1, borderColor: T.stroke,
                      paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99 }}>
                    <Text style={{ color: T.ink2, fontSize: 11, fontWeight: '600' }}>Quitar</Text>
                  </Pressable>
                )}
                <Pressable onPress={pickHeroPhoto}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: 'rgba(6,16,28,0.65)', borderWidth: 1, borderColor: T.stroke,
                    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99 }}>
                  <Ionicons name="camera" size={13} color={T.ink2} />
                  <Text style={{ color: T.ink2, fontSize: 11, fontWeight: '600' }}>
                    {car.photoUri ? 'Cambiar' : 'Tu foto'}
                  </Text>
                </Pressable>
              </View>
              {!car.photoUri && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 26,
                  alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Ionicons name="car-sport" size={120} color="rgba(140,170,220,0.5)" />
                </View>
              )}
            </ImageBackground>

            <View style={{ padding: 18, backgroundColor: T.cardA }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: T.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>{car.name}</Text>
                <EcoBadge car={car} />
                <Pressable onPress={() => router.push({ pathname: '/vehicle/form', params: { id: car.id } })}
                  style={{ marginLeft: 'auto', backgroundColor: 'rgba(77,141,255,0.12)',
                    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 }}>
                  <Text style={{ color: T.accent, fontSize: 11, fontWeight: '700' }}>Editar</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {[car.fuel, `${car.hp} CV`, String(car.year), car.bodyType].map(s => (
                  <View key={s} style={{ backgroundColor: 'rgba(116,138,176,0.1)', borderWidth: 1,
                    borderColor: T.stroke, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ color: T.steel, fontSize: 10.5, fontWeight: '600' }}>{s}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 16 }}>
                <HealthGauge score={car.health} />
                <View>
                  <Text style={{ color: T.steel, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 7 }}>
                    KILOMETRAJE
                  </Text>
                  <Text style={{ color: T.ink, fontSize: 35, fontWeight: '900', letterSpacing: -1.4,
                    fontVariant: ['tabular-nums'] }}>
                    {fmt(car.mileage)}
                  </Text>
                  <Text style={{ color: T.ink2, fontSize: 12, marginTop: 9 }}>
                    ▲ <Text style={{ color: T.mint, fontWeight: '700' }}>+{fmt(car.monthlyKm)} km</Text> este mes
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(160).duration(500)}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 12, marginTop: 4 }}>
          <Text style={{ color: T.ink, fontSize: 16, fontWeight: '700' }}>Próximos mantenimientos</Text>
        </Animated.View>

        {items.map((m, i) => (
          <Animated.View key={m.id} entering={FadeInUp.delay(200 + i * 40).duration(500)}>
            <MaintenanceCard item={m} />
          </Animated.View>
        ))}

        <Animated.View entering={FadeInUp.delay(340).duration(500)}>
          <LinearGradient colors={['rgba(52,232,164,0.10)', 'rgba(77,141,255,0.08)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ padding: 18, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(52,232,164,0.2)', marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="sparkles" size={13} color={T.mint} />
              <Text style={{ color: T.mint, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>RESUMEN VIGILANTE</Text>
            </View>
            <Text style={{ color: T.ink2, fontSize: 13.5, lineHeight: 21 }}>{car.summary}</Text>
          </LinearGradient>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}
