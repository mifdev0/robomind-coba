import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  Modal,
  StatusBar,
  PanResponder,
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
import Svg, { Line, Circle, Path, Rect } from "react-native-svg";
import { COLORS, SPACING, SHAPES, FONTS, SHADOWS } from "../constants/Theme";
import Button from "../components/ui/Button";

const COINS_STORAGE_KEY = "user_coins_balance";
const ORB_RADIUS = 11; // Collision radius
const VISUAL_ORB_RADIUS = 15;
const GRAVITY = 0.20;
const RESTITUTION = 0.75;
const FRICTION = 0.994;

interface ObstacleBase {
  id: string;
  color?: string;
}

interface SolidCircle extends ObstacleBase {
  type: "solid_circle";
  x: number;
  y: number;
  r: number;
}

interface SolidRect extends ObstacleBase {
  type: "solid_rect";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Pendulum extends ObstacleBase {
  type: "pendulum";
  pivotX: number;
  pivotY: number;
  length: number;
  radius: number;
  maxAngle: number;
  speed: number;
}

interface BumperCircle extends ObstacleBase {
  type: "bumper_circle";
  x: number;
  y: number;
  r: number;
}

type Obstacle = SolidCircle | SolidRect | Pendulum | BumperCircle;

interface PortalPair {
  id: string;
  inX: number;
  inY: number;
  outX: number;
  outY: number;
  radius: number;
}

interface SwitchMechanism {
  id: string;
  x: number;
  y: number;
  radius: number;
  targetGateId: string;
}

interface LaserGate {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isHorizontal: boolean;
}

interface LevelConfig {
  level: number;
  launcherX: number;
  launcherY: number;
  targetX: number;
  targetY: number;
  targetRadius: number;
  obstacles: Obstacle[];
  portals: PortalPair[];
  switches: SwitchMechanism[];
  gates: LaserGate[];
  star3Limit: number;
  star2Limit: number;
  rewardCoins: number;
  rewardXP: number;
  instructions: string;
}

const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: 1,
    launcherX: 80,
    launcherY: 80,
    targetX: 280,
    targetY: 420,
    targetRadius: 24,
    obstacles: [
      // Top divider separating launcher chamber and switch chamber
      { type: "solid_rect", id: "beam-1a", x1: 180, y1: 0, x2: 200, y2: 240 },
      // Horizontal platform creating bottom compartment
      { type: "solid_rect", id: "beam-1b", x1: 0, y1: 240, x2: 260, y2: 260 },
      // Bumper in the top-right corner to redirect the ball downwards
      { type: "bumper_circle", id: "bump-1", x: 330, y: 70, r: 18 },
    ],
    portals: [],
    gates: [
      // Horizontal laser gate blocking access to the bottom-right monster
      { id: "gate-1", x1: 200, y1: 340, x2: 360, y2: 355, isHorizontal: true },
    ],
    switches: [
      // Switch located on the wall in top-right chamber
      { id: "switch-1", x: 280, y: 70, radius: 15, targetGateId: "gate-1" },
    ],
    star3Limit: 1,
    star2Limit: 2,
    rewardCoins: 50,
    rewardXP: 30,
    instructions: "JALUR GRAVITASI (ONE-SHOT): Bidik ke kanan melewati pembatas vertikal. Bola harus memicu tombol 🟢, memantul dari bumper hijau ke bawah, lalu menembus laser yang mati menuju monster!",
  },
  {
    level: 2,
    launcherX: 60,
    launcherY: 420,
    targetX: 300,
    targetY: 100,
    targetRadius: 24,
    obstacles: [
      // Horizontal platform divider completely isolating top and bottom
      { type: "solid_rect", id: "floor-2", x1: 0, y1: 240, x2: 360, y2: 260 },
      // Vertical divider in the top room
      { type: "solid_rect", id: "beam-2", x1: 180, y1: 0, x2: 200, y2: 160 },
      // Speed Bumper in the top-left corner
      { type: "bumper_circle", id: "bump-2", x: 60, y: 40, r: 18 },
    ],
    portals: [
      // Entrance in bottom chamber, Exit in top-left chamber
      { id: "portal-2", inX: 300, inY: 400, outX: 60, outY: 120, radius: 18 },
    ],
    gates: [
      // Laser gate blocking the monster room
      { id: "gate-2", x1: 200, y1: 160, x2: 360, y2: 175, isHorizontal: true },
    ],
    switches: [
      // Switch mounted next to the wall in the top room
      { id: "switch-2", x: 240, y: 50, radius: 15, targetGateId: "gate-2" },
    ],
    star3Limit: 1,
    star2Limit: 2,
    rewardCoins: 75,
    rewardXP: 45,
    instructions: "WARP PORTAL LOOP (ONE-SHOT): Tembak bola ke portal biru kanan bawah. Bola keluar di top-left, memicu saklar atas 🟢, memantul dari bumper hijau ke kanan, lalu jatuh menembus laser ke monster!",
  },
  {
    level: 3,
    launcherX: 80,
    launcherY: 80,
    targetX: 280,
    targetY: 420,
    targetRadius: 24,
    obstacles: [
      // Horizontal floor partition with gap on the right
      { type: "solid_rect", id: "floor-3", x1: 0, y1: 240, x2: 260, y2: 260 },
      // Vertical separator
      { type: "solid_rect", id: "beam-3", x1: 180, y1: 0, x2: 200, y2: 240 },
      // Speed bumper corner
      { type: "bumper_circle", id: "bump-3", x: 335, y: 180, r: 18 },
      // Pendulum swinging in front of the top-right switch
      {
        type: "pendulum",
        id: "pend-3",
        pivotX: 280,
        pivotY: 0,
        length: 120,
        radius: 18,
        maxAngle: 0.6,
        speed: 0.05,
      },
    ],
    portals: [],
    gates: [
      { id: "gate-3", x1: 260, y1: 340, x2: 360, y2: 355, isHorizontal: true },
    ],
    switches: [
      { id: "switch-3", x: 280, y: 80, radius: 15, targetGateId: "gate-3" },
    ],
    star3Limit: 2,
    star2Limit: 3,
    rewardCoins: 100,
    rewardXP: 60,
    instructions: "AYUNAN REAKTOR (ONE-SHOT): Bidik melewati ayunan pendulum untuk mengenai saklar 🟢. Bola akan terus meluncur memantul dari bumper hijau ke bawah, menembus laser gate, lalu masuk ke monster!",
  },
  {
    level: 4,
    launcherX: 60,
    launcherY: 420,
    targetX: 300,
    targetY: 420,
    targetRadius: 24,
    obstacles: [
      // T-junction layout dividers
      { type: "solid_rect", id: "wall-4a", x1: 150, y1: 150, x2: 170, y2: 480 },
      { type: "solid_rect", id: "wall-4b", x1: 0, y1: 150, x2: 360, y2: 170 },
      // Green bumper directly under the switch to rebound the ball
      { type: "bumper_circle", id: "bump-4", x: 60, y: 120, r: 18 },
    ],
    portals: [
      { id: "portal-4", inX: 60, inY: 220, outX: 260, outY: 80, radius: 18 },
    ],
    gates: [
      { id: "gate-4", x1: 170, y1: 320, x2: 360, y2: 335, isHorizontal: true },
    ],
    switches: [
      { id: "switch-4", x: 60, y: 80, radius: 15, targetGateId: "gate-4" },
    ],
    star3Limit: 2,
    star2Limit: 3,
    rewardCoins: 150,
    rewardXP: 90,
    instructions: "AKSELERATOR REAKTOR (ONE-SHOT): Kirim bola ke portal biru. Bola keluar di top-right mengarah ke kiri, mengenai saklar 🟢, memantul dari bumper hijau ke kanan, lalu jatuh menembus laser ke monster!",
  },
  {
    level: 5,
    launcherX: 80,
    launcherY: 80,
    targetX: 300,
    targetY: 420,
    targetRadius: 24,
    obstacles: [
      // Complex assembly line dividers
      { type: "solid_rect", id: "wall-5a", x1: 150, y1: 0, x2: 170, y2: 360 },
      { type: "solid_rect", id: "wall-5b", x1: 0, y1: 200, x2: 150, y2: 220 },
      { type: "solid_rect", id: "wall-5c", x1: 170, y1: 300, x2: 360, y2: 320 },
      // Rebound bumper to push the ball through deactivated gate
      { type: "bumper_circle", id: "bump-5", x: 260, y: 260, r: 20 },
    ],
    portals: [
      { id: "portal-5", inX: 60, inY: 300, outX: 260, outY: 80, radius: 18 },
    ],
    gates: [
      { id: "gate-5", x1: 170, y1: 360, x2: 360, y2: 375, isHorizontal: true },
    ],
    switches: [
      { id: "switch-5", x: 260, y: 180, radius: 15, targetGateId: "gate-5" },
    ],
    star3Limit: 3,
    star2Limit: 4,
    rewardCoins: 250,
    rewardXP: 120,
    instructions: "PABRIK UTAMA FINAL (ONE-SHOT): Luncurkan bola ke bawah, masuk portal kiri-bawah. Keluar di top-right ke arah bawah memicu saklar 🟢, memantul dari bumper ke bawah menembus laser final!",
  },
];

