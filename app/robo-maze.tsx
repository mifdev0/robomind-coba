import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
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
import Svg, { Line, Circle, Rect, Path, Defs, RadialGradient, Stop } from "react-native-svg";
import { COLORS, SPACING, SHAPES, FONTS, SHADOWS } from "../constants/Theme";
import Button from "../components/ui/Button";

const COINS_STORAGE_KEY = "user_coins_balance";
const COLS = 9;
const ROWS = 6;

interface Wall {
  type: "H" | "V";
  x: number;
  y: number;
  len: number;
}

interface LevelConfig {
  level: number;
  start: { x: number; y: number };
  goal: { x: number; y: number };
  walls: Wall[];
  peeks: number;
  rewardCoins: number;
  rewardXP: number;
  instructions: string;
}

const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: {
    level: 1,
    start: { x: 0, y: 5 },
    goal: { x: 8, y: 0 },
    walls: [
      { type: "H", x: 0, y: 2, len: 3 },
      { type: "V", x: 3, y: 0, len: 3 },
      { type: "H", x: 4, y: 3, len: 4 },
      { type: "V", x: 5, y: 1, len: 3 },
    ],
    peeks: 3,
    rewardCoins: 50,
    rewardXP: 30,
    instructions: "PEMANASAN: Hafalkan rute laser merah dalam 8 detik sebelum mereka memudar. Navigasi Slime ke stasiun pengisian daya di kanan atas!",
  },
  2: {
    level: 2,
    start: { x: 6, y: 0 },
    goal: { x: 0, y: 5 },
    walls: [
      { type: "H", x: 4, y: 0, len: 3 },
      { type: "V", x: 2, y: 0, len: 1 },
      { type: "V", x: 2, y: 1, len: 1 },
      { type: "V", x: 3, y: 1, len: 1 },
      { type: "H", x: 0, y: 2, len: 1 },
      { type: "H", x: 2, y: 2, len: 4 },
      { type: "V", x: 6, y: 2, len: 1 },
      { type: "V", x: 5, y: 3, len: 1 },
      { type: "H", x: 0, y: 3, len: 2 },
      { type: "H", x: 3, y: 3, len: 3 },
      { type: "H", x: 7, y: 3, len: 2 },
      { type: "V", x: 1, y: 4, len: 1 },
      { type: "H", x: 3, y: 4, len: 6 },
      { type: "V", x: 2, y: 5, len: 1 },
    ],
    peeks: 2,
    rewardCoins: 100,
    rewardXP: 60,
    instructions: "REPLIKA MAP UTAMA: Rintangan laser sangat rapat. Pergunakan memori spasial Anda untuk mencapai pengisian daya di kiri bawah!",
  },
  3: {
    level: 3,
    start: { x: 0, y: 0 },
    goal: { x: 8, y: 5 },
    walls: [
      { type: "V", x: 0, y: 0, len: 3 },
      { type: "H", x: 1, y: 1, len: 3 },
      { type: "V", x: 2, y: 2, len: 3 },
      { type: "H", x: 0, y: 4, len: 2 },
      { type: "V", x: 4, y: 0, len: 4 },
      { type: "H", x: 5, y: 2, len: 3 },
      { type: "V", x: 6, y: 3, len: 3 },
      { type: "H", x: 4, y: 4, len: 3 },
    ],
    peeks: 1,
    rewardCoins: 200,
    rewardXP: 100,
    instructions: "LABIRIN SUPER PADAT: Rintangan berbelok tajam dengan peeks terbatas. Rencanakan langkah saksama sebelum mulai!",
  },
};

let audioCtx: AudioContext | null = null;
const playSynthSound = (type: "move" | "hit" | "tick" | "invisible" | "victory" | "gameover") => {
  if (Platform.OS !== "web") return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    if (type === "move") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === "hit") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.25);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "tick") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(750, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "invisible") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.08);
      osc.frequency.setValueAtTime(659.25, now + 0.16);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "victory") {
      const freqs = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((freq, idx) => {
        const osc = audioCtx!.createOscillator();
        const gain = audioCtx!.createGain();
        osc.connect(gain);
        gain.connect(audioCtx!.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.18, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } else if (type === "gameover") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.65);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
      osc.start(now);
      osc.stop(now + 0.65);
    }
  } catch {
    // Ignored
  }
};

