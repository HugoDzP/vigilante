// app/(auth)/register.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase, DEMO_MODE } from '../../src/lib/supabase';
import { T, glowMint } from '../../src/theme';
import { Field, Eyebrow, ScreenTitle } from '../../src/components';
import { useAuth } from '../_layout';

export default function Register() {
  const { enterDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);

  const signUp = async () => {
    if (DEMO_MODE || !supabase) { enterDemo(); return; }
    if (pass.length < 8) return Alert.alert('Contraseña corta', 'Mínimo 8 caracteres.');
    if (pass !== pass2) return Alert.alert('No coinciden', 'Revisa las contraseñas.');
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) return Alert.alert('No se pudo crear la cuenta', error.message);
    Alert.alert('¡Cuenta creada!', 'Revisa tu correo para confirmarla y luego inicia sesión.');
    router.back();
  };

  return (
    <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
        <View style={{ marginBottom: 26 }}>
          <Eyebrow>Bienvenido a Vigilante</Eyebrow>
          <ScreenTitle>Crea tu cuenta</ScreenTitle>
        </View>

        <Eyebrow>Correo</Eyebrow>
        <Field value={email} onChangeText={setEmail} placeholder="ejemplo@email.com"
          autoCapitalize="none" keyboardType="email-address" style={{ marginTop: 7, marginBottom: 14 }} />
        <Eyebrow>Contraseña</Eyebrow>
        <Field value={pass} onChangeText={setPass} placeholder="Mínimo 8 caracteres"
          secureTextEntry style={{ marginTop: 7, marginBottom: 14 }} />
        <Eyebrow>Repite la contraseña</Eyebrow>
        <Field value={pass2} onChangeText={setPass2} placeholder="••••••••" secureTextEntry style={{ marginTop: 7 }} />

        <Pressable onPress={signUp} disabled={busy}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }], marginTop: 22 })}>
          <LinearGradient colors={[T.mint, '#1FC987']}
            style={{ height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...glowMint }}>
            <Text style={{ color: '#06281B', fontSize: 15, fontWeight: '750' as any }}>
              {busy ? 'Creando…' : 'Crear cuenta'}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 18, alignItems: 'center' }}>
          <Text style={{ color: T.ink2, fontSize: 13 }}>
            ¿Ya tienes cuenta? <Text style={{ color: T.accent, fontWeight: '700' }}>Inicia sesión</Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
