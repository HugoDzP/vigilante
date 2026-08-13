// app/(auth)/_layout.tsx — layout del grupo de autenticación (login/register)
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
