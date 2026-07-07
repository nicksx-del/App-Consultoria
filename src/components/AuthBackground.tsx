import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function AuthBackground() {
  const driftA = useRef(new Animated.Value(0)).current;
  const driftB = useRef(new Animated.Value(0)).current;
  const driftC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createLoop = (value: Animated.Value, duration: number) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      );

      loop.start();
      return loop;
    };

    const loopA = createLoop(driftA, 14000);
    const loopB = createLoop(driftB, 18000);
    const loopC = createLoop(driftC, 22000);

    return () => {
      loopA.stop();
      loopB.stop();
      loopC.stop();
    };
  }, [driftA, driftB, driftC]);

  const orbStyle = (
    value: Animated.Value,
    translateX: number,
    translateY: number,
    scale: number,
    opacity: number,
  ) => ({
    opacity,
    transform: [
      {
        translateX: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0, translateX],
        }),
      },
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0, translateY],
        }),
      },
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [1, scale],
        }),
      },
    ],
  });

  return (
    <View style={styles.background} pointerEvents="none">
      <LinearGradient
        colors={['#040503', '#050705', '#070A06', '#040503']}
        locations={[0, 0.36, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[styles.orb, styles.orbLeft, orbStyle(driftA, 56, 30, 1.08, 0.82)]}
      />
      <Animated.View
        style={[styles.orb, styles.orbRight, orbStyle(driftB, -40, 36, 1.12, 0.58)]}
      />
      <Animated.View
        style={[styles.orb, styles.orbTop, orbStyle(driftC, 18, 22, 1.05, 0.5)]}
      />

      <View style={styles.topWash} />
      <View style={styles.bottomWash} />
      <View style={styles.matte} />
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(156, 240, 46, 0.12)',
    boxShadow: '0 0 90px rgba(156, 240, 46, 0.25)',
  },
  orbLeft: {
    width: 460,
    height: 460,
    left: -210,
    top: 70,
  },
  orbRight: {
    width: 520,
    height: 520,
    right: -230,
    top: 40,
    backgroundColor: 'rgba(54, 176, 88, 0.1)',
  },
  orbTop: {
    width: 250,
    height: 250,
    top: -80,
    left: '40%',
    backgroundColor: 'rgba(147, 240, 44, 0.1)',
  },
  topWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 170,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  bottomWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  matte: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
});
