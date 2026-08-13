// app/(tabs)/history.tsx — historial + estadísticas + exportar PDF
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { T } from '../../src/theme';
import { useVigilante, type LogEntry } from '../../src/store';
import { exportHistoryPdf } from '../../src/lib/exportPdf';
import { Card, Eyebrow, ScreenTitle, EmptyGarage } from '../../src/components';

const fmt = (n: number) => n.toLocaleString('es-ES');
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CAT_COLORS: Record<string, string> = { Mantenimiento: T.mint, 'Neumáticos': T.amber, 'Eléctrico': T.accent, Otros: T.steel };

function categorize(title: string): string {
  const t = title.toLowerCase();
  if (/neum|rueda|llanta/.test(t)) return 'Neumáticos';
  if (/bater|bombilla|fusible|luz/.test(t)) return 'Eléctrico';
  if (/aceite|filtro|freno|itv|correa|refriger/.test(t)) return 'Mantenimiento';
  return 'Otros';
}

export default function History() {
  const store = useVigilante();
  const car = store.currentVehicle();
  const entries = car ? store.historyFor(car.id) : [];
  const [exporting, setExporting] = useState(false);

  const { monthly, cats, total, perKm } = useMemo(() => {
    const monthly = new Array(6).fill(0); // últimos 6 meses
    const now = new Date();
    const cats: Record<string, number> = {};
    let total = 0;
    for (const e of entries) {
      total += e.cost;
      cats[categorize(e.title)] = (cats[categorize(e.title)] ?? 0) + e.cost;
      // mes aproximado por monthKey
      const idx = MONTH_LABELS.findIndex(m => e.monthKey.toLowerCase().startsWith(monthFull(m)));
      if (idx >= 0) {
        const offset = (now.getMonth() - idx + 12) % 12;
        if (offset < 6) monthly[5 - offset] += e.cost;
      }
    }
    const kmYear = Math.max((car?.monthlyKm ?? 0) * 12, 1);
    return { monthly, cats, total, perKm: (total / kmYear).toFixed(2).replace('.', ',') };
  }, [entries, car]);

  const maxMonthly = Math.max(...monthly, 1);
  const catTotal = Object.values(cats).reduce((a, b) => a + b, 0) || 1;
  const groups = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const e of entries) {
      if (!map.has(e.monthKey)) map.set(e.monthKey, []);
      map.get(e.monthKey)!.push(e);
    }
    return [...map.entries()];
  }, [entries]);

  const doExport = async () => {
    if (!car) return;
    try {
      setExporting(true);
      await exportHistoryPdf(car, entries);
    } catch (e) {
      Alert.alert('No se pudo exportar', String(e));
    } finally { setExporting(false); }
  };

  if (!car) {
    return (
      <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
        <EmptyGarage message="Añade tu primer vehículo para ver su historial y estadísticas." />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 64, paddingBottom: 112 }}>

        <Animated.View entering={FadeInUp.duration(500)}>
          <Eyebrow>{car.name}</Eyebrow>
          <ScreenTitle>Historial</ScreenTitle>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(60).duration(500)}
          style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Card style={{ flex: 1, padding: 16 }}>
            <Text style={{ color: T.mint, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{entries.length}</Text>
            <Text style={{ color: T.steel, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>REGISTROS</Text>
          </Card>
          <Card style={{ flex: 1, padding: 16 }}>
            <Text style={{ color: T.ink, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{fmt(total)} €</Text>
            <Text style={{ color: T.steel, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>INVERTIDO · {perKm} €/KM</Text>
          </Card>
        </Animated.View>

        {/* Gráfica mensual */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)}>
          <Text style={{ color: T.ink, fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 10 }}>
            Estadísticas de gasto <Text style={{ color: T.steelDim, fontSize: 10.5 }}>· últimos 6 meses</Text>
          </Text>
          <Card style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 9, height: 110 }}>
              {monthly.map((v, i) => {
                const monthIdx = (new Date().getMonth() - (5 - i) + 12) % 12;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <Text style={{ color: T.ink2, fontSize: 9.5, fontWeight: '700', height: 13, fontVariant: ['tabular-nums'] }}>
                      {v ? `${v} €` : ''}
                    </Text>
                    <LinearGradient colors={v ? [T.mint, 'rgba(77,141,255,0.75)'] : ['rgba(116,138,176,0.18)', 'rgba(116,138,176,0.18)']}
                      style={{ width: '100%', height: Math.max(5, (v / maxMonthly) * 64), borderRadius: 7 }} />
                    <Text style={{ color: T.steelDim, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>
                      {MONTH_LABELS[monthIdx].toUpperCase()}
                    </Text>
                  </View>
                );
              })}
            </View>
            {/* Categorías */}
            <View style={{ marginTop: 14, gap: 9 }}>
              {Object.entries(cats).map(([name, val]) => (
                <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ width: 96, color: T.ink2, fontSize: 11.5, fontWeight: '600' }}>{name}</Text>
                  <View style={{ flex: 1, height: 6, borderRadius: 99, backgroundColor: 'rgba(116,138,176,0.14)', overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round((val / catTotal) * 100)}%`, height: '100%',
                      borderRadius: 99, backgroundColor: CAT_COLORS[name] ?? T.steel }} />
                  </View>
                  <Text style={{ width: 52, textAlign: 'right', color: T.ink, fontSize: 11.5,
                    fontWeight: '700', fontVariant: ['tabular-nums'] }}>{fmt(val)} €</Text>
                </View>
              ))}
            </View>
          </Card>

          <Pressable onPress={doExport} disabled={exporting}
            style={{ marginTop: 12, height: 48, borderRadius: 16, borderWidth: 1,
              borderColor: 'rgba(77,141,255,0.35)', backgroundColor: 'rgba(77,141,255,0.1)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="document-text-outline" size={16} color={T.accent} />
            <Text style={{ color: T.accent, fontSize: 13, fontWeight: '700' }}>
              {exporting ? 'Generando PDF…' : 'Exportar historial en PDF'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Timeline */}
        {groups.map(([month, items], gi) => (
          <View key={month}>
            <Animated.Text entering={FadeInUp.delay(140 + gi * 50).duration(450)}
              style={{ color: T.steelDim, fontSize: 10.5, fontWeight: '800', letterSpacing: 3,
                textTransform: 'uppercase', marginTop: 18, marginBottom: 12 }}>
              {month}
            </Animated.Text>
            {items.map((e, i) => (
              <Animated.View key={e.id} entering={FadeInUp.delay(170 + gi * 50 + i * 40).duration(450)}
                style={{ flexDirection: 'row', marginBottom: 14 }}>
                <View style={{ width: 26, alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: T.mint, marginTop: 18 }} />
                  <View style={{ flex: 1, width: 2, backgroundColor: T.stroke, marginTop: 4 }} />
                </View>
                <Pressable style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.975 : 1 }] })}
                  onPress={() => e.maintenanceId && router.push(`/maintenance/${e.maintenanceId}`)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
                    {e.photos[0] ? (
                      <Image source={{ uri: e.photos[0] }} style={{ width: 56, height: 56, borderRadius: 14 }} />
                    ) : (
                      <View style={{ width: 56, height: 56, borderRadius: 14, borderWidth: 1, borderColor: T.stroke,
                        backgroundColor: '#0F1A2E', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 24 }}>{e.emoji}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: T.ink, fontSize: 14, fontWeight: '600' }}>{e.title}</Text>
                      <Text style={{ color: T.steel, fontSize: 12, marginTop: 3 }}>
                        {e.dateLabel} · {fmt(e.mileage)} km · {e.place}
                      </Text>
                    </View>
                    <Text style={{ color: T.ink, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                      {e.cost} €
                    </Text>
                  </Card>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

function monthFull(short: string): string {
  const map: Record<string, string> = {
    Ene: 'enero', Feb: 'febrero', Mar: 'marzo', Abr: 'abril', May: 'mayo', Jun: 'junio',
    Jul: 'julio', Ago: 'agosto', Sep: 'septiembre', Oct: 'octubre', Nov: 'noviembre', Dic: 'diciembre',
  };
  return map[short] ?? short.toLowerCase();
}
