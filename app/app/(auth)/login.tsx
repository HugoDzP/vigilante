// app/(auth)/login.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase, DEMO_MODE } from '../../src/lib/supabase';
import { T, glowMint } from '../../src/theme';
import { Field, Eyebrow } from '../../src/components';
import { useAuth } from '../_layout';

export default function Login() {
  const { enterDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    if (DEMO_MODE || !supabase) { enterDemo(); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) Alert.alert('No se pudo iniciar sesión', error.message);
  };

  return (
    <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>

        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <View style={{
            width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
            backgroundColor: T.mintDim, borderWidth: 1, borderColor: 'rgba(52,232,164,0.3)', marginBottom: 16,
          }}>
            <Ionicons name="shield-checkmark" size={36} color={T.mint} />
          </View>
          <Text style={{ color: T.ink, fontSize: 32, fontWeight: '850' as any, letterSpacing: -1 }}>Vigilante</Text>
          <Text style={{ color: T.steel, fontSize: 13, marginTop: 4 }}>Tu coche, siempre al día</Text>
        </View>

        <Eyebrow>Correo</Eyebrow>
        <Field value={email} onChangeText={setEmail} placeholder="ejemplo@email.com"
          autoCapitalize="none" keyboardType="email-address" style={{ marginTop: 7, marginBottom: 14 }} />
        <Eyebrow>Contraseña</Eyebrow>
        <Field value={pass} onChangeText={setPass} placeholder="••••••••" secureTextEntry style={{ marginTop: 7 }} />

        <Pressable onPress={signIn} disabled={busy}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }], marginTop: 22 })}>
          <LinearGradient colors={[T.mint, '#1FC987']}
            style={{ height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...glowMint }}>
            <Text style={{ color: '#06281B', fontSize: 15, fontWeight: '750' as any }}>
              {busy ? 'Entrando…' : 'Iniciar sesión'}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/register')} style={{ marginTop: 18, alignItems: 'center' }}>
          <Text style={{ color: T.ink2, fontSize: 13 }}>
            ¿Sin cuenta? <Text style={{ color: T.accent, fontWeight: '700' }}>Regístrate</Text>
          </Text>
        </Pressable>

        <Pressable onPress={enterDemo} style={{ marginTop: 28, alignItems: 'center' }}>
          <Text style={{ color: T.steelDim, fontSize: 12.5, fontWeight: '600' }}>
            {DEMO_MODE ? '🚀 Probar en modo demo (sin backend)' : 'Probar sin cuenta'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
