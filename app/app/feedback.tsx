// app/feedback.tsx — feedback de testers durante la beta
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { T, glowMint } from '../src/theme';
import { sync, HAS_BACKEND } from '../src/lib/api';
import { Eyebrow, ScreenTitle } from '../src/components';

const CATEGORIES = [
  { key: 'bug', label: 'Un fallo', icon: 'bug-outline' as const, color: T.danger },
  { key: 'idea', label: 'Una idea', icon: 'bulb-outline' as const, color: T.mint },
  { key: 'other', label: 'Otro comentario', icon: 'chatbubble-ellipses-outline' as const, color: T.accent },
];

export default function Feedback() {
  const [category, setCategory] = useState<'bug' | 'idea' | 'other'>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    if (!HAS_BACKEND) {
      Alert.alert('Sin conexión al servidor', 'El feedback se guarda en el backend, que aún no está configurado en esta build.');
      return;
    }
    setSending(true);
    try {
      await sync.sendFeedback({
        category, message: message.trim(),
        appVersion: Constants.expoConfig?.version,
        platform: Platform.OS,
      });
      setSent(true);
      setTimeout(() => router.back(), 1200);
    } catch (e) {
      Alert.alert('No se pudo enviar', 'Inténtalo de nuevo en un momento.');
    } finally {
      setSending(false);
    }
  };

  return (
    <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}>
          <Pressable onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card,
              borderWidth: 1, borderColor: T.stroke, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99 }}>
            <Ionicons name="chevron-back" size={14} color={T.ink2} />
            <Text style={{ color: T.ink2, fontSize: 12, fontWeight: '600' }}>Volver</Text>
          </Pressable>
        </View>

        <Eyebrow>Beta de Vigilante</Eyebrow>
        <ScreenTitle>Cuéntame qué tal</ScreenTitle>
        <Text style={{ color: T.steel, fontSize: 13, marginTop: 8, marginBottom: 20, lineHeight: 19 }}>
          Cualquier fallo, idea o comentario me ayuda muchísimo mientras pulo la app.
        </Text>

        <Text style={{ color: T.steelDim, fontSize: 10.5, fontWeight: '700', letterSpacing: 2, marginBottom: 10 }}>
          TIPO
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {CATEGORIES.map(c => {
            const on = category === c.key;
            return (
              <Pressable key={c.key} onPress={() => setCategory(c.key as any)}
                style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 16,
                  backgroundColor: on ? `${c.color}22` : T.card,
                  borderWidth: 1, borderColor: on ? c.color : T.stroke }}>
                <Ionicons name={c.icon} size={20} color={on ? c.color : T.steel} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: on ? T.ink : T.steel, textAlign: 'center' }}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ color: T.steelDim, fontSize: 10.5, fontWeight: '700', letterSpacing: 2, marginBottom: 10 }}>
          MENSAJE
        </Text>
        <TextInput
          value={message} onChangeText={setMessage} multiline
          placeholder="Cuenta con el detalle que quieras…"
          placeholderTextColor={T.steelDim}
          style={{ minHeight: 140, borderRadius: 16, borderWidth: 1, borderColor: T.stroke,
            backgroundColor: T.card, padding: 15, color: T.ink, fontSize: 14, textAlignVertical: 'top' }}
        />

        <Pressable onPress={send} disabled={sending || sent || !message.trim()}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }], marginTop: 20, opacity: message.trim() ? 1 : 0.5 })}>
          <LinearGradient colors={sent ? [T.card, T.card] : [T.mint, '#1FC987']}
            style={{ height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8, ...(sent ? {} : glowMint) }}>
            {sending ? <ActivityIndicator color="#06281B" /> : sent ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color={T.mint} />
                <Text style={{ color: T.mint, fontSize: 15, fontWeight: '700' }}>¡Enviado, gracias!</Text>
              </>
            ) : (
              <Text style={{ color: '#06281B', fontSize: 15, fontWeight: '700' }}>Enviar</Text>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}
