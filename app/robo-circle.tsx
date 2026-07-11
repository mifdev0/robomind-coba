import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
  Platform,
  Modal,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
} from "react-native-reanimated";
import Svg, { Rect, Circle, Line, Path } from "react-native-svg";
import { COLORS, SPACING, SHAPES, FONTS, SHADOWS } from "../constants/Theme";
import Button from "../components/ui/Button";

const COINS_STORAGE_KEY = "user_coins_balance";
const ROBOT_SIZE = 38;

interface Point {
  x: number;
  y: number;
  angle: number;
}

interface LevelConfig {
  level: number;
  targetRobots: number;
  initialRobots: number;
  speed: number;
  minGap: number;
  speedVaried?: boolean;
  rewardCoins: number;
  rewardXP: number;
  instructions: string;
  W: number;
  H: number;
  R: number;
}

const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: 1,
    targetRobots: 3,
    initialRobots: 1,
    speed: 0.0034,
    minGap: 0.12,
    rewardCoins: 50,
    rewardXP: 30,
    instructions: "TAP ketika celah kosong melewati sambungan di bawah! (Lintasan: Kotak)",
    W: 240,
    H: 240,
    R: 50,
  },
  {
    level: 2,
    targetRobots: 4,
    initialRobots: 2,
    speed: 0.0044,
    minGap: 0.11,
    rewardCoins: 75,
    rewardXP: 45,
    instructions: "Dua robot sekarang berputar. Perhatikan timing masuk! (Lintasan: Persegi Panjang)",
    W: 260,
    H: 180,
    R: 45,
  },
  {
    level: 3,
    targetRobots: 5,
    initialRobots: 2,
    speed: 0.0056,
    minGap: 0.09,
    rewardCoins: 100,
    rewardXP: 60,
    instructions: "Robot bergerak lebih cepat. Penting menjaga timing! (Lintasan: Lingkaran)",
    W: 220,
    H: 220,
    R: 110,
  },
  {
    level: 4,
    targetRobots: 6,
    initialRobots: 3,
    speed: 0.0072,
    minGap: 0.075,
    rewardCoins: 150,
    rewardXP: 90,
    instructions: "Celah semakin sempit. Masukkan 6 robot antrian! (Lintasan: Belah Ketupat)",
    W: 230,
    H: 230,
    R: 50,
  },
  {
    level: 5,
    targetRobots: 8,
    initialRobots: 3,
    speed: 0.0090,
    minGap: 0.065,
    speedVaried: true,
    rewardCoins: 250,
    rewardXP: 120,
    instructions: "Level Final! Kecepatan robot bervariasi. Tahan dan fokus! (Lintasan: Kapsul)",
    W: 260,
    H: 160,
    R: 80,
  },
];

const getRoundedRectPoint = (progress: number, W: number, H: number, R: number): Point => {
  const p = ((progress % 1) + 1) % 1;
  const L_top = W - 2 * R;
  const L_left = H - 2 * R;
  const L_corner = (Math.PI / 2) * R;
  const L_total = 2 * L_top + 2 * L_left + 4 * L_corner;

  const d = p * L_total;

  const b1 = L_top / 2;
  const b2 = b1 + L_corner;
  const b3 = b2 + L_left;
  const b4 = b3 + L_corner;
  const b5 = b4 + L_top;
  const b6 = b5 + L_corner;
  const b7 = b6 + L_left;
  const b8 = b7 + L_corner;

  if (d < b1) {
    const ratio = d / b1;
    return { x: -(W / 2 - R) * ratio, y: H / 2, angle: 180 };
  } else if (d < b2) {
    const ratio = (d - b1) / L_corner;
    const theta = Math.PI / 2 + ratio * (Math.PI / 2);
    return {
      x: -(W / 2 - R) + R * Math.cos(theta),
      y: (H / 2 - R) + R * Math.sin(theta),
      angle: 180 + ratio * 90,
    };
  } else if (d < b3) {
    const ratio = (d - b2) / L_left;
    return { x: -W / 2, y: (H / 2 - R) - L_left * ratio, angle: 270 };
  } else if (d < b4) {
    const ratio = (d - b3) / L_corner;
    const theta = Math.PI + ratio * (Math.PI / 2);
    return {
      x: -(W / 2 - R) + R * Math.cos(theta),
      y: -(H / 2 - R) + R * Math.sin(theta),
      angle: 270 + ratio * 90,
    };
  } else if (d < b5) {
    const ratio = (d - b4) / L_top;
    return { x: -(W / 2 - R) + L_top * ratio, y: -H / 2, angle: 0 };
  } else if (d < b6) {
    const ratio = (d - b5) / L_corner;
    const theta = (3 * Math.PI) / 2 + ratio * (Math.PI / 2);
    return {
      x: (W / 2 - R) + R * Math.cos(theta),
      y: -(H / 2 - R) + R * Math.sin(theta),
      angle: ratio * 90,
    };
  } else if (d < b7) {
    const ratio = (d - b6) / L_left;
    return { x: W / 2, y: -(H / 2 - R) + L_left * ratio, angle: 90 };
  } else if (d < b8) {
    const ratio = (d - b7) / L_corner;
    const theta = ratio * (Math.PI / 2);
    return {
      x: (W / 2 - R) + R * Math.cos(theta),
      y: (H / 2 - R) + R * Math.sin(theta),
      angle: 90 + ratio * 90,
    };
  } else {
    const ratio = (d - b8) / b1;
    return { x: (W / 2 - R) - (W / 2 - R) * ratio, y: H / 2, angle: 180 };
  }
};