// Predictive trajectory calculation simulating portals, switches, and real-time gate deactivations
const projectTrajectory = (
  startX: number,
  startY: number,
  initVx: number,
  initVy: number,
  obstaclesState: Obstacle[],
  portals: PortalPair[],
  gates: LaserGate[],
  initialActiveGateIds: string[],
  switches: SwitchMechanism[],
  timeCounter: number
): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  let px = startX;
  let py = startY;
  let pvx = initVx;
  let pvy = initVy;

  const simActiveGateIds = [...initialActiveGateIds];
  const simActiveSwitchIds: string[] = [];

  for (let step = 0; step < 72; step++) {
    pvy += GRAVITY;
    px += pvx;
    py += pvy;

    if (py >= 472) {
      py = 472;
      pvy = -pvy * RESTITUTION;
      pvx *= FRICTION;
    }
    if (px <= 8) {
      px = 8;
      pvx = -pvx * RESTITUTION;
    }
    if (px >= 352) {
      px = 352;
      pvx = -pvx * RESTITUTION;
    }
    if (py <= 8) {
      py = 8;
      pvy = -pvy * RESTITUTION;
    }

    portals.forEach((pt) => {
      const dist = Math.sqrt((px - pt.inX) ** 2 + (py - pt.inY) ** 2);
      if (dist < pt.radius + ORB_RADIUS) {
        px = pt.outX;
        py = pt.outY;
      }
    });

    // Simulate switch trigger and instant gate open
    switches.forEach((sw) => {
      if (!simActiveSwitchIds.includes(sw.id)) {
        const dist = Math.sqrt((px - sw.x) ** 2 + (py - sw.y) ** 2);
        if (dist < sw.radius + ORB_RADIUS) {
          simActiveSwitchIds.push(sw.id);
          const gateIdx = simActiveGateIds.indexOf(sw.targetGateId);
          if (gateIdx > -1) {
            simActiveGateIds.splice(gateIdx, 1);
          }
        }
      }
    });

    // Simulate gate collisions using active simulated gates
    gates.forEach((gate) => {
      if (simActiveGateIds.includes(gate.id)) {
        const closestX = Math.max(gate.x1, Math.min(px, gate.x2));
        const closestY = Math.max(gate.y1, Math.min(py, gate.y2));
        const dx = px - closestX;
        const dy = py - closestY;
        const dist = Math.sqrt(dx ** 2 + dy ** 2);
        if (dist < ORB_RADIUS) {
          const nx = dist === 0 ? 0 : dx / dist;
          const ny = dist === 0 ? 1 : dy / dist;
          px = closestX + nx * ORB_RADIUS;
          py = closestY + ny * ORB_RADIUS;
          const vn = pvx * nx + pvy * ny;
          if (vn < 0) {
            pvx -= (1 + RESTITUTION) * vn * nx;
            pvy -= (1 + RESTITUTION) * vn * ny;
          }
        }
      }
    });

    obstaclesState.forEach((obs) => {
      if (obs.type === "solid_rect") {
        const closestX = Math.max(obs.x1, Math.min(px, obs.x2));
        const closestY = Math.max(obs.y1, Math.min(py, obs.y2));
        const dx = px - closestX;
        const dy = py - closestY;
        const dist = Math.sqrt(dx ** 2 + dy ** 2);
        if (dist < ORB_RADIUS) {
          const nx = dist === 0 ? 0 : dx / dist;
          const ny = dist === 0 ? 1 : dy / dist;
          px = closestX + nx * ORB_RADIUS;
          py = closestY + ny * ORB_RADIUS;
          const vn = pvx * nx + pvy * ny;
          if (vn < 0) {
            pvx -= (1 + RESTITUTION) * vn * nx;
            pvy -= (1 + RESTITUTION) * vn * ny;
          }
        }
      } else if (obs.type === "bumper_circle") {
        const dist = Math.sqrt((px - obs.x) ** 2 + (py - obs.y) ** 2);
        const R_comb = obs.r + ORB_RADIUS;
        if (dist < R_comb && dist > 0) {
          const nx = (px - obs.x) / dist;
          const ny = (py - obs.y) / dist;
          px = obs.x + nx * R_comb;
          py = obs.y + ny * R_comb;
          const vn = pvx * nx + pvy * ny;
          if (vn < 0) {
            pvx -= (1 + 1.35) * vn * nx;
            pvy -= (1 + 1.35) * vn * ny;
          }
        }
      } else if (obs.type === "solid_circle") {
        const dist = Math.sqrt((px - obs.x) ** 2 + (py - obs.y) ** 2);
        const R_comb = obs.r + ORB_RADIUS;
        if (dist < R_comb && dist > 0) {
          const nx = (px - obs.x) / dist;
          const ny = (py - obs.y) / dist;
          px = obs.x + nx * R_comb;
          py = obs.y + ny * R_comb;
          const vn = pvx * nx + pvy * ny;
          if (vn < 0) {
            pvx -= (1 + RESTITUTION) * vn * nx;
            pvy -= (1 + RESTITUTION) * vn * ny;
          }
        }
      } else if (obs.type === "pendulum") {
        const ang = obs.maxAngle * Math.sin((timeCounter + step) * obs.speed);
        const gx = obs.pivotX + obs.length * Math.sin(ang);
        const gy = obs.pivotY + obs.length * Math.cos(ang);
        const dist = Math.sqrt((px - gx) ** 2 + (py - gy) ** 2);
        const R_comb = obs.radius + ORB_RADIUS;
        if (dist < R_comb && dist > 0) {
          const nx = (px - gx) / dist;
          const ny = (py - gy) / dist;
          px = gx + nx * R_comb;
          py = gy + ny * R_comb;
          const vn = pvx * nx + pvy * ny;
          if (vn < 0) {
            pvx -= (1 + RESTITUTION) * vn * nx;
            pvy -= (1 + RESTITUTION) * vn * ny;
          }
        }
      }
    });

    if (step % 3 === 0) {
      points.push({ x: px, y: py });
    }
  }

  return points;
};

