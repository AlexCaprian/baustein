import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import React, { useEffect } from 'react';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useColorScheme as useRNColorScheme, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Colors } from '@/constants/theme';
import { getToken } from '../services/api';
import { loadSavedTheme } from '../components/app-header';

const PUBLIC_ROUTES = ['index'];

function ThemeInitializer() {
  const { setColorScheme } = useColorScheme();
  useEffect(() => {
    const saved = loadSavedTheme();
    if (saved) setColorScheme(saved);
  }, []);
  return null;
}

function AuthGuard() {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const current = segments[0] ?? 'index';
    const isPublic = PUBLIC_ROUTES.includes(current as string);
    const hasToken = !!getToken();

    if (!isPublic && !hasToken) {
      router.replace('/' as any);
    }
  }, [segments, router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useRNColorScheme();
  return (
    <View style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background }}>
      <Head>
        <title>Baustein</title>
      </Head>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <ThemeInitializer />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="select-empresa" />
          <Stack.Screen name="hub" />
          <Stack.Screen name="funcionarios" />
        </Stack>
        <AuthGuard />
      </ThemeProvider>
    </View>
  );
}
