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
  runOnJS,
} from "react-native-reanimated";
import Svg, { Line, Circle, Path, Rect, G } from "react-native-svg";
import { COLORS, SPACING, SHAPES, FONTS, SHADOWS } from "../constants/Theme";
import Button from "../components/ui/Button";

const COINS_STORAGE_KEY = "user_coins_balance";

interface Tile {
  id: string;
  col: number;
  row: number;
  type: "straight" | "elbow" | "t_junction";
  rotation: number; // 0, 90, 180, 270 degrees
}

interface LevelConfig {
  level: number;
  cols: number;
  rows: number;
  startCol: number;
  startRow: number;
  startDir: "top" | "right" | "bottom" | "left";
  endCol: number;
  endRow: number;
  endDir: "top" | "right" | "bottom" | "left";
  tiles: {
    col: number;
    row: number;
    type: "straight" | "elbow" | "t_junction";
    initialRotation: number;
  }[];
  rewardCoins: number;
  rewardXP: number;
  instructions: string;
  timeLimit: number; // in seconds
}

const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: 1,
    cols: 3,
    rows: 3,
    startCol: 0,
    startRow: 2,
    startDir: "left",
    endCol: 2,
    endRow: 0,
    endDir: "right",
    tiles: [
      { col: 0, row: 2, type: "elbow", initialRotation: 0 },
      { col: 0, row: 1, type: "straight", initialRotation: 0 },
      { col: 0, row: 0, type: "elbow", initialRotation: 90 },
      { col: 1, row: 0, type: "straight", initialRotation: 90 },
      { col: 2, row: 0, type: "straight", initialRotation: 90 },
    ],
    rewardCoins: 50,
    rewardXP: 30,
    instructions: "Ketuk segmen kabel papan sirkuit untuk memutarnya. Sambungkan Robot ke PC Target!",
    timeLimit: 30,
  },
  {
    level: 2,
    cols: 4,
    rows: 4,
    startCol: 0,
    startRow: 3,
    startDir: "left",
    endCol: 3,
    endRow: 0,
    endDir: "right",
    tiles: [
      { col: 0, row: 3, type: "elbow", initialRotation: 90 },
      { col: 0, row: 2, type: "elbow", initialRotation: 90 },
      { col: 1, row: 2, type: "elbow", initialRotation: 0 },
      { col: 1, row: 1, type: "elbow", initialRotation: 270 },
      { col: 2, row: 1, type: "elbow", initialRotation: 90 },
      { col: 2, row: 0, type: "elbow", initialRotation: 180 },
      { col: 3, row: 0, type: "straight", initialRotation: 90 },
    ],
    rewardCoins: 75,
    rewardXP: 45,
    instructions: "Buat rute kabel berliku-liku di papan sirkuit dengan memutar setiap ubin siku!",
    timeLimit: 30,
  },
  {
    level: 3,
    cols: 4,
    rows: 4,
    startCol: 0,
    startRow: 3,
    startDir: "left",
    endCol: 3,
    endRow: 0,
    endDir: "right",
    tiles: [
      { col: 0, row: 3, type: "straight", initialRotation: 90 },
      { col: 1, row: 3, type: "elbow", initialRotation: 0 },
      { col: 1, row: 2, type: "straight", initialRotation: 0 },
      { col: 1, row: 1, type: "elbow", initialRotation: 270 },
      { col: 2, row: 1, type: "straight", initialRotation: 90 },
      { col: 3, row: 1, type: "elbow", initialRotation: 90 },
      { col: 3, row: 0, type: "elbow", initialRotation: 180 },
      { col: 2, row: 3, type: "elbow", initialRotation: 90 }, // Trap tile
    ],
    rewardCoins: 100,
    rewardXP: 60,
    instructions: "Waspada ubin jebakan di kanan bawah! Cari rute logis lain yang benar-benar tersambung.",
    timeLimit: 35,
  },
  {
    level: 4,
    cols: 5,
    rows: 5,
    startCol: 0,
    startRow: 4,
    startDir: "left",
    endCol: 4,
    endRow: 0,
    endDir: "right",
    tiles: [
      { col: 0, row: 4, type: "elbow", initialRotation: 0 },
      { col: 0, row: 3, type: "straight", initialRotation: 0 },
      { col: 0, row: 2, type: "elbow", initialRotation: 90 },
      { col: 1, row: 2, type: "t_junction", initialRotation: 90 },
      { col: 1, row: 3, type: "elbow", initialRotation: 0 }, // Dead end link
      { col: 2, row: 2, type: "elbow", initialRotation: 90 },
      { col: 2, row: 1, type: "straight", initialRotation: 0 },
      { col: 2, row: 0, type: "elbow", initialRotation: 270 },
      { col: 3, row: 0, type: "straight", initialRotation: 90 },
      { col: 4, row: 0, type: "straight", initialRotation: 90 },
    ],
    rewardCoins: 150,
    rewardXP: 90,
    instructions: "Gunakan pembagi ubin tipe-T 📡! Rencanakan arah aliran sirkuit agar tidak terjebak di cabang mati.",
    timeLimit: 40,
  },
  {
    level: 5,
    cols: 5,
    rows: 5,
    startCol: 0,
    startRow: 4,
    startDir: "left",
    endCol: 4,
    endRow: 0,
    endDir: "right",
    tiles: [
      { col: 0, row: 4, type: "straight", initialRotation: 90 },
      { col: 1, row: 4, type: "elbow", initialRotation: 0 },
      { col: 1, row: 3, type: "elbow", initialRotation: 90 },
      { col: 2, row: 3, type: "straight", initialRotation: 90 },
      { col: 3, row: 3, type: "elbow", initialRotation: 0 },
      { col: 3, row: 2, type: "elbow", initialRotation: 0 },
      { col: 2, row: 2, type: "elbow", initialRotation: 90 },
      { col: 2, row: 1, type: "straight", initialRotation: 0 },
      { col: 2, row: 0, type: "elbow", initialRotation: 180 },
      { col: 3, row: 0, type: "straight", initialRotation: 90 },
      { col: 4, row: 0, type: "straight", initialRotation: 90 },
      { col: 0, row: 2, type: "straight", initialRotation: 90 }, // Decoy
      { col: 4, row: 4, type: "elbow", initialRotation: 180 }, // Decoy
    ],
    rewardCoins: 250,
    rewardXP: 120,
    instructions: "Tantangan Papan Sirkuit Final! Hubungkan jalur kabel tembaga terpanjang dari Robot ke Terminal target.",
    timeLimit: 45,
  },
];

