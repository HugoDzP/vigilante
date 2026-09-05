// app/maintenance/new.tsx — añadir un mantenimiento a mano (sin pasar por el chat)
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { T, glowMint } from '../../src/theme';
import { useVigilante } from '../../src/store';
import { Card, Segmented } from '../../src/components';

const PRESETS = [
  { emoji: '🛢️', title: 'Aceite y filtro', kind: 'km', interval: 15000 },
  { emoji: '🛞', title: 'Neumáticos', kind: 'km', interval: 40000 },
  { emoji: '⚠️', title: 'Pastillas de freno', kind: 'km', interval: 40000 },
  { emoji: '🔋', title: 'Batería 12V', kind: 'days', interval: 1460 },
  { emoji: '🌬️', title: 'Filtro de habitáculo', kind: 'days', interval: 365 },
  { emoji: '🔧', title: 'Otro', kind: 'km', interval: 20000 },
];

const CADENCE = ['Por kilómetros', 'Por fecha', 'Sin repetir'] as const;

export default function NewMaintenance() {
  const store = useVigilante();
  const car = store.currentVehicle();

  const [preset, setPreset] = useState(PRESETS[0]);
  const [title, setTitle] = useState(PRESETS[0].title);
  const [cadence, setCadence] = useState<(typeof CADENCE)[number]>('Por kilómetros');
  const [intervalValue, setIntervalValue] = useState(String(PRESETS[0].interval));
  const [lastDoneKm, setLastDoneKm] = useState('');
  const [lastDoneAgoDays, setLastDoneAgoDays] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const pickPreset = (p: typeof PRESETS[number]) => {
    setPreset(p);
    setTitle(p.title);
    setCadence(p.kind === 'km' ? 'Por kilómetros' : 'Por fecha');
    setIntervalValue(String(p.interval));
  };

  const save = async () => {
    if (!car || !title.trim()) return;
    setSaving(true);
    let lastDoneDate: string | undefined;
    if (cadence === 'Por fecha' && lastDoneAgoDays.trim()) {
      const d = new Date();
      d.setDate(d.getDate() - (parseInt(lastDoneAgoDays) || 0));
      lastDoneDate = d.toISOString().slice(0, 10);
    }
    await store.addCustomMaintenance(car.id, {
      title: title.trim(),
      emoji: preset.emoji,
      estCost: cost.trim() ? `${cost.trim()} €` : undefined,
      notes: notes.trim(),
      intervalKm: cadence === 'Por kilómetros' ? parseInt(intervalValue) || undefined : undefined,
      intervalDays: cadence === 'Por fecha' ? parseInt(intervalValue) || undefined : undefined,
      lastDoneKm: cadence === 'Por kilómetros' && lastDoneKm.trim() ? parseInt(lastDoneKm) : undefined,
      lastDoneDate,
    });
    setSaving(false);
    router.back();
  };

  return (
    <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}>
          <Pressable onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card,
              borderWidth: 1, borderColor: T.stroke, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99 }}>
            <Ionicons name="chevron-back" size={14} color={T.ink2} />
            <Text style={{ color: T.ink2, fontSize: 12, fontWeight: '600' }}>Cancelar</Text>
          </Pressable>
        </View>

        <Text style={{ color: T.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.9, marginBottom: 6 }}>
          Nuevo mantenimiento
        </Text>
        <Text style={{ color: T.steel, fontSize: 13, marginBottom: 20 }}>
          Para {car?.short ?? 'tu coche'} — también puedes registrarlo hablando con el Chat.
        </Text>

        <Text style={lbl}>TIPO</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {PRESETS.map(p => {
            const on = p.title === preset.title;
            return (
              <Pressable key={p.title} onPress={() => pickPreset(p)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9,
                  borderRadius: 99, backgroundColor: on ? T.mint : T.card,
                  borderWidth: 1, borderColor: on ? T.mint : T.stroke }}>
                <Text style={{ fontSize: 14 }}>{p.emoji}</Text>
                <Text style={{ fontSize: 12.5, fontWeight: on ? '700' : '600', color: on ? '#06281B' : T.ink2 }}>
                  {p.title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {preset.title === 'Otro' && (
          <>
            <Text style={lbl}>NOMBRE</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Ej. Correa de distribución"
              placeholderTextColor={T.steelDim}
              style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: T.stroke,
                backgroundColor: T.card, paddingHorizontal: 15, color: T.ink, fontSize: 14, marginBottom: 16 }} />
          </>
        )}

        <Text style={lbl}>SE REPITE</Text>
        <Segmented options={CADENCE} value={cadence} onChange={setCadence} />

        {cadence !== 'Sin repetir' && (
          <>
            <Text style={lbl}>{cadence === 'Por kilómetros' ? 'CADA CUÁNTOS KM' : 'CADA CUÁNTOS DÍAS'}</Text>
            <TextInput value={intervalValue} onChangeText={setIntervalValue} keyboardType="number-pad"
              placeholder={cadence === 'Por kilómetros' ? '15000' : '365'}
              placeholderTextColor={T.steelDim}
              style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: T.stroke,
                backgroundColor: T.card, paddingHorizontal: 15, color: T.ink, fontSize: 14, marginBottom: 16 }} />

            {cadence === 'Por kilómetros' ? (
              <>
                <Text style={lbl}>¿CON CUÁNTOS KM LO HICISTE LA ÚLTIMA VEZ? (OPCIONAL)</Text>
                <TextInput value={lastDoneKm} onChangeText={setLastDoneKm} keyboardType="number-pad"
                  placeholder={`Si no lo pones, uso los ${car?.mileage.toLocaleString('es-ES') ?? 'actuales'} km de hoy`}
                  placeholderTextColor={T.steelDim}
                  style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: T.stroke,
                    backgroundColor: T.card, paddingHorizontal: 15, color: T.ink, fontSize: 13, marginBottom: 16 }} />
              </>
            ) : (
              <>
                <Text style={lbl}>¿HACE CUÁNTOS DÍAS LO HICISTE? (OPCIONAL)</Text>
                <TextInput value={lastDoneAgoDays} onChangeText={setLastDoneAgoDays} keyboardType="number-pad"
                  placeholder="Si no lo pones, cuento desde hoy"
                  placeholderTextColor={T.steelDim}
                  style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: T.stroke,
                    backgroundColor: T.card, paddingHorizontal: 15, color: T.ink, fontSize: 13, marginBottom: 16 }} />
              </>
            )}
          </>
        )}

        <Text style={lbl}>COSTE ESTIMADO (OPCIONAL)</Text>
        <TextInput value={cost} onChangeText={setCost} keyboardType="numeric" placeholder="90"
          placeholderTextColor={T.steelDim}
          style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: T.stroke,
            backgroundColor: T.card, paddingHorizontal: 15, color: T.ink, fontSize: 14, marginBottom: 16 }} />

        <Text style={lbl}>NOTAS (OPCIONAL)</Text>
        <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Cualquier detalle que quieras recordar…"
          placeholderTextColor={T.steelDim}
          style={{ minHeight: 90, borderRadius: 14, borderWidth: 1, borderColor: T.stroke,
            backgroundColor: T.card, padding: 15, color: T.ink, fontSize: 14, textAlignVertical: 'top' }} />

        <Pressable onPress={save} disabled={saving || !title.trim()}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }], marginTop: 22, opacity: title.trim() ? 1 : 0.5 })}>
          <LinearGradient colors={[T.mint, '#1FC987']}
            style={{ height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...glowMint }}>
            <Text style={{ color: '#06281B', fontSize: 15, fontWeight: '700' }}>
              {saving ? 'Guardando…' : 'Guardar mantenimiento'}
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const lbl = { color: T.steelDim, fontSize: 10.5, fontWeight: '700' as const, letterSpacing: 2, marginBottom: 8, marginTop: 4 };
