import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { api, setToken, setPerfil, setNome, setEmpresaId } from '../services/api';
import { LoadingOverlay } from '@/components/ui/loading-overlay';

function friendlyError(raw: string): string {
  if (raw === 'NETWORK_ERROR')
    return 'Não foi possível conectar ao servidor. Verifique sua conexão ou tente mais tarde.';
  if (raw.toLowerCase().includes('usuário ou senha'))
    return 'Usuário ou senha incorretos. Verifique seus dados e tente novamente.';
  if (raw.toLowerCase().includes('informe'))
    return 'Preencha todos os campos antes de continuar.';
  return 'Ocorreu um erro inesperado. Tente novamente em instantes.';
}

export default function LoginScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [lembre, setLembre] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [campoErro, setCampoErro] = useState<'usuario' | 'senha' | null>(null);

  const handleLogin = async () => {
    if (!usuario.trim()) {
      setCampoErro('usuario');
      setErro('Informe seu usuário.');
      return;
    }
    if (!password.trim()) {
      setCampoErro('senha');
      setErro('Informe sua senha.');
      return;
    }
    setCampoErro(null);
    setErro('');
    setLoading(true);
    try {
      const res = await api.login(usuario.trim(), password);
      setToken(res.token);
      setPerfil(res.perfil);
      setNome(res.nome);
      setEmpresaId(res.empresa_id);
      router.replace(res.redirect as any);
    } catch (e: any) {
      setErro(friendlyError(e.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const ph = isDark ? '#4b5563' : '#aaa';

  const inputBase = `flex-1 h-12 px-3.5 text-base text-gray-800 dark:text-gray-100`;
  const wrapperBase = `flex-row items-center h-12 rounded-lg border overflow-hidden bg-white dark:bg-gray-900`;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-100 dark:bg-gray-950 justify-center items-center p-5"
    >
      <View className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800" style={{ maxWidth: 380, padding: isMobile ? 20 : 32 }}>

        {/* Logo */}
        <View className="flex-row items-center justify-center gap-2 mb-7">
          <Image
            source={require('../../assets/images/icon_logo_borda.png')}
            style={{ width: 42, height: 42, marginRight: 8 }}
            resizeMode="contain"
          />
          <Text className="text-2xl font-bold text-[#1e2d6e] dark:text-white" style={{ letterSpacing: -0.3 }}>
            Baustein
          </Text>
        </View>

        {/* Usuário */}
        <View className="mb-4">
          <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Usuário</Text>
          <View className={`${wrapperBase} ${campoErro === 'usuario' ? 'border-red-400 bg-red-50 dark:bg-red-950/30' : 'border-gray-300 dark:border-gray-700 border-t-gray-400 dark:border-t-gray-600'}`}>
            <TextInput
              className={inputBase}
              style={{ outline: 'none' } as any}
              autoCapitalize="none"
              keyboardType="email-address"
              value={usuario}
              onChangeText={(v) => { setUsuario(v); if (campoErro === 'usuario') { setCampoErro(null); setErro(''); } }}
              placeholderTextColor={ph}
              underlineColorAndroid="transparent"
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Senha */}
        <View className="mb-4">
          <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Senha</Text>
          <View className={`${wrapperBase} ${campoErro === 'senha' ? 'border-red-400 bg-red-50 dark:bg-red-950/30' : 'border-gray-300 dark:border-gray-700'}`}>
            <TextInput
              className={inputBase}
              style={{ outline: 'none' } as any}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(v) => { setPassword(v); if (campoErro === 'senha') { setCampoErro(null); setErro(''); } }}
              placeholderTextColor={ph}
              underlineColorAndroid="transparent"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              className="px-3 h-12 justify-center items-center"
              onPress={() => setShowPassword(v => !v)}
              activeOpacity={0.6}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={isDark ? '#6b7280' : '#888'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Erro */}
        {erro ? (
          <View className="flex-row items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2.5 mb-3">
            <Ionicons name="alert-circle-outline" size={15} color="#dc2626" />
            <Text className="flex-1 text-xs text-red-600 dark:text-red-400 leading-5">{erro}</Text>
          </View>
        ) : null}

        {/* Lembre de mim */}
        <TouchableOpacity
          className="flex-row items-center gap-2 mb-6 mt-1"
          onPress={() => setLembre(!lembre)}
          activeOpacity={0.7}
        >
          <View className={`w-4 h-4 rounded-sm border-2 items-center justify-center ${lembre ? 'bg-[#3b5fe0] border-[#3b5fe0]' : 'border-gray-300 dark:border-gray-600'}`}>
            {lembre && <Text className="text-white text-xs font-bold" style={{ lineHeight: 13 }}>✓</Text>}
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-400">Lembre de mim</Text>
        </TouchableOpacity>

        {/* Botão */}
        <TouchableOpacity
          className={`bg-[#3b5fe0] rounded-lg h-11 items-center justify-center ${loading ? 'opacity-60' : ''}`}
          activeOpacity={0.85}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text className="text-white text-base font-semibold">Entrar</Text>
        </TouchableOpacity>

      </View>
      <LoadingOverlay visible={loading} message="Autenticando" />
    </KeyboardAvoidingView>
  );
}
