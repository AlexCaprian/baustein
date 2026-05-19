import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useColorScheme } from 'nativewind';

const THEME_KEY = 'baustein_theme';

function saveTheme(scheme: 'light' | 'dark') {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_KEY, scheme);
  }
}

export function loadSavedTheme(): 'light' | 'dark' | null {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  }
  return null;
}
import { logout } from '../services/api';

interface AppHeaderProps {
  right?: React.ReactNode;
}

export function AppHeader({ right }: AppHeaderProps) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const isDark = colorScheme === 'dark';

  return (
    <>
      <View
        className="flex-row items-center justify-between px-5 pb-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
        style={{ paddingTop: 52, zIndex: 100, overflow: 'visible' }}
      >
        {/* Logo + Brand */}
        <View className="flex-row items-center">
          <Image
            source={require('../../assets/images/icon_logo_borda.png')}
            style={{ width: 28, height: 28, marginRight: 8 }}
            resizeMode="contain"
          />
          <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white">Baustein</Text>
        </View>

        {/* Right side */}
        <View className="flex-row items-center gap-3" style={{ overflow: 'visible' }}>
          {right}

          {/* Settings */}
          <View style={{ zIndex: 200, overflow: 'visible' }}>
            <TouchableOpacity
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
              onPress={() => setMenuOpen(p => !p)}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>

            {menuOpen && (
              <View
                className="absolute right-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 py-1"
                style={{ top: 42, minWidth: 180, zIndex: 999, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 }}
              >
                <TouchableOpacity
                  className="flex-row items-center gap-2.5 px-4 py-3"
                  onPress={() => { const next = isDark ? 'light' : 'dark'; setColorScheme(next); saveTheme(next); setMenuOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={16} color={isDark ? '#e5e7eb' : '#374151'} />
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {isDark ? 'Modo Claro' : 'Modo Escuro'}
                  </Text>
                </TouchableOpacity>

                <View className="h-px bg-gray-100 dark:bg-gray-700 mx-2" />

                <TouchableOpacity
                  className="flex-row items-center gap-2.5 px-4 py-3"
                  onPress={() => { setMenuOpen(false); setLogoutModal(true); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-out-outline" size={16} color="#ef4444" />
                  <Text className="text-sm font-medium text-red-500">Sair</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Avatar */}
          <View className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-900 items-center justify-center">
            <Text className="text-xs font-bold text-[#3b5fe0] dark:text-indigo-300">AB</Text>
          </View>
        </View>
      </View>

      {/* Logout Modal */}
      <Modal visible={logoutModal} transparent animationType="fade" onRequestClose={() => setLogoutModal(false)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <View className="items-center mb-3">
              <Ionicons name="log-out-outline" size={32} color="#ef4444" />
            </View>
            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white text-center mb-2">
              Sair da conta
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 text-center leading-5 mb-5">
              Tem certeza que deseja sair? Você precisará fazer login novamente para acessar o sistema.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setLogoutModal(false)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl bg-red-500 flex-row items-center justify-center gap-1.5"
                onPress={logout}
              >
                <Ionicons name="log-out-outline" size={16} color="#fff" />
                <Text className="text-sm font-semibold text-white">Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
