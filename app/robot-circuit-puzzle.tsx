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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  runOnJS,
} from "react-native-reanimated";
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop, Polygon } from "react-native-svg";
import { COLORS, SPACING, SHAPES, FONTS, SHADOWS } from "../constants/Theme";
import Button from "../components/ui/Button";

const STORAGE_KEY_COINS = "user_coins_balance";
const STORAGE_KEY_LEVEL = "robot_circuit_current_level";
const GRID_SIZE = 6; // 6x6 grid

interface RobotModule {
  id: string;
  name: string;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
  direction: "UP" | "DOWN" | "LEFT" | "RIGHT";
  color: string;
  accentColor: string;
  icon: string;
}

interface LevelConfig {
  level: number;
  title: string;
  rewardCoins: number;
  rewardXP: number;
  modules: RobotModule[];
  hintOrder: string[];
}

interface EducationalChallenge {
  title: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const EDUCATIONAL_CHALLENGES: Record<number, EducationalChallenge> = {
  5: {
    title: "Tantangan Komputasi Ron-Bonta",
    question: "Ron-Bonta ingin mengirim instruksi ke Servo Motor. Jika kode berikut dijalankan:\n\nlet daya = 10;\nrepeat(3) {\n  daya = daya + 5;\n}\n\nBerapakah nilai akhir 'daya'?",
    options: ["15", "25", "30", "35"],
    correctIndex: 1,
    explanation: "Variabel 'daya' dimulai dari 10. Pengulangan dijalankan 3 kali, setiap kali menambah 5. Maka 10 + 5 + 5 + 5 = 25!",
  },
};

const LEVELS: LevelConfig[] = [
  {
    level: 1,
    title: "Sirkuit AI Sederhana",
    rewardCoins: 50,
    rewardXP: 100,
    hintOrder: ["m1", "m2"],
    modules: [
      {
        id: "m1",
        name: "Battery Module",
        gridX: 1,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "UP",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "battery-charging",
      },
      {
        id: "m2",
        name: "AI Core",
        gridX: 2,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "RIGHT",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "robot-outline",
      },
    ],
  },
  {
    level: 2,
    title: "Sirkuit Sensor Kamera",
    rewardCoins: 75,
    rewardXP: 120,
    hintOrder: ["m2", "m1", "m3"],
    modules: [
      {
        id: "m1",
        name: "Vision Sensor",
        gridX: 2,
        gridY: 1,
        width: 1,
        height: 1,
        direction: "UP",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "eye-outline",
      },
      {
        id: "m2",
        name: "CPU Chip",
        gridX: 2,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "LEFT",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "cpu",
      },
      {
        id: "m3",
        name: "Memory Chip",
        gridX: 3,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "RIGHT",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "memory",
      },
    ],
  },
  {
    level: 3,
    title: "Labirin Transmisi Daya",
    rewardCoins: 100,
    rewardXP: 150,
    hintOrder: ["m1", "m3", "m2", "m4"],
    modules: [
      {
        id: "m1",
        name: "AI Core",
        gridX: 1,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "UP",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "robot-outline",
      },
      {
        id: "m2",
        name: "Servo Motor",
        gridX: 2,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "DOWN",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "engine",
      },
      {
        id: "m3",
        name: "Energy Cell",
        gridX: 3,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "RIGHT",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "lightning-bolt-outline",
      },
      {
        id: "m4",
        name: "Cooling Unit",
        gridX: 2,
        gridY: 3,
        width: 1,
        height: 1,
        direction: "RIGHT",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "snowflake",
      },
    ],
  },
  {
    level: 4,
    title: "Sirkuit Robotika Lanjut",
    rewardCoins: 125,
    rewardXP: 180,
    hintOrder: ["m1", "m3", "m4", "m2", "m5"],
    modules: [
      {
        id: "m1",
        name: "Battery Module",
        gridX: 1,
        gridY: 1,
        width: 1,
        height: 1,
        direction: "LEFT",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "battery-charging",
      },
      {
        id: "m2",
        name: "CPU Chip",
        gridX: 2,
        gridY: 1,
        width: 1,
        height: 1,
        direction: "UP",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "cpu",
      },
      {
        id: "m3",
        name: "Memory Chip",
        gridX: 3,
        gridY: 1,
        width: 1,
        height: 1,
        direction: "UP",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "memory",
      },
      {
        id: "m4",
        name: "Servo Motor",
        gridX: 2,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "DOWN",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "engine",
      },
      {
        id: "m5",
        name: "Navigation Module",
        gridX: 3,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "RIGHT",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "compass-outline",
      },
    ],
  },
  {
    level: 5,
    title: "Inti Kognitif Ron-Bonta",
    rewardCoins: 150,
    rewardXP: 200,
    hintOrder: ["m1", "m3", "m5", "m2", "m4", "m6"],
    modules: [
      {
        id: "m1",
        name: "AI Core",
        gridX: 1,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "UP",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "robot-outline",
      },
      {
        id: "m2",
        name: "Arm Joint",
        gridX: 2,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "LEFT",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "robot-industrial",
      },
      {
        id: "m3",
        name: "Servo Motor",
        gridX: 3,
        gridY: 2,
        width: 1,
        height: 1,
        direction: "UP",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "engine",
      },
      {
        id: "m4",
        name: "Energy Cell",
        gridX: 2,
        gridY: 3,
        width: 1,
        height: 1,
        direction: "LEFT",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "lightning-bolt-outline",
      },
      {
        id: "m5",
        name: "CPU Chip",
        gridX: 3,
        gridY: 3,
        width: 1,
        height: 1,
        direction: "RIGHT",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "cpu",
      },
      {
        id: "m6",
        name: "Cooling Unit",
        gridX: 3,
        gridY: 4,
        width: 1,
        height: 1,
        direction: "DOWN",
        color: "#FFFFFF",
        accentColor: "#38BDF8",
        icon: "snowflake",
      },
    ],
  },
];

// Helper to determine if two modules are adjacent on a specific side
const getNeighborConnection = (
  mod: RobotModule,
  allModules: RobotModule[],
  side: "TOP" | "RIGHT" | "BOTTOM" | "LEFT"
): "KNOB" | "SOCKET" | "NONE" => {
  let nx = mod.gridX;
  let ny = mod.gridY;

  if (side === "TOP") ny -= 1;
  else if (side === "RIGHT") nx += 1;
  else if (side === "BOTTOM") ny += 1;
  else if (side === "LEFT") nx -= 1;

  const neighbor = allModules.find((m) => m.gridX === nx && m.gridY === ny);
  if (!neighbor) return "NONE";

  // Deterministic rule: smaller ID gets knob, larger gets socket
  return mod.id < neighbor.id ? "KNOB" : "SOCKET";
};

// Sub-component for rendering a jigsaw puzzle piece
const ModuleItem = React.memo(({
  mod,
  allModules,
  trans,
  cellSize,
  onPress,
}: {
  mod: RobotModule;
  allModules: RobotModule[];
  trans: { x: Animated.SharedValue<number>; y: Animated.SharedValue<number> };
  cellSize: number;
  onPress: () => void;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: trans.x.value },
        { translateY: trans.y.value },
      ],
    };
  });

  const topConn = getNeighborConnection(mod, allModules, "TOP");
  const rightConn = getNeighborConnection(mod, allModules, "RIGHT");
  const bottomConn = getNeighborConnection(mod, allModules, "BOTTOM");
  const leftConn = getNeighborConnection(mod, allModules, "LEFT");

  // SVG Jigsaw Path Generation
  const generateJigsawPath = () => {
    const S = cellSize;
    const R = 8; // rounded corners radius
    const K = 12; // knob size

    // Start at top-left corner
    let path = `M ${R} 0`;

    // TOP EDGE: goes to (S - R, 0)
    if (topConn === "NONE") {
      path += ` L ${S - R} 0`;
    } else {
      const mid = S / 2;
      const dir = topConn === "KNOB" ? -1 : 1; // Knob bulges out (upward negative), Socket bulges in (downward positive)
      path += ` L ${mid - 10} 0`;
      path += ` C ${mid - 8} ${dir * K}, ${mid + 8} ${dir * K}, ${mid + 10} 0`;
      path += ` L ${S - R} 0`;
    }
    // Top-Right Corner
    path += ` A ${R} ${R} 0 0 1 ${S} ${R}`;

    // RIGHT EDGE: goes to (S, S - R)
    if (rightConn === "NONE") {
      path += ` L ${S} ${S - R}`;
    } else {
      const mid = S / 2;
      const dir = rightConn === "KNOB" ? 1 : -1; // Knob bulges out (rightward positive)
      path += ` L ${S} ${mid - 10}`;
      path += ` C ${S + dir * K} ${mid - 8}, ${S + dir * K} ${mid + 8}, ${S} ${mid + 10}`;
      path += ` L ${S} ${S - R}`;
    }
    // Bottom-Right Corner
    path += ` A ${R} ${R} 0 0 1 ${S - R} ${S}`;

    // BOTTOM EDGE: goes to (R, S)
    if (bottomConn === "NONE") {
      path += ` L ${R} ${S}`;
    } else {
      const mid = S / 2;
      const dir = bottomConn === "KNOB" ? 1 : -1; // Knob bulges out (downward positive)
      path += ` L ${mid + 10} ${S}`;
      path += ` C ${mid + 8} ${S + dir * K}, ${mid - 8} ${S + dir * K}, ${mid - 10} ${S}`;
      path += ` L ${R} ${S}`;
    }
    // Bottom-Left Corner
    path += ` A ${R} ${R} 0 0 1 0 ${S - R}`;

    // LEFT EDGE: goes to (0, R)
    if (leftConn === "NONE") {
      path += ` L 0 ${R}`;
    } else {
      const mid = S / 2;
      const dir = leftConn === "KNOB" ? -1 : 1; // Knob bulges out (leftward negative)
      path += ` L 0 ${mid + 10}`;
      path += ` C ${dir * K} ${mid + 8}, ${dir * K} ${mid - 8}, 0 ${mid - 10}`;
      path += ` L 0 ${R}`;
    }
    // Top-Left Corner
    path += ` A ${R} ${R} 0 0 1 ${R} 0 Z`;

    return path;
  };

  // Render Triangle direction indicator inside the piece
  const renderArrow = () => {
    const c = cellSize / 2;
    const size = 16;
    let rot = "0deg";

    if (mod.direction === "RIGHT") rot = "90deg";
    else if (mod.direction === "DOWN") rot = "180deg";
    else if (mod.direction === "LEFT") rot = "270deg";

    return (
      <View style={[StyleSheet.absoluteFillObject, { justifyContent: "center", alignItems: "center", transform: [{ rotate: rot }] }]}>
        <Svg width={cellSize} height={cellSize} viewBox={`0 0 ${cellSize} ${cellSize}`}>
          <Polygon
            points={`${c},${c - size} ${c - size},${c + size * 0.7} ${c + size},${c + size * 0.7}`}
            fill="none"
            stroke="#0284C7"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.moduleWrapper,
        animatedStyle,
        {
          left: mod.gridX * cellSize,
          top: mod.gridY * cellSize,
          width: cellSize,
          height: cellSize,
        },
      ]}
    >
      <Pressable onPress={onPress} style={{ width: cellSize, height: cellSize }}>
        {/* Draw puzzle body with soft shadow */}
        <Svg width={cellSize + 20} height={cellSize + 20} style={{ overflow: "visible", position: "absolute", left: -10, top: -10 }}>
          <Defs>
            <LinearGradient id="pieceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="100%" stopColor="#F3F4F6" />
            </LinearGradient>
          </Defs>
          {/* Drop shadow path */}
          <Path d={generateJigsawPath()} fill="#D1D5DB" transform="translate(10, 12)" opacity="0.8" />
          {/* Main piece path */}
          <Path d={generateJigsawPath()} fill="url(#pieceGrad)" stroke="#E5E7EB" strokeWidth="1.5" transform="translate(10, 10)" />
        </Svg>

        {/* Direction Indicator */}
        {renderArrow()}
      </Pressable>
    </Animated.View>
  );
});

