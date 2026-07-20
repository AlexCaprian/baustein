import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ConfirmDeleteModalProps = {
  visible: boolean;
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  visible,
  title = 'Confirmar Exclusão',
  message,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 400 }}>
          <View className="items-center mb-4">
            <View className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 items-center justify-center mb-3">
              <Ionicons name="trash-outline" size={24} color="#ef4444" />
            </View>
            <Text className="text-lg font-bold text-gray-800 dark:text-white">{title}</Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">{message}</Text>
          </View>

          <View className="flex-row gap-2.5">
            <TouchableOpacity
              className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
              onPress={onCancel}
              disabled={loading}
            >
              <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 h-11 rounded-xl bg-red-500 items-center justify-center ${loading ? 'opacity-50' : ''}`}
              onPress={onConfirm}
              disabled={loading}
            >
              <Text className="text-sm font-semibold text-white">{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