const getTrackPointForLevel = (progress: number, config: LevelConfig): Point => {
  if (config.level === 4) {
    const p_shifted = (progress + 0.375) % 1;
    const rawPt = getRoundedRectPoint(p_shifted, config.W, config.H, config.R);
    const rad = (45 * Math.PI) / 180;
    const rx = rawPt.x * Math.cos(rad) - rawPt.y * Math.sin(rad);
    const ry = rawPt.x * Math.sin(rad) + rawPt.y * Math.cos(rad);
    return { x: rx, y: ry, angle: rawPt.angle + 45 };
  }
  return getRoundedRectPoint(progress, config.W, config.H, config.R);
};

interface TrackRobot {
  id: string;
  progress: number;
  speed: number;
  color: string;
  model: number;
}

interface QueuedRobot {
  id: string;
  color: string;
  model: number;
}

interface LaunchingRobot {
  id: string;
  color: string;
  model: number;
  progress: number;
}

const RobotVisual = ({ color }: { color: string }) => {
  return (
    <View style={styles.robotBase}>
      <View style={styles.wheelTop} />
      <View style={styles.wheelBottom} />
      <View style={[styles.bodyPlate, { borderColor: color }]}>
        <View style={styles.faceVisor}>
          <View style={styles.eyeLed} />
          <View style={styles.eyeLed} />
        </View>
        <View style={[styles.powerCore, { backgroundColor: color }]} />
      </View>
      <View style={styles.antennaLine} />
      <View style={[styles.antennaTop, { backgroundColor: color }]} />
    </View>
  );
};

const ConfettiPiece = ({
  xPercent,
  color,
  size,
  isRibbon,
  delay,
  duration,
}: {
  xPercent: number;
  color: string;
  size: number;
  isRibbon: boolean;
  delay: number;
  duration: number;
}) => {
  const translateY = useSharedValue(-50);
  const rotation = useSharedValue(0);

  useEffect(() => {
    translateY.value = -50;
    rotation.value = 0;

    const timeout = setTimeout(() => {
      translateY.value = withRepeat(
        withSequence(
          withTiming(650, { duration }),
          withTiming(-50, { duration: 0 })
        ),
        -1,
        false
      );
      rotation.value = withRepeat(
        withTiming(720, { duration }),
        -1,
        false
      );
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay, duration, translateY, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: `${xPercent}%`,
          top: 0,
          backgroundColor: color,
          width: isRibbon ? size * 0.4 : size,
          height: isRibbon ? size * 2.5 : size,
          borderRadius: isRibbon ? 2 : size / 2,
          opacity: 0.85,
          zIndex: 999,
        },
        animatedStyle,
      ]}
    />
  );
};

