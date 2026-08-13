// app/maintenance/[id].tsx — detalle de mantenimiento (modal sheet)
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { T, LEVEL, glowMint } from '../../src/theme';
import { useVigilante } from '../../src/store';
import { pickAndCompress } from '../../src/lib/images';
import { scheduleMaintenanceReminder } from '../../src/lib/notifications';
import { Card } from '../../src/components';

export default function MaintenanceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useVigilante();
  const item = store.maintenance.find(m => m.id === id);
  const [done, setDone] = useState(false);

  if (!item) {
    return (
      <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: T.steel }}>Mantenimiento no encontrado.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: T.accent, fontWeight: '600' }}>Volver</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  const lv = LEVEL[item.level];

  const addPhoto = async () => {
    const img = await pickAndCompress();
    if (img) store.addPhoto(item.id, { uri: img.remoteUrl ?? img.uri, sizeLabel: img.sizeLabel });
  };

  const handleCta = async () => {
    if (item.ctaLabel.startsWith('Marcar')) {
      store.markDone(item.id);
      setDone(true);
      setTimeout(() => router.back(), 700);
    } else if (item.ctaLabel.startsWith('Programar')) {
      await scheduleMaintenanceReminder(item.title, `${item.remainingText} restantes — toca para ver el detalle.`, 7);
      Alert.alert('Recordatorio programado ⏰', 'Te avisaré en 7 días.');
    } else {
      router.back();
    }
  };

  return (
    <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 }}>

        {/* Nav */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}>
          <Pressable onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card,
              borderWidth: 1, borderColor: T.stroke, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99 }}>
            <Ionicons name="chevron-back" size={14} color={T.ink2} />
            <Text style={{ color: T.ink2, fontSize: 12, fontWeight: '600' }}>Volver</Text>
          </Pressable>
        </View>

        {/* Cabecera */}
        <Animated.View entering={FadeInUp.duration(450)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: lv.dim,
            alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.6 }}>{item.title}</Text>
            <View style={{ alignSelf: 'flex-start', backgroundColor: lv.dim,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, marginTop: 6 }}>
              <Text style={{ color: lv.color, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }}>
                {lv.label.toUpperCase()} · {item.remainingText}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInUp.delay(60).duration(450)}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
          {item.stats.map(([v, l]) => (
            <Card key={l} style={{ width: '47%', flexGrow: 1, padding: 14 }}>
              <Text style={{ color: T.ink, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{v}</Text>
              <Text style={{ color: T.steel, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 2 }}>
                {l.toUpperCase()}
              </Text>
            </Card>
          ))}
        </Animated.View>

        {/* Taller */}
        <Animated.View entering={FadeInUp.delay(90).duration(450)}>
          <Sec title="Realizado en" hint="toca para asignar" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...store.workshops.map(w => w.name), 'Mantenimiento casero 🧰'].map(name => {
              const on = item.workshop === name;
              return (
                <Pressable key={name}
                  onPress={() => store.assignWorkshop(item.id, on ? null : name)}
                  style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99,
                    backgroundColor: on ? T.mint : T.card,
                    borderWidth: 1, borderColor: on ? T.mint : T.stroke }}>
                  <Text style={{ fontSize: 12, fontWeight: on ? '700' : '600', color: on ? '#06281B' : T.ink2 }}>
                    {on ? '✓ ' : ''}{name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Fotos */}
        <Animated.View entering={FadeInUp.delay(120).duration(450)}>
          <Sec title="Fotos" hint="opcionales · ticket, pieza, antes/después" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {item.photos.map((p, i) => (
              <View key={p.uri + i} style={{ width: '31%', aspectRatio: 1 }}>
                <Image source={{ uri: p.uri }}
                  style={{ width: '100%', height: '100%', borderRadius: 14, borderWidth: 1, borderColor: T.stroke }} />
                <Pressable onPress={() => store.removePhoto(item.id, i)}
                  style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11,
                    backgroundColor: 'rgba(5,11,20,0.75)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={12} color="#fff" />
                </Pressable>
                {!!p.sizeLabel && (
                  <Text style={{ position: 'absolute', bottom: 4, left: 6, color: 'rgba(255,255,255,0.85)',
                    fontSize: 8.5, fontWeight: '700' }}>{p.sizeLabel}</Text>
                )}
              </View>
            ))}
            <Pressable onPress={addPhoto}
              style={{ width: '31%', aspectRatio: 1, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
                borderColor: 'rgba(116,138,176,0.35)', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Ionicons name="add" size={20} color={T.steelDim} />
              <Text style={{ color: T.steelDim, fontSize: 10, fontWeight: '600' }}>Añadir</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Notas */}
        <Animated.View entering={FadeInUp.delay(150).duration(450)}>
          <Sec title="Notas" />
          <Card style={{ padding: 16 }}>
            <Text style={{ color: T.ink2, fontSize: 13, lineHeight: 21 }}>{item.notes}</Text>
          </Card>
        </Animated.View>

        {/* Veces anteriores */}
        {item.pastOccurrences.length > 0 && (
          <Animated.View entering={FadeInUp.delay(180).duration(450)}>
            <Sec title="Veces anteriores" />
            {item.pastOccurrences.map(p => (
              <Card key={p.meta} style={{ flexDirection: 'row', justifyContent: 'space-between',
                alignItems: 'center', padding: 12, paddingHorizontal: 14, marginBottom: 8 }}>
                <View>
                  <Text style={{ color: T.ink, fontSize: 12.5, fontWeight: '600' }}>{p.title}</Text>
                  <Text style={{ color: T.steel, fontSize: 11, marginTop: 1, fontVariant: ['tabular-nums'] }}>{p.meta}</Text>
                </View>
                <Text style={{ color: T.ink, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{p.cost}</Text>
              </Card>
            ))}
          </Animated.View>
        )}

        {/* CTA */}
        <Animated.View entering={FadeInUp.delay(210).duration(450)}>
          <Pressable onPress={handleCta}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }], marginTop: 20 })}>
            {done ? (
              <View style={{ height: 52, borderRadius: 18, backgroundColor: T.card,
                alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: T.mint, fontSize: 15, fontWeight: '700' }}>✓ Registrado</Text>
              </View>
            ) : (
              <LinearGradient colors={[T.mint, '#1FC987']}
                style={{ height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...glowMint }}>
                <Text style={{ color: '#06281B', fontSize: 15, fontWeight: '700' }}>{item.ctaLabel}</Text>
              </LinearGradient>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

function Sec({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
      marginTop: 18, marginBottom: 10 }}>
      <Text style={{ color: T.ink, fontSize: 13, fontWeight: '700' }}>{title}</Text>
      {hint && <Text style={{ color: T.steelDim, fontSize: 10.5, fontWeight: '600' }}>{hint}</Text>}
    </View>
  );
}