const getTilePorts = (type: "straight" | "elbow" | "t_junction", rotation: number): string[] => {
  let basePorts: string[] = [];
  if (type === "straight") {
    basePorts = ["left", "right"];
  } else if (type === "elbow") {
    basePorts = ["bottom", "right"];
  } else if (type === "t_junction") {
    basePorts = ["left", "right", "bottom"];
  }

  const dirs = ["top", "right", "bottom", "left"];
  const steps = (rotation / 90) % 4;

  return basePorts.map((port) => {
    const idx = dirs.indexOf(port);
    const nextIdx = (idx + steps) % 4;
    return dirs[nextIdx];
  });
};

const computeConnectivity = (
  tiles: Tile[],
  cols: number,
  rows: number,
  startCol: number,
  startRow: number,
  startDir: "top" | "right" | "bottom" | "left",
  endCol: number,
  endRow: number,
  endDir: "top" | "right" | "bottom" | "left"
): { poweredIds: string[]; isTargetConnected: boolean } => {
  const poweredIds: string[] = [];
  const visited = new Set<string>();

  const tileMap = new Map<string, Tile>();
  tiles.forEach((t) => {
    tileMap.set(`${t.col},${t.row}`, t);
  });

  const getTile = (c: number, r: number) => tileMap.get(`${c},${r}`);
  const queue: { col: number; row: number; enterDir: string }[] = [];

  const startTile = getTile(startCol, startRow);
  if (startTile) {
    const ports = getTilePorts(startTile.type, startTile.rotation);
    if (ports.includes(startDir)) {
      queue.push({ col: startCol, row: startRow, enterDir: startDir });
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const key = `${curr.col},${curr.row}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const tile = getTile(curr.col, curr.row);
    if (!tile) continue;

    poweredIds.push(tile.id);
    const ports = getTilePorts(tile.type, tile.rotation);

    ports.forEach((p) => {
      let nc = curr.col;
      let nr = curr.row;
      let targetEnterDir = "";

      if (p === "top") {
        nr = curr.row - 1;
        targetEnterDir = "bottom";
      } else if (p === "right") {
        nc = curr.col + 1;
        targetEnterDir = "left";
      } else if (p === "bottom") {
        nr = curr.row + 1;
        targetEnterDir = "top";
      } else if (p === "left") {
        nc = curr.col - 1;
        targetEnterDir = "right";
      }

      const neighbor = getTile(nc, nr);
      if (neighbor) {
        const neighborPorts = getTilePorts(neighbor.type, neighbor.rotation);
        if (neighborPorts.includes(targetEnterDir) && !visited.has(`${nc},${nr}`)) {
          queue.push({ col: nc, row: nr, enterDir: targetEnterDir });
        }
      }
    });
  }

  let isTargetConnected = false;
  if (visited.has(`${endCol},${endRow}`)) {
    const endTile = getTile(endCol, endRow)!;
    const ports = getTilePorts(endTile.type, endTile.rotation);
    if (ports.includes(endDir)) {
      isTargetConnected = true;
    }
  }

  return {
    poweredIds,
    isTargetConnected,
  };
};

const ICChip = ({ style }: { style: any }) => (
  <View style={[styles.icChipContainer, style]} pointerEvents="none">
    <View style={styles.icPin} />
    <View style={styles.icPin} />
    <View style={styles.icPin} />
    <View style={styles.icBody}>
      <View style={styles.icDot} />
    </View>
    <View style={styles.icPin} />
    <View style={styles.icPin} />
    <View style={styles.icPin} />
  </View>
);

const Resistor = ({ style }: { style: any }) => (
  <View style={[styles.resistorContainer, style]} pointerEvents="none">
    <View style={styles.resistorWire} />
    <View style={styles.resistorBody}>
      <View style={[styles.resistorBand, { backgroundColor: "#B45309" }]} />
      <View style={[styles.resistorBand, { backgroundColor: "#FBBF24" }]} />
      <View style={[styles.resistorBand, { backgroundColor: "#EF4444" }]} />
    </View>
    <View style={styles.resistorWire} />
  </View>
);

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

let audioCtx: AudioContext | null = null;
const playSynthSound = (type: "connect" | "victory" | "fail") => {
  if (Platform.OS !== "web") return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    if (type === "connect") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === "victory") {
      const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
      freqs.forEach((freq, idx) => {
        const osc = audioCtx!.createOscillator();
        const gain = audioCtx!.createGain();
        osc.connect(gain);
        gain.connect(audioCtx!.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.15, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } else if (type === "fail") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.6);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch (e) {
    console.warn("Failed to play synth sound:", e);
  }
};

const traceConnectionPath = (
  tiles: Tile[],
  config: LevelConfig,
  tileSize: number
): { x: number; y: number }[] => {
  const tileMap = new Map<string, Tile>();
  tiles.forEach((t) => {
    tileMap.set(`${t.col},${t.row}`, t);
  });

  const getTile = (c: number, r: number) => tileMap.get(`${c},${r}`);
  const points: { x: number; y: number }[] = [];

  const generatorY = config.startRow * tileSize + tileSize / 2;
  points.push({ x: -12, y: generatorY });

  const startTileCenterX = config.startCol * tileSize + tileSize / 2;
  const startTileCenterY = config.startRow * tileSize + tileSize / 2;
  let currentX = startTileCenterX;
  let currentY = startTileCenterY;
  if (config.startDir === "left") currentX = config.startCol * tileSize;
  else if (config.startDir === "right") currentX = (config.startCol + 1) * tileSize;
  else if (config.startDir === "top") currentY = config.startRow * tileSize;
  else if (config.startDir === "bottom") currentY = (config.startRow + 1) * tileSize;

  points.push({ x: currentX, y: currentY });

  let col = config.startCol;
  let row = config.startRow;
  let enterDir = config.startDir;
  const visited = new Set<string>();

  let loopCount = 0;
  while (loopCount < 100) {
    loopCount++;
    const key = `${col},${row}`;
    visited.add(key);

    const tile = getTile(col, row);
    if (!tile) break;

    const tileCenterX = col * tileSize + tileSize / 2;
    const tileCenterY = row * tileSize + tileSize / 2;
    points.push({ x: tileCenterX, y: tileCenterY });

    const ports = getTilePorts(tile.type, tile.rotation);
    if (!ports.includes(enterDir)) break;

    const exitPorts = ports.filter((p) => p !== enterDir);
    let chosenExit: string | null = null;
    let nextCol = col;
    let nextRow = row;
    let nextEnterDir: "top" | "right" | "bottom" | "left" = "left";

    for (const p of exitPorts) {
      let nc = col;
      let nr = row;
      let targetEnterDir: "top" | "right" | "bottom" | "left" = "left";

      if (p === "top") {
        nr = row - 1;
        targetEnterDir = "bottom";
      } else if (p === "right") {
        nc = col + 1;
        targetEnterDir = "left";
      } else if (p === "bottom") {
        nr = row + 1;
        targetEnterDir = "top";
      } else if (p === "left") {
        nc = col - 1;
        targetEnterDir = "right";
      }

      if (col === config.endCol && row === config.endRow && p === config.endDir) {
        chosenExit = p;
        nextCol = nc;
        nextRow = nr;
        nextEnterDir = targetEnterDir;
        break;
      }

      const neighbor = getTile(nc, nr);
      if (neighbor && !visited.has(`${nc},${nr}`)) {
        const neighborPorts = getTilePorts(neighbor.type, neighbor.rotation);
        if (neighborPorts.includes(targetEnterDir)) {
          chosenExit = p;
          nextCol = nc;
          nextRow = nr;
          nextEnterDir = targetEnterDir;
          break;
        }
      }
    }

    if (!chosenExit) break;

    let exitX = tileCenterX;
    let exitY = tileCenterY;
    if (chosenExit === "left") exitX = col * tileSize;
    else if (chosenExit === "right") exitX = (col + 1) * tileSize;
    else if (chosenExit === "top") exitY = row * tileSize;
    else if (chosenExit === "bottom") exitY = (row + 1) * tileSize;

    points.push({ x: exitX, y: exitY });

    if (col === config.endCol && row === config.endRow && chosenExit === config.endDir) {
      const pcY = config.endRow * tileSize + tileSize / 2;
      points.push({ x: 372, y: pcY });
      break;
    }

    col = nextCol;
    row = nextRow;
    enterDir = nextEnterDir;
  }

  return points;
};

export default function RoboLinkScreen() {
  const router = useRouter();
  const [level, setLevel] = useState(1);
  const [userCoins, setUserCoins] = useState(1250);
  const [gameState, setGameState] = useState<"playing" | "victory" | "completed" | "failed">("playing");

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [timeCounter, setTimeCounter] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isAnimatingFinish, setIsAnimatingFinish] = useState(false);

  const pulseScale = useSharedValue(1);
  const pulseProgress = useSharedValue(0);
  const sharedPoints = useSharedValue<{ x: number; y: number }[]>([]);

  const currentConfig = useMemo(() => {
    return LEVEL_CONFIGS.find((l) => l.level === level) || LEVEL_CONFIGS[0];
  }, [level]);

  // Compute active connection traces Reactively
  const connectivity = useMemo(() => {
    return computeConnectivity(
      tiles,
      currentConfig.cols,
      currentConfig.rows,
      currentConfig.startCol,
      currentConfig.startRow,
      currentConfig.startDir,
      currentConfig.endCol,
      currentConfig.endRow,
      currentConfig.endDir
    );
  }, [tiles, currentConfig]);

  // Haptic trigger
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

  // Timer countdown effect
  useEffect(() => {
    if (gameState !== "playing" || isAnimatingFinish) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          playSynthSound("fail");
          triggerHaptic("error");
          setGameState("failed");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, isAnimatingFinish, level]);

  // Clock frame loop
  useEffect(() => {
    if (gameState !== "playing" && !isAnimatingFinish) return;

    let isRunning = true;
    let frameId: number;

    const loop = () => {
      if (!isRunning) return;
      setTimeCounter((t) => t + 1);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => {
      isRunning = false;
      cancelAnimationFrame(frameId);
    };
  }, [gameState, isAnimatingFinish, level]);

  // Load progress
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const storedCoins = await AsyncStorage.getItem(COINS_STORAGE_KEY);
        if (storedCoins !== null) {
          setUserCoins(parseInt(storedCoins));
        }
        const storedLevel = await AsyncStorage.getItem("robo_link_current_level");
        if (storedLevel !== null) {
          setLevel(parseInt(storedLevel));
        }
      } catch (e) {
        console.error("Failed to load game data", e);
      }
    };
    loadGameData();
  }, []);

  const handleRestartLevel = () => {
    triggerHaptic("light");
    initLevel(level);
  };

  const initLevel = (levelIndex: number) => {
    const config = LEVEL_CONFIGS.find((l) => l.level === levelIndex);
    if (!config) return;

    const initialTiles = config.tiles.map((t, idx) => ({
      id: `tile-${idx}`,
      col: t.col,
      row: t.row,
      type: t.type,
      rotation: t.initialRotation,
    }));

    setTiles(initialTiles);
    setTimeLeft(config.timeLimit || 30);
    setIsAnimatingFinish(false);
    pulseProgress.value = 0;
    sharedPoints.value = [];
    setGameState("playing");
  };

  useEffect(() => {
    initLevel(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const handleFinishTransition = () => {
    playSynthSound("victory");
    triggerHaptic("success");
    pulseScale.value = withSequence(withTiming(1.2, { duration: 150 }), withTiming(1, { duration: 180 }));
    
    setTimeout(() => {
      if (level < LEVEL_CONFIGS.length) {
        setGameState("victory");
      } else {
        setGameState("completed");
      }
      setIsAnimatingFinish(false);
    }, 450);
  };

  // Handle tile rotaton clicks
  const handleTilePress = (tileId: string) => {
    if (gameState !== "playing" || isAnimatingFinish) return;
    triggerHaptic("light");

    setTiles((prevTiles) => {
      const nextTiles = prevTiles.map((t) => {
        if (t.id === tileId) {
          return { ...t, rotation: (t.rotation + 90) % 360 };
        }
        return t;
      });

      const { isTargetConnected } = computeConnectivity(
        nextTiles,
        currentConfig.cols,
        currentConfig.rows,
        currentConfig.startCol,
        currentConfig.startRow,
        currentConfig.startDir,
        currentConfig.endCol,
        currentConfig.endRow,
        currentConfig.endDir
      );

      if (isTargetConnected) {
        playSynthSound("connect");
        const path = traceConnectionPath(nextTiles, currentConfig, tileSize);
        sharedPoints.value = path;
        setIsAnimatingFinish(true);
        pulseProgress.value = 0;
        pulseProgress.value = withTiming(1, { duration: 1500 }, (finished) => {
          if (finished) {
            runOnJS(handleFinishTransition)();
          }
        });
      }

      return nextTiles;
    });
  };

  const handleNextLevel = async () => {
    triggerHaptic("light");
    const nextLvl = level + 1;
    const finalBalance = userCoins + currentConfig.rewardCoins;

    try {
      await AsyncStorage.setItem(COINS_STORAGE_KEY, finalBalance.toString());
      await AsyncStorage.setItem("robo_link_current_level", nextLvl.toString());
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
      await AsyncStorage.setItem("robo_link_current_level", "1");
      router.back();
    } catch (e) {
      console.error("Failed to save progress", e);
      router.back();
    }
  };

  const isBlinking = (timeCounter % 60) < 30;
  const isEnergyDelivered = gameState === "victory" || gameState === "completed";

  const targetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => {
    const points = sharedPoints.value;
    if (!points || points.length === 0) {
      return {
        opacity: 0,
        transform: [{ translateX: 0 }, { translateY: 0 }],
      };
    }

    const p = pulseProgress.value;
    if (p <= 0) {
      return {
        opacity: 1,
        transform: [{ translateX: points[0].x - 10 }, { translateY: points[0].y - 10 }],
      };
    }
    if (p >= 1) {
      const lastPoint = points[points.length - 1];
      return {
        opacity: 1,
        transform: [{ translateX: lastPoint.x - 10 }, { translateY: lastPoint.y - 10 }],
      };
    }

    let totalLength = 0;
    const segmentLengths = [];
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      segmentLengths.push(len);
      totalLength += len;
    }

    const targetDist = p * totalLength;
    let accumulatedDist = 0;
    let x = points[0].x;
    let y = points[0].y;

    for (let i = 0; i < points.length - 1; i++) {
      const len = segmentLengths[i];
      if (targetDist <= accumulatedDist + len) {
        const segProgress = (targetDist - accumulatedDist) / len;
        const p1 = points[i];
        const p2 = points[i + 1];
        x = p1.x + (p2.x - p1.x) * segProgress;
        y = p1.y + (p2.y - p1.y) * segProgress;
        break;
      }
      accumulatedDist += len;
    }

    return {
      opacity: 1,
      transform: [
        { translateX: x - 10 },
        { translateY: y - 10 },
      ],
    };
  });

  // Dynamic Tile size based on grid columns
  const tileSize = 360 / currentConfig.cols;

  // Node Robot positions
  const robotPosition = useMemo(() => {
    const rY = currentConfig.startRow * tileSize + (tileSize - 50) / 2;
    return { x: -62, y: rY };
  }, [currentConfig, tileSize]);

  // Node Target PC positions
  const pcPosition = useMemo(() => {
    const pY = currentConfig.endRow * tileSize + (tileSize - 50) / 2;
    return { x: 372, y: pY };
  }, [currentConfig, tileSize]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#99F6E4" />

      {/* HEADER HUD BAR */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => {
              triggerHaptic("light");
              router.back();
            }}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="arrow-back" size={20} color="#0F766E" />
          </Pressable>

          {/* TIMER BADGE */}
          <View style={[styles.timerBadge, timeLeft <= 10 && styles.timerBadgeUrgent]}>
            <Ionicons name="time" size={16} color={timeLeft <= 10 ? "#EF4444" : "#0D9488"} />
            <Text style={[styles.timerText, timeLeft <= 10 && styles.timerTextUrgent]}>{timeLeft}s</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
          <MaterialCommunityIcons name={"coin" as any} size={18} color="#D97706" />
          <Text style={styles.coinsHeaderVal}>{userCoins}</Text>
        </View>
      </View>

      {/* TIMER PROGRESS BAR */}
      <View style={styles.timerProgressContainer}>
        <View
          style={[
            styles.timerProgressBar,
            {
              width: `${(timeLeft / (currentConfig.timeLimit || 30)) * 100}%`,
              backgroundColor: timeLeft <= 10 ? "#EF4444" : "#10B981",
            },
          ]}
        />
      </View>

      {/* HAZARD TAPE ACCENTS */}
      <View style={styles.hazardTapeTop} />

      {/* FULL-SCREEN CIRCUIT BOARD VIEWPORT */}
      <View style={styles.gameplayArea}>
        
        {/* PCB Background copper circuit traces decoration (Bright grid style) */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d="M40,160 L120,240 L340,240" stroke="rgba(20, 184, 166, 0.18)" strokeWidth={3} fill="none" />
          <Path d="M320,60 L280,100 L280,180" stroke="rgba(20, 184, 166, 0.18)" strokeWidth={3} fill="none" />
          <Path d="M80,420 L160,340 L160,280" stroke="rgba(20, 184, 166, 0.18)" strokeWidth={3} fill="none" />
          
          <Circle cx={120} cy={240} r={4} fill="rgba(20, 184, 166, 0.3)" />
          <Circle cx={280} cy={100} r={4} fill="rgba(20, 184, 166, 0.3)" />
        </Svg>

        {/* Scattered hardware components */}
        <ICChip style={{ left: 16, top: 140 }} />
        <ICChip style={{ right: 20, top: 220 }} />
        <Resistor style={{ left: 80, top: 80 }} />
        <Resistor style={{ right: 80, top: 410 }} />

        {/* Blinking diagnostic LEDs */}
        <View style={[styles.ledNode, { left: 40, top: 60, backgroundColor: isBlinking ? "#10B981" : "#0F766E" }]} />
        <View style={[styles.ledNode, { right: 40, top: 60, backgroundColor: !isBlinking ? "#F59E0B" : "#0F766E" }]} />

        {/* Floating Instruction Card at the Top */}
        <View style={styles.topCardBanner}>
          <MaterialCommunityIcons name="information" size={16} color="#0D9488" />
          <Text style={styles.topCardBannerText}>
            KETUK UBIN UNTUK MEMUTAR SIRKUIT KUNING ⚡ SAMPAI MENYALAKAN PC!
          </Text>
        </View>

        {/* CENTERED ADAPTING PLAY ZONE */}
        <View style={styles.arenaContainer}>
          <View style={styles.arenaWrapper}>
            
            {/* Source Robot Port Casing (Left) */}
            <View style={[styles.sourceRobotNode, { left: robotPosition.x, top: robotPosition.y }]}>
              <View style={styles.robotConnectorHead}>
                <View style={styles.robotConnectorHeadFace}>
                  <View style={styles.connectorEye} />
                  <View style={styles.connectorEye} />
                </View>
              </View>
              <View style={styles.robotConnectorBody} />
              
              {/* Silver pins connecting into starting tile */}
              <View style={styles.silverPinRow}>
                <View style={styles.silverPin} />
                <View style={styles.silverPin} />
              </View>

              <View style={styles.nodeLabel}>
                <Text style={styles.nodeLabelText}>GENERATOR</Text>
              </View>
            </View>

            {/* Target PC Receptor Casing (Right) */}
            <Animated.View
              style={[
                styles.targetNodeContainer,
                isEnergyDelivered && targetAnimatedStyle,
                { left: pcPosition.x, top: pcPosition.y },
              ]}
            >
              <View
                style={[
                  styles.pcMonitor,
                  {
                    backgroundColor: isEnergyDelivered ? "#10B981" : "#475569",
                    borderColor: isEnergyDelivered ? "#A7F3D0" : "#64748B",
                  },
                ]}
              >
                {isEnergyDelivered ? (
                  <>
                    <MaterialCommunityIcons name="lan-connect" size={14} color="#FFFFFF" />
                    <Text style={styles.pcFaceText}>(^.^)</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="lan-disconnect" size={14} color="#CBD5E1" />
                    <Text style={[styles.pcFaceText, { color: "#CBD5E1" }]}>OFFLINE</Text>
                  </>
                )}
              </View>
              <View style={styles.pcStand} />
              <View style={styles.pcBase} />

              {/* Silver pins connecting from end tile */}
              <View style={[styles.silverPinRow, { left: -10 }]}>
                <View style={styles.silverPin} />
                <View style={styles.silverPin} />
              </View>

              <View style={styles.nodeLabel}>
                <Text style={styles.nodeLabelText}>PC TARGET</Text>
              </View>
            </Animated.View>

            {/* Grid Arena */}
            {/* Grid Arena */}
            <View style={styles.gameArena}>
              {isAnimatingFinish && (
                <Animated.View
                  style={[
                    styles.energyPulse,
                    pulseAnimatedStyle,
                  ]}
                />
              )}
              {tiles.map((tile) => {
                const leftPos = tile.col * tileSize;
                const topPos = tile.row * tileSize;

                return (
                  <Pressable
                    key={tile.id}
                    onPress={() => handleTilePress(tile.id)}
                    style={[
                      styles.tileCard,
                      {
                        left: leftPos + 1.5,
                        top: topPos + 1.5,
                        width: tileSize - 3,
                        height: tileSize - 3,
                      },
                    ]}
                  >
                    {/* Metal Solder Pads in corners */}
                    <View style={[styles.solderPad, { top: 3, left: 3 }]} />
                    <View style={[styles.solderPad, { top: 3, right: 3 }]} />
                    <View style={[styles.solderPad, { bottom: 3, left: 3 }]} />
                    <View style={[styles.solderPad, { bottom: 3, right: 3 }]} />
                  </Pressable>
                );
              })}

              {/* Single Parent SVG Canvas covering the entire grid + overflow bounds */}
              <Svg width={360} height={360} style={[StyleSheet.absoluteFill, { overflow: "visible" }]} pointerEvents="none">
                {/* 1. Generator Source Input Lead (Always glowing orange-yellow) */}
                <Line
                  x1={-12}
                  y1={currentConfig.startRow * tileSize + tileSize / 2}
                  x2={0}
                  y2={currentConfig.startRow * tileSize + tileSize / 2}
                  stroke="#FBBF24"
                  strokeWidth={8}
                  strokeLinecap="round"
                />
                <Line
                  x1={-12}
                  y1={currentConfig.startRow * tileSize + tileSize / 2}
                  x2={0}
                  y2={currentConfig.startRow * tileSize + tileSize / 2}
                  stroke="#F97316"
                  strokeWidth={4}
                  strokeLinecap="round"
                />

                {/* 2. PC Target Receptor Output Lead (Glows orange-yellow on connection success) */}
                <Line
                  x1={360}
                  y1={currentConfig.endRow * tileSize + tileSize / 2}
                  x2={372}
                  y2={currentConfig.endRow * tileSize + tileSize / 2}
                  stroke={isEnergyDelivered ? "#FBBF24" : "rgba(251, 191, 36, 0.16)"}
                  strokeWidth={8}
                  strokeLinecap="round"
                />
                <Line
                  x1={360}
                  y1={currentConfig.endRow * tileSize + tileSize / 2}
                  x2={372}
                  y2={currentConfig.endRow * tileSize + tileSize / 2}
                  stroke={isEnergyDelivered ? "#F97316" : "#475569"}
                  strokeWidth={4}
                  strokeLinecap="round"
                />

                {/* 3. Dynamic Rotatable Circuit Traces */}
                {tiles.map((tile) => {
                  const isPowered = connectivity.poweredIds.includes(tile.id);
                  const cx = tile.col * tileSize + tileSize / 2;
                  const cy = tile.row * tileSize + tileSize / 2;
                  const half = tileSize / 2;

                  return (
                    <G key={tile.id} transform={`rotate(${tile.rotation}, ${cx}, ${cy})`}>
                      {tile.type === "straight" && (
                        <>
                          <Line
                            x1={cx - half}
                            y1={cy}
                            x2={cx + half}
                            y2={cy}
                            stroke={isPowered ? "#FBBF24" : "rgba(251, 191, 36, 0.16)"}
                            strokeWidth={8}
                            strokeLinecap="round"
                            strokeDasharray={isPowered ? [10, 8] : undefined}
                            strokeDashoffset={isPowered ? -timeCounter * 1.5 : undefined}
                          />
                          <Line
                            x1={cx - half}
                            y1={cy}
                            x2={cx + half}
                            y2={cy}
                            stroke={isPowered ? "#F97316" : "#475569"}
                            strokeWidth={4}
                            strokeLinecap="round"
                          />
                        </>
                      )}

                      {tile.type === "elbow" && (
                        <>
                          <Path
                            d={`M ${cx} ${cy + half} Q ${cx} ${cy} ${cx + half} ${cy}`}
                            fill="none"
                            stroke={isPowered ? "#FBBF24" : "rgba(251, 191, 36, 0.16)"}
                            strokeWidth={8}
                            strokeLinecap="round"
                            strokeDasharray={isPowered ? [10, 8] : undefined}
                            strokeDashoffset={isPowered ? -timeCounter * 1.5 : undefined}
                          />
                          <Path
                            d={`M ${cx} ${cy + half} Q ${cx} ${cy} ${cx + half} ${cy}`}
                            fill="none"
                            stroke={isPowered ? "#F97316" : "#475569"}
                            strokeWidth={4}
                            strokeLinecap="round"
                          />
                        </>
                      )}

                      {tile.type === "t_junction" && (
                        <>
                          <Line
                            x1={cx - half}
                            y1={cy}
                            x2={cx + half}
                            y2={cy}
                            stroke={isPowered ? "#FBBF24" : "rgba(251, 191, 36, 0.16)"}
                            strokeWidth={8}
                            strokeLinecap="round"
                            strokeDasharray={isPowered ? [10, 8] : undefined}
                            strokeDashoffset={isPowered ? -timeCounter * 1.5 : undefined}
                          />
                          <Line
                            x1={cx}
                            y1={cy}
                            x2={cx}
                            y2={cy + half}
                            stroke={isPowered ? "#FBBF24" : "rgba(251, 191, 36, 0.16)"}
                            strokeWidth={8}
                            strokeLinecap="round"
                            strokeDasharray={isPowered ? [10, 8] : undefined}
                            strokeDashoffset={isPowered ? -timeCounter * 1.5 : undefined}
                          />
                          <Line
                            x1={cx - half}
                            y1={cy}
                            x2={cx + half}
                            y2={cy}
                            stroke={isPowered ? "#F97316" : "#475569"}
                            strokeWidth={4}
                            strokeLinecap="round"
                          />
                          <Line
                            x1={cx}
                            y1={cy}
                            x2={cx}
                            y2={cy + half}
                            stroke={isPowered ? "#F97316" : "#475569"}
                            strokeWidth={4}
                            strokeLinecap="round"
                          />
                        </>
                      )}
                    </G>
                  );
                })}
              </Svg>
            </View>

          </View>
        </View>
      </View>

      {/* INDUSTRIAL HAZARD BOTTOM TAPES */}
      <View style={styles.hazardTapeBottom} />

      {/* BOTTOM INFO CARD */}
      <View style={styles.missionCardContainer}>
        <View style={styles.missionCard}>
          <View style={styles.missionCardHeader}>
            <View style={styles.skillBadge}>
              <Text style={styles.skillBadgeText}>🧩 PLANNING & SPATIAL</Text>
            </View>
            <Text style={styles.xpReward}>+{currentConfig.rewardXP} XP</Text>
          </View>
          <Text style={styles.missionTitle}>Misi: Robo-Link</Text>
          <Text style={styles.missionDescription}>{currentConfig.instructions}</Text>
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
              <Ionicons name="trophy" size={44} color="#F59E0B" />
            </View>
            <Text style={styles.modalTitle}>KONEKSI BERHASIL!</Text>
            <Text style={styles.modalSubtitle}>Sirkuit data tersambung! Arus energi mengalir menyalakan target PC.</Text>

            <View style={styles.rewardSummary}>
              <Text style={styles.rewardLabel}>HADIAH</Text>
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons name={"coin" as any} size={20} color="#F59E0B" />
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

      {/* COMPLETED ALL LEVELS MODAL OVERLAY */}
      <Modal visible={gameState === "completed"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.victoryIconCircle, { backgroundColor: "#FFF7ED" }]}>
              <Ionicons name="medal" size={50} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>PETUALANGAN SELESAI!</Text>
            <Text style={styles.modalSubtitle}>Luar biasa! Kamu berhasil menghubungkan seluruh jaringan sirkuit komputer Robo-Link!</Text>

            <View style={styles.rewardSummary}>
              <Text style={styles.rewardLabel}>HADIAH TOTAL</Text>
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons name={"coin" as any} size={20} color="#F59E0B" />
                <Text style={styles.rewardBadgeText}>+{currentConfig.rewardCoins} Koin</Text>
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

      {/* FAILED MODAL OVERLAY */}
      <Modal visible={gameState === "failed"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.victoryIconCircle, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="alert-circle" size={50} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>WAKTU HABIS!</Text>
            <Text style={styles.modalSubtitle}>Sirkuit gagal tersambung dalam batas waktu. Jangan menyerah, coba lagi!</Text>

            <Button
              title="Coba Lagi"
              onPress={handleRestartLevel}
              variant="primary"
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
    backgroundColor: "#E0F2FE", // PCB bright mint-cyan theme
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
    backgroundColor: "#99F6E4", // Light mint-teal header
    borderBottomWidth: 2.5,
    borderBottomColor: "#5DD8C4",
    zIndex: 99,
  },
  backBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    borderWidth: 1,
    borderColor: "#5DD8C4",
  },
  resetBtn: {
    backgroundColor: "#0D9488",
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
    backgroundColor: "#0D9488",
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
    backgroundColor: "#CCFBF1", // Mint PCB plate color
  },
  icChipContainer: {
    position: "absolute",
    width: 38,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    opacity: 0.15,
  },
  icBody: {
    width: 24,
    height: 38,
    backgroundColor: "#1E293B",
    borderRadius: 4,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 4,
  },
  icDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#475569",
  },
  icPin: {
    width: 4,
    height: 2,
    backgroundColor: "#64748B",
    marginVertical: 4,
  },
  resistorContainer: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    opacity: 0.18,
  },
  resistorWire: {
    width: 14,
    height: 2,
    backgroundColor: "#64748B",
  },
  resistorBody: {
    width: 32,
    height: 12,
    backgroundColor: "#E2E8F0",
    borderWidth: 1,
    borderColor: "#94A3B8",
    borderRadius: 3,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  resistorBand: {
    width: 3,
    height: "100%",
  },
  ledNode: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    opacity: 0.5,
  },
  topCardBanner: {
    position: "absolute",
    top: 14,
    left: 20,
    right: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 40,
    ...SHADOWS.medium,
  },
  topCardBannerText: {
    ...FONTS.bodyBold,
    fontSize: 9.5,
    color: "#0F766E",
    letterSpacing: 0.5,
    textAlign: "center",
    flex: 1,
  },
  arenaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
  },
  arenaWrapper: {
    position: "relative",
    width: 360,
    height: 360,
    justifyContent: "center",
    alignItems: "center",
  },
  gameArena: {
    width: 360,
    height: 360,
    position: "relative",
    backgroundColor: "#115E59", // Solder mask dark teal
    borderColor: "#0F766E",
    borderWidth: 5,
    borderRadius: 12,
    overflow: "visible",
    ...SHADOWS.medium,
  },
  sourceRobotNode: {
    position: "absolute",
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  robotConnectorHead: {
    width: 36,
    height: 26,
    backgroundColor: "#E2E8F0",
    borderWidth: 2.5,
    borderColor: "#64748B",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  robotConnectorHeadFace: {
    width: 22,
    height: 10,
    backgroundColor: "#0F172A",
    borderRadius: 3,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  connectorEye: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#F97316", // Orange eye glow
  },
  robotConnectorBody: {
    width: 28,
    height: 10,
    backgroundColor: "#64748B",
    borderRadius: 2,
    marginTop: -2,
    zIndex: 1,
  },
  silverPinRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: 20,
    position: "absolute",
    right: -10,
    zIndex: 1,
  },
  silverPin: {
    width: 8,
    height: 4,
    backgroundColor: "#CBD5E1",
    borderWidth: 1,
    borderColor: "#94A3B8",
    borderRadius: 1,
  },
  targetNodeContainer: {
    position: "absolute",
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  pcMonitor: {
    width: 38,
    height: 28,
    borderRadius: 4,
    borderWidth: 2.5,
    justifyContent: "center",
    alignItems: "center",
  },
  pcFaceText: {
    fontSize: 7,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  pcStand: {
    width: 6,
    height: 6,
    backgroundColor: "#64748B",
    marginTop: -1,
  },
  pcBase: {
    width: 20,
    height: 3,
    backgroundColor: "#475569",
    borderRadius: 1.5,
  },
  nodeLabel: {
    position: "absolute",
    bottom: -18,
    backgroundColor: "#1E293B",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  nodeLabelText: {
    fontSize: 7,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  tileCard: {
    position: "absolute",
    backgroundColor: "#0D9488", // Green solder mask tile
    borderWidth: 2.5,
    borderColor: "#0F766E",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  solderPad: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#E2E8F0",
    borderWidth: 1,
    borderColor: "#94A3B8",
  },
  missionCardContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    backgroundColor: "#CCFBF1", // Seamless floor match
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
    marginBottom: SPACING.md,
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
    marginBottom: SPACING.md,
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
  timerProgressContainer: {
    height: 4,
    backgroundColor: "#E2E8F0",
    width: "100%",
  },
  timerProgressBar: {
    height: "100%",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FFEDD5",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 4,
    paddingHorizontal: SPACING.md,
    gap: 4,
  },
  timerBadgeUrgent: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  timerText: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: "#C2410C",
  },
  timerTextUrgent: {
    color: "#EF4444",
  },
  energyPulse: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FBBF24",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    zIndex: 50,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
});
