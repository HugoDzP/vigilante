// app/_layout.tsx — gate de auth: sesión → tabs, si no → login
import React, { useEffect, useState, createContext, useContext } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase, DEMO_MODE } from '../src/lib/supabase';
import { useVigilante } from '../src/store';
import { T } from '../src/theme';

interface AuthCtx { signedIn: boolean; demo: boolean; enterDemo: () => void; signOut: () => void; }
const Ctx = createContext<AuthCtx>({ signedIn: false, demo: false, enterDemo: () => {}, signOut: () => {} });
export const useAuth = () => useContext(Ctx);

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [demo, setDemo] = useState(false);
  const segments = useSegments();

  useEffect(() => {
    if (DEMO_MODE || !supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session); setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Con sesión real (no demo), carga el garaje real del backend una vez
  useEffect(() => {
    if (signedIn) useVigilante.getState().hydrateFromBackend();
  }, [signedIn]);

  // Redirección según estado de auth
  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    const allowed = signedIn || demo;
    if (!allowed && !inAuth) router.replace('/(auth)/login');
    if (allowed && inAuth) router.replace('/(tabs)');
  }, [ready, signedIn, demo, segments]);

  const value: AuthCtx = {
    signedIn, demo,
    enterDemo: () => setDemo(true),
    signOut: () => { setDemo(false); useVigilante.getState().resetToDemo(); supabase?.auth.signOut(); },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Ctx.Provider value={value}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg0 } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="maintenance/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="vehicle/form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </Ctx.Provider>
    </GestureHandlerRootView>
  );
}