export default function RobotCircuitPuzzleScreen() {
  const router = useRouter();

  // Define 12 pairs of shared values (maximum possible modules in a level) to comply with Rules of Hooks
  const sv1_x = useSharedValue(0); const sv1_y = useSharedValue(0);
  const sv2_x = useSharedValue(0); const sv2_y = useSharedValue(0);
  const sv3_x = useSharedValue(0); const sv3_y = useSharedValue(0);
  const sv4_x = useSharedValue(0); const sv4_y = useSharedValue(0);
  const sv5_x = useSharedValue(0); const sv5_y = useSharedValue(0);
  const sv6_x = useSharedValue(0); const sv6_y = useSharedValue(0);
  const sv7_x = useSharedValue(0); const sv7_y = useSharedValue(0);
  const sv8_x = useSharedValue(0); const sv8_y = useSharedValue(0);
  const sv9_x = useSharedValue(0); const sv9_y = useSharedValue(0);
  const sv10_x = useSharedValue(0); const sv10_y = useSharedValue(0);
  const sv11_x = useSharedValue(0); const sv11_y = useSharedValue(0);
  const sv12_x = useSharedValue(0); const sv12_y = useSharedValue(0);

  const sharedValues = useMemo(() => [
    { x: sv1_x, y: sv1_y },
    { x: sv2_x, y: sv2_y },
    { x: sv3_x, y: sv3_y },
    { x: sv4_x, y: sv4_y },
    { x: sv5_x, y: sv5_y },
    { x: sv6_x, y: sv6_y },
    { x: sv7_x, y: sv7_y },
    { x: sv8_x, y: sv8_y },
    { x: sv9_x, y: sv9_y },
    { x: sv10_x, y: sv10_y },
    { x: sv11_x, y: sv11_y },
    { x: sv12_x, y: sv12_y },
  ], [
    sv1_x, sv1_y, sv2_x, sv2_y, sv3_x, sv3_y, sv4_x, sv4_y,
    sv5_x, sv5_y, sv6_x, sv6_y, sv7_x, sv7_y, sv8_x, sv8_y,
    sv9_x, sv9_y, sv10_x, sv10_y, sv11_x, sv11_y, sv12_x, sv12_y
  ]);

  const moduleIndexMap = useRef<Record<string, number>>({});

  // State Variables
  const [level, setLevel] = useState(1);
  const [modules, setModules] = useState<RobotModule[]>([]);
  const [history, setHistory] = useState<RobotModule[][]>([]);
  const [userCoins, setUserCoins] = useState(1250);
  const [energy, setEnergy] = useState(100);
  const [gameState, setGameState] = useState<"playing" | "victory" | "completed">("playing");
  const [showHintModal, setShowHintModal] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);

  // Educational Challenge Modal state
  const [showEduModal, setShowEduModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [selectedEduOption, setSelectedEduOption] = useState<number | null>(null);
  const [eduIsCorrect, setEduIsCorrect] = useState<boolean | null>(null);

  // Companion Dialog state
  const [companionText, setCompanionText] = useState(
    "Hai Anak Pintar! Bantu Ron-Bonta melepas semua komponen robot dari sirkuit dengan menggesernya keluar!"
  );

  // Screen layout measurements (constrained for mobile aspect ratio on web/desktop)
  const windowWidth = Dimensions.get("window").width;
  const windowHeight = Dimensions.get("window").height;
  const boardPadding = SPACING.md;
  const boardSize = Math.min(windowWidth - boardPadding * 2, 420, windowHeight * 0.42);
  const cellSize = boardSize / GRID_SIZE;

  // Active level config
  const currentLevelConfig = useMemo(() => {
    return LEVELS.find((l) => l.level === level) || LEVELS[0];
  }, [level]);

  // Load User Stats on mount
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const storedCoins = await AsyncStorage.getItem(STORAGE_KEY_COINS);
        if (storedCoins !== null) {
          setUserCoins(parseInt(storedCoins));
        }
        const storedLevel = await AsyncStorage.getItem(STORAGE_KEY_LEVEL);
        if (storedLevel !== null) {
          const l = parseInt(storedLevel);
          if (l <= LEVELS.length) {
            setLevel(l);
          } else {
            setLevel(1);
          }
        }
      } catch (err) {
        console.error("Error loading sirkuit data", err);
      }
    };
    loadGameData();
  }, []);

  // Initialize level
  useEffect(() => {
    if (currentLevelConfig) {
      setModules(JSON.parse(JSON.stringify(currentLevelConfig.modules)));
      setHistory([]);
      setGameState("playing");
      setHintIndex(0);
      setCompanionText(
        `Misi Level ${level}: Lepaskan semua komponen ${currentLevelConfig.title}. Perhatikan arah panah masing-masing modul!`
      );

      const indexMap: Record<string, number> = {};
      currentLevelConfig.modules.forEach((m, idx) => {
        indexMap[m.id] = idx;
        if (sharedValues[idx]) {
          sharedValues[idx].x.value = 0;
          sharedValues[idx].y.value = 0;
        }
      });
      moduleIndexMap.current = indexMap;
    }
  }, [level, currentLevelConfig, sharedValues]);

  // Check victory condition
  useEffect(() => {
    if (modules.length === 0 && gameState === "playing") {
      handleLevelComplete();
    }
  }, [modules, gameState]);

  // Level Complete logic
  const handleLevelComplete = () => {
    setGameState("victory");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCompanionText("Luar biasa! Kamu berhasil menyusun urutan pelepasan sirkuit secara sempurna!");
  };

  // Move Validation Logic
  const canMove = (mod: RobotModule, currentModules: RobotModule[]): boolean => {
    const { gridX, gridY, width, height, direction } = mod;

    if (direction === "RIGHT") {
      const rightBound = gridX + width;
      for (let x = rightBound; x < GRID_SIZE; x++) {
        for (let y = gridY; y < gridY + height; y++) {
          const isBlocked = currentModules.some(
            (o) =>
              o.id !== mod.id &&
              x >= o.gridX &&
              x < o.gridX + o.width &&
              y >= o.gridY &&
              y < o.gridY + o.height
          );
          if (isBlocked) return false;
        }
      }
      return true;
    }

    if (direction === "LEFT") {
      const leftBound = gridX - 1;
      for (let x = leftBound; x >= 0; x--) {
        for (let y = gridY; y < gridY + height; y++) {
          const isBlocked = currentModules.some(
            (o) =>
              o.id !== mod.id &&
              x >= o.gridX &&
              x < o.gridX + o.width &&
              y >= o.gridY &&
              y < o.gridY + o.height
          );
          if (isBlocked) return false;
        }
      }
      return true;
    }

    if (direction === "UP") {
      const upperBound = gridY - 1;
      for (let y = upperBound; y >= 0; y--) {
        for (let x = gridX; x < gridX + width; x++) {
          const isBlocked = currentModules.some(
            (o) =>
              o.id !== mod.id &&
              x >= o.gridX &&
              x < o.gridX + o.width &&
              y >= o.gridY &&
              y < o.gridY + o.height
          );
          if (isBlocked) return false;
        }
      }
      return true;
    }

    if (direction === "DOWN") {
      const lowerBound = gridY + height;
      for (let y = lowerBound; y < GRID_SIZE; y++) {
        for (let x = gridX; x < gridX + width; x++) {
          const isBlocked = currentModules.some(
            (o) =>
              o.id !== mod.id &&
              x >= o.gridX &&
              x < o.gridX + o.width &&
              y >= o.gridY &&
              y < o.gridY + o.height
          );
          if (isBlocked) return false;
        }
      }
      return true;
    }

    return false;
  };

  const getTranslationForModule = (id: string) => {
    const idx = moduleIndexMap.current[id];
    if (idx !== undefined && sharedValues[idx]) {
      return sharedValues[idx];
    }
    return { x: { value: 0 }, y: { value: 0 } };
  };

  // Handle tap/click on a module
  const handleTapModule = (mod: RobotModule) => {
    if (gameState !== "playing") return;

    const currentTrans = getTranslationForModule(mod.id);
    if (!currentTrans || !("value" in currentTrans.x)) return;

    if (canMove(mod, modules)) {
      setHistory((prev) => [...prev, JSON.parse(JSON.stringify(modules))]);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setEnergy((prev) => Math.max(10, prev - 2));

      let targetX = 0;
      let targetY = 0;
      const travelDist = boardSize + 100;

      if (mod.direction === "RIGHT") targetX = travelDist;
      if (mod.direction === "LEFT") targetX = -travelDist;
      if (mod.direction === "DOWN") targetY = travelDist;
      if (mod.direction === "UP") targetY = -travelDist;

      currentTrans.x.value = withTiming(targetX, { duration: 400 });
      currentTrans.y.value = withTiming(targetY, { duration: 400 }, () => {
        runOnJS(removeModule)(mod.id);
      });

      setCompanionText(`Modul ${mod.name} berhasil dilepas!`);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setCompanionText(`Gagal! Modul ${mod.name} terhalang modul lain.`);

      const shakeAmt = 8;
      if (mod.direction === "LEFT" || mod.direction === "RIGHT") {
        currentTrans.y.value = withSequence(
          withTiming(-shakeAmt, { duration: 50 }),
          withTiming(shakeAmt, { duration: 50 }),
          withTiming(-shakeAmt / 2, { duration: 50 }),
          withTiming(shakeAmt / 2, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );
      } else {
        currentTrans.x.value = withSequence(
          withTiming(-shakeAmt, { duration: 50 }),
          withTiming(shakeAmt, { duration: 50 }),
          withTiming(-shakeAmt / 2, { duration: 50 }),
          withTiming(shakeAmt / 2, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );
      }
    }
  };

  const removeModule = (id: string) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUndo = () => {
    if (history.length === 0) {
      setCompanionText("Tidak ada gerakan untuk di-undo!");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevState = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));

    prevState.forEach((m) => {
      const trans = getTranslationForModule(m.id);
      if (trans && "value" in trans.x) {
        trans.x.value = 0;
        trans.y.value = 0;
      }
    });

    setModules(prevState);
    setCompanionText("Gerakan dibatalkan. Kembalikan modul!");
  };

  const handleRestart = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    modules.forEach((m) => {
      const trans = getTranslationForModule(m.id);
      if (trans && "value" in trans.x) {
        trans.x.value = 0;
        trans.y.value = 0;
      }
    });
    setModules(JSON.parse(JSON.stringify(currentLevelConfig.modules)));
    setHistory([]);
    setHintIndex(0);
    setCompanionText("Sirkuit di-reset. Mari kita coba lagi!");
  };

  const handleHint = () => {
    if (gameState !== "playing" || modules.length === 0) return;

    if (userCoins < 20) {
      setCompanionText("Koin tidak cukup!");
      return;
    }

    const newCoins = userCoins - 20;
    setUserCoins(newCoins);
    AsyncStorage.setItem(STORAGE_KEY_COINS, String(newCoins));

    const nextToClear = currentLevelConfig.hintOrder.find((id) =>
      modules.some((m) => m.id === id)
    );

    if (nextToClear) {
      const targetMod = modules.find((m) => m.id === nextToClear);
      if (targetMod) {
        setCompanionText(`💡 Petunjuk: Coba lepaskan modul "${targetMod.name}"!`);
        const trans = getTranslationForModule(targetMod.id);
        if (trans && "value" in trans.x) {
          trans.y.value = withSequence(
            withTiming(-6, { duration: 80 }),
            withTiming(6, { duration: 80 }),
            withTiming(0, { duration: 80 })
          );
        }
      }
    } else {
      setCompanionText("💡 Petunjuk: Semua modul siap dilepas!");
    }
  };

  const handleNextLevel = async () => {
    const nextLevelNum = level + 1;
    const coinsReward = currentLevelConfig.rewardCoins;
    const finalCoins = userCoins + coinsReward;
    setUserCoins(finalCoins);
    await AsyncStorage.setItem(STORAGE_KEY_COINS, String(finalCoins));

    if (EDUCATIONAL_CHALLENGES[nextLevelNum]) {
      setSelectedEduOption(null);
      setEduIsCorrect(null);
      setShowEduModal(true);
      return;
    }

    proceedToLevel(nextLevelNum);
  };

  const proceedToLevel = async (lvl: number) => {
    if (lvl > LEVELS.length) {
      setGameState("completed");
      setCompanionText("Semua level selesai!");
      setLevel(1);
      await AsyncStorage.setItem(STORAGE_KEY_LEVEL, "1");
    } else {
      setLevel(lvl);
      await AsyncStorage.setItem(STORAGE_KEY_LEVEL, String(lvl));
    }
  };

  const handleAnswerChallenge = (index: number) => {
    const nextLevelNum = level + 1;
    const challenge = EDUCATIONAL_CHALLENGES[nextLevelNum];
    if (!challenge) return;

    setSelectedEduOption(index);
    if (index === challenge.correctIndex) {
      setEduIsCorrect(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setEduIsCorrect(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0EA5E9" />

      {/* TOP BAR */}
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => setShowPauseModal(true)}>
          <Ionicons name="menu" size={24} color="#64748B" />
        </Pressable>

        <View style={styles.levelBadgeContainer}>
          <Text style={styles.levelText}>Sirkuit {level}</Text>
        </View>

        <View style={styles.topHud}>
          <View style={[styles.hudBadge, { borderColor: "#F59E0B" }]}>
            <Ionicons name="bulb" size={16} color="#FFFFFF" />
            <Text style={[styles.hudText, { color: "#FFFFFF" }]}>2</Text>
          </View>
        </View>
      </View>

      {/* Main Game Area */}
      <View style={styles.mainGameArea}>
        <View style={[styles.boardContainer, { width: boardSize, height: boardSize }]}>
          {/* Render Robot Modules */}
          {modules.map((mod) => {
            const trans = getTranslationForModule(mod.id);
            return (
              <ModuleItem
                key={mod.id}
                mod={mod}
                allModules={modules}
                trans={trans}
                cellSize={cellSize}
                onPress={() => handleTapModule(mod)}
              />
            );
          })}
        </View>
      </View>

      {/* Robot Companion Ron-Bonta Panel & Dialog */}
      <View style={styles.companionPanel}>
        <View style={styles.ronBontaAvatarContainer}>
          <Svg width="44" height="44" viewBox="0 0 64 64">
            <Rect x="8" y="14" width="48" height="40" rx="14" fill="#00C3A0" stroke="#FFFFFF" strokeWidth="3" />
            <Circle cx="22" cy="32" r="6" fill="#1E2937" />
            <Circle cx="22" cy="32" r="2.5" fill="#00FFFF" />
            <Circle cx="42" cy="32" r="6" fill="#1E2937" />
            <Circle cx="42" cy="32" r="2.5" fill="#00FFFF" />
            <Rect x="29" y="4" width="6" height="10" rx="3" fill="#FFE600" />
            <Circle cx="32" cy="4" r="5" fill="#FFE600" />
            <Circle cx="15" cy="42" r="3" fill="#FF5E36" opacity="0.6" />
            <Circle cx="49" cy="42" r="3" fill="#FF5E36" opacity="0.6" />
          </Svg>
        </View>
        <View style={styles.dialogBubble}>
          <Text style={styles.dialogText}>{companionText}</Text>
        </View>
      </View>

      {/* BOTTOM PANEL CONTROLS */}
      <View style={styles.bottomBar}>
        <Pressable style={styles.actionBtn} onPress={handleUndo}>
          <View style={styles.actionIconBg}>
            <Ionicons name="arrow-undo-outline" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.actionBtnLabel}>Undo</Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={handleRestart}>
          <View style={[styles.actionIconBg, { backgroundColor: "#FF5E36" }]}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.actionBtnLabel}>Restart</Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={handleHint}>
          <View style={[styles.actionIconBg, { backgroundColor: "#FBBF24" }]}>
            <Ionicons name="bulb-outline" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.actionBtnLabel}>Hint (20🪙)</Text>
        </Pressable>
      </View>

      {/* Victory & Reward Modal */}
      <Modal visible={gameState === "victory"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.victoryCard}>
            <Text style={styles.victoryTitle}>Sirkuit Selesai!</Text>
            <Text style={styles.victorySubtitle}>Kamu berhasil melepas semua komponen digital.</Text>

            <View style={styles.starRow}>
              <Ionicons name="star" size={42} color="#FBBF24" />
              <Ionicons name="star" size={54} color="#FBBF24" style={{ marginTop: -15 }} />
              <Ionicons name="star" size={42} color="#FBBF24" />
            </View>

            <View style={styles.rewardCardContainer}>
              <View style={styles.rewardItem}>
                <MaterialCommunityIcons name="coins" size={26} color="#FBBF24" />
                <Text style={styles.rewardAmount}>+{currentLevelConfig?.rewardCoins} Koin</Text>
              </View>
              <View style={styles.rewardItem}>
                <MaterialCommunityIcons name="trophy-outline" size={26} color="#60A5FA" />
                <Text style={styles.rewardAmount}>+{currentLevelConfig?.rewardXP} XP</Text>
              </View>
            </View>

            <Button
              title={level === LEVELS.length ? "Selesai" : "Misi Berikutnya"}
              onPress={handleNextLevel}
              variant="orange"
              style={styles.nextLevelButton}
            />
          </View>
        </View>
      </Modal>

      {/* Pause Menu Modal */}
      <Modal visible={showPauseModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.victoryCard}>
            <Text style={[styles.victoryTitle, { color: "#1E2937", marginBottom: 6 }]}>Game Berhenti</Text>
            <Text style={[styles.victorySubtitle, { marginBottom: 24 }]}>Pilih opsi untuk melanjutkan:</Text>

            <Button
              title="Lanjutkan Bermain"
              onPress={() => setShowPauseModal(false)}
              variant="green"
              style={{ width: "100%", marginBottom: 12 }}
            />

            <Button
              title="Mulai Ulang Level"
              onPress={() => {
                setShowPauseModal(false);
                handleRestart();
              }}
              variant="orange"
              style={{ width: "100%", marginBottom: 12 }}
            />

            <Button
              title="Kembali ke Menu Utama"
              onPress={() => {
                setShowPauseModal(false);
                router.back();
              }}
              variant="orange"
              style={{ width: "100%", backgroundColor: "#EF4444" }}
            />
          </View>
        </View>
      </Modal>

      {/* Educational Challenge Modal */}
      <Modal visible={showEduModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.eduCard}>
            <View style={styles.eduHeader}>
              <MaterialCommunityIcons name="lightbulb-on" size={24} color="#FBBF24" />
              <Text style={styles.eduTitle}>Tantangan Komputasi</Text>
            </View>
            <ScrollView contentContainerStyle={styles.eduScroll}>
              <Text style={styles.eduQuestion}>
                {EDUCATIONAL_CHALLENGES[level + 1]?.question}
              </Text>

              {EDUCATIONAL_CHALLENGES[level + 1]?.options.map((opt, index) => {
                let btnStyle = styles.optionBtn;
                let textStyle = styles.optionText;

                if (selectedEduOption === index) {
                  if (eduIsCorrect) {
                    btnStyle = [styles.optionBtn, styles.optionBtnSuccess];
                    textStyle = [styles.optionText, styles.optionTextSuccess];
                  } else {
                    btnStyle = [styles.optionBtn, styles.optionBtnError];
                    textStyle = [styles.optionText, styles.optionTextError];
                  }
                }

                return (
                  <Pressable
                    key={index}
                    disabled={selectedEduOption !== null}
                    style={btnStyle}
                    onPress={() => handleAnswerChallenge(index)}
                  >
                    <Text style={textStyle}>{opt}</Text>
                    {selectedEduOption === index && (
                      <Ionicons
                        name={eduIsCorrect ? "checkmark-circle" : "close-circle"}
                        size={20}
                        color={eduIsCorrect ? "#10B981" : "#EF4444"}
                      />
                    )}
                  </Pressable>
                );
              })}

              {eduIsCorrect !== null && (
                <View style={styles.feedbackContainer}>
                  <Text style={styles.feedbackHeader}>
                    {eduIsCorrect ? "🎉 Jawaban Benar!" : "❌ Kurang Tepat"}
                  </Text>
                  <Text style={styles.feedbackText}>
                    {EDUCATIONAL_CHALLENGES[level + 1]?.explanation}
                  </Text>
                  <Button
                    title="Lanjutkan"
                    variant="green"
                    style={{ marginTop: 15 }}
                    onPress={() => {
                      setShowEduModal(false);
                      proceedToLevel(level + 1);
                    }}
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Game Completed screen */}
      <Modal visible={gameState === "completed"} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.victoryCard}>
            <MaterialCommunityIcons name="party-popper" size={60} color="#FF5E36" />
            <Text style={styles.victoryTitle}>Semua Sirkuit Selesai!</Text>
            <Text style={styles.victorySubtitle}>Hebat! Seluruh sirkuit robot berhasil kamu perbaiki.</Text>
            <Button
              title="Keluar"
              onPress={() => router.back()}
              variant="green"
              style={styles.nextLevelButton}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0EA5E9", // Light blue sky color like Unpuzzle
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: "#0EA5E9",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  levelBadgeContainer: {
    backgroundColor: "transparent",
  },
  levelText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 18,
    opacity: 0.9,
  },
  topHud: {
    flexDirection: "row",
    gap: 8,
  },
  hudBadge: {
    width: 50,
    height: 40,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF8C42",
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  hudText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  mainGameArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  boardContainer: {
    backgroundColor: "transparent",
    overflow: "visible",
    position: "relative",
  },
  moduleWrapper: {
    position: "absolute",
  },
  companionPanel: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    padding: 10,
  },
  ronBontaAvatarContainer: {
    marginRight: 10,
  },
  dialogBubble: {
    flex: 1,
  },
  dialogText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  actionBtn: {
    alignItems: "center",
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  actionBtnLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.9,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  victoryCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  victoryTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E2937",
    textAlign: "center",
    marginBottom: 8,
  },
  victorySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },
  starRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  rewardCardContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    marginBottom: 24,
  },
  rewardItem: {
    alignItems: "center",
    flex: 1,
  },
  rewardAmount: {
    color: "#1F2937",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  nextLevelButton: {
    width: "100%",
  },
  eduCard: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
  },
  eduHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 16,
    gap: 8,
  },
  eduTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
  },
  eduScroll: {
    padding: 20,
  },
  eduQuestion: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    lineHeight: 20,
    marginBottom: 20,
    backgroundColor: "#F3F4F6",
    padding: 14,
    borderRadius: 12,
  },
  optionBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionBtnSuccess: {
    borderColor: "#10B981",
    backgroundColor: "rgba(16, 185, 129, 0.05)",
  },
  optionBtnError: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },
  optionText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
  },
  optionTextSuccess: {
    color: "#10B981",
  },
  optionTextError: {
    color: "#EF4444",
  },
  feedbackContainer: {
    marginTop: 10,
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  feedbackHeader: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  feedbackText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
  },
});
