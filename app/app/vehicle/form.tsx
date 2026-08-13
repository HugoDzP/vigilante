// app/vehicle/form.tsx — añadir / editar vehículo
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { T, glowMint } from '../../src/theme';
import { useVigilante } from '../../src/store';
import { pickAndCompress } from '../../src/lib/images';
import { FUELS, ecoFromSpecs, ECO_META, type Fuel, type EcoCode } from '../../src/lib/eco';
import { Card, Field, Eyebrow, EcoBadge, Segmented } from '../../src/components';

const LABEL_OPTIONS = ['Auto', 'B', 'C', 'ECO', '0'] as const;

export default function VehicleForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useVigilante();
  const editing = id ? store.vehicles.find(v => v.id === id) : undefined;

  const [photoUri, setPhotoUri] = useState(editing?.photoUri);
  const [brand, setBrand] = useState(editing?.brand ?? '');
  const [model, setModel] = useState(editing?.model ?? '');
  const [year, setYear] = useState(editing ? String(editing.year) : '');
  const [plate, setPlate] = useState(editing?.plate ?? '');
  const [km, setKm] = useState(editing ? String(editing.mileage) : '');
  const [fuel, setFuel] = useState<Fuel>(editing?.fuel ?? 'Diésel');
  const [hp, setHp] = useState(editing ? String(editing.hp) : '');
  const [bodyType, setBodyType] = useState(editing?.bodyType ?? '');
  const [labelChoice, setLabelChoice] = useState<(typeof LABEL_OPTIONS)[number]>(
    editing?.label ? (editing.label as any) : 'Auto'
  );

  const effectiveCode: EcoCode = labelChoice === 'Auto' ? ecoFromSpecs(fuel, year) : (labelChoice as EcoCode);

  const pickPhoto = async () => {
    const img = await pickAndCompress({ aspect: [16, 9] });
    if (img) setPhotoUri(img.remoteUrl ?? img.uri);
  };

  const save = () => {
    if (!brand.trim()) return;
    store.upsertVehicle({
      id: editing?.id,
      brand: brand.trim(), model: model.trim(),
      year: parseInt(year) || new Date().getFullYear(),
      plate: plate.toUpperCase().trim() || '—',
      fuel, hp: hp || '—', bodyType: bodyType.trim() || '—',
      mileage: parseInt(km) || editing?.mileage || 0,
      monthlyKm: editing?.monthlyKm ?? 0,
      health: editing?.health ?? 0.9,
      label: labelChoice === 'Auto' ? null : (labelChoice as EcoCode),
      photoUri,
    } as any);
    router.back();
  };

  return (
    <LinearGradient colors={[T.bg1, T.bg0]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 }}>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Pressable onPress={() => router.back()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card,
                borderWidth: 1, borderColor: T.stroke, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99 }}>
              <Ionicons name="chevron-back" size={14} color={T.ink2} />
              <Text style={{ color: T.ink2, fontSize: 12, fontWeight: '600' }}>Cancelar</Text>
            </Pressable>
          </View>

          <Text style={{ color: T.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.9, marginBottom: 16 }}>
            {editing ? 'Editar vehículo' : 'Añadir vehículo'}
          </Text>

          {/* Foto */}
          <Pressable onPress={pickPhoto}
            style={{ height: 160, borderRadius: 20, overflow: 'hidden', marginBottom: 16,
              borderWidth: 1, borderStyle: photoUri ? 'solid' : 'dashed',
              borderColor: 'rgba(116,138,176,0.4)', backgroundColor: '#0C1526',
              alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {photoUri ? (
              <>
                <Image source={{ uri: photoUri }} style={{ position: 'absolute', width: '100%', height: '100%' }} />
                <View style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(5,11,20,0.7)',
                  paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 }}>
                  <Text style={{ color: T.ink, fontSize: 10.5, fontWeight: '700' }}>Cambiar</Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="camera-outline" size={28} color={T.steelDim} />
                <Text style={{ color: T.steelDim, fontSize: 11.5, fontWeight: '600' }}>Añade una foto de tu coche</Text>
              </>
            )}
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Lbl>Marca</Lbl><Field value={brand} onChangeText={setBrand} placeholder="Mercedes" />
            </View>
            <View style={{ flex: 1 }}>
              <Lbl>Modelo</Lbl><Field value={model} onChangeText={setModel} placeholder="C 220d" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Lbl>Año</Lbl>
              <Field value={year} onChangeText={setYear} placeholder="2019" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Lbl>Matrícula</Lbl>
              <Field value={plate} onChangeText={setPlate} placeholder="1234 ABC" autoCapitalize="characters" />
            </View>
          </View>

          <Lbl>Kilometraje actual</Lbl>
          <Field value={km} onChangeText={setKm} placeholder="128450" keyboardType="number-pad" />

          <Lbl>Combustible</Lbl>
          <Segmented options={FUELS} value={fuel} onChange={setFuel} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 16, marginBottom: 7 }}>
            <Text style={lblStyle}>ETIQUETA AMBIENTAL</Text>
            <EcoBadge code={effectiveCode} suffix={labelChoice === 'Auto' ? ' · auto' : ''} />
          </View>
          <Segmented options={LABEL_OPTIONS} value={labelChoice} onChange={setLabelChoice} />
          <Text style={{ color: T.steelDim, fontSize: 10.5, lineHeight: 15, marginTop: 7 }}>
            «Auto» la calcula según combustible y año (normativa DGT). Casos especiales — enchufable
            con &lt;40 km de autonomía (ECO) o GLP/GNC (ECO) — selecciónala a mano.
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Lbl>Potencia (CV)</Lbl>
              <Field value={hp} onChangeText={setHp} placeholder="194" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Lbl>Carrocería</Lbl>
              <Field value={bodyType} onChangeText={setBodyType} placeholder="Berlina" />
            </View>
          </View>

          <Pressable onPress={save}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }], marginTop: 24 })}>
            <LinearGradient colors={[T.mint, '#1FC987']}
              style={{ height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...glowMint }}>
              <Text style={{ color: '#06281B', fontSize: 15, fontWeight: '700' }}>
                {editing ? 'Guardar cambios' : 'Guardar vehículo'}
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const lblStyle = {
  color: T.steelDim, fontSize: 10.5, fontWeight: '700' as const,
  letterSpacing: 2, textTransform: 'uppercase' as const,
};

function Lbl({ children }: { children: string }) {
  return <Text style={[lblStyle, { marginTop: 16, marginBottom: 7 }]}>{children}</Text>;
}
