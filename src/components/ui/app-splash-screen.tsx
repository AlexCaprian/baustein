import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { Colors } from '@/constants/theme';

interface AppSplashScreenProps {
  visible: boolean;
  onHidden?: () => void;
}

export function AppSplashScreen({ visible, onHidden }: AppSplashScreenProps) {
  const { colorScheme } = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const opacity = useSharedValue(1);
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const ringRotation = useSharedValue(0);

  useEffect(() => {
    // Entrada: logo e texto surgem
    logoScale.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.5)) });
    logoOpacity.value = withTiming(1, { duration: 400 });
    textOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));

    // Anel girando continuamente
    ringRotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    if (!visible) {
      // Saída: fade out suave
      opacity.value = withDelay(
        100,
        withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }, (finished) => {
          if (finished && onHidden) runOnJS(onHidden)();
        })
      );
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${ringRotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background }, containerStyle]}>
      <View style={styles.center}>
        {/* Anel animado */}
        <View style={styles.ringWrapper}>
          <Animated.View
            style={[
              styles.ring,
              { borderTopColor: theme.primary, borderRightColor: theme.primary },
              ringStyle,
            ]}
          />
          {/* Logo */}
          <Animated.View style={[styles.logoWrapper, logoStyle]}>
            <Image
              source={require('@/assets/images/icon_logo_borda.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Nome do app */}
        <Animated.View style={[styles.brandRow, textStyle]}>
          <Text style={[styles.brandName, { color: theme.text }]}>Operkit</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const RING = 96;
const LOGO = 56;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 24,
  },
  ringWrapper: {
    width: RING,
    height: RING,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  logoWrapper: {
    width: LOGO,
    height: LOGO,
  },
  logo: {
    width: LOGO,
    height: LOGO,
  },
  brandRow: {
    alignItems: 'center',
    gap: 4,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