export default function RoboChargeScreen() {
  const router = useRouter();
  const [level, setLevel] = useState(1);
  const [userCoins, setUserCoins] = useState(1250);
  const [gameState, setGameState] = useState<"playing" | "victory" | "completed" | "failed">("playing");

  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [orb, setOrb] = useState({ x: 80, y: 80, vx: 0, vy: 0 });
  const [orbStatus, setOrbStatus] = useState<"aiming" | "flying" | "success" | "failed">("aiming");
  const [shotsUsed, setShotsUsed] = useState(0);
  const [lives, setLives] = useState(3);

  const [activeGateIds, setActiveGateIds] = useState<string[]>([]);
  const [activeSwitchIds, setActiveSwitchIds] = useState<string[]>([]);

  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [timeCounter, setTimeCounter] = useState(0);

  const shakeOffset = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  const currentConfig = useMemo(() => {
    return LEVEL_CONFIGS.find((l) => l.level === level) || LEVEL_CONFIGS[0];
  }, [level]);

  const stateRef = useRef({
    gameState,
    orbStatus,
    isDragging,
    currentConfig,
    lives,
    obstacles,
    timeCounter,
    activeGateIds,
    activeSwitchIds,
  });

  useEffect(() => {
    stateRef.current = {
      gameState,
      orbStatus,
      isDragging,
      currentConfig,
      lives,
      obstacles,
      timeCounter,
      activeGateIds,
      activeSwitchIds,
    };
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const { gameState: gs, orbStatus: os, currentConfig: cfg } = stateRef.current;
        if (gs !== "playing" || os !== "aiming") return false;

        const touchX = evt.nativeEvent.locationX;
        const touchY = evt.nativeEvent.locationY;
        const dist = Math.sqrt((touchX - cfg.launcherX) ** 2 + (touchY - cfg.launcherY) ** 2);
        return dist <= 42;
      },
      onMoveShouldSetPanResponder: (evt) => {
        const { gameState: gs, orbStatus: os, currentConfig: cfg } = stateRef.current;
        if (gs !== "playing" || os !== "aiming") return false;

        const touchX = evt.nativeEvent.locationX;
        const touchY = evt.nativeEvent.locationY;
        const dist = Math.sqrt((touchX - cfg.launcherX) ** 2 + (touchY - cfg.launcherY) ** 2);
        return dist <= 42;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        setDragOffset({ dx: 0, dy: 0 });
        triggerHaptic("light");
      },
      onPanResponderMove: (e, gestureState) => {
        const { gameState: gs, orbStatus: os } = stateRef.current;
        if (gs !== "playing" || os !== "aiming") return;

        let dx = gestureState.dx;
        let dy = gestureState.dy;

        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxStretch = 90;
        if (dist > maxStretch) {
          dx = (dx / dist) * maxStretch;
          dy = (dy / dist) * maxStretch;
        }
        setDragOffset({ dx, dy });
      },
      onPanResponderRelease: (e, gestureState) => {
        const { gameState: gs, orbStatus: os, currentConfig: cfg } = stateRef.current;
        if (gs !== "playing" || os !== "aiming") {
          setIsDragging(false);
          setDragOffset({ dx: 0, dy: 0 });
          return;
        }

        let dx = gestureState.dx;
        let dy = gestureState.dy;

        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxStretch = 90;
        if (dist > maxStretch) {
          dx = (dx / dist) * maxStretch;
          dy = (dy / dist) * maxStretch;
        }

        let vx = -dx * 0.16;
        let vy = -dy * 0.16;

        const magnitude = Math.sqrt(vx * vx + vy * vy);
        setIsDragging(false);
        setDragOffset({ dx: 0, dy: 0 });

        if (magnitude > 0.6) {
          setShotsUsed((s) => s + 1);
          setOrb({
            x: cfg.launcherX,
            y: cfg.launcherY,
            vx,
            vy,
          });
          setOrbStatus("flying");
          triggerHaptic("light");
        }
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        setDragOffset({ dx: 0, dy: 0 });
      },
    })
  ).current;

  // Load progress
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const storedCoins = await AsyncStorage.getItem(COINS_STORAGE_KEY);
        if (storedCoins !== null) {
          setUserCoins(parseInt(storedCoins));
        }
        const storedLevel = await AsyncStorage.getItem("robo_charge_current_level");
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

  const handleRestartLevel = () => {
    triggerHaptic("light");
    initLevel(level);
  };

  const initLevel = (levelIndex: number) => {
    const config = LEVEL_CONFIGS.find((l) => l.level === levelIndex);
    if (!config) return;

    const initialGateIds = config.gates.map((g) => g.id);
    setActiveGateIds(initialGateIds);
    setActiveSwitchIds([]);

    setObstacles(config.obstacles);
    setOrb({ x: config.launcherX, y: config.launcherY, vx: 0, vy: 0 });
    setOrbStatus("aiming");
    setShotsUsed(0);
    setLives(3);
    setGameState("playing");
    setIsDragging(false);
    setDragOffset({ dx: 0, dy: 0 });
  };

  useEffect(() => {
    initLevel(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const aimVelocity = useMemo(() => {
    if (!isDragging) return { vx: 0, vy: 0 };
    return {
      vx: -dragOffset.dx * 0.16,
      vy: -dragOffset.dy * 0.16,
    };
  }, [isDragging, dragOffset]);

  const aimAngle = useMemo(() => {
    if (!isDragging) return -45;
    return Math.atan2(aimVelocity.vy, aimVelocity.vx) * (180 / Math.PI);
  }, [isDragging, aimVelocity]);

  const trajectoryPoints = useMemo(() => {
    if (!isDragging) return [];
    return projectTrajectory(
      currentConfig.launcherX,
      currentConfig.launcherY,
      aimVelocity.vx,
      aimVelocity.vy,
      obstacles,
      currentConfig.portals,
      currentConfig.gates,
      activeGateIds,
      currentConfig.switches,
      timeCounter
    );
  }, [isDragging, aimVelocity, currentConfig, obstacles, activeGateIds, timeCounter]);

  const orbX = useMemo(() => {
    if (orbStatus === "aiming") {
      return currentConfig.launcherX + dragOffset.dx;
    }
    return orb.x;
  }, [orbStatus, currentConfig, dragOffset, orb.x]);

  const orbY = useMemo(() => {
    if (orbStatus === "aiming") {
      return currentConfig.launcherY + dragOffset.dy;
    }
    return orb.y;
  }, [orbStatus, currentConfig, dragOffset, orb.y]);

  // Main physics frames loop
  useEffect(() => {
    if (gameState !== "playing") return;

    let isRunning = true;
    let frameId: number;

    const loop = () => {
      if (!isRunning) return;

      setTimeCounter((t) => t + 1);

      if (stateRef.current.orbStatus === "flying") {
        setOrb((prevOrb) => {
          const cfg = stateRef.current.currentConfig;
          const obst = stateRef.current.obstacles;
          const tc = stateRef.current.timeCounter;
          const actGates = [...stateRef.current.activeGateIds];
          const actSwitches = [...stateRef.current.activeSwitchIds];

          let nextVy = prevOrb.vy + GRAVITY;
          let nextVx = prevOrb.vx;
          let nextX = prevOrb.x + nextVx;
          let nextY = prevOrb.y + nextVy;

          // Target monster collision
          const distToTarget = Math.sqrt(
            (nextX - cfg.targetX) ** 2 + (nextY - cfg.targetY) ** 2
          );
          if (distToTarget < cfg.targetRadius + ORB_RADIUS) {
            setTimeout(() => {
              triggerHaptic("success");
              pulseScale.value = withSequence(withTiming(1.1, { duration: 100 }), withTiming(1, { duration: 150 }));
              setOrbStatus("success");

              if (level < LEVEL_CONFIGS.length) {
                setGameState("victory");
              } else {
                setGameState("completed");
              }
            }, 0);
            return prevOrb;
          }

          // Teleport warp collision
          cfg.portals.forEach((pt) => {
            const dist = Math.sqrt((nextX - pt.inX) ** 2 + (nextY - pt.inY) ** 2);
            if (dist < pt.radius + ORB_RADIUS) {
              nextX = pt.outX;
              nextY = pt.outY;
              triggerHaptic("light");
            }
          });

          // Switches collision (processed first, deactivating gates in the same frame!)
          cfg.switches.forEach((sw) => {
            if (!actSwitches.includes(sw.id)) {
              const dist = Math.sqrt((nextX - sw.x) ** 2 + (nextY - sw.y) ** 2);
              if (dist < sw.radius + ORB_RADIUS) {
                triggerHaptic("success");
                actSwitches.push(sw.id);
                // Instant deactivate gate in this frame
                const gateIdx = actGates.indexOf(sw.targetGateId);
                if (gateIdx > -1) {
                  actGates.splice(gateIdx, 1);
                }
                setActiveSwitchIds([...actSwitches]);
                setActiveGateIds([...actGates]);
              }
            }
          });

          let bounced = false;

          // Gates collision using active gates state (reflecting real-time updates)
          cfg.gates.forEach((gate) => {
            if (actGates.includes(gate.id)) {
              const closestX = Math.max(gate.x1, Math.min(nextX, gate.x2));
              const closestY = Math.max(gate.y1, Math.min(nextY, gate.y2));
              const dist = Math.sqrt((nextX - closestX) ** 2 + (nextY - closestY) ** 2);
              if (dist < ORB_RADIUS) {
                const nx = dist === 0 ? 0 : (nextX - closestX) / dist;
                const ny = dist === 0 ? 1 : (nextY - closestY) / dist;
                nextX = closestX + nx * ORB_RADIUS;
                nextY = closestY + ny * ORB_RADIUS;
                const vn = nextVx * nx + nextVy * ny;
                if (vn < 0) {
                  nextVx -= (1 + RESTITUTION) * vn * nx;
                  nextVy -= (1 + RESTITUTION) * vn * ny;
                  bounced = true;
                }
              }
            }
          });

          // Boundary walls (360x480)
          if (nextY >= 472) {
            nextY = 472;
            nextVy = -nextVy * RESTITUTION;
            nextVx *= FRICTION;
            bounced = true;
          }
          if (nextX <= 8) {
            nextX = 8;
            nextVx = -nextVx * RESTITUTION;
            bounced = true;
          }
          if (nextX >= 352) {
            nextX = 352;
            nextVx = -nextVx * RESTITUTION;
            bounced = true;
          }
          if (nextY <= 8) {
            nextY = 8;
            nextVy = -nextVy * RESTITUTION;
            bounced = true;
          }

          // Obstacles
          obst.forEach((obs) => {
            if (obs.type === "solid_rect") {
              const closestX = Math.max(obs.x1, Math.min(nextX, obs.x2));
              const closestY = Math.max(obs.y1, Math.min(nextY, obs.y2));
              const dist = Math.sqrt((nextX - closestX) ** 2 + (nextY - closestY) ** 2);
              if (dist < ORB_RADIUS) {
                const nx = dist === 0 ? 0 : (nextX - closestX) / dist;
                const ny = dist === 0 ? 1 : (nextY - closestY) / dist;
                nextX = closestX + nx * ORB_RADIUS;
                nextY = closestY + ny * ORB_RADIUS;
                const vn = nextVx * nx + nextVy * ny;
                if (vn < 0) {
                  nextVx -= (1 + RESTITUTION) * vn * nx;
                  nextVy -= (1 + RESTITUTION) * vn * ny;
                  bounced = true;
                }
              }
            } else if (obs.type === "bumper_circle") {
              const dist = Math.sqrt((nextX - obs.x) ** 2 + (nextY - obs.y) ** 2);
              const R_comb = obs.r + ORB_RADIUS;
              if (dist < R_comb && dist > 0) {
                const nx = (nextX - obs.x) / dist;
                const ny = (nextY - obs.y) / dist;
                nextX = obs.x + nx * R_comb;
                nextY = obs.y + ny * R_comb;
                const vn = nextVx * nx + nextVy * ny;
                if (vn < 0) {
                  nextVx -= (1 + 1.35) * vn * nx;
                  nextVy -= (1 + 1.35) * vn * ny;
                  bounced = true;
                  triggerHaptic("success");
                }
              }
            } else if (obs.type === "solid_circle") {
              const dist = Math.sqrt((nextX - obs.x) ** 2 + (nextY - obs.y) ** 2);
              const R_comb = obs.r + ORB_RADIUS;
              if (dist < R_comb && dist > 0) {
                const nx = (nextX - obs.x) / dist;
                const ny = (nextY - obs.y) / dist;
                nextX = obs.x + nx * R_comb;
                nextY = obs.y + ny * R_comb;
                const vn = nextVx * nx + nextVy * ny;
                if (vn < 0) {
                  nextVx -= (1 + RESTITUTION) * vn * nx;
                  nextVy -= (1 + RESTITUTION) * vn * ny;
                  bounced = true;
                }
              }
            } else if (obs.type === "pendulum") {
              const ang = obs.maxAngle * Math.sin(tc * obs.speed);
              const gx = obs.pivotX + obs.length * Math.sin(ang);
              const gy = obs.pivotY + obs.length * Math.cos(ang);
              const dist = Math.sqrt((nextX - gx) ** 2 + (nextY - gy) ** 2);
              const R_comb = obs.radius + ORB_RADIUS;
              if (dist < R_comb && dist > 0) {
                const nx = (nextX - gx) / dist;
                const ny = (nextY - gy) / dist;
                nextX = gx + nx * R_comb;
                nextY = gy + ny * R_comb;
                const vn = nextVx * nx + nextVy * ny;
                if (vn < 0) {
                  nextVx -= (1 + RESTITUTION) * vn * nx;
                  nextVy -= (1 + RESTITUTION) * vn * ny;
                  bounced = true;
                }
              }
            }
          });

          if (bounced) {
            triggerHaptic("light");
          }

          const offScreen = nextY > 490 || nextX < -20 || nextX > 380;
          const isStuck = Math.abs(nextVx) < 0.05 && Math.abs(nextVy) < 0.05 && nextY >= 468;
          if (offScreen || isStuck) {
            setTimeout(() => {
              setOrbStatus("failed");
              triggerHaptic("error");

              setLives((l) => {
                const nextLives = Math.max(0, l - 1);
                if (nextLives === 0) {
                  setGameState("failed");
                } else {
                  setTimeout(() => {
                    if (stateRef.current.gameState === "playing") {
                      // Reset local gates and switches to closed state for the new attempt!
                      const initGates = cfg.gates.map((g) => g.id);
                      setActiveGateIds(initGates);
                      setActiveSwitchIds([]);

                      setOrb({ x: cfg.launcherX, y: cfg.launcherY, vx: 0, vy: 0 });
                      setOrbStatus("aiming");
                    }
                  }, 800);
                }
                return nextLives;
              });
            }, 0);
            return prevOrb;
          }

          return { x: nextX, y: nextY, vx: nextVx, vy: nextVy };
        });
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => {
      isRunning = false;
      cancelAnimationFrame(frameId);
    };
  }, [gameState, level]);

  const handleNextLevel = async () => {
    triggerHaptic("light");
    const nextLvl = level + 1;
    const finalBalance = userCoins + currentConfig.rewardCoins;

    try {
      await AsyncStorage.setItem(COINS_STORAGE_KEY, finalBalance.toString());
      await AsyncStorage.setItem("robo_charge_current_level", nextLvl.toString());
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
      await AsyncStorage.setItem("robo_charge_current_level", "1");
      router.back();
    } catch (e) {
      console.error("Failed to save reward coins", e);
      router.back();
    }
  };

  const calculatedStars = useMemo(() => {
    if (shotsUsed <= currentConfig.star3Limit) return 3;
    if (shotsUsed <= currentConfig.star2Limit) return 2;
    return 1;
  }, [shotsUsed, currentConfig]);

  const containerShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }],
  }));

  const screenFlashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const targetPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

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

          <View style={styles.heartsRow}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < lives ? "heart" : "heart-outline"}
                size={20}
                color={i < lives ? "#EF4444" : "#64748B"}
                style={{ marginRight: 1 }}
              />
            ))}
          </View>

          <View style={styles.shotsBadge}>
            <Text style={styles.shotsText}>Tembakan: {shotsUsed}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Sektor {level}</Text>
          </View>
          <Pressable
            onPress={handleRestartLevel}
            style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="reload" size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.coinsHeaderBadge}>
          <MaterialCommunityIcons name="coin" size={16} color="#F59E0B" />
          <Text style={styles.coinsHeaderVal}>{userCoins}</Text>
        </View>
      </View>

      {/* HAZARD WARNING LINE */}
      <View style={styles.hazardTapeTop} />

      {/* FULL-SCREEN GAMEPLAY VIEWPORT */}
      <Animated.View style={[styles.gameplayArea, containerShakeStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.flashOverlay, screenFlashStyle]} pointerEvents="none" />

        {/* BLUEPRINT FACTORY GRID BACKGROUND */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Grid coordinates lines */}
          {Array.from({ length: 13 }).map((_, i) => (
            <Line
              key={`h-${i}`}
              x1={0}
              y1={i * 40}
              x2={360}
              y2={i * 40}
              stroke="#1E293B"
              strokeWidth={1.2}
            />
          ))}
          {/* Vertical lines */}
          {Array.from({ length: 10 }).map((_, i) => (
            <Line
              key={`v-${i}`}
              x1={i * 40}
              y1={0}
              x2={i * 40}
              y2={480}
              stroke="#1E293B"
              strokeWidth={1.2}
            />
          ))}
        </Svg>

        {/* Scattered blueprint notes */}
        <Text style={[styles.blueprintLabel, { left: 16, top: 180 }]}>SECTOR_A // RECOVERY_CORE</Text>
        <Text style={[styles.blueprintLabel, { right: 16, bottom: 100 }]}>SECTOR_B // PC_RECEPTOR</Text>

        {/* COMPACT MISSION INSTRUCTION BANNER */}
        <View style={styles.topCardBanner}>
          <MaterialCommunityIcons name="lightning-bolt" size={14} color="#FBBF24" />
          <Text style={styles.topCardBannerText}>
            ONE-SHOT SIRKUIT: BUAT SATU LINTASAN KONTINU MENGAKTIFKAN PANEL HINGGA REAKTOR MONSTER!
          </Text>
        </View>

        {/* MAIN PUZZLE ARENA CONTAINER */}
        <View style={styles.arenaContainer}>
          <View style={styles.arenaWrapper}>
            <View style={styles.gameArena}>
              
              {/* TARGET MONSTER (Inside concrete chamber) */}
              <Animated.View
                style={[
                  styles.targetMonster,
                  targetPulseStyle,
                  {
                    left: currentConfig.targetX - currentConfig.targetRadius,
                    top: currentConfig.targetY - currentConfig.targetRadius,
                    width: currentConfig.targetRadius * 2,
                    height: currentConfig.targetRadius * 2,
                    borderRadius: currentConfig.targetRadius,
                    backgroundColor: orbStatus === "success" ? "#10B981" : "#0284C7",
                    borderColor: "#38BDF8",
                    borderWidth: 3.5,
                  },
                ]}
              >
                <View style={styles.receptorRim} />

                {/* Eyes */}
                <View style={styles.monsterEyesRow}>
                  {orbStatus === "success" ? (
                    <>
                      <Text style={styles.happyEye}>^</Text>
                      <Text style={styles.happyEye}>^</Text>
                    </>
                  ) : orbStatus === "failed" && lives === 0 ? (
                    <>
                      <Text style={styles.sadEye}>×</Text>
                      <Text style={styles.sadEye}>×</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.monsterEye}>
                        <View style={styles.monsterPupil} />
                      </View>
                      <View style={styles.monsterEye}>
                        <View style={styles.monsterPupil} />
                      </View>
                    </>
                  )}
                </View>

                {/* Mouth */}
                <View style={styles.monsterMouth} />

                <View style={styles.socketLabelContainer}>
                  <Text style={styles.socketLabelText}>MONSTER CORE</Text>
                </View>
              </Animated.View>

              {/* Trajectory dots (simulating bounces through portal warp) */}
              {isDragging && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  {trajectoryPoints.map((pt, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.trajectoryDot,
                        {
                          left: pt.x - 3,
                          top: pt.y - 3,
                          opacity: 1 - idx * 0.045,
                        },
                      ]}
                    />
                  ))}
                </View>
              )}

              {/* Warp Portals (mechanical ring visual frames) */}
              {currentConfig.portals.map((pt) => (
                <React.Fragment key={pt.id}>
                  {/* Entrance Blue Portal */}
                  <View
                    style={[
                      styles.portalRing,
                      {
                        left: pt.inX - pt.radius,
                        top: pt.inY - pt.radius,
                        width: pt.radius * 2,
                        height: pt.radius * 2,
                        borderRadius: pt.radius,
                        borderColor: "#38BDF8",
                        shadowColor: "#0EA5E9",
                      },
                    ]}
                  >
                    <View style={[styles.portalInnerDisk, { backgroundColor: "#0284C7" }]} />
                    <MaterialCommunityIcons name="portal" size={pt.radius * 1.2} color="#E0F2FE" />
                    <View style={styles.portalLabel}>
                      <Text style={styles.portalLabelText}>PORTAL_IN</Text>
                    </View>
                  </View>

                  {/* Exit Orange Portal */}
                  <View
                    style={[
                      styles.portalRing,
                      {
                        left: pt.outX - pt.radius,
                        top: pt.outY - pt.radius,
                        width: pt.radius * 2,
                        height: pt.radius * 2,
                        borderRadius: pt.radius,
                        borderColor: "#F97316",
                        shadowColor: "#EA580C",
                      },
                    ]}
                  >
                    <View style={[styles.portalInnerDisk, { backgroundColor: "#EA580C" }]} />
                    <MaterialCommunityIcons name="portal" size={pt.radius * 1.2} color="#FFF7ED" />
                    <View style={[styles.portalLabel, { borderColor: "#EA580C" }]}>
                      <Text style={[styles.portalLabelText, { color: "#F97316" }]}>PORTAL_OUT</Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}

              {/* Switches (Mounted flat on walls) */}
              {currentConfig.switches.map((sw) => {
                const active = activeSwitchIds.includes(sw.id);
                return (
                  <View
                    key={sw.id}
                    style={[
                      styles.switchPanel,
                      {
                        left: sw.x - sw.radius,
                        top: sw.y - sw.radius,
                        width: sw.radius * 2,
                        height: sw.radius * 2,
                        borderRadius: 6,
                        backgroundColor: active ? "#10B981" : "#EF4444",
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={active ? "checkbox-marked-circle" : "alert-circle"}
                      size={sw.radius * 1.2}
                      color="#FFFFFF"
                    />
                    <View style={styles.switchLabel}>
                      <Text style={[styles.switchLabelText, { color: active ? "#10B981" : "#EF4444" }]}>SWITCH</Text>
                    </View>
                  </View>
                );
              })}

              {/* Laser Gates (Projected between metal emitters) */}
              {currentConfig.gates.map((gate) => {
                const active = activeGateIds.includes(gate.id);
                return (
                  <View key={gate.id} style={StyleSheet.absoluteFill} pointerEvents="none">
                    {/* Metal bracket emitter 1 */}
                    <View
                      style={[
                        styles.laserEmitterBracket,
                        {
                          left: gate.x1 - 4,
                          top: gate.y1 - 4,
                          width: gate.isHorizontal ? 8 : 12,
                          height: gate.isHorizontal ? 12 : 8,
                        },
                      ]}
                    />
                    {/* Emitter 2 */}
                    <View
                      style={[
                        styles.laserEmitterBracket,
                        {
                          left: gate.x2 - 4,
                          top: gate.isHorizontal ? gate.y1 - 4 : gate.y2 - 4,
                          width: gate.isHorizontal ? 8 : 12,
                          height: gate.isHorizontal ? 12 : 8,
                        },
                      ]}
                    />

                    {/* Glowing active laser beam path */}
                    {active && (
                      <Svg width={360} height={480} style={StyleSheet.absoluteFill}>
                        <Line
                          x1={gate.x1}
                          y1={gate.y1}
                          x2={gate.x2}
                          y2={gate.isHorizontal ? gate.y1 : gate.y2}
                          stroke="#EF4444"
                          strokeWidth={6}
                          strokeOpacity={0.4}
                        />
                        <Line
                          x1={gate.x1}
                          y1={gate.y1}
                          x2={gate.x2}
                          y2={gate.isHorizontal ? gate.y1 : gate.y2}
                          stroke="#FCA5A5"
                          strokeWidth={2}
                          strokeDasharray="4,4"
                        />
                      </Svg>
                    )}
                  </View>
                );
              })}

              {/* Dynamic Obstacles (Steel Beams, Bumpers, Pendulums) */}
              {obstacles.map((obs) => {
                if (obs.type === "solid_rect") {
                  const width = obs.x2 - obs.x1;
                  const height = obs.y2 - obs.y1;

                  return (
                    <View
                      key={obs.id}
                      style={[
                        styles.steelBeam,
                        {
                          left: obs.x1,
                          top: obs.y1,
                          width: width,
                          height: height,
                        },
                      ]}
                    >
                      {/* Rivets details inside beam corners */}
                      <View style={[styles.rivetDot, { top: 3, left: 3 }]} />
                      {width > 24 && <View style={[styles.rivetDot, { top: 3, right: 3 }]} />}
                      {height > 24 && <View style={[styles.rivetDot, { bottom: 3, left: 3 }]} />}
                      {width > 24 && height > 24 && <View style={[styles.rivetDot, { bottom: 3, right: 3 }]} />}

                      {/* Hazard stripes overlay */}
                      <View style={styles.hazardStripes} />
                    </View>
                  );
                } else if (obs.type === "bumper_circle") {
                  return (
                    <View
                      key={obs.id}
                      style={[
                        styles.bumperCirclePad,
                        {
                          left: obs.x - obs.r,
                          top: obs.y - obs.r,
                          width: obs.r * 2,
                          height: obs.r * 2,
                          borderRadius: obs.r,
                        },
                      ]}
                    >
                      <View style={styles.bumperCoreInner} />
                      <MaterialCommunityIcons name="flash" size={obs.r * 1.1} color="#FFFFFF" />
                    </View>
                  );
                } else if (obs.type === "pendulum") {
                  const ang = obs.maxAngle * Math.sin(timeCounter * obs.speed);
                  const gx = obs.pivotX + obs.length * Math.sin(ang);
                  const gy = obs.pivotY + obs.length * Math.cos(ang);

                  return (
                    <View key={obs.id} style={StyleSheet.absoluteFill} pointerEvents="none">
                      <Svg width={360} height={480} style={StyleSheet.absoluteFill}>
                        <Line
                          x1={obs.pivotX}
                          y1={obs.pivotY}
                          x2={gx}
                          y2={gy}
                          stroke="#475569"
                          strokeWidth={3}
                          strokeDasharray="4,4"
                        />
                        <Circle cx={obs.pivotX} cy={obs.pivotY} r={5} fill="#64748B" />
                      </Svg>
                      <View
                        style={[
                          styles.pendulumGearBob,
                          {
                            left: gx - obs.radius,
                            top: gy - obs.radius,
                            width: obs.radius * 2,
                            height: obs.radius * 2,
                            borderRadius: obs.radius,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons name="cog" size={obs.radius * 1.3} color="#FFFFFF" />
                      </View>
                    </View>
                  );
                }
                return null;
              })}

              {/* LAUNCHER ROBOT (Turret futuristik anchored to the floor) */}
              <View style={[styles.launcherTurret, { left: currentConfig.launcherX - 25, top: currentConfig.launcherY - 25 }]}>
                <View style={styles.turretAnchorBase} />
                
                {/* Gun barrel rotating based on aim angle */}
                <View
                  style={[
                    styles.turretArmBarrel,
                    {
                      transform: [{ rotate: `${aimAngle}deg` }],
                    },
                  ]}
                >
                  <View style={styles.turretCorePipe} />
                </View>

                {/* Turret Casing Head */}
                <View style={styles.turretDome}>
                  <View style={styles.turretVisorLed} />
                </View>
              </View>

              {/* Rubber sling pull-back vector line */}
              {isDragging && (
                <Svg width={360} height={480} style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Line
                    x1={currentConfig.launcherX}
                    y1={currentConfig.launcherY}
                    x2={orbX}
                    y2={orbY}
                    stroke="#00F0FF"
                    strokeWidth={4}
                    strokeOpacity={0.8}
                  />
                  <Circle cx={orbX} cy={orbY} r={VISUAL_ORB_RADIUS + 3} fill="none" stroke="#00F0FF" strokeWidth={1} strokeDasharray="3,3" />
                </Svg>
              )}

              {/* Energy Ball Core */}
              <View
                style={[
                  styles.energyBall,
                  {
                    left: orbX - VISUAL_ORB_RADIUS,
                    top: orbY - VISUAL_ORB_RADIUS,
                    width: VISUAL_ORB_RADIUS * 2,
                    height: VISUAL_ORB_RADIUS * 2,
                    borderRadius: VISUAL_ORB_RADIUS,
                    backgroundColor: orbStatus === "success" ? "#10B981" : "#22D3EE",
                    shadowColor: orbStatus === "success" ? "#10B981" : "#22D3EE",
                  },
                ]}
              >
                <View style={styles.energyBallGlowCenter} />
              </View>

              {level === 1 && shotsUsed === 0 && !isDragging && (
                <View style={styles.tutorialOverlay} pointerEvents="none">
                  <MaterialCommunityIcons name="gesture-swipe-right" size={32} color="#22D3EE" />
                  <Text style={styles.tutorialText}>Klik BOLA lalu tarik ke belakang untuk meluncurkan sirkuit!</Text>
                </View>
              )}

              {/* Touch Interaction Capture Canvas */}
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
                {...panResponder.panHandlers}
              />
            </View>
          </View>
        </View>
      </Animated.View>

      {/* HAZARD TAPE BOTTOM */}
      <View style={styles.hazardTapeBottom} />

      {/* COMPACT BOTTOM MISSION CARD */}
      <View style={styles.missionCardContainer}>
        <View style={styles.missionCard}>
          <View style={styles.missionCardHeader}>
            <View style={styles.skillBadge}>
              <Text style={styles.skillBadgeText}>🧩 PLANNING & SPATIAL</Text>
            </View>
            <Text style={styles.xpReward}>+{currentConfig.rewardXP} XP</Text>
          </View>
          <Text style={styles.missionTitle}>Fasilitas Pabrik Robot // Sektor {level}</Text>
          <Text style={styles.missionDescription}>{currentConfig.instructions}</Text>
        </View>
      </View>

      {/* Victory / Completion Celebration */}
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

      {/* VICTORY OVERLAY */}
      <Modal visible={gameState === "victory"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.victoryIconCircle}>
              <Ionicons name="trophy" size={44} color="#F59E0B" />
            </View>
            <Text style={styles.modalTitle}>SEKTOR TERATASI!</Text>
            <Text style={styles.modalSubtitle}>Sirkuit generator terhubung dan suplai energi berhasil didistribusikan ke PC monster.</Text>

            <View style={styles.starRow}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < calculatedStars ? "star" : "star-outline"}
                  size={36}
                  color={i < calculatedStars ? "#FBBF24" : "#CBD5E1"}
                  style={{ marginHorizontal: 3 }}
                />
              ))}
            </View>

            <View style={styles.rewardSummary}>
              <Text style={styles.rewardLabel}>HADIAH BALANCE</Text>
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons name="coin" size={20} color="#F59E0B" />
                <Text style={styles.rewardBadgeText}>+{currentConfig.rewardCoins} Koin</Text>
              </View>
            </View>

            <Button
              title="Lanjut Sektor Berikutnya"
              onPress={handleNextLevel}
              variant="primary"
              style={{ width: "100%" }}
            />
          </View>
        </View>
      </Modal>

      {/* COMPLETED ALL SECTORS */}
      <Modal visible={gameState === "completed"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.victoryIconCircle, { backgroundColor: "#FFF7ED" }]}>
              <Ionicons name="medal" size={50} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>MISI PABRIK SELESAI!</Text>
            <Text style={styles.modalSubtitle}>Selamat! Seluruh sistem reaktor listrik dan laser gate telah berhasil dipulihkan!</Text>

            <View style={styles.starRow}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < calculatedStars ? "star" : "star-outline"}
                  size={36}
                  color={i < calculatedStars ? "#FBBF24" : "#CBD5E1"}
                  style={{ marginHorizontal: 3 }}
                />
              ))}
            </View>

            <View style={styles.rewardSummary}>
              <Text style={styles.rewardLabel}>BONUS SELESAI</Text>
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons name="coin" size={20} color="#F59E0B" />
                <Text style={styles.rewardBadgeText}>+{currentConfig.rewardCoins} Koin</Text>
              </View>
            </View>

            <Button
              title="Klaim Koin & Keluar"
              onPress={handleClaimAndExit}
              variant="primary"
              style={{ width: "100%" }}
            />
          </View>
        </View>
      </Modal>

      {/* FAILED / GAMEOVER */}
      <Modal visible={gameState === "failed"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.victoryIconCircle, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="close-circle" size={48} color="#EF4444" />
            </View>
            <Text style={[styles.modalTitle, { color: "#EF4444" }]}>DAYA HABIS!</Text>
            <Text style={styles.modalSubtitle}>Sirkuit gagal terhubung. Rencanakan pantulan dan timing sirkuit lebih matang!</Text>

            <Button
              title="Coba Sektor Ini Lagi"
              onPress={handleRestartLevel}
              variant="primary"
              style={{ width: "100%", backgroundColor: "#EF4444", marginBottom: 12 }}
            />
            <Button
              title="Keluar ke Menu"
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
    ...Platform.select({
      web: {
        userSelect: "none",
        WebkitUserSelect: "none",
      } as any,
      default: {},
    }),
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
    zIndex: 99,
  },
  backBtn: {
    backgroundColor: "#1E293B",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  resetBtn: {
    backgroundColor: "#1E293B",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  heartsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  shotsBadge: {
    backgroundColor: "#1E293B",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  shotsText: {
    ...FONTS.bodyBold,
    fontSize: 10,
    color: "#CBD5E1",
  },
  levelBadge: {
    backgroundColor: "#1E293B",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  levelBadgeText: {
    ...FONTS.bodyBold,
    fontSize: 11,
    color: "#E2E8F0",
  },
  coinsHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 3,
  },
  coinsHeaderVal: {
    ...FONTS.bodyBold,
    fontSize: 11,
    color: "#FBBF24",
  },
  hazardTapeTop: {
    height: 4,
    backgroundColor: "#FBBF24",
    borderBottomWidth: 1,
    borderBottomColor: "#D97706",
    backgroundImage: "repeating-linear-gradient(45deg, #FBBF24, #FBBF24 6px, #0F172A 6px, #0F172A 12px)",
  } as any,
  hazardTapeBottom: {
    height: 4,
    backgroundColor: "#FBBF24",
    borderTopWidth: 1,
    borderTopColor: "#D97706",
    backgroundImage: "repeating-linear-gradient(45deg, #FBBF24, #FBBF24 6px, #0F172A 6px, #0F172A 12px)",
  } as any,
  gameplayArea: {
    flex: 1,
    position: "relative",
    backgroundColor: "#0F172A",
  },
  flashOverlay: {
    zIndex: 90,
  },
  blueprintLabel: {
    position: "absolute",
    fontSize: 7.5,
    fontWeight: "900",
    color: "rgba(100, 116, 139, 0.4)",
    letterSpacing: 1.2,
  },
  topCardBanner: {
    position: "absolute",
    top: 10,
    left: 20,
    right: 20,
    backgroundColor: "#1E293B",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#334155",
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    zIndex: 40,
    ...SHADOWS.light,
  },
  topCardBannerText: {
    ...FONTS.bodyBold,
    fontSize: 8.5,
    color: "#38BDF8",
    letterSpacing: 0.5,
    textAlign: "center",
    flex: 1,
  },
  arenaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 30,
  },
  arenaWrapper: {
    position: "relative",
    width: 360,
    height: 480,
    justifyContent: "center",
    alignItems: "center",
  },
  gameArena: {
    width: 360,
    height: 480,
    position: "relative",
    backgroundColor: "transparent",
  },
  targetMonster: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  receptorRim: {
    position: "absolute",
    width: "115%",
    height: "115%",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderStyle: "dashed",
  },
  monsterEyesRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
    zIndex: 2,
  },
  monsterEye: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  monsterPupil: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#0F172A",
  },
  happyEye: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  sadEye: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  monsterMouth: {
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#0F172A",
    marginTop: 3,
  },
  socketLabelContainer: {
    position: "absolute",
    bottom: -15,
    backgroundColor: "#1E293B",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "#334155",
  },
  socketLabelText: {
    fontSize: 6.5,
    fontWeight: "900",
    color: "#CBD5E1",
    letterSpacing: 0.5,
  },
  trajectoryDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#38BDF8",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    zIndex: 4,
  },
  portalRing: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    zIndex: 7,
    backgroundColor: "#1E293B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  portalInnerDisk: {
    position: "absolute",
    width: "80%",
    height: "80%",
    borderRadius: 999,
    opacity: 0.25,
  },
  portalLabel: {
    position: "absolute",
    bottom: -14,
    backgroundColor: "#0F172A",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderWidth: 1,
    borderColor: "#38BDF8",
  },
  portalLabelText: {
    fontSize: 6.5,
    fontWeight: "900",
    color: "#38BDF8",
  },
  switchPanel: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#475569",
    zIndex: 7,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  switchLabel: {
    position: "absolute",
    bottom: -14,
    backgroundColor: "#0F172A",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderWidth: 1,
    borderColor: "#475569",
  },
  switchLabelText: {
    fontSize: 6.5,
    fontWeight: "900",
  },
  laserEmitterBracket: {
    position: "absolute",
    backgroundColor: "#475569",
    borderWidth: 1.5,
    borderColor: "#64748B",
    borderRadius: 2,
    zIndex: 6,
  },
  laserGateContainer: {
    position: "absolute",
    borderRadius: 2,
    zIndex: 7,
  },
  laserText: {
    fontSize: 7.5,
    fontWeight: "900",
    color: "#EF4444",
    letterSpacing: 0.6,
  },
  steelBeam: {
    position: "absolute",
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 2,
    borderRadius: 4,
    zIndex: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 5,
  },
  rivetDot: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#475569",
  },
  hazardStripes: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    opacity: 0.05,
    backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, #FBBF24 5px, #FBBF24 10px)",
  } as any,
  bumperCirclePad: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#10B981",
    borderWidth: 2.5,
    borderColor: "#A7F3D0",
    zIndex: 7,
    shadowColor: "#10B981",
    shadowRadius: 8,
    shadowOpacity: 0.6,
    elevation: 4,
  },
  bumperCoreInner: {
    position: "absolute",
    width: "70%",
    height: "70%",
    borderRadius: 999,
    backgroundColor: "#047857",
  },
  pendulumGearBob: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EF4444",
    borderWidth: 2.5,
    borderColor: "#FEE2E2",
    zIndex: 7,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  launcherTurret: {
    position: "absolute",
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9,
  },
  turretAnchorBase: {
    position: "absolute",
    bottom: 2,
    width: 36,
    height: 8,
    backgroundColor: "#1E293B",
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: "#475569",
    zIndex: 1,
  },
  turretDome: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#334155",
    borderWidth: 2.5,
    borderColor: "#64748B",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  turretVisorLed: {
    width: 14,
    height: 5,
    backgroundColor: "#0F172A",
    borderRadius: 2.5,
    borderWidth: 1,
    borderColor: "#00F0FF",
  },
  turretArmBarrel: {
    position: "absolute",
    width: 34,
    height: 12,
    justifyContent: "center",
    alignItems: "flex-end",
    zIndex: 2,
  },
  turretCorePipe: {
    width: 18,
    height: 8,
    backgroundColor: "#475569",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 2,
  },
  energyBall: {
    position: "absolute",
    zIndex: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowRadius: 10,
    shadowOpacity: 0.9,
    elevation: 5,
  },
  energyBallGlowCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  tutorialOverlay: {
    position: "absolute",
    left: 20,
    bottom: 85,
    right: 20,
    alignItems: "center",
    zIndex: 30,
  },
  tutorialText: {
    ...FONTS.bodyBold,
    fontSize: 10.5,
    color: "#22D3EE",
    marginTop: 4,
    textAlign: "center",
    textShadowColor: "#000000",
    textShadowRadius: 2,
  },
  missionCardContainer: {
    paddingHorizontal: SPACING.md + 2,
    paddingBottom: SPACING.md + 2,
    backgroundColor: "#0F172A",
  },
  missionCard: {
    backgroundColor: "#1E293B",
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: "#334155",
    ...SHADOWS.light,
  },
  missionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  skillBadge: {
    backgroundColor: "#0F172A",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#334155",
  },
  skillBadgeText: {
    fontSize: 8.5,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  xpReward: {
    fontSize: 11,
    fontWeight: "900",
    color: "#10B981",
  },
  missionTitle: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: "#F8FAFC",
    marginBottom: 2,
  },
  missionDescription: {
    ...FONTS.bodyRegular,
    fontSize: 10,
    color: "#94A3B8",
    lineHeight: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
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
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
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
