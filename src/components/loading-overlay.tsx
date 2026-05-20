import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

const RING_SIZE = 92;
const LOGO_SIZE = 54;
const DOT_CYCLE = 1200;
const DOT_STEP = DOT_CYCLE / 3;
const DOT_ACTIVE_MS = 350;

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

function Dot({ shared }: { shared: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: shared.value }));
  const theme = useTheme();
  return (
    <Animated.Text style={[styles.dot, { color: theme.textSecondary }, style]}>
      .
    </Animated.Text>
  );
}

export function LoadingOverlay({ visible, message = 'Carregando' }: LoadingOverlayProps) {
  const theme = useTheme();
  const rotation = useSharedValue(0);
  const dot1 = useSharedValue(0.2);
  const dot2 = useSharedValue(0.2);
  const dot3 = useSharedValue(0.2);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );

    const animateDot = (sv: typeof dot1, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: DOT_ACTIVE_MS }),
            withTiming(0.2, { duration: DOT_ACTIVE_MS }),
            withDelay(DOT_CYCLE - DOT_ACTIVE_MS * 2, withTiming(0.2, { duration: 0 }))
          ),
          -1
        )
      );
    };

    animateDot(dot1, 0);
    animateDot(dot2, DOT_STEP);
    animateDot(dot3, DOT_STEP * 2);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View
        style={[
          styles.card,
          Platform.select({
            web: { backgroundColor: 'rgba(255,255,255,0.07)' } as object,
            default: { backgroundColor: theme.backgroundElement + 'EE' },
          }),
        ]}
      >
        <View style={styles.ringContainer}>
          <Animated.View
            style={[
              styles.ring,
              {
                borderTopColor: theme.primary,
                borderRightColor: theme.primary,
              },
              ringStyle,
            ]}
          />
          <Image
            style={styles.logo}
            source={require('@/assets/images/icon_logo_borda.png')}
            contentFit="contain"
          />
        </View>

        <View style={styles.textRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
          <Dot shared={dot1} />
          <Dot shared={dot2} />
          <Dot shared={dot3} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      },
    }),
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  dot: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
    marginLeft: 2,
  },
});
