// app/(tabs)/settings.tsx — notificaciones, talleres favoritos (Places) y cuenta
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { T } from '../../src/theme';
import { useVigilante } from '../../src/store';
import { requestNotifPermission, sendDemoNotification, scheduleMileageAsk } from '../../src/lib/notifications';
import { searchPlaces, HAS_BACKEND, sync, type PlaceResult } from '../../src/lib/api';
import { DEMO_MODE } from '../../src/lib/supabase';
import { Card, Eyebrow, ScreenTitle, Field } from '../../src/components';
import { useAuth } from '../_layout';

export default function Settings() {
  const store = useVigilante();
  const { signOut, demo } = useAuth();
  const [notifOn, setNotifOn] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [placesError, setPlacesError] = useState<'not_configured' | 'other' | null>(null);
  const [manual, setManual] = useState({ name: '', address: '', phone: '' });
  const [leadKmDraft, setLeadKmDraft] = useState(String(store.reminderLeadKm));
  const [leadDaysDraft, setLeadDaysDraft] = useState(String(store.reminderLeadDays));
  const [savedThresholds, setSavedThresholds] = useState(false);

  const saveThresholds = async () => {
    await store.updatePreferences({
      reminderLeadKm: parseInt(leadKmDraft) || store.reminderLeadKm,
      reminderLeadDays: parseInt(leadDaysDraft) || store.reminderLeadDays,
    });
    setSavedThresholds(true);
    setTimeout(() => setSavedThresholds(false), 1800);
  };
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteAccount = () => {
    Alert.alert(
      '¿Eliminar tu cuenta?',
      'Se borrarán tus vehículos, mantenimientos, fotos e historial de forma permanente. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: doDeleteAccount },
      ],
    );
  };

  const doDeleteAccount = async () => {
    if (demo || !HAS_BACKEND) {
      signOut();
      return;
    }
    setDeleting(true);
    try {
      await sync.deleteAccount();
      signOut();
    } catch (e) {
      Alert.alert('No se pudo eliminar', 'Inténtalo de nuevo en un momento, o escríbenos desde Feedback.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleNotif = async (v: boolean) => {
    if (v) {
      const ok = await requestNotifPermission();
      if (!ok) return Alert.alert('Permiso denegado', 'Actívalo en Ajustes del sistema.');
      setNotifOn(true);
      await scheduleMileageAsk(store.currentVehicle()?.short ?? 'tu coche');
      await sendDemoNotification();
      Alert.alert('Activadas 🔔', 'Te llega una notificación de ejemplo en 3 segundos.');
    } else setNotifOn(false);
  };

  const search = async (q: string) => {
    setQuery(q);
    setPlacesError(null);
    if (q.length < 3 || !HAS_BACKEND || demo) { setResults([]); return; }
    try {
      setResults(await searchPlaces(q));
    } catch (e: any) {
      setResults([]);
      setPlacesError(e?.message === 'not_configured' ? 'not_configured' : 'other');
    }
  };

  const addFromPlace = (p: PlaceResult) => {
    store.addWorkshop({ name: p.name, address: p.address, phone: p.phone ?? '—', notes: 'Añadido desde Google Places' });
    resetAdd();
  };
  const addManual = () => {
    if (!manual.name.trim()) return;
    store.addWorkshop({ ...manual, name: manual.name.trim(), notes: 'Añadido a mano' });
    resetAdd();
  };
  const resetAdd = () => { setAdding(false); setQuery(''); setResults([]); setPlacesError(null); setManual({ name: '', address: '', phone: '' }); };

  return (
    <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 64, paddingBottom: 28 }}>

        <Animated.View entering={FadeInUp.duration(500)}>
          <Eyebrow>Configuración</Eyebrow>
          <ScreenTitle>Ajustes</ScreenTitle>
        </Animated.View>

        <SectionLabel>Recordatorios</SectionLabel>
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <Row icon="🔔" iconBg={T.mintDim} title="Notificaciones push"
            sub="Avisos por km o fecha + pregunta de kilometraje cada 2 semanas"
            right={<Switch value={notifOn} onValueChange={toggleNotif}
              trackColor={{ true: T.mint, false: 'rgba(116,138,176,0.25)' }} thumbColor="#fff" />} />

          <View style={{ height: 1, backgroundColor: T.stroke, marginVertical: 14 }} />

          <Text style={{ color: T.steel, fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
            Cuándo avisarte de un mantenimiento próximo:
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.steelDim, fontSize: 10.5, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
                A CUÁNTOS KM
              </Text>
              <Field value={leadKmDraft} onChangeText={setLeadKmDraft} keyboardType="number-pad" placeholder="1000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.steelDim, fontSize: 10.5, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
                A CUÁNTOS DÍAS
              </Text>
              <Field value={leadDaysDraft} onChangeText={setLeadDaysDraft} keyboardType="number-pad" placeholder="60" />
            </View>
          </View>
          <Pressable onPress={saveThresholds}
            style={{ marginTop: 12, height: 40, borderRadius: 12, backgroundColor: T.mintDim,
              alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: T.mint, fontSize: 12.5, fontWeight: '700' }}>
              {savedThresholds ? '✓ Guardado' : 'Guardar umbrales'}
            </Text>
          </Pressable>
        </Card>

        <SectionLabel>Talleres favoritos · {store.workshops.length} guardados</SectionLabel>
        {store.workshops.map(w => (
          <Card key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 9 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.amberDim,
              alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 17 }}>🔧</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.ink, fontSize: 13.5, fontWeight: '600' }}>{w.name}</Text>
              <Text style={{ color: T.steel, fontSize: 11.5, marginTop: 2 }}>{w.address} · {w.phone}</Text>
              <Text style={{ color: T.steelDim, fontSize: 11.5 }}>{w.notes}</Text>
            </View>
            <Pressable onPress={() => store.removeWorkshop(w.id)} style={{ padding: 6 }}>
              <Ionicons name="close" size={16} color={T.steelDim} />
            </Pressable>
          </Card>
        ))}

        {!adding ? (
          <Pressable onPress={() => setAdding(true)}
            style={{ height: 46, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed',
              borderColor: 'rgba(116,138,176,0.35)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: T.steelDim, fontSize: 12.5, fontWeight: '600' }}>＋ Añadir taller</Text>
          </Pressable>
        ) : (
          <Card style={{ padding: 14, gap: 10 }}>
            {HAS_BACKEND && !demo && placesError !== 'not_configured' ? (
              <>
                <Field value={query} onChangeText={search} placeholder="Busca en Google Maps: «taller Toledo»…" />
                {results.map(p => (
                  <Pressable key={p.placeId} onPress={() => addFromPlace(p)}
                    style={{ paddingVertical: 9, borderBottomWidth: 1, borderColor: T.stroke }}>
                    <Text style={{ color: T.ink, fontSize: 13, fontWeight: '600' }}>{p.name}</Text>
                    <Text style={{ color: T.steel, fontSize: 11.5 }}>{p.address}</Text>
                  </Pressable>
                ))}
                {query.length >= 3 && results.length === 0 && !placesError && (
                  <Text style={{ color: T.steelDim, fontSize: 11.5 }}>Sin resultados…</Text>
                )}
                {placesError === 'other' && (
                  <Text style={{ color: T.steelDim, fontSize: 11.5 }}>No se pudo buscar ahora mismo. Inténtalo de nuevo.</Text>
                )}
              </>
            ) : (
              <>
                <Text style={{ color: T.steelDim, fontSize: 11.5, lineHeight: 17 }}>
                  {placesError === 'not_configured'
                    ? 'La búsqueda en Google Maps aún no está activada en el servidor. De momento, añádelo a mano:'
                    : demo
                    ? 'La búsqueda en Google Maps necesita una cuenta real. De momento, añádelo a mano:'
                    : 'La búsqueda en Google Maps se activa al conectar el backend. De momento, añádelo a mano:'}
                </Text>
                <Field value={manual.name} onChangeText={t => setManual(s => ({ ...s, name: t }))} placeholder="Nombre del taller" />
                <Field value={manual.address} onChangeText={t => setManual(s => ({ ...s, address: t }))} placeholder="Dirección" />
                <Field value={manual.phone} onChangeText={t => setManual(s => ({ ...s, phone: t }))}
                  placeholder="Teléfono" keyboardType="phone-pad" />
                <Pressable onPress={addManual}
                  style={{ height: 44, borderRadius: 14, backgroundColor: T.mint,
                    alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#06281B', fontSize: 13, fontWeight: '700' }}>Guardar taller</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={resetAdd} style={{ alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ color: T.steelDim, fontSize: 12, fontWeight: '600' }}>Cancelar</Text>
            </Pressable>
          </Card>
        )}

        <SectionLabel>Cuenta</SectionLabel>
        <Card style={{ padding: 16 }}>
          <Row icon="☁️" iconBg="rgba(77,141,255,0.12)"
            title={DEMO_MODE ? 'Modo demo' : demo ? 'Sesión de invitado' : 'Sincronizado con la nube'}
            sub={DEMO_MODE ? 'Configura .env para activar cuentas y nube' : 'Tus datos viajan contigo'}
            right={
              <Pressable onPress={signOut} style={{ paddingHorizontal: 12, paddingVertical: 7,
                borderRadius: 99, backgroundColor: T.dangerDim }}>
                <Text style={{ color: T.danger, fontSize: 11.5, fontWeight: '700' }}>Salir</Text>
              </Pressable>
            } />
        </Card>
        <Pressable onPress={confirmDeleteAccount} disabled={deleting} style={{ marginTop: 10 }}>
          <Card style={{ padding: 14, alignItems: 'center' }}>
            <Text style={{ color: T.danger, fontSize: 12.5, fontWeight: '700' }}>
              {deleting ? 'Eliminando…' : 'Eliminar mi cuenta y todos mis datos'}
            </Text>
          </Card>
        </Pressable>

        <SectionLabel>Beta</SectionLabel>
        <Pressable onPress={() => router.push('/feedback')}>
          <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: T.mintDim,
              alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 17 }}>💬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.ink, fontSize: 14, fontWeight: '700' }}>Enviar feedback</Text>
              <Text style={{ color: T.steel, fontSize: 11.5, marginTop: 1 }}>Fallos, ideas o cualquier comentario</Text>
            </View>
            <Text style={{ color: T.steelDim, fontSize: 15 }}>›</Text>
          </Card>
        </Pressable>

        <SectionLabel>Acerca de</SectionLabel>
        <Card style={{ padding: 16, gap: 12 }}>
          <AboutRow label="App" value={Constants.expoConfig?.name ?? 'Vigilante'} />
          <AboutRow label="Versión" value={Constants.expoConfig?.version ?? '1.0.0'} />
          <AboutRow label="Fecha de versión" value="Agosto 2026" />
          <AboutRow label="Licencia" value="Privada" />
        </Card>
      </ScrollView>
    </LinearGradient>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <Text style={{ color: T.steel, fontSize: 12.5, flexShrink: 0 }}>{label}</Text>
      <Text style={{ color: T.ink, fontSize: 12.5, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: T.ink, fontSize: 13, fontWeight: '700', marginTop: 22, marginBottom: 10 }}>{children}</Text>;
}

function Row({ icon, iconBg, title, sub, right }: {
  icon: string; iconBg: string; title: string; sub: string; right?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: iconBg,
        alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 17 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.ink, fontSize: 14, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: T.steel, fontSize: 11.5, marginTop: 1, lineHeight: 16 }}>{sub}</Text>
      </View>
      {right}
    </View>
  );
}