export default function RoboCircleScreen() {
  const router = useRouter();
  const [level, setLevel] = useState(1);
  const [userCoins, setUserCoins] = useState(1250);
  const [gameState, setGameState] = useState<"playing" | "victory" | "completed" | "failed">("playing");

  const [onTrackRobots, setOnTrackRobots] = useState<TrackRobot[]>([]);
  const [queuedRobots, setQueuedRobots] = useState<QueuedRobot[]>([]);
  const [launchingRobot, setLaunchingRobot] = useState<LaunchingRobot | null>(null);
  const [lives, setLives] = useState(3);
  const [insertedCount, setInsertedCount] = useState(0);
  const [score, setScore] = useState(0);

  const shakeOffset = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  const t = Date.now() * 0.008;
  const isBlinking = Date.now() % 800 < 400;

  // Get active config
  const currentLevelConfig = useMemo(() => {
    return LEVEL_CONFIGS.find((l) => l.level === level) || LEVEL_CONFIGS[0];
  }, [level]);

  // Junction point calculation
  const yJunction = useMemo(() => {
    const pt = getTrackPointForLevel(0, currentLevelConfig);
    return pt.y;
  }, [currentLevelConfig]);

  // Load progress
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const storedCoins = await AsyncStorage.getItem(COINS_STORAGE_KEY);
        if (storedCoins !== null) {
          setUserCoins(parseInt(storedCoins));
        }
        const storedLevel = await AsyncStorage.getItem("robo_circle_current_level");
        if (storedLevel !== null) {
          setLevel(parseInt(storedLevel));
        }
      } catch (e) {
        console.error("Failed to load game data", e);
      }
    };
    loadGameData();
  }, []);

  const triggerHaptic = (type: "success" | "error" | "light") => {
    try {
      if (Platform.OS !== "web") {
        if (type === "success") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (type === "error") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch {
      // Ignored
    }
  };

  // Initialize game
  const initLevel = (levelIndex: number) => {
    const config = LEVEL_CONFIGS.find((l) => l.level === levelIndex);
    if (!config) return;

    const colors = ["#38BDF8", "#34D399", "#FBBF24", "#F472B6", "#A78BFA", "#FB7185"];
    
    const initialTrack: TrackRobot[] = Array.from({ length: config.initialRobots }).map((_, i) => {
      const startProgress = ((i + 0.5) / config.initialRobots) % 1;
      return {
        id: `initial-${i}-${Math.random()}`,
        progress: startProgress,
        speed: config.speed * (config.speedVaried ? (0.85 + Math.random() * 0.3) : 1),
        color: colors[i % colors.length],
        model: i % 3,
      };
    });

    const initialQueue: QueuedRobot[] = Array.from({ length: 5 }).map((_, i) => ({
      id: `queue-${i}-${Math.random()}`,
      color: colors[(i + config.initialRobots) % colors.length],
      model: (i + config.initialRobots) % 3,
    }));

    setOnTrackRobots(initialTrack);
    setQueuedRobots(initialQueue);
    setLaunchingRobot(null);
    setLives(3);
    setInsertedCount(0);
    setScore(0);
    setGameState("playing");
  };

  useEffect(() => {
    initLevel(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // Physics loop
  useEffect(() => {
    if (gameState !== "playing") return;

    let frameId: number;

    const loop = () => {
      setOnTrackRobots((prev) =>
        prev.map((r) => ({
          ...r,
          progress: (r.progress + r.speed) % 1,
        }))
      );

      setLaunchingRobot((prevLaunch) => {
        if (!prevLaunch) return null;
        
        const nextProgress = prevLaunch.progress + 0.075;
        
        if (nextProgress >= 1) {
          const config = LEVEL_CONFIGS.find((l) => l.level === level)!;
          const gapThreshold = config.minGap;

          let hasCollision = false;
          setOnTrackRobots((currentTrack) => {
            const ptLaunch = getTrackPointForLevel(0, config);
            hasCollision = currentTrack.some((r) => {
              const ptRobot = getTrackPointForLevel(r.progress, config);
              const pixelDist = Math.sqrt(
                (ptLaunch.x - ptRobot.x) ** 2 + (ptLaunch.y - ptRobot.y) ** 2
              );
              return pixelDist < 36; // Visually overlapping threshold (36px for 38px size robots)
            });
            return currentTrack;
          });

          setTimeout(() => {
            if (hasCollision) {
              flashOpacity.value = withSequence(
                withTiming(0.4, { duration: 50 }),
                withTiming(0, { duration: 200 })
              );
              shakeOffset.value = withSequence(
                withTiming(-12, { duration: 40 }),
                withTiming(12, { duration: 40 }),
                withTiming(-8, { duration: 40 }),
                withTiming(8, { duration: 40 }),
                withTiming(0, { duration: 40 })
              );
              
              triggerHaptic("error");
              setLives((l) => {
                const updatedLives = Math.max(0, l - 1);
                if (updatedLives === 0) {
                  setGameState("failed");
                }
                return updatedLives;
              });
            } else {
              pulseScale.value = withSequence(
                withTiming(1.05, { duration: 100 }),
                withTiming(1, { duration: 150 })
              );
              triggerHaptic("success");
              
              setOnTrackRobots((currentTrack) => [
                ...currentTrack,
                {
                  id: prevLaunch.id,
                  progress: 0,
                  speed: config.speed * (config.speedVaried ? (0.85 + Math.random() * 0.3) : 1),
                  color: prevLaunch.color,
                  model: prevLaunch.model,
                },
              ]);
              
              setInsertedCount((c) => {
                const nextCount = c + 1;
                if (nextCount >= config.targetRobots) {
                  if (level < LEVEL_CONFIGS.length) {
                    setGameState("victory");
                  } else {
                    setGameState("completed");
                  }
                }
                return nextCount;
              });
              setScore((s) => s + 10);
            }
            setLaunchingRobot(null);
          }, 0);

          return null;
        }

        return { ...prevLaunch, progress: nextProgress };
      });

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [gameState, level, flashOpacity, shakeOffset, pulseScale]);

  const handleTapSpawn = () => {
    if (gameState !== "playing") return;
    if (launchingRobot) return;
    if (queuedRobots.length === 0) return;

    triggerHaptic("light");

    const nextRobot = queuedRobots[0];
    setLaunchingRobot({ ...nextRobot, progress: 0 });

    setQueuedRobots((prev) => {
      const colors = ["#38BDF8", "#34D399", "#FBBF24", "#F472B6", "#A78BFA", "#FB7185"];
      const nextQueue = prev.slice(1);
      const randIdx = Math.floor(Math.random() * colors.length);
      const newRobot = {
        id: `queue-new-${Math.random()}`,
        color: colors[randIdx],
        model: Math.floor(Math.random() * 3),
      };
      return [...nextQueue, newRobot];
    });
  };

  const handleRestartLevel = () => {
    triggerHaptic("light");
    initLevel(level);
  };

  const handleNextLevel = async () => {
    triggerHaptic("light");
    const nextLvl = level + 1;
    const finalBalance = userCoins + LEVEL_CONFIGS.find((l) => l.level === level)!.rewardCoins;

    try {
      await AsyncStorage.setItem(COINS_STORAGE_KEY, finalBalance.toString());
      await AsyncStorage.setItem("robo_circle_current_level", nextLvl.toString());
      setUserCoins(finalBalance);
      setLevel(nextLvl);
    } catch (e) {
      console.error("Failed to save progress", e);
      setLevel(nextLvl);
    }
  };

  const handleClaimAndExit = async () => {
    triggerHaptic("success");
    const finalBalance = userCoins + LEVEL_CONFIGS.find((l) => l.level === level)!.rewardCoins;

    try {
      await AsyncStorage.setItem(COINS_STORAGE_KEY, finalBalance.toString());
      await AsyncStorage.setItem("robo_circle_current_level", "1");
      router.back();
    } catch (e) {
      console.error("Failed to save reward coins", e);
      router.back();
    }
  };

  const handleResetLevelProgress = async () => {
    triggerHaptic("success");
    try {
      await AsyncStorage.setItem("robo_circle_current_level", "1");
      setLevel(1);
    } catch (e) {
      console.error("Failed to reset level progress", e);
    }
  };

  const containerShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }],
  }));

  const screenFlashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const arenaPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const launchStartY = useMemo(() => 150 + yJunction + 70, [yJunction]);
  const launchEndY = useMemo(() => 150 + yJunction, [yJunction]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#7DD3FC" />

      {/* HEADER HUD BAR */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => {
              triggerHaptic("light");
              router.back();
            }}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>

          <View style={styles.heartsRow}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < lives ? "heart" : "heart-outline"}
                size={22}
                color={i < lives ? "#EF4444" : "#94A3B8"}
                style={{ marginRight: 2 }}
              />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Level {level}</Text>
          </View>
          <Pressable
            onPress={handleRestartLevel}
            style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="reload" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.coinsHeaderBadge}>
          <MaterialCommunityIcons name="coin" size={18} color="#F59E0B" />
          <Text style={styles.coinsHeaderVal}>{userCoins}</Text>
        </View>
      </View>

      {/* HAZARD BARS */}
      <View style={styles.hazardTapeTop} />

      {/* SCREEN FLASH & SHAKE CONTAINER */}
      <Animated.View style={[styles.gameplayArea, containerShakeStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.flashOverlay, screenFlashStyle]} pointerEvents="none" />

        {/* FACTORY BACKDROP SVG DECORATIONS */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d="M20,60 L60,60 L90,90 L90,130" stroke="rgba(56, 189, 248, 0.15)" strokeWidth={3} fill="none" />
          <Path d="M300,60 L260,60 L230,90 L230,130" stroke="rgba(56, 189, 248, 0.15)" strokeWidth={3} fill="none" />
          <Path d="M40,240 L80,240 L110,270 L110,320" stroke="rgba(56, 189, 248, 0.15)" strokeWidth={3} fill="none" />
          <Circle cx={90} cy={130} r={4} fill="rgba(56, 189, 248, 0.25)" />
          <Circle cx={230} cy={130} r={4} fill="rgba(56, 189, 248, 0.25)" />
          <Circle cx={110} cy={320} r={4} fill="rgba(56, 189, 248, 0.25)" />
        </Svg>

        {/* Level progress status */}
        <View style={styles.progressStatusContainer}>
          <Text style={styles.progressText}>
            Robot Masuk: <Text style={styles.progressHighlight}>{insertedCount} / {currentLevelConfig.targetRobots}</Text>
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(100, (insertedCount / currentLevelConfig.targetRobots) * 100)}%` },
              ]}
            />
          </View>
        </View>

        {/* PLAYING GRID ARENA WRAPPED WITH SPECTATORS CLUSTERED CLOSE */}
        <View style={styles.arenaContainer}>
          <View style={styles.arenaWrapper}>
            
            {/* LEFT TIERED STADIUM STANDS */}
            <View style={styles.leftGalleryClose}>
              <View style={styles.railingLeft} />
              
              {/* Bench Row 1 */}
              <View style={styles.benchRow}>
                <View style={[styles.spectatorContainer, { transform: [{ translateY: Math.sin(t * 1.1) * 4 }] }]}>
                  <View style={[styles.flagPole, { transform: [{ rotate: `${Math.sin(t * 0.85) * 22}deg` }] }]}>
                    <View style={styles.flagRibbon} />
                  </View>
                  <MaterialCommunityIcons name="robot" size={24} color="#0EA5E9" />
                </View>
              </View>

              {/* Bench Row 2 */}
              <View style={styles.benchRow}>
                <View style={[styles.spectatorContainer, { transform: [{ translateY: Math.cos(t * 0.9) * 3.5 }] }]}>
                  <MaterialCommunityIcons name="robot-mower" size={26} color="#34D399" />
                  <View style={[styles.glowStick, { backgroundColor: "#10B981", transform: [{ rotate: `${Math.sin(t * 1.5) * 30}deg` }] }]} />
                </View>
              </View>

              {/* Bench Row 3 */}
              <View style={styles.benchRow}>
                <View style={[styles.spectatorContainer, { transform: [{ translateY: Math.abs(Math.sin(t * 1.3)) * -6 }] }]}>
                  <MaterialCommunityIcons name="robot-industrial" size={24} color="#A78BFA" />
                </View>
              </View>
            </View>

            {/* THE CENTRAL 300x470 PLAY GAME BOX */}
            <Animated.View style={[styles.gameArena, arenaPulseStyle]}>
              <Svg width={300} height={300} viewBox="0 0 300 300" style={StyleSheet.absoluteFill}>
                {/* Outer Bed */}
                <Rect
                  x={150 - currentLevelConfig.W / 2}
                  y={150 - currentLevelConfig.H / 2}
                  width={currentLevelConfig.W}
                  height={currentLevelConfig.H}
                  rx={currentLevelConfig.R}
                  ry={currentLevelConfig.R}
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth={32}
                  transform={level === 4 ? "rotate(45 150 150)" : undefined}
                />
                {/* Conveyor Path */}
                <Rect
                  x={150 - currentLevelConfig.W / 2}
                  y={150 - currentLevelConfig.H / 2}
                  width={currentLevelConfig.W}
                  height={currentLevelConfig.H}
                  rx={currentLevelConfig.R}
                  ry={currentLevelConfig.R}
                  fill="none"
                  stroke="#334155"
                  strokeWidth={18}
                  transform={level === 4 ? "rotate(45 150 150)" : undefined}
                />
                {/* Inner Guide Dashes */}
                <Rect
                  x={150 - currentLevelConfig.W / 2}
                  y={150 - currentLevelConfig.H / 2}
                  width={currentLevelConfig.W}
                  height={currentLevelConfig.H}
                  rx={currentLevelConfig.R}
                  ry={currentLevelConfig.R}
                  fill="none"
                  stroke="#64748B"
                  strokeWidth={2}
                  strokeDasharray="6,8"
                  transform={level === 4 ? "rotate(45 150 150)" : undefined}
                />
              </Svg>

              {/* Blinking LEDs */}
              <View style={[styles.ledIndicator, { left: 150 - currentLevelConfig.W/2 - 10, top: 150 - currentLevelConfig.H/2 - 10, backgroundColor: isBlinking ? "#EF4444" : "#22D3EE" }]} />
              <View style={[styles.ledIndicator, { right: 150 - currentLevelConfig.W/2 - 10, top: 150 - currentLevelConfig.H/2 - 10, backgroundColor: isBlinking ? "#22D3EE" : "#EF4444" }]} />
              <View style={[styles.ledIndicator, { left: 150 - currentLevelConfig.W/2 - 10, top: 150 + currentLevelConfig.H/2 - 10, backgroundColor: isBlinking ? "#22D3EE" : "#EF4444" }]} />
              <View style={[styles.ledIndicator, { right: 150 - currentLevelConfig.W/2 - 10, top: 150 + currentLevelConfig.H/2 - 10, backgroundColor: isBlinking ? "#EF4444" : "#22D3EE" }]} />

              {/* Entry Junction Line Markings */}
              <View style={[styles.spawnJunctionLine, { top: launchEndY - 6 }]} />

              {/* Spawn queue track guide path */}
              <View style={[styles.spawnQueueGuide, { top: launchEndY + 5 }]} />

              {/* Render Robots on Track */}
              {onTrackRobots.map((robot) => {
                const pt = getTrackPointForLevel(robot.progress, currentLevelConfig);
                return (
                  <View
                    key={robot.id}
                    style={[
                      styles.robotContainer,
                      {
                        left: 150 + pt.x - 19,
                        top: 150 + pt.y - 19,
                        transform: [{ rotate: `${pt.angle}deg` }],
                      },
                    ]}
                  >
                    <RobotVisual color={robot.color} />
                  </View>
                );
              })}

              {/* Render Launching Robot */}
              {launchingRobot && (
                <View
                  style={[
                    styles.robotContainer,
                    {
                      left: 150 - 19,
                      top: launchStartY - launchingRobot.progress * 70 - 19,
                      transform: [{ rotate: "270deg" }],
                    },
                  ]}
                >
                  <RobotVisual color={launchingRobot.color} />
                </View>
              )}

              {/* Render Spawn Lane Queue */}
              {queuedRobots.map((robot, idx) => {
                if (idx >= 3) return null;
                return (
                  <View
                    key={robot.id}
                    style={[
                      styles.robotContainer,
                      {
                        left: 150 - 19,
                        top: launchStartY + idx * 42 - 19,
                        transform: [{ rotate: "270deg" }],
                        opacity: idx === 0 ? 1 : 0.6 - idx * 0.15,
                      },
                    ]}
                  >
                    <RobotVisual color={robot.color} />
                  </View>
                );
              })}

              {/* Spawn Tap Button overlay */}
              <Pressable
                onPress={handleTapSpawn}
                style={({ pressed }) => [
                  styles.launchTriggerBtn,
                  { top: launchStartY + 65 },
                  pressed && { transform: [{ scale: 0.95 }], backgroundColor: "#0284C7" },
                ]}
              >
                <Text style={styles.launchBtnLabel}>LEPAS ROBOT</Text>
              </Pressable>

              {/* Level 1 Hint Visual Overlay */}
              {level === 1 && insertedCount === 0 && !launchingRobot && (
                <View style={[styles.tutorialOverlay, { top: launchStartY - 30 }]} pointerEvents="none" >
                  <Ionicons name="arrow-up" size={28} color="#0284C7" style={styles.tutorialArrowAnim} />
                  <Text style={styles.tutorialText}>TAP di bawah untuk masuk!</Text>
                </View>
              )}
            </Animated.View>

            {/* RIGHT TIERED STADIUM STANDS */}
            <View style={styles.rightGalleryClose}>
              <View style={styles.railingRight} />

              {/* Bench Row 1 */}
              <View style={styles.benchRow}>
                <View style={[styles.spectatorContainer, { transform: [{ translateY: Math.cos(t * 1.0) * 4 }] }]}>
                  <View style={[styles.flagPole, { transform: [{ rotate: `${Math.cos(t * 0.75) * -22}deg` }] }]}>
                    <View style={[styles.flagRibbon, { backgroundColor: "#F472B6" }]} />
                  </View>
                  <MaterialCommunityIcons name="robot-vacuum" size={24} color="#FB7185" />
                </View>
              </View>

              {/* Bench Row 2 */}
              <View style={styles.benchRow}>
                <View style={[styles.spectatorContainer, { transform: [{ translateY: Math.abs(Math.cos(t * 1.4)) * -6 }] }]}>
                  <MaterialCommunityIcons name="toy-brick-outline" size={22} color="#FBBF24" />
                  <View style={[styles.glowStick, { backgroundColor: "#F59E0B", transform: [{ rotate: `${Math.cos(t * 1.6) * -30}deg` }] }]} />
                </View>
              </View>

              {/* Bench Row 3 */}
              <View style={styles.benchRow}>
                <View style={[styles.spectatorContainer, { transform: [{ translateY: Math.sin(t * 1.2) * 3.5 }] }]}>
                  <MaterialCommunityIcons name="robot-confused" size={24} color="#F472B6" />
                </View>
              </View>
            </View>

          </View>
        </View>
      </Animated.View>

      {/* HAZARD TAPE BOTTOM */}
      <View style={styles.hazardTapeBottom} />

      {/* BOTTOM INFO PANEL */}
      <View style={styles.missionCardContainer}>
        <View style={styles.missionCard}>
          <View style={styles.missionCardHeader}>
            <View style={styles.skillBadge}>
              <Text style={styles.skillBadgeText}>⚡ INHIBITOR CONTROL</Text>
            </View>
            <Text style={styles.xpReward}>+{currentLevelConfig.rewardXP} XP</Text>
          </View>
          <Text style={styles.missionTitle}>Misi: Robo-Circle</Text>
          <Text style={styles.missionDescription}>
            {currentLevelConfig.instructions}
          </Text>
        </View>
      </View>

      {/* Confetti Ribbon Celebration Overlay */}
      {(gameState === "victory" || gameState === "completed") && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 30 }).map((_, i) => {
            const randomX = (i * 12.34) % 100;
            const randomDelay = (i * 150) % 2000;
            const randomDuration = 2500 + ((i * 370) % 1500);
            const randomColor = ["#FF2E93", "#FF8A00", "#FF007A", "#FFD600", "#00F0FF", "#7000FF", "#00FF66"][i % 7];
            const size = 6 + (i % 6);
            const isRibbon = i % 2 === 0;

            return (
              <ConfettiPiece
                key={i}
                xPercent={randomX}
                color={randomColor}
                size={size}
                isRibbon={isRibbon}
                delay={randomDelay}
                duration={randomDuration}
              />
            );
          })}
        </View>
      )}

      {/* VICTORY MODAL OVERLAY */}
      <Modal visible={gameState === "victory"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.victoryIconCircle}>
              <Ionicons name="trophy" size={48} color="#F59E0B" />
            </View>
            <Text style={styles.modalTitle}>LEVEL SELESAI!</Text>
            <Text style={styles.modalSubtitle}>Sempurna! Robot teratur di dalam lingkaran.</Text>

            <View style={styles.rewardSummary}>
              <Text style={styles.rewardLabel}>HADIAH</Text>
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons name="coin" size={20} color="#F59E0B" />
                <Text style={styles.rewardBadgeText}>+{currentLevelConfig.rewardCoins} Koin</Text>
              </View>
            </View>

            <Button
              title="Lanjut Level Berikutnya"
              onPress={handleNextLevel}
              variant="primary"
              style={{ width: "100%" }}
            />
          </View>
        </View>
      </Modal>

      {/* COMPLETED ALL LEVELS MODAL OVERLAY */}
      <Modal visible={gameState === "completed"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.victoryIconCircle, { backgroundColor: "#FFF7ED" }]}>
              <Ionicons name="medal" size={54} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>PETUALANGAN SELESAI!</Text>
            <Text style={styles.modalSubtitle}>Hebat! Kamu menguasai sustained attention & timing inhibitor control!</Text>

            <View style={styles.rewardSummary}>
              <Text style={styles.rewardLabel}>HADIAH TOTAL</Text>
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons name="coin" size={20} color="#F59E0B" />
                <Text style={styles.rewardBadgeText}>+{currentLevelConfig.rewardCoins} Koin</Text>
              </View>
            </View>

            <Button
              title="Klaim Hadiah & Selesai"
              onPress={handleClaimAndExit}
              variant="primary"
              style={{ width: "100%" }}
            />
          </View>
        </View>
      </Modal>

      {/* GAME OVER MODAL OVERLAY */}
      <Modal visible={gameState === "failed"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.victoryIconCircle, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="close-circle" size={48} color="#EF4444" />
            </View>
            <Text style={[styles.modalTitle, { color: "#EF4444" }]}>MISI GAGAL!</Text>
            <Text style={styles.modalSubtitle}>Sirkuit robo-circle terganggu akibat tabrakan!</Text>

            <Button
              title="Coba Lagi"
              onPress={handleRestartLevel}
              variant="primary"
              style={{ width: "100%", backgroundColor: "#EF4444", marginBottom: 12 }}
            />
            <Button
              title="Kembali ke Menu"
              onPress={() => router.back()}
              variant="secondary"
              style={{ width: "100%" }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ECFDF5",
    ...Platform.select({
      web: {
        userSelect: "none",
        WebkitUserSelect: "none",
      } as any,
      default: {},
    }),
  },
  header: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: "#7DD3FC",
    borderBottomWidth: 2.5,
    borderBottomColor: "#38BDF8",
    zIndex: 99,
  },
  backBtn: {
    position: "relative",
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  resetBtn: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  heartsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  levelBadge: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 5,
    paddingHorizontal: SPACING.lg,
  },
  levelBadgeText: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: "#FFFFFF",
  },
  coinsHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FDBA74",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 4,
    paddingHorizontal: SPACING.md,
    gap: 4,
  },
  coinsHeaderVal: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: "#C2410C",
  },
  hazardTapeTop: {
    height: 6,
    backgroundColor: "#FBBF24",
    borderBottomWidth: 1,
    borderBottomColor: "#D97706",
    backgroundImage: "repeating-linear-gradient(45deg, #FBBF24, #FBBF24 8px, #1E293B 8px, #1E293B 16px)",
  } as any,
  hazardTapeBottom: {
    height: 6,
    backgroundColor: "#FBBF24",
    borderTopWidth: 1,
    borderTopColor: "#D97706",
    backgroundImage: "repeating-linear-gradient(45deg, #FBBF24, #FBBF24 8px, #1E293B 8px, #1E293B 16px)",
  } as any,
  gameplayArea: {
    flex: 1,
    position: "relative",
  },
  flashOverlay: {
    zIndex: 90,
  },
  progressStatusContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  progressText: {
    ...FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.brandDarkBlue,
    marginBottom: 6,
  },
  progressHighlight: {
    color: "#0284C7",
    fontSize: 16,
  },
  progressBarBg: {
    width: "100%",
    maxWidth: 260,
    height: 10,
    backgroundColor: "#E2E8F0",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#38BDF8",
    borderRadius: 5,
  },
  arenaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 20,
  },
  arenaWrapper: {
    position: "relative",
    width: 300,
    height: 470,
    justifyContent: "center",
    alignItems: "center",
  },
  gameArena: {
    width: 300,
    height: 470,
    position: "relative",
  },
  ledIndicator: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    zIndex: 4,
    ...SHADOWS.light,
  },
  spawnJunctionLine: {
    position: "absolute",
    left: 148,
    width: 4,
    height: 12,
    backgroundColor: "#EF4444",
    borderRadius: 2,
    zIndex: 5,
  },
  spawnQueueGuide: {
    position: "absolute",
    left: 140,
    width: 20,
    height: 155,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    zIndex: -1,
  },
  robotContainer: {
    position: "absolute",
    width: ROBOT_SIZE,
    height: ROBOT_SIZE,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  launchTriggerBtn: {
    position: "absolute",
    left: 80,
    width: 140,
    height: 48,
    borderRadius: SHAPES.radiusRound,
    backgroundColor: "#0ea5e9",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
    zIndex: 40,
  },
  launchBtnLabel: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  tutorialOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  tutorialArrowAnim: {
    transform: [{ translateY: -2 }],
    marginBottom: 4,
  },
  tutorialText: {
    ...FONTS.bodyBold,
    fontSize: 12,
    color: "#0ea5e9",
    textShadowColor: "#FFFFFF",
    textShadowRadius: 2,
    textShadowOffset: { width: 1, height: 1 },
  },
  robotBase: {
    width: ROBOT_SIZE,
    height: ROBOT_SIZE,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bodyPlate: {
    width: 26,
    height: 26,
    backgroundColor: "#E0F2FE",
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  wheelTop: {
    position: "absolute",
    top: 2,
    width: 18,
    height: 4,
    backgroundColor: "#334155",
    borderRadius: 2,
  },
  wheelBottom: {
    position: "absolute",
    bottom: 2,
    width: 18,
    height: 4,
    backgroundColor: "#334155",
    borderRadius: 2,
  },
  faceVisor: {
    width: 8,
    height: 16,
    backgroundColor: "#0F172A",
    borderRadius: 4,
    position: "absolute",
    right: 2,
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 2,
  },
  eyeLed: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#22D3EE",
  },
  powerCore: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    position: "absolute",
    left: 4,
  },
  antennaLine: {
    position: "absolute",
    right: -3,
    width: 5,
    height: 2,
    backgroundColor: "#475569",
  },
  antennaTop: {
    position: "absolute",
    right: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  leftGalleryClose: {
    position: "absolute",
    left: -54,
    top: 30,
    width: 46,
    height: 290,
    backgroundColor: "#D1D5DB",
    borderColor: "#94A3B8",
    borderWidth: 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    zIndex: 20,
    ...SHADOWS.light,
  },
  rightGalleryClose: {
    position: "absolute",
    right: -54,
    top: 30,
    width: 46,
    height: 290,
    backgroundColor: "#D1D5DB",
    borderColor: "#94A3B8",
    borderWidth: 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    zIndex: 20,
    ...SHADOWS.light,
  },
  benchRow: {
    width: "85%",
    height: 64,
    backgroundColor: "#E5E7EB",
    borderWidth: 1.5,
    borderColor: "#94A3B8",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  railingLeft: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#64748B",
    zIndex: 21,
  },
  railingRight: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#64748B",
    zIndex: 21,
  },
  galleryLabel: {
    display: "none",
  },
  spectatorContainer: {
    alignItems: "center",
    position: "relative",
  },
  flagPole: {
    position: "absolute",
    top: -12,
    left: -4,
    width: 2,
    height: 16,
    backgroundColor: "#475569",
    zIndex: 2,
  },
  flagRibbon: {
    position: "absolute",
    top: 0,
    left: 2,
    width: 12,
    height: 8,
    backgroundColor: "#38BDF8",
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  glowStick: {
    position: "absolute",
    top: -6,
    right: -4,
    width: 3,
    height: 10,
    borderRadius: 1.5,
    transform: [{ rotate: "30deg" }],
  },
  missionCardContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    backgroundColor: "#ECFDF5",
  },
  missionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: SHAPES.radiusLg,
    padding: SPACING.md + 2,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...SHADOWS.light,
  },
  missionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  skillBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  skillBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#475569",
    letterSpacing: 0.8,
  },
  xpReward: {
    fontSize: 12,
    fontWeight: "900",
    color: "#10B981",
  },
  missionTitle: {
    ...FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.brandDarkBlue,
    marginBottom: 4,
  },
  missionDescription: {
    ...FONTS.bodyRegular,
    fontSize: 11,
    color: COLORS.textMedium,
    lineHeight: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: SHAPES.radiusXl,
    padding: SPACING.xl + 4,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    ...SHADOWS.medium,
  },
  victoryIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFBEB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    ...FONTS.heading,
    fontSize: 20,
    color: COLORS.brandDarkBlue,
    textAlign: "center",
    marginBottom: 6,
  },
  modalSubtitle: {
    ...FONTS.bodyRegular,
    fontSize: 12,
    color: COLORS.textMedium,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: SPACING.xl,
  },
  rewardSummary: {
    backgroundColor: "#F9FAFB",
    borderRadius: SHAPES.radiusLg,
    padding: SPACING.md,
    alignItems: "center",
    width: "100%",
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  rewardLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: COLORS.textLight,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 4,
    paddingHorizontal: SPACING.lg,
    gap: 6,
  },
  rewardBadgeText: {
    ...FONTS.bodyBold,
    fontSize: 16,
    color: "#D97706",
  },
});