const SlimeRobotSvg = ({ isHappy, isSad }: { isHappy: boolean; isSad: boolean }) => (
  <Svg viewBox="0 0 100 100" style={styles.slimeSvg}>
    {/* Antena */}
    <Rect x="47" y="6" width="6" height="12" fill="#64748b" rx="2" />
    <Circle cx="50" cy="5" r="4" fill="#22d3ee" />
    {/* Ear Bolts */}
    <Rect x="14" y="30" width="6" height="14" rx="2" fill="#475569" />
    <Rect x="80" y="30" width="6" height="14" rx="2" fill="#475569" />
    {/* Kepala Robot */}
    <Rect x="20" y="15" width="60" height="44" rx="12" fill="#94a3b8" stroke="#475569" strokeWidth={3} />
    {/* Layar Visor */}
    <Rect x="28" y="22" width="44" height="20" rx="6" fill="#0f172a" stroke="#334155" strokeWidth={1.5} />
    
    {/* Mata / LED Visor */}
    {isHappy ? (
      <>
        <Path d="M 32 32 Q 36 26 40 32" stroke="#22d3ee" strokeWidth={3.5} fill="none" strokeLinecap="round" />
        <Path d="M 60 32 Q 64 26 68 32" stroke="#22d3ee" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      </>
    ) : isSad ? (
      <>
        <Path d="M 32 26 L 40 34 M 40 26 L 32 34" stroke="#EF4444" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M 60 26 L 68 34 M 68 26 L 60 34" stroke="#EF4444" strokeWidth={3} fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <Rect x="32" y="28" width="36" height="8" rx="4" fill="#22d3ee" />
        <Circle cx="36" cy="32" r="1.5" fill="#ffffff" opacity={0.8} />
      </>
    )}

    {/* Leher */}
    <Rect x="44" y="59" width="12" height="6" fill="#475569" />
    {/* Badan Logam */}
    <Path d="M 32,65 L 68,65 L 72,88 L 28,88 Z" fill="#64748b" stroke="#475569" strokeWidth={3} />
    {/* Inti Energi */}
    <Circle cx="50" cy="76" r="5" fill="#22d3ee" />
  </Svg>
);

