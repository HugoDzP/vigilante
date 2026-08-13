// src/lib/images.ts — selección, compresión y subida de fotos
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase, DEMO_MODE } from './supabase';

export interface PickedImage {
  uri: string;          // uri local comprimida (mostrable al instante)
  remoteUrl?: string;   // url pública en Supabase Storage (si hay sesión)
  sizeLabel: string;    // "240 KB" para feedback visual
}

/** Abre galería → comprime (1280px, 70%) → sube a Storage si hay sesión */
export async function pickAndCompress(opts?: { aspect?: [number, number] }): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsEditing: !!opts?.aspect,
    aspect: opts?.aspect,
  });
  if (res.canceled) return null;

  const manipulated = await ImageManipulator.manipulateAsync(
    res.assets[0].uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  const sizeLabel = await fileSizeLabel(manipulated.uri);
  const remoteUrl = await uploadToStorage(manipulated.uri);
  return { uri: manipulated.uri, remoteUrl, sizeLabel };
}

export async function toBase64(uri: string): Promise<string> {
  const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1100 } }], {
    compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true,
  });
  return r.base64 ?? '';
}

async function fileSizeLabel(uri: string): Promise<string> {
  try {
    const blob = await (await fetch(uri)).blob();
    const b = blob.size;
    return b > 1_048_576 ? `${(b / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.round(b / 1024)} KB`;
  } catch { return ''; }
}

async function uploadToStorage(uri: string): Promise<string | undefined> {
  if (DEMO_MODE || !supabase) return undefined;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return undefined;
  const path = `${u.user.id}/${Date.now()}.jpg`;
  const blob = await (await fetch(uri)).blob();
  const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) { console.warn('upload:', error.message); return undefined; }
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
}
