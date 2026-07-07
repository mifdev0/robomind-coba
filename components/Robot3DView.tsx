import React, { useEffect } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

export default function Robot3DView() {
  // --- REANIMATED SHARED VALUES ---
  const robotY = useSharedValue(0);
  const robotScaleX = useSharedValue(1);
  const robotScaleY = useSharedValue(1);
  const headRotation = useSharedValue(0);
  const leftArmRotation = useSharedValue(10);
  const rightArmRotation = useSharedValue(-10);
  const eyeBlink = useSharedValue(1);
  const corePulse = useSharedValue(1);

  // Background Cloud X Translation Positions
  const cloud1X = useSharedValue(-60);
  const cloud2X = useSharedValue(-120);
  const cloud3X = useSharedValue(-200);

  // Hover Jet Booster Flame Pulse & Thruster vibration
  const boosterPulse = useSharedValue(1);
  const boosterOpacity = useSharedValue(0.85);
  const hoverVibration = useSharedValue(0);

  // --- ANIMATED STYLE BINDINGS ---
  const robotTranslateStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: robotY.value + hoverVibration.value },
      { scaleX: robotScaleX.value },
      { scaleY: robotScaleY.value },
    ],
  }));

  const headStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${headRotation.value}deg` }],
  }));

  const leftArmStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leftArmRotation.value}deg` }],
  }));

  const rightArmStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rightArmRotation.value}deg` }],
  }));

  const eyeBlinkStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeBlink.value }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: corePulse.value }],
    opacity: 0.5 + (corePulse.value - 0.85) * 1.6,
  }));

  const shadowStyle = useAnimatedStyle(() => {
    const scaleVal = 1 + robotY.value / 40;
    const opacityVal = 0.6 + robotY.value / 80;
    return {
      transform: [{ scaleX: scaleVal }],
      opacity: opacityVal,
    };
  });

  // Animated Cloud Styles
  const cloud1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: cloud1X.value }],
  }));

  const cloud2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: cloud2X.value }],
  }));

  const cloud3Style = useAnimatedStyle(() => ({
    transform: [{ translateX: cloud3X.value }],
  }));

  // Glowing Thruster Flame Style
  const boosterStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: boosterPulse.value },
      { scaleX: 0.88 + boosterPulse.value * 0.12 },
    ],
    opacity: boosterOpacity.value,
  }));

  // --- IDLE LOOPS EFFECTS ---
  useEffect(() => {
    // 1. Floating Y (Melayang naik-turun halus)
    robotY.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 1800 }),
        withTiming(12, { duration: 1800 })
      ),
      -1,
      true
    );

    // 2. Breathing Scale X & Y (Kembang kempis tubuh)
    robotScaleX.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000 }),
        withTiming(0.98, { duration: 2000 })
      ),
      -1,
      true
    );
    robotScaleY.value = withRepeat(
      withSequence(
        withTiming(0.98, { duration: 2000 }),
        withTiming(1.02, { duration: 2000 })
      ),
      -1,
      true
    );

    // 3. Head Sway (Kemiringan kepala)
    headRotation.value = withRepeat(
      withSequence(
        withTiming(3, { duration: 2200 }),
        withTiming(-3, { duration: 2200 })
      ),
      -1,
      true
    );

    // 4. Arms Sway (Ayun lengan lambat)
    leftArmRotation.value = withRepeat(
      withSequence(
        withTiming(12, { duration: 2400 }),
        withTiming(-12, { duration: 2400 })
      ),
      -1,
      true
    );
    rightArmRotation.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 2400 }),
        withTiming(12, { duration: 2400 })
      ),
      -1,
      true
    );

    // 5. Core Reactor Pulse (Pendaran reaktor sirkuit dada)
    corePulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1000 }),
        withTiming(0.85, { duration: 1000 })
      ),
      -1,
      true
    );

    // 6. Background Clouds Continuous Drifting Loops
    cloud1X.value = withRepeat(
      withTiming(360, { duration: 22000, easing: Easing.linear }),
      -1,
      false
    );
    cloud2X.value = withRepeat(
      withTiming(360, { duration: 32000, easing: Easing.linear }),
      -1,
      false
    );
    cloud3X.value = withRepeat(
      withTiming(360, { duration: 16000, easing: Easing.linear }),
      -1,
      false
    );

    // 7. Jet Booster Plasma Flame Flickering & vibration loops
    boosterPulse.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 90, easing: Easing.linear }),
        withTiming(0.8, { duration: 90, easing: Easing.linear })
      ),
      -1,
      true
    );
    boosterOpacity.value = withRepeat(
      withSequence(
        withTiming(0.98, { duration: 80, easing: Easing.linear }),
        withTiming(0.68, { duration: 80, easing: Easing.linear })
      ),
      -1,
      true
    );
    hoverVibration.value = withRepeat(
      withSequence(
        withTiming(-0.8, { duration: 45, easing: Easing.linear }),
        withTiming(0.8, { duration: 45, easing: Easing.linear })
      ),
      -1,
      true
    );

    // 8. Periodic Blink (Kedipan mata otomatis tiap 4 detik)
    const blinkInterval = setInterval(() => {
      eyeBlink.value = withSequence(
        withTiming(0.05, { duration: 100 }),
        withTiming(1, { duration: 100 }),
        withTiming(0.05, { duration: 80 }),
        withTiming(1, { duration: 100 })
      );
    }, 4000);

    return () => {
      clearInterval(blinkInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- INTERACTION TAP TRIGGER ---
  const handleInteraction = () => {
    // Haptics
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      // Ignored
    }

    // Cancel idle bounce temporary for jump
    cancelAnimation(robotY);
    cancelAnimation(robotScaleX);
    cancelAnimation(robotScaleY);
    cancelAnimation(rightArmRotation);

    // Jump & Squash/Stretch Sequence (Lompatan Gembira)
    robotY.value = withSequence(
      withTiming(15, { duration: 100 }), // Menekuk lutut ke bawah
      withTiming(-45, { duration: 250 }), // Melompat tinggi ke atas
      withTiming(0, { duration: 200 }),   // Mendarat kembali
      withSpring(0, { damping: 10 })
    );

    robotScaleX.value = withSequence(
      withTiming(1.18, { duration: 100 }),
      withTiming(0.82, { duration: 250 }),
      withTiming(1.12, { duration: 200 }),
      withSpring(1, { damping: 10 })
    );
    robotScaleY.value = withSequence(
      withTiming(0.82, { duration: 100 }),
      withTiming(1.18, { duration: 250 }),
      withTiming(0.88, { duration: 200 }),
      withSpring(1, { damping: 10 })
    );

    // Excited Arm Wave Sequence (Lambaian tangan gembira)
    rightArmRotation.value = withSequence(
      withTiming(-90, { duration: 100 }),
      withTiming(-30, { duration: 100 }),
      withTiming(-90, { duration: 100 }),
      withTiming(-30, { duration: 100 }),
      withTiming(-90, { duration: 100 }),
      withSpring(0, { damping: 10 })
    );

    // Resume idle loops after 3.5 seconds
    const resetTimeout = setTimeout(() => {
      robotY.value = withRepeat(
        withSequence(
          withTiming(-12, { duration: 1800 }),
          withTiming(12, { duration: 1800 })
        ),
        -1,
        true
      );
      robotScaleX.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 2000 }),
          withTiming(0.98, { duration: 2000 })
        ),
        -1,
        true
      );
      robotScaleY.value = withRepeat(
        withSequence(
          withTiming(0.98, { duration: 2000 }),
          withTiming(1.02, { duration: 2000 })
        ),
        -1,
        true
      );
      rightArmRotation.value = withRepeat(
        withSequence(
          withTiming(-12, { duration: 2400 }),
          withTiming(12, { duration: 2400 })
        ),
        -1,
        true
      );
    }, 3500);

    return () => clearTimeout(resetTimeout);
  };

  return (
    <View style={styles.outerContainer}>
      {/* LANDSCAPE SCRAPPY BACKGROUND: Bukit, langit, awan & gelembung aura */}
      <Animated.View style={[styles.cloud1, cloud1Style]} />
      <Animated.View style={[styles.cloud2, cloud2Style]} />
      <Animated.View style={[styles.cloud3, cloud3Style]} />

      <View style={styles.backHill} />
      <View style={styles.frontHill} />
      <View style={styles.grassGround} />

      {/* Gelembung Aura transparan di belakang robot */}
      <View style={styles.glassAura} />

      <View style={styles.robotContainer}>
        {/* Pressable Robot Assembly */}
        <Pressable onPress={handleInteraction} style={styles.robotTouchArea}>
          <Animated.View style={[styles.robotAssembly, robotTranslateStyle]}>
            {/* HEAD ASSEMBLY */}
            <Animated.View style={[styles.headContainer, headStyle]}>
              {/* Antenna */}
              <View style={styles.antennaStick} />
              <View style={styles.antennaBulb} />
              
              {/* Head Shell */}
              <View style={styles.headShell}>
                {/* Side Bolt Ears */}
                <View style={styles.leftEar} />
                <View style={styles.rightEar} />

                {/* Face Visor Screen */}
                <View style={styles.visorScreen}>
                  {/* Blinking LED Eyes */}
                  <Animated.View style={[styles.eyesRow, eyeBlinkStyle]}>
                    <View style={styles.eyeCircle}>
                      <View style={styles.pupil} />
                    </View>
                    <View style={styles.eyeCircle}>
                      <View style={styles.pupil} />
                    </View>
                  </Animated.View>
                </View>
              </View>
            </Animated.View>

            {/* NECK JOINT */}
            <View style={styles.neckJoint} />

            {/* TORSO BODY */}
            <View style={styles.bodyContainer}>
              {/* Left Arm (Shoulder Pivot) */}
              <Animated.View style={[styles.leftShoulder, leftArmStyle]}>
                <View style={styles.leftArm} />
              </Animated.View>

              {/* Body Shell */}
              <View style={styles.bodyShell}>
                {/* Chest Monitor Display */}
                <View style={styles.chestScreen}>
                  {/* Pulsing Core Reactor */}
                  <Animated.View style={[styles.coreReactor, coreStyle]} />
                  {/* Decorative circuit lines */}
                  <View style={styles.circuitLineHorizontal} />
                </View>
              </View>

              {/* Right Arm (Shoulder Pivot) */}
              <Animated.View style={[styles.rightShoulder, rightArmStyle]}>
                <View style={styles.rightArm} />
              </Animated.View>
            </View>

            {/* TRACKS WHEELS BASE */}
            <View style={styles.wheelsBase}>
              <View style={styles.treadDot} />
              <View style={styles.treadDot} />
              <View style={styles.treadDot} />
            </View>

            {/* Glowing Hover Thruster Plasma Flame */}
            <Animated.View style={[styles.boosterFlame, boosterStyle]}>
              <Svg width="22" height="28" viewBox="0 0 20 25">
                <Path
                  d="M10 25C15 25 18 18 18 12C18 4 10 0 10 0C10 0 2 4 2 12C2 18 5 25 10 25Z"
                  fill="#06B6D4"
                />
                <Path
                  d="M10 20C13 20 15 15 15 11C15 5 10 2 10 2C10 2 5 5 5 11C5 15 7 20 10 20Z"
                  fill="#22D3EE"
                />
              </Svg>
            </Animated.View>
          </Animated.View>
        </Pressable>

        {/* Dynamic Shadow on the floor (Dark green shadow blending with grass) */}
        <Animated.View style={[styles.floorShadow, shadowStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 35,
    backgroundColor: "#BAE6FD", // Soft Sky Blue
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    position: "relative",
    // Soft card shadow
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  
  // CLOUD SHAPES
  cloud1: {
    position: "absolute",
    top: 25,
    left: -50,
    width: 36,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    opacity: 0.85,
    zIndex: 0,
  },
  cloud2: {
    position: "absolute",
    top: 40,
    left: -80,
    width: 50,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    opacity: 0.85,
    zIndex: 0,
  },
  cloud3: {
    position: "absolute",
    top: 15,
    left: -40,
    width: 30,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    opacity: 0.6,
    zIndex: 0,
  },

  // HILL SHAPES (Perbukitan Hijau bertumpuk)
  backHill: {
    position: "absolute",
    bottom: 30,
    width: "150%",
    height: 160,
    borderRadius: 180,
    backgroundColor: "#A7F3D0", // Soft green back hill
    left: "-25%",
    zIndex: 0,
  },
  frontHill: {
    position: "absolute",
    bottom: 12,
    width: "160%",
    height: 120,
    borderRadius: 160,
    backgroundColor: "#6EE7B7", // Medium green front hill
    left: "-30%",
    zIndex: 0,
  },
  grassGround: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 45,
    backgroundColor: "#34D399", // Grass floor
    zIndex: 0,
  },

  // Glass Aura Bubble behind the robot (Gelembung aura melayang)
  glassAura: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(224, 242, 254, 0.42)",
    borderWidth: 1.5,
    borderColor: "rgba(14, 165, 233, 0.2)",
    alignSelf: "center",
    top: "14%",
    zIndex: 0,
  },

  robotContainer: {
    width: 160,
    height: 290,
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
    zIndex: 1,
  },
  robotTouchArea: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    width: "100%",
    zIndex: 2,
  },
  robotAssembly: {
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 10,
    position: "relative",
  },

  // HEAD
  headContainer: {
    alignItems: "center",
    position: "relative",
    zIndex: 5,
  },
  antennaStick: {
    width: 5,
    height: 12,
    backgroundColor: "#0284C7",
  },
  antennaBulb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F59E0B",
    position: "absolute",
    top: -10,
  },
  headShell: {
    width: 82,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#E0F2FE", // Soft metallic blue
    borderWidth: 2.5,
    borderColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  leftEar: {
    position: "absolute",
    left: -7,
    top: 24,
    width: 5,
    height: 14,
    borderRadius: 2.5,
    backgroundColor: "#0284C7",
  },
  rightEar: {
    position: "absolute",
    right: -7,
    top: 24,
    width: 5,
    height: 14,
    borderRadius: 2.5,
    backgroundColor: "#0284C7",
  },
  visorScreen: {
    width: 64,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#0F172A", // Dark visor screen
    justifyContent: "center",
    alignItems: "center",
  },
  eyesRow: {
    flexDirection: "row",
    gap: 12,
  },
  eyeCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#22D3EE", // Glowing cyan LED eyes
    justifyContent: "center",
    alignItems: "center",
  },
  pupil: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },

  // JOINTS
  neckJoint: {
    width: 20,
    height: 8,
    backgroundColor: "#0284C7",
    zIndex: 4,
    marginTop: -2,
  },

  // BODY & ARMS
  bodyContainer: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 3,
    marginTop: -2,
  },
  bodyShell: {
    width: 108,
    height: 90,
    borderRadius: 24,
    backgroundColor: "#E0F2FE",
    borderWidth: 2.5,
    borderColor: "#0284C7",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  chestScreen: {
    width: 76,
    height: 62,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  coreReactor: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#38BDF8", // Glowing cyan reactor
    shadowColor: "#00C3A0",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  circuitLineHorizontal: {
    width: "80%",
    height: 1.5,
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    position: "absolute",
  },
  
  // SHOULDER & ARMS
  leftShoulder: {
    width: 12,
    height: 12,
    justifyContent: "flex-start",
    alignItems: "center",
    marginRight: -3,
    zIndex: 2,
  },
  leftArm: {
    position: "absolute",
    top: 0,
    width: 12,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#E0F2FE",
    borderWidth: 2,
    borderColor: "#0284C7",
  },
  rightShoulder: {
    width: 12,
    height: 12,
    justifyContent: "flex-start",
    alignItems: "center",
    marginLeft: -3,
    zIndex: 2,
  },
  rightArm: {
    position: "absolute",
    top: 0,
    width: 12,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#E0F2FE",
    borderWidth: 2,
    borderColor: "#0284C7",
  },

  // BASE
  wheelsBase: {
    width: 90,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#334155", // Heavy track base
    borderWidth: 2,
    borderColor: "#0284C7",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: -2,
    zIndex: 5,
  },
  treadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#94A3B8",
  },

  // Hover booster plasma flame
  boosterFlame: {
    position: "absolute",
    bottom: -22,
    alignSelf: "center",
    zIndex: 1,
  },

  // FLOOR SHADOW (Green-tinted grass shadow)
  floorShadow: {
    position: "absolute",
    bottom: 2,
    width: 110,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(6, 78, 59, 0.22)", // Bayangan hijau gelap di atas rumput
    zIndex: 1,
  },
});