export default function RoboMazeScreen() {
  const router = useRouter();
  const [level, setLevel] = useState(2); // Starts at level 2 replica by default
  const [userCoins, setUserCoins] = useState(1250);
  const [gameState, setGameState] = useState<"playing" | "victory" | "completed" | "failed">("playing");

  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [lives, setLives] = useState(3);
  const [steps, setSteps] = useState(0);
  const [peeksLeft, setPeeksLeft] = useState(2);
  const [showWalls, setShowWalls] = useState(true);
  const [isGameActive, setIsGameActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(8);

  // Layout Dynamic Sizes (calculated from gameplayArea onLayout)
  const [layoutWidth, setLayoutWidth] = useState(360);
  const [layoutHeight, setLayoutHeight] = useState(360);

  const containerShakeX = useSharedValue(0);
  const containerShakeY = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  // Robot dynamic scale and jump offset for jumping feel
  const robotScaleX = useSharedValue(1);
  const robotScaleY = useSharedValue(1);
  const robotJumpY = useSharedValue(0);

  // Robot gentle hover animation (robotIdle 2s)
  const hoverY = useSharedValue(0);

  const currentConfig = useMemo(() => {
    return LEVEL_CONFIGS[level] || LEVEL_CONFIGS[2];
  }, [level]);

  // Measured Board sizing: fits 90% of layout width and height, preserving 9/6 aspect ratio
  const boardMetrics = useMemo(() => {
    const marginRatio = 0.92;
    const maxBoardWidth = layoutWidth * marginRatio;
    const maxBoardHeight = layoutHeight * marginRatio;

    let width = maxBoardWidth;
    let height = maxBoardWidth / 1.5;

    if (height > maxBoardHeight) {
      height = maxBoardHeight;
      width = maxBoardHeight * 1.5;
    }

    // Grid bounds padding relative to the board
    const gridWidth = width * 0.88;
    const gridHeight = height * 0.80;
    const gridLeft = width * 0.06;
    const gridTop = height * 0.10;

    const cellWidth = gridWidth / (COLS - 1);
    const cellHeight = gridHeight / (ROWS - 1);
    const cellSize = Math.min(cellWidth, cellHeight);

    const robotSize = cellSize * 0.82;
    const goalSize = cellSize * 0.82;
    const dotSize = cellSize * 0.24;
    const thickness = Math.max(6, cellSize * 0.13);

    return {
      boardWidth: width,
      boardHeight: height,
      gridWidth,
      gridHeight,
      gridLeft,
      gridTop,
      cellWidth,
      cellHeight,
      robotSize,
      goalSize,
      dotSize,
      thickness,
    };
  }, [layoutWidth, layoutHeight]);

  // Load Coins and Level Balance
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const storedCoins = await AsyncStorage.getItem(COINS_STORAGE_KEY);
        if (storedCoins !== null) {
          setUserCoins(parseInt(storedCoins));
        }
        const storedLevel = await AsyncStorage.getItem("robo_maze_current_level");
        if (storedLevel !== null) {
          setLevel(parseInt(storedLevel));
        }
      } catch (e) {
        console.error("Failed to load progress", e);
      }
    };
    loadProgress();
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

  // Compile full collision key lookup table
  const collisionIndex = useMemo(() => {
    const table = new Set<string>();
    currentConfig.walls.forEach((w) => {
      if (w.type === "H") {
        for (let i = 0; i < w.len; i++) {
          const cx = w.x + i;
          const cy = w.y;
          if (cx < COLS && cy < ROWS - 1) {
            table.add(`${cx},${cy}-${cx},${cy + 1}`);
            table.add(`${cx},${cy + 1}-${cx},${cy}`);
          }
        }
      } else if (w.type === "V") {
        for (let i = 0; i < w.len; i++) {
          const cx = w.x;
          const cy = w.y + i;
          if (cx < COLS - 1 && cy < ROWS) {
            table.add(`${cx},${cy}-${cx + 1},${cy}`);
            table.add(`${cx + 1},${cy}-${cx},${cy}`);
          }
        }
      }
    });
    return table;
  }, [currentConfig]);

  const initLevel = (lvlIndex: number) => {
    const config = LEVEL_CONFIGS[lvlIndex];
    if (!config) return;

    setPlayerPos({ ...config.start });
    setLives(3);
    setSteps(0);
    setPeeksLeft(config.peeks);
    setShowWalls(true);
    setIsGameActive(false);
    setCountdownSeconds(8);
    setGameState("playing");
  };

  useEffect(() => {
    initLevel(level);
  }, [level]);

  // Idle hover animation looping
  useEffect(() => {
    hoverY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1000 }),
        withTiming(0, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  // Memory countdown phase (8 seconds)
  useEffect(() => {
    if (gameState !== "playing" || isGameActive) return;

    const timer = setInterval(() => {
      setCountdownSeconds((sec) => {
        if (sec <= 1) {
          clearInterval(timer);
          setShowWalls(false);
          setIsGameActive(true);
          playSynthSound("invisible");
          return 0;
        } else {
          playSynthSound("tick");
          return sec - 1;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, isGameActive]);

  // Keyboard navigation support on web
  useEffect(() => {
    if (Platform.OS !== "web" || !isGameActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          movePlayer(0, -1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          movePlayer(0, 1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          movePlayer(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          movePlayer(1, 0);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGameActive, playerPos, collisionIndex]);

  const movePlayer = (dx: number, dy: number) => {
    if (!isGameActive || gameState !== "playing") return;

    const nextX = playerPos.x + dx;
    const nextY = playerPos.y + dy;

    if (nextX < 0 || nextX >= COLS || nextY < 0 || nextY >= ROWS) return;

    // Check collision key
    const pathKey = `${playerPos.x},${playerPos.y}-${nextX},${nextY}`;
    if (collisionIndex.has(pathKey)) {
      triggerCollision();
      return;
    }

    // Success step
    triggerHaptic("light");
    playSynthSound("move");
    setPlayerPos({ x: nextX, y: nextY });
    setSteps((s) => s + 1);

    // Apply Dash jump squash/stretch matching robotDash keyframe (0.25s)
    robotScaleX.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(1.05, { duration: 100 }),
      withTiming(1, { duration: 50 })
    );
    robotScaleY.value = withSequence(
      withTiming(1.1, { duration: 100 }),
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 50 })
    );
    robotJumpY.value = withSequence(
      withTiming(-10, { duration: 100 }),
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 50 })
    );

    // Check Goal
    if (nextX === currentConfig.goal.x && nextY === currentConfig.goal.y) {
      triggerVictory();
    }
  };

  const triggerCollision = () => {
    triggerHaptic("error");
    playSynthSound("hit");

    // Red screen flash
    flashOpacity.value = withSequence(
      withTiming(0.35, { duration: 100 }),
      withTiming(0, { duration: 200 })
    );

    // Screen Shake Reanimated
    containerShakeX.value = withSequence(
      withTiming(-5, { duration: 30 }),
      withTiming(5, { duration: 30 }),
      withTiming(-5, { duration: 30 }),
      withTiming(5, { duration: 30 }),
      withTiming(-5, { duration: 30 }),
      withTiming(5, { duration: 30 }),
      withTiming(0, { duration: 30 })
    );
    containerShakeY.value = withSequence(
      withTiming(3, { duration: 30 }),
      withTiming(-3, { duration: 30 }),
      withTiming(3, { duration: 30 }),
      withTiming(-3, { duration: 30 }),
      withTiming(3, { duration: 30 }),
      withTiming(-3, { duration: 30 }),
      withTiming(0, { duration: 30 })
    );

    setLives((l) => {
      const nextLives = Math.max(0, l - 1);
      if (nextLives === 0) {
        setGameState("failed");
        setIsGameActive(false);
        playSynthSound("gameover");
        setShowWalls(true);
      }
      return nextLives;
    });
  };

  const triggerVictory = () => {
    setIsGameActive(false);
    setShowWalls(true);
    triggerHaptic("success");
    playSynthSound("victory");

    if (level < 3) {
      setGameState("victory");
    } else {
      setGameState("completed");
    }
  };

  const handleUsePeek = () => {
    if (!isGameActive || peeksLeft <= 0 || showWalls || countdownSeconds > 0) return;

    triggerHaptic("light");
    playSynthSound("invisible");
    setPeeksLeft((p) => p - 1);
    setShowWalls(true);

    // Re-hide walls after 1.5 seconds
    setTimeout(() => {
      setShowWalls(false);
    }, 1500);
  };

  const handleNextLevel = async () => {
    triggerHaptic("light");
    const nextLvl = level + 1;
    const finalBalance = userCoins + currentConfig.rewardCoins;

    try {
      await AsyncStorage.setItem(COINS_STORAGE_KEY, finalBalance.toString());
      await AsyncStorage.setItem("robo_maze_current_level", nextLvl.toString());
      setUserCoins(finalBalance);
      setLevel(nextLvl);
    } catch (e) {
      console.error("Failed to save progress", e);
      setLevel(nextLvl);
    }
  };

  const handleClaimAndExit = async () => {
    triggerHaptic("success");
    const finalBalance = userCoins + currentConfig.rewardCoins;

    try {
      await AsyncStorage.setItem(COINS_STORAGE_KEY, finalBalance.toString());
      await AsyncStorage.setItem("robo_maze_current_level", "1");
      router.back();
    } catch (e) {
      console.error("Failed to save progress", e);
      router.back();
    }
  };

  const onGameplayLayout = (e: any) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayoutWidth(width);
      setLayoutHeight(height);
    }
  };

  // Reanimated style structures
  const containerShakeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: containerShakeX.value },
      { translateY: containerShakeY.value },
    ],
  }));

  const screenFlashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const robotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: robotScaleX.value },
      { scaleY: robotScaleY.value },
      { translateY: robotJumpY.value + hoverY.value },
    ],
  }));

  // Border & Glow settings on Game Container
  const dynamicContainerGlow = useMemo(() => {
    if (lives < 3 && flashOpacity.value > 0) {
      return {
        borderColor: "rgba(239, 68, 68, 0.8)",
        shadowColor: "#EF4444",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.65,
        shadowRadius: 25,
        elevation: 12,
      };
    } else if (countdownSeconds > 0) {
      return {
        borderColor: "rgba(245, 158, 11, 0.6)",
        shadowColor: "#F59E0B",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 8,
      };
    } else {
      return {
        borderColor: "rgba(34, 211, 238, 0.5)",
        shadowColor: "#22D3EE",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 8,
      };
    }
  }, [lives, countdownSeconds, flashOpacity.value]);

  const {
    boardWidth,
    boardHeight,
    gridLeft,
    gridTop,
    cellWidth,
    cellHeight,
    robotSize,
    goalSize,
    dotSize,
    thickness,
  } = boardMetrics;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* FLASH SCREEN ERROR OVERLAY */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.flashOverlay, screenFlashStyle]} pointerEvents="none" />

      {/* COMPACT HUD BAR */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => {
              triggerHaptic("light");
              router.back();
            }}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </Pressable>

          <View style={styles.levelBadge}>
            <MaterialCommunityIcons name="microchip" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text style={styles.levelBadgeText}>Level {level}</Text>
          </View>

          <Text style={styles.systemStatusText}>
            System:{" "}
            <Text
              style={
                countdownSeconds > 0
                  ? styles.systemTextMemorizing
                  : styles.systemTextActive
              }
            >
              {countdownSeconds > 0 ? "Mengingat..." : "Cari Jalan!"}
            </Text>
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.hudStatBadgeRose}>
            <Ionicons name="heart" size={12} color="#E11D48" style={{ marginRight: 2 }} />
            <Text style={styles.hudStatTextRose}>Core: {lives}</Text>
          </View>
          <View style={styles.hudStatBadgeIndigo}>
            <Ionicons name="footsteps" size={12} color="#4F46E5" style={{ marginRight: 2 }} />
            <Text style={styles.hudStatTextIndigo}>Langkah: {steps}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Pressable
            onPress={handleUsePeek}
            disabled={peeksLeft <= 0 || showWalls || countdownSeconds > 0}
            style={({ pressed }) => [
              styles.peekButton,
              (peeksLeft <= 0 || showWalls || countdownSeconds > 0) && { opacity: 0.4 },
              pressed && { scale: 0.95 },
            ]}
          >
            <Ionicons name="eye" size={11} color="#FFFFFF" style={{ marginRight: 2 }} />
            <Text style={styles.peekButtonText}>Intip ({peeksLeft})</Text>
          </Pressable>
          <Pressable
            onPress={() => initLevel(level)}
            style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="reload" size={14} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.hazardTapeTop} />

      {/* GAMEPLAY AREA (Takes up 100% available space) */}
      <View style={styles.gameplayArea} onLayout={onGameplayLayout}>
        <Animated.View style={[styles.gameContainer, dynamicContainerGlow, { width: boardWidth, height: boardHeight }, containerShakeStyle]}>
          
          {/* Radial Gradient cyber blueprint background */}
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <RadialGradient id="bgGlow" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
                <Stop offset="0%" stopColor="#F8FAFC" />
                <Stop offset="100%" stopColor="#CBD5E1" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#bgGlow)" />
            
            {/* Cyber Grid Lines */}
            {Array.from({ length: 15 }).map((_, i) => (
              <Line key={`lh-${i}`} x1="0" y1={i * 20} x2="100%" y2={i * 20} stroke="rgba(14, 165, 233, 0.12)" strokeWidth={1} />
            ))}
            {Array.from({ length: 25 }).map((_, i) => (
              <Line key={`lv-${i}`} x1={i * 20} y1="0" x2={i * 20} y2="100%" stroke="rgba(14, 165, 233, 0.12)" strokeWidth={1} />
            ))}
          </Svg>

          {/* Floating Cyber Binary Particles */}
          <Text style={[styles.cyberParticle, { top: "10%", left: "10%" }]}>010110</Text>
          <Text style={[styles.cyberParticle, { top: "40%", left: "45%" }]}>SYSTEM_OK</Text>
          <Text style={[styles.cyberParticle, { top: "70%", left: "20%" }]}>1001</Text>
          <Text style={[styles.cyberParticle, { top: "25%", left: "75%" }]}>[RUNNING]</Text>
          <Text style={[styles.cyberParticle, { top: "80%", left: "80%" }]}>0xAA55</Text>

          {/* Countdown Memory Phase overlay */}
          {countdownSeconds > 0 && (
            <View style={styles.countdownOverlay} pointerEvents="none">
              <MaterialCommunityIcons name="timer-sand" size={15} color="#0F172A" style={styles.spinIcon} />
              <Text style={styles.countdownOverlayText}>Ingat Rintangan! <Text style={styles.countdownSec}>{countdownSeconds}s</Text></Text>
            </View>
          )}

          {/* DYNAMIC SCALE-RESPONSIVE GRID MAZE WRAPPER */}
          <View style={[styles.mazeGridWrapper, { left: gridLeft, top: gridTop, width: boardWidth - gridLeft * 2, height: boardHeight - gridTop - boardHeight * 0.08 }]}>
            
            {/* Render 9x6 Connection Dots (Nodes) */}
            {Array.from({ length: ROWS }).map((_, r) =>
              Array.from({ length: COLS }).map((_, c) => {
                const isGoal = c === currentConfig.goal.x && r === currentConfig.goal.y;
                const isStart = c === currentConfig.start.x && r === currentConfig.start.y;
                return (
                  <View
                    key={`dot-${c}-${r}`}
                    style={[
                      styles.gridDot,
                      {
                        left: c * cellWidth,
                        top: r * cellHeight,
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        transform: [{ translateX: -dotSize / 2 }, { translateY: -dotSize / 2 }],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.dotCore,
                        {
                          width: dotSize * 0.35,
                          height: dotSize * 0.35,
                          borderRadius: (dotSize * 0.35) / 2,
                        },
                        isGoal && { backgroundColor: "#10B981" },
                        isStart && { backgroundColor: "#3B82F6" },
                      ]}
                    />
                  </View>
                );
              })
            )}

            {/* Charging goal station */}
            <View
              style={[
                styles.goalStation,
                {
                  left: currentConfig.goal.x * cellWidth,
                  top: currentConfig.goal.y * cellHeight,
                  width: goalSize,
                  height: goalSize,
                  transform: [{ translateX: -goalSize / 2 }, { translateY: -goalSize / 2 }],
                },
              ]}
            >
              <MaterialCommunityIcons name="charging-station" size={goalSize * 0.72} color="#22D3EE" style={styles.goalBounceIcon} />
              <View style={[styles.stationLabel, { bottom: -goalSize * 0.28 }]}>
                <Text style={styles.stationLabelText}>CHARGE</Text>
              </View>
            </View>

            {/* Laser Obstacle Walls (Exact scale and coordinates from HTML) */}
            {currentConfig.walls.map((wall, idx) => {
              if (wall.type === "H") {
                return (
                  <View
                    key={`wall-${idx}`}
                    style={[
                      styles.wallLaser,
                      {
                        left: (wall.x - 0.5) * cellWidth,
                        top: (wall.y + 0.5) * cellHeight,
                        width: wall.len * cellWidth,
                        height: thickness,
                        transform: [{ translateY: -thickness / 2 }],
                        opacity: showWalls ? 1 : 0,
                      },
                    ]}
                  >
                    <View style={styles.laserCoreLine} />
                  </View>
                );
              } else {
                return (
                  <View
                    key={`wall-${idx}`}
                    style={[
                      styles.wallLaser,
                      {
                        left: (wall.x + 0.5) * cellWidth,
                        top: (wall.y - 0.5) * cellHeight,
                        width: thickness,
                        height: wall.len * cellHeight,
                        transform: [{ translateX: -thickness / 2 }],
                        opacity: showWalls ? 1 : 0,
                      },
                    ]}
                  >
                    <View style={styles.laserCoreLine} />
                  </View>
                );
              }
            })}

            {/* Slime Robot Character */}
            <Animated.View
              style={[
                styles.playerSlime,
                robotAnimatedStyle,
                {
                  left: playerPos.x * cellWidth,
                  top: playerPos.y * cellHeight,
                  width: robotSize,
                  height: robotSize,
                  transform: [
                    { translateX: -robotSize / 2 },
                    { translateY: -robotSize / 2 },
                    { scaleX: robotScaleX.value },
                    { scaleY: robotScaleY.value },
                    { translateY: robotJumpY.value + hoverY.value },
                  ],
                },
              ]}
            >
              <SlimeRobotSvg
                isHappy={gameState === "victory" || gameState === "completed"}
                isSad={lives === 0 || gameState === "failed"}
              />
            </Animated.View>

          </View>

          {/* COMPACT FLOATING D-PAD OVERLAY IN BOTTOM-RIGHT OF BOARD */}
          <View style={styles.dpadContainer}>
            <View style={styles.dpadKeypad}>
              <View style={styles.dpadCenterDecor}>
                <MaterialCommunityIcons name="gamepad" size={14} color="rgba(79, 70, 229, 0.35)" />
              </View>
              
              {/* UP BUTTON */}
              <Pressable
                onPress={() => movePlayer(0, -1)}
                style={({ pressed }) => [styles.dpadBtn, styles.dpadUp, pressed && styles.dpadBtnPressed]}
              >
                <Ionicons name="chevron-up" size={16} color="#4338CA" />
              </Pressable>

              {/* DOWN BUTTON */}
              <Pressable
                onPress={() => movePlayer(0, 1)}
                style={({ pressed }) => [styles.dpadBtn, styles.dpadDown, pressed && styles.dpadBtnPressed]}
              >
                <Ionicons name="chevron-down" size={16} color="#4338CA" />
              </Pressable>

              {/* LEFT BUTTON */}
              <Pressable
                onPress={() => movePlayer(-1, 0)}
                style={({ pressed }) => [styles.dpadBtn, styles.dpadLeft, pressed && styles.dpadBtnPressed]}
              >
                <Ionicons name="chevron-back" size={16} color="#4338CA" />
              </Pressable>

              {/* RIGHT BUTTON */}
              <Pressable
                onPress={() => movePlayer(1, 0)}
                style={({ pressed }) => [styles.dpadBtn, styles.dpadRight, pressed && styles.dpadBtnPressed]}
              >
                <Ionicons name="chevron-forward" size={16} color="#4338CA" />
              </Pressable>
            </View>
          </View>

        </Animated.View>
      </View>

      <View style={styles.hazardTapeBottom} />

      {/* COMPACT FOOTER MISSION CARD (Height reduced by 40%) */}
      <View style={styles.missionCardContainer}>
        <View style={styles.missionCard}>
          <View style={styles.missionCardHeader}>
            <View style={styles.skillBadge}>
              <Text style={styles.skillBadgeText}>🧠 WORKING MEMORY</Text>
            </View>
            <Text style={styles.xpReward}>+{currentConfig.rewardXP} XP</Text>
          </View>
          <Text style={styles.missionTitle}>Robo-Maze (Invisible)</Text>
          <Text style={styles.missionDescription}>{currentConfig.instructions}</Text>
        </View>
      </View>

      {/* VICTORY MODAL */}
      <Modal visible={gameState === "victory"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.victoryIconCircle}>
              <Ionicons name="trophy" size={36} color="#F59E0B" />
            </View>
            <Text style={styles.modalTitle}>BERHASIL MASUK!</Text>
            <Text style={styles.modalSubtitle}>Sempurna! Slime Robot berhasil mencapai stasiun pengisian daya dengan selamat.</Text>

            <View style={styles.statsSummary}>
              <Text style={styles.statsLabel}>REKAP LANGKAH</Text>
              <Text style={styles.statsValue}>{steps} Langkah // Sisa {lives} Core</Text>
            </View>

            <View style={styles.rewardSummary}>
              <Text style={styles.rewardLabel}>HADIAH</Text>
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons name="coin" size={18} color="#F59E0B" />
                <Text style={styles.rewardBadgeText}>+{currentConfig.rewardCoins} Koin</Text>
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

      {/* COMPLETION MODAL */}
      <Modal visible={gameState === "completed"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.victoryIconCircle, { borderColor: "#D97706" }]}>
              <Ionicons name="medal" size={40} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>SELESAI LENGKAP!</Text>
            <Text style={styles.modalSubtitle}>Luar biasa! Kamu memiliki daya ingat spasial yang luar biasa dan menaklukkan semua level!</Text>

            <View style={styles.rewardSummary}>
              <Text style={styles.rewardLabel}>BONUS UTAMA</Text>
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons name="coin" size={18} color="#F59E0B" />
                <Text style={styles.rewardBadgeText}>+{currentConfig.rewardCoins} Koin</Text>
              </View>
            </View>

            <Button
              title="Klaim Koin & Selesai"
              onPress={handleClaimAndExit}
              variant="primary"
              style={{ width: "100%" }}
            />
          </View>
        </View>
      </Modal>

      {/* GAME OVER MODAL */}
      <Modal visible={gameState === "failed"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.victoryIconCircle, { borderColor: "#EF4444" }]}>
              <Ionicons name="close-circle" size={40} color="#EF4444" />
            </View>
            <Text style={[styles.modalTitle, { color: "#EF4444" }]}>CORE RUSAK!</Text>
            <Text style={styles.modalSubtitle}>Robot terlalu sering menabrak laser tak terlihat dan kehabisan daya.</Text>

            <Button
              title="Coba Lagi"
              onPress={() => initLevel(level)}
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
    backgroundColor: "#0F172A",
  },
  flashOverlay: {
    zIndex: 99,
    backgroundColor: "rgba(239, 68, 68, 0.35)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: "#0F172A",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1E293B",
    zIndex: 90,
  },
  backBtn: {
    backgroundColor: "#1E293B",
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  resetBtn: {
    backgroundColor: "#334155",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#475569",
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0891B2",
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    shadowColor: "#0891B2",
    shadowRadius: 3,
    shadowOpacity: 0.25,
  },
  levelBadgeText: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  systemStatusText: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#64748B",
    marginLeft: 4,
  },
  systemTextMemorizing: {
    color: "#D97706",
  },
  systemTextActive: {
    color: "#059669",
  },
  hudStatBadgeRose: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFE4E6",
    borderColor: "#FDA4AF",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  hudStatTextRose: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#BE123C",
  },
  hudStatBadgeIndigo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0E7FF",
    borderColor: "#C7D2FE",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  hudStatTextIndigo: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#4338CA",
  },
  peekButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: "#059669",
    shadowRadius: 3,
    shadowOpacity: 0.25,
  },
  peekButtonText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  hazardTapeTop: {
    height: 4,
    backgroundColor: "#FBBF24",
    borderBottomWidth: 1,
    borderBottomColor: "#D97706",
  },
  hazardTapeBottom: {
    height: 4,
    backgroundColor: "#FBBF24",
    borderTopWidth: 1,
    borderTopColor: "#D97706",
  },
  gameplayArea: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  gameContainer: {
    backgroundColor: "#CBD5E1",
    borderRadius: 24,
    borderWidth: 4,
    position: "relative",
    overflow: "hidden",
  },
  cyberParticle: {
    position: "absolute",
    color: "rgba(14, 165, 233, 0.35)",
    fontSize: 9.5,
    fontFamily: "monospace",
    fontWeight: "bold",
    zIndex: 1,
  },
  countdownOverlay: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    backgroundColor: "#FFB020",
    borderColor: "#FFFFFF",
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    zIndex: 50,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
  countdownOverlayText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#0F172A",
  },
  countdownSec: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0F172A",
  },
  spinIcon: {
    opacity: 0.9,
  },
  mazeGridWrapper: {
    position: "absolute",
  },
  gridDot: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  dotCore: {
    backgroundColor: "#22D3EE",
    opacity: 0.8,
  },
  goalStation: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 15,
  },
  goalBounceIcon: {
    shadowColor: "#22D3EE",
    shadowRadius: 8,
    shadowOpacity: 0.8,
  },
  stationLabel: {
    position: "absolute",
    backgroundColor: "#0F172A",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderWidth: 1,
    borderColor: "#22D3EE",
  },
  stationLabelText: {
    fontSize: 5,
    fontWeight: "900",
    color: "#22D3EE",
  },
  wallLaser: {
    position: "absolute",
    backgroundColor: "#F43F5E",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDA4AF",
    zIndex: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#F43F5E",
    shadowRadius: 6,
    shadowOpacity: 0.85,
    elevation: 4,
  },
  laserCoreLine: {
    width: "80%",
    height: 1.5,
    backgroundColor: "#FFE4E6",
    opacity: 0.75,
  },
  playerSlime: {
    position: "absolute",
    zIndex: 30,
    shadowColor: "#22D3EE",
    shadowRadius: 10,
    shadowOpacity: 0.75,
  },
  slimeSvg: {
    width: "100%",
    height: "100%",
  },
  dpadContainer: {
    position: "absolute",
    bottom: 8,
    right: 8,
    zIndex: 40,
    opacity: 0.8,
  },
  dpadKeypad: {
    position: "relative",
    width: 84,
    height: 84,
    backgroundColor: "rgba(15, 23, 42, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 42,
    justifyContent: "center",
    alignItems: "center",
  },
  dpadCenterDecor: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(15, 23, 42, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  dpadBtn: {
    position: "absolute",
    width: 26,
    height: 26,
    backgroundColor: "rgba(79, 70, 229, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.18)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  dpadBtnPressed: {
    backgroundColor: "rgba(79, 70, 229, 0.45)",
    transform: [{ scale: 0.95 }],
  },
  dpadUp: {
    top: 2,
  },
  dpadDown: {
    bottom: 2,
  },
  dpadLeft: {
    left: 2,
  },
  dpadRight: {
    right: 2,
  },
  missionCardContainer: {
    paddingHorizontal: SPACING.md + 2,
    paddingBottom: SPACING.md + 2,
    backgroundColor: "#0F172A",
  },
  missionCard: {
    backgroundColor: "#1E293B",
    borderRadius: 8,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderColor: "#334155",
    ...SHADOWS.light,
  },
  missionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  skillBadge: {
    backgroundColor: "#0F172A",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  skillBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  xpReward: {
    fontSize: 10,
    fontWeight: "900",
    color: "#10B981",
  },
  missionTitle: {
    ...FONTS.bodyBold,
    fontSize: 11.5,
    color: "#F8FAFC",
    marginBottom: 1,
  },
  missionDescription: {
    ...FONTS.bodyRegular,
    fontSize: 9,
    color: "#94A3B8",
    lineHeight: 12.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  modalContent: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 300,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#334155",
    ...SHADOWS.medium,
  },
  victoryIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: "#F59E0B",
  },
  modalTitle: {
    ...FONTS.heading,
    fontSize: 18,
    color: "#F8FAFC",
    textAlign: "center",
    marginBottom: 4,
  },
  modalSubtitle: {
    ...FONTS.bodyRegular,
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 16,
    marginBottom: SPACING.md,
  },
  statsSummary: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    width: "100%",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statsLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 2,
  },
  statsValue: {
    fontSize: 11,
    fontWeight: "900",
    color: "#38BDF8",
  },
  rewardSummary: {
    backgroundColor: "#0F172A",
    borderRadius: 6,
    padding: SPACING.sm + 2,
    alignItems: "center",
    width: "100%",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "#334155",
  },
  rewardLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 1,
    marginBottom: 2,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#D97706",
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 4,
  },
  rewardBadgeText: {
    ...FONTS.bodyBold,
    fontSize: 14,
    color: "#FBBF24",
  },
});
