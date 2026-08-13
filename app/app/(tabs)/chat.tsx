// app/(tabs)/chat.tsx — registro conversacional + OCR de facturas
import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { T, glowMint } from '../../src/theme';
import { useVigilante } from '../../src/store';
import { parseText, parseInvoice, HAS_BACKEND, sync } from '../../src/lib/api';
import { pickAndCompress, toBase64 } from '../../src/lib/images';
import { Card, Eyebrow, ScreenTitle, EmptyGarage } from '../../src/components';

type Msg =
  | { id: string; kind: 'text'; text: string; isUser: boolean }
  | { id: string; kind: 'photo'; uri: string; scanning?: boolean }
  | { id: string; kind: 'confirm'; title: string; rows: [string, string][]; source?: string }
  | { id: string; kind: 'typing' };

let seq = 0;
const mid = () => `m${++seq}`;

export default function Chat() {
  const store = useVigilante();
  const car = store.currentVehicle();
  const list = useRef<FlatList>(null);
  const [draft, setDraft] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: mid(), kind: 'text', isUser: false,
      text: `Hola Hugo 👋 Cuéntame qué le has hecho al ${car?.short ?? 'tu coche'}, o sube una foto de la factura 🧾 y saco los datos.` },
  ]);

  if (!car) {
    return (
      <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
        <EmptyGarage message="Añade tu primer vehículo para empezar a registrar mantenimientos por chat." />
      </LinearGradient>
    );
  }

  const push = (m: Msg) => setMsgs(prev => [...prev, m]);
  const replaceTyping = (ms: Msg[]) => setMsgs(prev => [...prev.filter(m => m.kind !== 'typing'), ...ms]);
  const scrollEnd = () => setTimeout(() => list.current?.scrollToEnd({ animated: true }), 80);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    push({ id: mid(), kind: 'text', text, isUser: true });
    push({ id: mid(), kind: 'typing' });
    scrollEnd();

    const p = await parseText(text, car.mileage);
    const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    replaceTyping([
      { id: mid(), kind: 'confirm', title: p.title,
        rows: [['Fecha', today], ['Kilómetros', `${p.km} km`], ['Coste', p.cost], ['Próximo', p.next]] },
      { id: mid(), kind: 'text', isUser: false,
        text: `¡Apuntado en el ${car.short}! ✅ Si tienes el ticket, súbelo con la cámara — es opcional pero te servirá para garantías. 📷` },
    ]);
    store.addLog({
      vehicleId: car.id, emoji: '🔧', title: p.title,
      dateLabel: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      monthKey: capMonth(), mileage: car.mileage, place: '—',
      cost: parseFloat(p.cost.replace(',', '.')) || 0, photos: [],
    });
    if (HAS_BACKEND) sync.pushLog({ vehicleId: car.id, title: p.title }).catch(() => {});
    scrollEnd();
  };

  const attachInvoice = async () => {
    const img = await pickAndCompress();
    if (!img) return;
    const photoId = mid();
    push({ id: photoId, kind: 'photo', uri: img.uri, scanning: HAS_BACKEND });
    scrollEnd();

    if (!HAS_BACKEND) {
      push({ id: mid(), kind: 'text', isUser: false,
        text: `📷 Foto guardada (${img.sizeLabel}). El OCR automático se activa al conectar el backend — de momento, cuéntame los datos y los apunto.` });
      scrollEnd();
      return;
    }

    try {
      const data = await parseInvoice(await toBase64(img.uri));
      setMsgs(prev => prev.map(m => (m.id === photoId && m.kind === 'photo' ? { ...m, scanning: false } : m)));
      if (data) {
        push({ id: mid(), kind: 'confirm', title: data.title, source: '🧾 Extraído de la factura · revisa los datos',
          rows: [['Fecha', data.date], ['Coste', data.cost], ['Kilómetros', data.km],
                 ['Taller', data.workshop ?? '—']] });
        push({ id: mid(), kind: 'text', isUser: false, text: '¿Todo correcto? Lo guardo con la factura adjunta. ✅' });
      }
    } catch {
      setMsgs(prev => prev.map(m => (m.id === photoId && m.kind === 'photo' ? { ...m, scanning: false } : m)));
      push({ id: mid(), kind: 'text', isUser: false,
        text: 'No pude leer la factura (¿servidor dormido?). Cuéntame los datos y los apunto a mano. 🙂' });
    }
    scrollEnd();
  };

  const render = ({ item }: { item: Msg }) => {
    if (item.kind === 'typing') return <TypingDots />;
    if (item.kind === 'photo') {
      return (
        <Animated.View entering={FadeInUp.duration(350)} style={{ alignSelf: 'flex-end' }}>
          <Card style={{ padding: 5, borderRadius: 20 }}>
            <Image source={{ uri: item.uri }} style={{ width: 150, height: 106, borderRadius: 15 }} />
            {item.scanning && (
              <View style={{ position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderRadius: 15,
                backgroundColor: 'rgba(5,11,20,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: T.mint, fontSize: 11, fontWeight: '700' }}>🔍 Analizando…</Text>
              </View>
            )}
          </Card>
        </Animated.View>
      );
    }
    if (item.kind === 'confirm') {
      return (
        <Animated.View entering={FadeInUp.duration(400)} style={{ alignSelf: 'flex-start', width: '90%' }}>
          <Card style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: T.mintDim,
                alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark" size={16} color={T.mint} />
              </View>
              <Text style={{ color: T.ink, fontSize: 14, fontWeight: '700' }}>{item.title}</Text>
            </View>
            {item.rows.map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ color: T.steel, fontSize: 12.5 }}>{k}</Text>
                <Text style={{ color: T.ink, fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{v}</Text>
              </View>
            ))}
            {item.source && (
              <Text style={{ color: T.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 10 }}>
                {item.source.toUpperCase()}
              </Text>
            )}
          </Card>
        </Animated.View>
      );
    }
    return (
      <Animated.View entering={FadeInUp.duration(350)}
        style={{ alignSelf: item.isUser ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
        {item.isUser ? (
          <LinearGradient colors={['#2563EB', '#1D4ED8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 15, paddingVertical: 11, borderRadius: 20, borderBottomRightRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>{item.text}</Text>
          </LinearGradient>
        ) : (
          <View style={{ backgroundColor: T.card, borderWidth: 1, borderColor: T.stroke,
            paddingHorizontal: 15, paddingVertical: 11, borderRadius: 20, borderBottomLeftRadius: 6 }}>
            <Text style={{ color: T.ink2, fontSize: 14, lineHeight: 20 }}>{item.text}</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList ref={list} data={msgs} keyExtractor={m => m.id} renderItem={render}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 64, paddingBottom: 170, gap: 12 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 6 }}>
              <Eyebrow>Texto, voz o foto de factura</Eyebrow>
              <ScreenTitle>Cuéntale a Vigilante</ScreenTitle>
            </View>
          }
          showsVerticalScrollIndicator={false} />

        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 96,
          flexDirection: 'row', gap: 9, alignItems: 'center' }}>
          <Pressable onPress={attachInvoice}
            style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: T.stroke,
              backgroundColor: 'rgba(13,21,37,0.88)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="camera-outline" size={20} color={T.steel} />
          </Pressable>
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={send}
            placeholder="Escribe un mantenimiento…" placeholderTextColor={T.steelDim} returnKeyType="send"
            style={{ flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: T.stroke,
              backgroundColor: 'rgba(13,21,37,0.88)', paddingHorizontal: 18, color: T.ink, fontSize: 14 }} />
          <Pressable onPress={send} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}>
            <LinearGradient colors={[T.mint, '#1FC987']}
              style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', ...glowMint }}>
              <Ionicons name="arrow-up" size={20} color="#06281B" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function TypingDots() {
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 5, backgroundColor: T.card,
      borderWidth: 1, borderColor: T.stroke, paddingHorizontal: 16, paddingVertical: 14,
      borderRadius: 20, borderBottomLeftRadius: 6 }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: T.steel, opacity: 0.6 }} />
      ))}
    </View>
  );
}

function capMonth() {
  const s = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
