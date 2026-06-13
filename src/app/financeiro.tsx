import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { AppHeader } from '@/components/layout/app-header';

const FUNCIONALIDADES = [
  {
    icon: 'bar-chart-outline',
    title: 'Gerar relatórios',
    description: 'Relatórios financeiros consolidados por período, empresa e grupo.',
  },
  {
    icon: 'swap-horizontal-outline',
    title: 'Contas a pagar/receber',
    description: 'Controle de obrigações e recebíveis, com vencimentos e status.',
  },
  {
    icon: 'trending-up-outline',
    title: 'Fluxo de caixa',
    description: 'Acompanhamento de entradas e saídas e projeção de saldo.',
  },
  {
    icon: 'sync-outline',
    title: 'Conciliação bancária',
    description: 'Comparação entre lançamentos internos e extratos bancários.',
  },
  {
    icon: 'receipt-outline',
    title: 'Emissão de notas e DRE',
    description: 'Emissão de notas fiscais e demonstrativo de resultado do exercício.',
  },
] as const;

export default function FinanceiroScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const params = useLocalSearchParams<{ empresaId: string; empresaName: string; grupoId: string }>();

  return (
    <View className="flex-1 bg-slate-100 dark:bg-gray-950">
      <AppHeader />

      <ScrollView contentContainerStyle={{ padding: isMobile ? 16 : 24, paddingTop: isMobile ? 20 : 28 }}>
        <View style={{ width: '100%', maxWidth: 900, alignSelf: 'center' }}>

          {/* Título + back */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/hub' as any, params: { empresaId: params.empresaId, empresaName: params.empresaName, grupoId: params.grupoId } })}
              style={{ padding: 6, borderRadius: 8, backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#fff' : '#1e2d6e' }}>
              Financeiro
            </Text>
          </View>

          {/* Aviso de módulo em desenvolvimento */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: isDark ? '#052e16' : '#f0fdf4',
            borderWidth: 1, borderColor: isDark ? '#166534' : '#bbf7d0',
            borderRadius: 10, padding: 14, marginBottom: 20,
          }}>
            <Ionicons name="construct-outline" size={20} color="#16a34a" />
            <Text style={{ flex: 1, fontSize: 13, color: isDark ? '#bbf7d0' : '#15803d' }}>
              Módulo em desenvolvimento. Em breve as funcionalidades abaixo estarão disponíveis.
            </Text>
          </View>

          {/* Lista de funcionalidades planejadas */}
          <View style={{ gap: 12 }}>
            {FUNCIONALIDADES.map((f) => (
              <View
                key={f.title}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  backgroundColor: isDark ? '#1C1F2E' : '#fff',
                  borderWidth: 1, borderColor: isDark ? '#374151' : '#e2e5ea',
                  borderRadius: 12, padding: 16,
                }}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: isDark ? '#052e16' : '#dcfce7',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={f.icon as any} size={22} color="#16a34a" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#fff' : '#1e2d6e' }}>
                    {f.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>
                    {f.description}
                  </Text>
                </View>
                <View style={{
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                  backgroundColor: isDark ? '#374151' : '#f1f5f9',
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280' }}>
                    Em breve
                  </Text>
                </View>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
