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
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  cancelAnimation,
  interpolateColor,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { COLORS, SPACING, SHAPES, FONTS, SHADOWS } from "../constants/Theme";
import Button from "../components/ui/Button";

const COINS_STORAGE_KEY = "user_coins_balance";
const ROBOT_SIZE = 68;
const ROBOT_HEIGHT = 75;
const ROAD_WIDTH = 90;
const COLLISION_THRESHOLD = 58;

interface RobotObject {
  id: number;
  startX: number;
  startY: number;
  direction: "UP" | "DOWN" | "LEFT" | "RIGHT";
  turn?: "straight" | "left" | "right" | "uturn";
  status: "idle" | "moving" | "escaped" | "collided";
}

interface StaticObstacle {
  id: number;
  x: number;
  y: number;
  type: "cone" | "broken_robot";
}

interface LevelConfig {
  level: number;
  reward: number;
  robots: RobotObject[];
  staticObstacles?: StaticObstacle[];
}

// --- DECORATIVE MAP ASSETS ---
const Tree = ({ style }: { style: any }) => (
  <View style={[styles.treeContainer, style]}>
    <View style={styles.treeTrunk} />
    <View style={styles.treeLeavesBack} />
    <View style={styles.treeLeavesFront} />
  </View>
);

const Rock = ({ style }: { style: any }) => (
  <View style={[styles.rock, style]} />
);

const Flower = ({ style, color = "#F472B6" }: { style: any; color?: string }) => (
  <View style={[styles.flowerContainer, style]}>
    <View style={[styles.flowerPetal, { backgroundColor: color, top: -4 }]} />
    <View style={[styles.flowerPetal, { backgroundColor: color, left: -4 }]} />
    <View style={[styles.flowerPetal, { backgroundColor: color, right: -4 }]} />
    <View style={[styles.flowerPetal, { backgroundColor: color, bottom: -4 }]} />
    <View style={styles.flowerCenter} />
  </View>
);

const ChargingStation = ({ style }: { style: any }) => (
  <View style={[styles.chargingContainer, style]}>
    <View style={styles.chargingBase} />
    <View style={styles.chargingScreen}>
      <MaterialCommunityIcons name="lightning-bolt" size={14} color="#22D3EE" />
    </View>
    <View style={styles.chargingCable} />
  </View>
);

const ZebraCrossing = ({ horizontal, style }: { horizontal?: boolean; style: any }) => (
  <View style={[styles.zebraContainer, horizontal ? styles.zebraRow : styles.zebraColumn, style]}>
    <View style={horizontal ? styles.zebraLineH : styles.zebraLineV} />
    <View style={horizontal ? styles.zebraLineH : styles.zebraLineV} />
    <View style={horizontal ? styles.zebraLineH : styles.zebraLineV} />
    <View style={horizontal ? styles.zebraLineH : styles.zebraLineV} />
  </View>
);

// --- CUSTOM SVG ARROW TURNS ---
const TurnArrow = ({ direction, turn }: { direction: string; turn?: string }) => {
  if (!turn) return null;

  // Rotate arrow layout based on start lane heading direction
  let rot = "0deg";
  if (direction === "DOWN") rot = "180deg";
  else if (direction === "LEFT") rot = "-90deg";
  else if (direction === "RIGHT") rot = "90deg";

  return (
    <View style={{ transform: [{ rotate: rot }], width: 18, height: 18, justifyContent: "center", alignItems: "center" }}>
      <Svg width="15" height="15" viewBox="0 0 24 24">
        {turn === "straight" && (
          <Path d="M12 3l-6 6h4v12h4V9h4z" fill="#FFFFFF" />
        )}
        {turn === "left" && (
          <Path d="M5 12l5-5v3h7a3 3 0 0 1 3 3v7h-3v-7a1 1 0 0 0-1-1h-6v3z" fill="#FFFFFF" />
        )}
        {turn === "right" && (
          <Path d="M19 12l-5-5v3H7a3 3 0 0 0-3 3v7h3v-7a1 1 0 0 1 1-1h6v3z" fill="#FFFFFF" />
        )}
        {turn === "uturn" && (
          <Path d="M7 19l-4-4h3V9a6 6 0 0 1 12 0v10h-3V9a3 3 0 0 0-6 0v6h3z" fill="#FFFFFF" />
        )}
      </Svg>
    </View>
  );
};

export default function RobotEscapeScreen() {
  const router = useRouter();
  
  // Game state
  const [level, setLevel] = useState(1);
  const [robots, setRobots] = useState<RobotObject[]>([]);
  const [gameState, setGameState] = useState<"playing" | "victory" | "completed">("playing");
  const [userCoins, setUserCoins] = useState(1250);
  const [coinsReward, setCoinsReward] = useState(0);

  // Layout measurements
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  
  const centerX = useMemo(() => screenWidth / 2, [screenWidth]);
  const centerY = useMemo(() => screenHeight * 0.48, [screenHeight]);

  // Keep ref to robots state
  const robotsRef = useRef<RobotObject[]>([]);

  // --- REANIMATED SHARED VALUES (Max 6 robots supported) ---
  const robotX = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];
  
  const robotY = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  const robotShakeX = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  const robotFlashRed = [
    useSharedValue(0), // 0 is normal, 1 is flash red
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  const robotRotate = [
    useSharedValue(0), // Wobble rotation when running
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  // Dust smoke particles shared values
  const dustScale = [
    useSharedValue(0.2),
    useSharedValue(0.2),
    useSharedValue(0.2),
    useSharedValue(0.2),
    useSharedValue(0.2),
    useSharedValue(0.2),
  ];
  const dustOpacity = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  // Global shared values for idle breathing / floating loops
  const idleHover = useSharedValue(0);
  const idleScale = useSharedValue(1);

  // Determine active roads layout styling dynamically
  const getRoadLayoutType = () => {
    if (level <= 3) return "single"; // Level 1 - 3
    if (level <= 7) return "double-vertical"; // Level 4 - 7
    if (level <= 9) return "double-horizontal"; // Level 8 - 9
    return "double-both"; // Level 10
  };

  // --- GET LEVEL DATA CONFIGURATIONS (10 Levels with Turns & Deadlocks fixed) ---
  const levels: LevelConfig[] = useMemo(() => {
    return [
      {
        level: 1,
        reward: 50,
        robots: [
          {
            id: 1,
            startX: centerX - ROBOT_SIZE / 2,
            startY: centerY - 150,
            direction: "DOWN",
            turn: "straight",
            status: "idle",
          },
          {
            id: 2,
            startX: centerX + 110,
            startY: centerY - ROBOT_HEIGHT / 2,
            direction: "LEFT",
            turn: "straight",
            status: "idle",
          },
        ],
      },
      {
        level: 2,
        reward: 80,
        robots: [
          {
            id: 1,
            startX: centerX - ROBOT_SIZE / 2,
            startY: centerY - 165,
            direction: "UP",
            turn: "right",
            status: "idle",
          },
          {
            id: 2,
            startX: centerX + 110,
            startY: centerY - ROBOT_HEIGHT / 2,
            direction: "LEFT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 3,
            startX: centerX - ROBOT_SIZE / 2,
            startY: centerY + 115,
            direction: "DOWN",
            turn: "left",
            status: "idle",
          },
        ],
      },
      {
        level: 3,
        reward: 100,
        robots: [
          {
            id: 1,
            startX: centerX - ROBOT_SIZE / 2,
            startY: centerY - 95,
            direction: "UP",
            turn: "left",
            status: "idle",
          },
          {
            id: 2,
            startX: centerX + 110,
            startY: centerY - ROBOT_HEIGHT / 2,
            direction: "LEFT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 3,
            startX: centerX - ROBOT_SIZE / 2,
            startY: centerY + 40,
            direction: "UP",
            turn: "straight",
            status: "idle",
          },
        ],
        staticObstacles: [
          {
            id: 101,
            x: centerX - ROBOT_SIZE / 2,
            y: centerY + 115,
            type: "cone",
          },
        ],
      },
      {
        level: 4,
        reward: 120,
        robots: [
          {
            id: 1,
            startX: centerX - 100 - ROBOT_SIZE / 2,
            startY: centerY - 150,
            direction: "DOWN",
            turn: "left",
            status: "idle",
          },
          {
            id: 2,
            startX: centerX + 150,
            startY: centerY - ROBOT_HEIGHT / 2,
            direction: "LEFT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 3,
            startX: centerX + 100 - ROBOT_SIZE / 2,
            startY: centerY + 120,
            direction: "UP",
            turn: "right",
            status: "idle",
          },
        ],
      },
      {
        level: 5,
        reward: 150,
        robots: [
          {
            id: 1,
            startX: centerX - 100 - ROBOT_SIZE / 2,
            startY: centerY + 40,
            direction: "UP",
            turn: "left",
            status: "idle",
          },
          {
            id: 2,
            startX: centerX + 150,
            startY: centerY - ROBOT_HEIGHT / 2,
            direction: "LEFT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 3,
            startX: centerX + 100 - ROBOT_SIZE / 2,
            startY: centerY - 150,
            direction: "DOWN",
            turn: "right",
            status: "idle",
          },
        ],
        staticObstacles: [
          {
            id: 201,
            x: centerX - 100 - ROBOT_SIZE / 2,
            y: centerY + 110,
            type: "broken_robot",
          },
        ],
      },
      {
        level: 6,
        reward: 180,
        robots: [
          {
            id: 1,
            startX: centerX - 100 - ROBOT_SIZE / 2,
            startY: centerY - 150,
            direction: "UP",
            turn: "right",
            status: "idle",
          },
          {
            id: 2,
            startX: centerX - 100 - ROBOT_SIZE / 2,
            startY: centerY + 120,
            direction: "DOWN",
            turn: "left",
            status: "idle",
          },
          {
            id: 3,
            startX: centerX + 150,
            startY: centerY - ROBOT_HEIGHT / 2,
            direction: "RIGHT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 4,
            startX: centerX + 100 - ROBOT_SIZE / 2,
            startY: centerY - 150,
            direction: "DOWN",
            turn: "right",
            status: "idle",
          },
          {
            id: 5,
            startX: centerX - 150,
            startY: centerY - ROBOT_HEIGHT / 2,
            direction: "LEFT",
            turn: "straight",
            status: "idle",
          },
        ],
      },
      {
        level: 7,
        reward: 200,
        robots: [
          {
            id: 1,
            startX: centerX - 100 - ROBOT_SIZE / 2,
            startY: centerY + 40,
            direction: "UP",
            turn: "left",
            status: "idle",
          },
          {
            id: 2,
            startX: centerX + 150,
            startY: centerY - ROBOT_HEIGHT / 2,
            direction: "LEFT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 3,
            startX: centerX + 100 - ROBOT_SIZE / 2,
            startY: centerY + 45,
            direction: "DOWN",
            turn: "straight",
            status: "idle",
          },
          {
            id: 4,
            startX: centerX - 100 - ROBOT_SIZE / 2,
            startY: centerY - 150,
            direction: "UP",
            turn: "straight",
            status: "idle",
          },
        ],
        staticObstacles: [
          {
            id: 301,
            x: centerX - 100 - ROBOT_SIZE / 2,
            y: centerY + 110,
            type: "cone",
          },
          {
            id: 302,
            x: centerX + 100 - ROBOT_SIZE / 2,
            y: centerY - 150,
            type: "cone",
          },
        ],
      },
      {
        level: 8,
        reward: 220,
        robots: [
          {
            id: 1,
            startX: centerX - ROBOT_SIZE / 2,
            startY: centerY - 170,
            direction: "UP",
            turn: "right",
            status: "idle",
          },
          {
            id: 2,
            startX: centerX + 140,
            startY: centerY - 80 - ROBOT_HEIGHT / 2,
            direction: "RIGHT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 3,
            startX: centerX - 140,
            startY: centerY + 80 - ROBOT_HEIGHT / 2,
            direction: "LEFT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 4,
            startX: centerX - ROBOT_SIZE / 2,
            startY: centerY + 150,
            direction: "DOWN",
            turn: "left",
            status: "idle",
          },
        ],
      },
      {
        level: 9,
        reward: 250,
        robots: [
          {
            id: 1,
            startX: centerX - ROBOT_SIZE / 2,
            startY: centerY - 160,
            direction: "UP",
            turn: "left",
            status: "idle",
          },
          {
            id: 2,
            startX: centerX + 140,
            startY: centerY - 80 - ROBOT_HEIGHT / 2,
            direction: "LEFT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 3,
            startX: centerX - ROBOT_SIZE / 2,
            startY: centerY + 155,
            direction: "DOWN",
            turn: "straight",
            status: "idle",
          },
          {
            id: 4,
            startX: centerX - 60,
            startY: centerY + 80 - ROBOT_HEIGHT / 2,
            direction: "RIGHT",
            turn: "straight",
            status: "idle",
          },
        ],
        staticObstacles: [
          {
            id: 401,
            x: centerX - 140,
            y: centerY + 80 - ROBOT_HEIGHT / 2,
            type: "broken_robot",
          },
        ],
      },
      {
        level: 10,
        reward: 300,
        robots: [
          {
            id: 1,
            startX: centerX - 100 - ROBOT_SIZE / 2,
            startY: centerY + 130,
            direction: "UP",
            turn: "straight",
            status: "idle",
          },
          {
            id: 2,
            startX: centerX + 140,
            startY: centerY - 80 - ROBOT_HEIGHT / 2,
            direction: "LEFT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 3,
            startX: centerX + 100 - ROBOT_SIZE / 2,
            startY: centerY - 160,
            direction: "DOWN",
            turn: "straight",
            status: "idle",
          },
          {
            id: 4,
            startX: centerX - 140,
            startY: centerY + 80 - ROBOT_HEIGHT / 2,
            direction: "RIGHT",
            turn: "straight",
            status: "idle",
          },
          {
            id: 5,
            startX: centerX - 100 - ROBOT_SIZE / 2,
            startY: centerY - 160,
            direction: "UP",
            turn: "right",
            status: "idle",
          },
        ],
        staticObstacles: [
          {
            id: 501,
            x: centerX - ROBOT_SIZE / 2,
            y: centerY + 80 - ROBOT_HEIGHT / 2,
            type: "cone",
          },
        ],
      },
    ];
  }, [centerX, centerY]);

  // --- STATIC REANIMATED HOOK STYLE CALLS ---
  const animatedStyle0 = useAnimatedStyle(() => {
    const isMoving = robots[0]?.status === "moving";
    const translateYOffset = isMoving ? 0 : idleHover.value;
    const scaleVal = isMoving ? 1 : idleScale.value;
    const rotVal = isMoving ? robotRotate[0].value : 0;

    const bodyColor = interpolateColor(robotFlashRed[0].value, [0, 1], ["#FFFFFF", "#FEE2E2"]);
    const borderColor = interpolateColor(robotFlashRed[0].value, [0, 1], ["#0284C7", "#EF4444"]);
    return {
      transform: [
        { translateX: robotX[0].value + robotShakeX[0].value },
        { translateY: robotY[0].value + translateYOffset },
        { scale: scaleVal },
        { rotate: `${rotVal}deg` },
      ],
      backgroundColor: bodyColor,
      borderColor: borderColor,
    };
  });

  const animatedStyle1 = useAnimatedStyle(() => {
    const isMoving = robots[1]?.status === "moving";
    const translateYOffset = isMoving ? 0 : idleHover.value;
    const scaleVal = isMoving ? 1 : idleScale.value;
    const rotVal = isMoving ? robotRotate[1].value : 0;

    const bodyColor = interpolateColor(robotFlashRed[1].value, [0, 1], ["#FFFFFF", "#FEE2E2"]);
    const borderColor = interpolateColor(robotFlashRed[1].value, [0, 1], ["#0284C7", "#EF4444"]);
    return {
      transform: [
        { translateX: robotX[1].value + robotShakeX[1].value },
        { translateY: robotY[1].value + translateYOffset },
        { scale: scaleVal },
        { rotate: `${rotVal}deg` },
      ],
      backgroundColor: bodyColor,
      borderColor: borderColor,
    };
  });

  const animatedStyle2 = useAnimatedStyle(() => {
    const isMoving = robots[2]?.status === "moving";
    const translateYOffset = isMoving ? 0 : idleHover.value;
    const scaleVal = isMoving ? 1 : idleScale.value;
    const rotVal = isMoving ? robotRotate[2].value : 0;

    const bodyColor = interpolateColor(robotFlashRed[2].value, [0, 1], ["#FFFFFF", "#FEE2E2"]);
    const borderColor = interpolateColor(robotFlashRed[2].value, [0, 1], ["#0284C7", "#EF4444"]);
    return {
      transform: [
        { translateX: robotX[2].value + robotShakeX[2].value },
        { translateY: robotY[2].value + translateYOffset },
        { scale: scaleVal },
        { rotate: `${rotVal}deg` },
      ],
      backgroundColor: bodyColor,
      borderColor: borderColor,
    };
  });

  const animatedStyle3 = useAnimatedStyle(() => {
    const isMoving = robots[3]?.status === "moving";
    const translateYOffset = isMoving ? 0 : idleHover.value;
    const scaleVal = isMoving ? 1 : idleScale.value;
    const rotVal = isMoving ? robotRotate[3].value : 0;

    const bodyColor = interpolateColor(robotFlashRed[3].value, [0, 1], ["#FFFFFF", "#FEE2E2"]);
    const borderColor = interpolateColor(robotFlashRed[3].value, [0, 1], ["#0284C7", "#EF4444"]);
    return {
      transform: [
        { translateX: robotX[3].value + robotShakeX[3].value },
        { translateY: robotY[3].value + translateYOffset },
        { scale: scaleVal },
        { rotate: `${rotVal}deg` },
      ],
      backgroundColor: bodyColor,
      borderColor: borderColor,
    };
  });

  const animatedStyle4 = useAnimatedStyle(() => {
    const isMoving = robots[4]?.status === "moving";
    const translateYOffset = isMoving ? 0 : idleHover.value;
    const scaleVal = isMoving ? 1 : idleScale.value;
    const rotVal = isMoving ? robotRotate[4].value : 0;

    const bodyColor = interpolateColor(robotFlashRed[4].value, [0, 1], ["#FFFFFF", "#FEE2E2"]);
    const borderColor = interpolateColor(robotFlashRed[4].value, [0, 1], ["#0284C7", "#EF4444"]);
    return {
      transform: [
        { translateX: robotX[4].value + robotShakeX[4].value },
        { translateY: robotY[4].value + translateYOffset },
        { scale: scaleVal },
        { rotate: `${rotVal}deg` },
      ],
      backgroundColor: bodyColor,
      borderColor: borderColor,
    };
  });

  const animatedStyle5 = useAnimatedStyle(() => {
    const isMoving = robots[5]?.status === "moving";
    const translateYOffset = isMoving ? 0 : idleHover.value;
    const scaleVal = isMoving ? 1 : idleScale.value;
    const rotVal = isMoving ? robotRotate[5].value : 0;

    const bodyColor = interpolateColor(robotFlashRed[5].value, [0, 1], ["#FFFFFF", "#FEE2E2"]);
    const borderColor = interpolateColor(robotFlashRed[5].value, [0, 1], ["#0284C7", "#EF4444"]);
    return {
      transform: [
        { translateX: robotX[5].value + robotShakeX[5].value },
        { translateY: robotY[5].value + translateYOffset },
        { scale: scaleVal },
        { rotate: `${rotVal}deg` },
      ],
      backgroundColor: bodyColor,
      borderColor: borderColor,
    };
  });

  const animatedStyles = [
    animatedStyle0,
    animatedStyle1,
    animatedStyle2,
    animatedStyle3,
    animatedStyle4,
    animatedStyle5,
  ];

  // Static Dust Particle Styles
  const dustStyle0 = useAnimatedStyle(() => ({
    transform: [{ scale: dustScale[0].value }],
    opacity: dustOpacity[0].value,
  }));
  const dustStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: dustScale[1].value }],
    opacity: dustOpacity[1].value,
  }));
  const dustStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: dustScale[2].value }],
    opacity: dustOpacity[2].value,
  }));
  const dustStyle3 = useAnimatedStyle(() => ({
    transform: [{ scale: dustScale[3].value }],
    opacity: dustOpacity[3].value,
  }));
  const dustStyle4 = useAnimatedStyle(() => ({
    transform: [{ scale: dustScale[4].value }],
    opacity: dustOpacity[4].value,
  }));
  const dustStyle5 = useAnimatedStyle(() => ({
    transform: [{ scale: dustScale[5].value }],
    opacity: dustOpacity[5].value,
  }));

  const dustStyles = [
    dustStyle0,
    dustStyle1,
    dustStyle2,
    dustStyle3,
    dustStyle4,
    dustStyle5,
  ];

  // Sound/Haptic feedback helper
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

  // Load Coins on start
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const storedCoins = await AsyncStorage.getItem(COINS_STORAGE_KEY);
        if (storedCoins !== null) {
          setUserCoins(parseInt(storedCoins));
        }
        const storedLevel = await AsyncStorage.getItem("robot_escape_current_level");
        if (storedLevel !== null) {
          setLevel(parseInt(storedLevel));
        }
      } catch (_e) {
        console.error("Failed to load game data", _e);
      }
    };
    loadGameData();
  }, []);

  // Initialize global idle breathing loops on mount
  useEffect(() => {
    idleHover.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1100 }),
        withTiming(3, { duration: 1100 })
      ),
      -1,
      true
    );

    idleScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1300 }),
        withTiming(0.96, { duration: 1300 })
      ),
      -1,
      true
    );
  }, [idleHover, idleScale]);

  // Initialize level
  const initLevel = (levelIndex: number) => {
    const targetLevel = levels.find((l) => l.level === levelIndex);
    if (!targetLevel) return;

    const initialRobots = targetLevel.robots.map((r) => ({ ...r, status: "idle" as const }));
    setRobots(initialRobots);
    robotsRef.current = initialRobots;
    setGameState("playing");

    // Initialize Shared values for each robot
    initialRobots.forEach((r, index) => {
      cancelAnimation(robotX[index]);
      cancelAnimation(robotY[index]);
      robotX[index].value = r.startX;
      robotY[index].value = r.startY;
      robotShakeX[index].value = 0;
      robotFlashRed[index].value = 0;
      dustScale[index].value = 0.2;
      dustOpacity[index].value = 0;
      cancelAnimation(robotRotate[index]);
      robotRotate[index].value = 0;
    });
  };

  // Initialize Level on mount/update
  useEffect(() => {
    initLevel(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // --- DETERMINISTIC GEOMETRIC COLLISION RESOLVER & MULTI-STAGE MOVEMENT ---
  const handleEscape = (i: number) => {
    cancelAnimation(robotX[i]);
    cancelAnimation(robotY[i]);
    cancelAnimation(robotRotate[i]);
    robotRotate[i].value = 0;

    const updated = [...robotsRef.current];
    updated[i].status = "escaped";
    setRobots(updated);
    robotsRef.current = updated;

    triggerHaptic("light");

    const allEscaped = updated.every((r) => r.status === "escaped");
    if (allEscaped) {
      handleLevelWin();
    }
  };

  const handleLevelWin = () => {
    triggerHaptic("success");
    const currentReward = levels.find((l) => l.level === level)?.reward || 50;
    setCoinsReward(currentReward);

    if (level < levels.length) {
      setGameState("victory");
    } else {
      setGameState("completed");
    }
  };

  const handleNextLevel = async () => {
    triggerHaptic("light");
    const nextLvl = level + 1;
    const finalBalance = userCoins + coinsReward;
    
    try {
      await AsyncStorage.setItem(COINS_STORAGE_KEY, finalBalance.toString());
      await AsyncStorage.setItem("robot_escape_current_level", nextLvl.toString());
      setUserCoins(finalBalance);
      setLevel(nextLvl);
    } catch (e) {
      console.error("Failed to save reward coins", e);
      setLevel(nextLvl);
    }
  };

  const handleClaimAndExit = async () => {
    triggerHaptic("success");
    const finalBalance = userCoins + coinsReward;
    
    try {
      await AsyncStorage.setItem(COINS_STORAGE_KEY, finalBalance.toString());
      await AsyncStorage.setItem("robot_escape_current_level", "10"); // locked at Level 10 max
      router.back();
    } catch (e) {
      console.error("Failed to save reward coins", e);
      router.back();
    }
  };

  const handleResetLevelProgress = async () => {
    triggerHaptic("success");
    try {
      await AsyncStorage.setItem("robot_escape_current_level", "1");
      setLevel(1);
    } catch (e) {
      console.error("Failed to reset level progress", e);
    }
  };

  const updatedRobotStatus = (index: number, status: RobotObject["status"]) => {
    const updated = [...robotsRef.current];
    updated[index].status = status;
    setRobots(updated);
    robotsRef.current = updated;
  };

  // Helper: Get intersection center coordinate based on start lane
  const getIntersectionPoint = (r: RobotObject) => {
    const layout = getRoadLayoutType();
    const rx = r.startX;
    const ry = r.startY;
    const dir = r.direction;

    let ix = centerX;
    let iy = centerY;

    if (layout === "single") {
      ix = centerX - ROBOT_SIZE / 2;
      iy = centerY - ROBOT_HEIGHT / 2;
    } else if (layout === "double-vertical") {
      iy = centerY - ROBOT_HEIGHT / 2;
      if (dir === "UP" || dir === "DOWN") {
        ix = rx < centerX ? centerX - 100 - ROBOT_SIZE / 2 : centerX + 100 - ROBOT_SIZE / 2;
      } else {
        ix = dir === "LEFT" ? centerX + 100 - ROBOT_SIZE / 2 : centerX - 100 - ROBOT_SIZE / 2;
      }
    } else if (layout === "double-horizontal") {
      ix = centerX - ROBOT_SIZE / 2;
      if (dir === "LEFT" || dir === "RIGHT") {
        iy = ry < centerY ? centerY - 80 - ROBOT_HEIGHT / 2 : centerY + 80 - ROBOT_HEIGHT / 2;
      } else {
        iy = dir === "DOWN" ? centerY - 80 - ROBOT_HEIGHT / 2 : centerY + 80 - ROBOT_HEIGHT / 2;
      }
    } else if (layout === "double-both") {
      if (dir === "UP" || dir === "DOWN") {
        ix = rx < centerX ? centerX - 100 - ROBOT_SIZE / 2 : centerX + 100 - ROBOT_SIZE / 2;
        iy = dir === "DOWN" ? centerY - 80 - ROBOT_HEIGHT / 2 : centerY + 80 - ROBOT_HEIGHT / 2;
      } else {
        ix = dir === "LEFT" ? centerX + 100 - ROBOT_SIZE / 2 : centerX - 100 - ROBOT_SIZE / 2;
        iy = ry < centerY ? centerY - 80 - ROBOT_HEIGHT / 2 : centerY + 80 - ROBOT_HEIGHT / 2;
      }
    }

    return { ix, iy };
  };

  // Helper: get direction of motion after turning
  const getTurnedDirection = (dir: string, turn?: string) => {
    if (!turn || turn === "straight") return dir;

    if (dir === "UP") {
      if (turn === "left") return "LEFT";
      if (turn === "right") return "RIGHT";
      if (turn === "uturn") return "DOWN";
    } else if (dir === "DOWN") {
      if (turn === "left") return "RIGHT";
      if (turn === "right") return "LEFT";
      if (turn === "uturn") return "UP";
    } else if (dir === "LEFT") {
      if (turn === "left") return "DOWN";
      if (turn === "right") return "UP";
      if (turn === "uturn") return "RIGHT";
    } else if (dir === "RIGHT") {
      if (turn === "left") return "UP";
      if (turn === "right") return "DOWN";
      if (turn === "uturn") return "LEFT";
    }
    return dir;
  };

  // Trigger robot layout direction text update
  const handleUpdateDirection = (index: number, nextDir: RobotObject["direction"]) => {
    const updated = [...robotsRef.current];
    updated[index].direction = nextDir;
    setRobots(updated);
    robotsRef.current = updated;
  };

  const handleTapRobot = (index: number) => {
    const currentRobots = [...robotsRef.current];
    if (currentRobots[index].status !== "idle") return;

    const r = currentRobots[index];
    const ax = r.startX;
    const ay = r.startY;
    const dir = r.direction;
    const turn = r.turn || "straight";

    const { ix: intX, iy: intY } = getIntersectionPoint(r);
    const nextDir = getTurnedDirection(dir, turn);

    const currentLevelData = levels.find((l) => l.level === level);
    const obstacles = currentLevelData?.staticObstacles || [];

    // --- COLLISION BLOCK DETECTOR ---
    let blockerSegment1: { x: number; y: number; type: "robot" | "obstacle"; index?: number } | null = null;
    let blockerSegment2: { x: number; y: number; type: "robot" | "obstacle"; index?: number } | null = null;

    let closestDistS1 = Infinity;
    let closestDistS2 = Infinity;

    currentRobots.forEach((B, j) => {
      if (j === index || B.status === "escaped") return;
      const bx = robotX[j].value;
      const by = robotY[j].value;

      // 1. Check blocker on Segment 1 (initial road towards intersection)
      if (dir === "UP") {
        if (Math.abs(bx - ax) < COLLISION_THRESHOLD && by < ay && by >= intY) {
          const dist = ay - by;
          if (dist < closestDistS1) {
            closestDistS1 = dist;
            blockerSegment1 = { x: bx, y: by, type: "robot", index: j };
          }
        }
      } else if (dir === "DOWN") {
        if (Math.abs(bx - ax) < COLLISION_THRESHOLD && by > ay && by <= intY) {
          const dist = by - ay;
          if (dist < closestDistS1) {
            closestDistS1 = dist;
            blockerSegment1 = { x: bx, y: by, type: "robot", index: j };
          }
        }
      } else if (dir === "LEFT") {
        if (Math.abs(by - ay) < COLLISION_THRESHOLD && bx < ax && bx >= intX) {
          const dist = ax - bx;
          if (dist < closestDistS1) {
            closestDistS1 = dist;
            blockerSegment1 = { x: bx, y: by, type: "robot", index: j };
          }
        }
      } else if (dir === "RIGHT") {
        if (Math.abs(by - ay) < COLLISION_THRESHOLD && bx > ax && bx <= intX) {
          const dist = bx - ax;
          if (dist < closestDistS1) {
            closestDistS1 = dist;
            blockerSegment1 = { x: bx, y: by, type: "robot", index: j };
          }
        }
      }

      // 2. Check blocker on Segment 2 (after the intersection turn)
      if (nextDir === "UP") {
        if (Math.abs(bx - intX) < COLLISION_THRESHOLD && by < intY) {
          const dist = intY - by;
          if (dist < closestDistS2) {
            closestDistS2 = dist;
            blockerSegment2 = { x: bx, y: by, type: "robot", index: j };
          }
        }
      } else if (nextDir === "DOWN") {
        if (Math.abs(bx - intX) < COLLISION_THRESHOLD && by > intY) {
          const dist = by - intY;
          if (dist < closestDistS2) {
            closestDistS2 = dist;
            blockerSegment2 = { x: bx, y: by, type: "robot", index: j };
          }
        }
      } else if (nextDir === "LEFT") {
        if (Math.abs(by - intY) < COLLISION_THRESHOLD && bx < intX) {
          const dist = intX - bx;
          if (dist < closestDistS2) {
            closestDistS2 = dist;
            blockerSegment2 = { x: bx, y: by, type: "robot", index: j };
          }
        }
      } else if (nextDir === "RIGHT") {
        if (Math.abs(by - intY) < COLLISION_THRESHOLD && bx > intX) {
          const dist = bx - intX;
          if (dist < closestDistS2) {
            closestDistS2 = dist;
            blockerSegment2 = { x: bx, y: by, type: "robot", index: j };
          }
        }
      }
    });

    // Check static obstacles blocker
    obstacles.forEach((obs) => {
      const bx = obs.x;
      const by = obs.y;

      if (dir === "UP") {
        if (Math.abs(bx - ax) < COLLISION_THRESHOLD && by < ay && by >= intY) {
          const dist = ay - by;
          if (dist < closestDistS1) {
            closestDistS1 = dist;
            blockerSegment1 = { x: bx, y: by, type: "obstacle" };
          }
        }
      } else if (dir === "DOWN") {
        if (Math.abs(bx - ax) < COLLISION_THRESHOLD && by > ay && by <= intY) {
          const dist = by - ay;
          if (dist < closestDistS1) {
            closestDistS1 = dist;
            blockerSegment1 = { x: bx, y: by, type: "obstacle" };
          }
        }
      } else if (dir === "LEFT") {
        if (Math.abs(by - ay) < COLLISION_THRESHOLD && bx < ax && bx >= intX) {
          const dist = ax - bx;
          if (dist < closestDistS1) {
            closestDistS1 = dist;
            blockerSegment1 = { x: bx, y: by, type: "obstacle" };
          }
        }
      } else if (dir === "RIGHT") {
        if (Math.abs(by - ay) < COLLISION_THRESHOLD && bx > ax && bx <= intX) {
          const dist = bx - ax;
          if (dist < closestDistS1) {
            closestDistS1 = dist;
            blockerSegment1 = { x: bx, y: by, type: "obstacle" };
          }
        }
      }

      if (nextDir === "UP") {
        if (Math.abs(bx - intX) < COLLISION_THRESHOLD && by < intY) {
          const dist = intY - by;
          if (dist < closestDistS2) {
            closestDistS2 = dist;
            blockerSegment2 = { x: bx, y: by, type: "obstacle" };
          }
        }
      } else if (nextDir === "DOWN") {
        if (Math.abs(bx - intX) < COLLISION_THRESHOLD && by > intY) {
          const dist = by - intY;
          if (dist < closestDistS2) {
            closestDistS2 = dist;
            blockerSegment2 = { x: bx, y: by, type: "obstacle" };
          }
        }
      } else if (nextDir === "LEFT") {
        if (Math.abs(by - intY) < COLLISION_THRESHOLD && bx < intX) {
          const dist = intX - bx;
          if (dist < closestDistS2) {
            closestDistS2 = dist;
            blockerSegment2 = { x: bx, y: by, type: "obstacle" };
          }
        }
      } else if (nextDir === "RIGHT") {
        if (Math.abs(by - intY) < COLLISION_THRESHOLD && bx > intX) {
          const dist = bx - intX;
          if (dist < closestDistS2) {
            closestDistS2 = dist;
            blockerSegment2 = { x: bx, y: by, type: "obstacle" };
          }
        }
      }
    });

    triggerHaptic("light");

    // Start run wobble
    robotRotate[index].value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 80 }),
        withTiming(6, { duration: 80 })
      ),
      -1,
      true
    );

    // Trigger launch smoke
    dustScale[index].value = 0.2;
    dustOpacity[index].value = 0.85;
    dustScale[index].value = withTiming(1.5, { duration: 400 });
    dustOpacity[index].value = withTiming(0, { duration: 400 });

    const triggerDoubleCrashFeedback = (blocker: any) => {
      if (blocker && blocker.type === "robot" && blocker.index !== undefined) {
        const blockerIdx = blocker.index;
        updatedRobotStatus(blockerIdx, "collided");

        robotFlashRed[blockerIdx].value = withSequence(
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 100 }),
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 100 })
        );
        robotShakeX[blockerIdx].value = withSequence(
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );

        // Snap blocker robot back to start positions
        setTimeout(() => {
          const bRobot = currentRobots[blockerIdx];
          robotX[blockerIdx].value = withSpring(bRobot.startX, { damping: 9, stiffness: 90 });
          robotY[blockerIdx].value = withSpring(bRobot.startY, { damping: 9, stiffness: 90 });
          setTimeout(() => {
            updatedRobotStatus(blockerIdx, "idle");
          }, 500);
        }, 600);
      }
    };

    const triggerSelfCrashVisuals = (onFinish: () => void) => {
      cancelAnimation(robotRotate[index]);
      robotRotate[index].value = 0;
      updatedRobotStatus(index, "collided");
      triggerHaptic("error");

      robotFlashRed[index].value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 100 }),
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
      robotShakeX[index].value = withSequence(
        withTiming(-12, { duration: 50 }),
        withTiming(12, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );

      setTimeout(onFinish, 600);
    };

    if (blockerSegment1) {
      // --- CRASH ON SEGMENT 1 (Before reaching intersection) ---
      updatedRobotStatus(index, "moving");

      let targetX = ax;
      let targetY = ay;
      if (dir === "UP") targetY = blockerSegment1.y + COLLISION_THRESHOLD - 5;
      else if (dir === "DOWN") targetY = blockerSegment1.y - COLLISION_THRESHOLD + 5;
      else if (dir === "LEFT") targetX = blockerSegment1.x + COLLISION_THRESHOLD - 5;
      else if (dir === "RIGHT") targetX = blockerSegment1.x - COLLISION_THRESHOLD + 5;

      const crashS1Done = () => {
        triggerDoubleCrashFeedback(blockerSegment1);
        triggerSelfCrashVisuals(() => {
          robotX[index].value = withSpring(r.startX, { damping: 9, stiffness: 90 });
          robotY[index].value = withSpring(r.startY, { damping: 9, stiffness: 90 });
          setTimeout(() => {
            updatedRobotStatus(index, "idle");
          }, 500);
        });
      };

      if (dir === "UP" || dir === "DOWN") {
        robotY[index].value = withTiming(targetY, { duration: 250, easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(crashS1Done)();
        });
      } else {
        robotX[index].value = withTiming(targetX, { duration: 250, easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(crashS1Done)();
        });
      }

    } else if (blockerSegment2) {
      // --- CRASH ON SEGMENT 2 (After reaching intersection & turning) ---
      updatedRobotStatus(index, "moving");

      let targetX = intX;
      let targetY = intY;
      if (nextDir === "UP") targetY = blockerSegment2.y + COLLISION_THRESHOLD - 5;
      else if (nextDir === "DOWN") targetY = blockerSegment2.y - COLLISION_THRESHOLD + 5;
      else if (nextDir === "LEFT") targetX = blockerSegment2.x + COLLISION_THRESHOLD - 5;
      else if (nextDir === "RIGHT") targetX = blockerSegment2.x - COLLISION_THRESHOLD + 5;

      const runStage2Crash = () => {
        runOnJS(handleUpdateDirection)(index, nextDir);

        const crashS2Done = () => {
          triggerDoubleCrashFeedback(blockerSegment2);
          triggerSelfCrashVisuals(() => {
            // Animate backward through turn
            if (nextDir === "UP" || nextDir === "DOWN") {
              robotY[index].value = withTiming(intY, { duration: 250, easing: Easing.linear }, (fin) => {
                if (fin) {
                  runOnJS(handleUpdateDirection)(index, dir);
                  robotX[index].value = withSpring(r.startX, { damping: 9, stiffness: 90 });
                  robotY[index].value = withSpring(r.startY, { damping: 9, stiffness: 90 });
                  setTimeout(() => {
                    runOnJS(updatedRobotStatus)(index, "idle");
                  }, 500);
                }
              });
            } else {
              robotX[index].value = withTiming(intX, { duration: 250, easing: Easing.linear }, (fin) => {
                if (fin) {
                  runOnJS(handleUpdateDirection)(index, dir);
                  robotX[index].value = withSpring(r.startX, { damping: 9, stiffness: 90 });
                  robotY[index].value = withSpring(r.startY, { damping: 9, stiffness: 90 });
                  setTimeout(() => {
                    runOnJS(updatedRobotStatus)(index, "idle");
                  }, 500);
                }
              });
            }
          });
        };

        if (nextDir === "UP" || nextDir === "DOWN") {
          robotY[index].value = withTiming(targetY, { duration: 250, easing: Easing.linear }, (finished) => {
            if (finished) runOnJS(crashS2Done)();
          });
        } else {
          robotX[index].value = withTiming(targetX, { duration: 250, easing: Easing.linear }, (finished) => {
            if (finished) runOnJS(crashS2Done)();
          });
        }
      };

      if (dir === "UP" || dir === "DOWN") {
        robotY[index].value = withTiming(intY, { duration: 300, easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(runStage2Crash)();
        });
      } else {
        robotX[index].value = withTiming(intX, { duration: 300, easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(runStage2Crash)();
        });
      }

    } else {
      // --- ESCAPE PATHWAY (Stage 1 to intersection, turn, Stage 2 to exit) ---
      updatedRobotStatus(index, "moving");

      let exitX = intX;
      let exitY = intY;
      if (nextDir === "DOWN") exitY = screenHeight + 150;
      else if (nextDir === "UP") exitY = -150;
      else if (nextDir === "LEFT") exitX = -150;
      else if (nextDir === "RIGHT") exitX = screenWidth + 150;

      const runStage2Escape = () => {
        runOnJS(handleUpdateDirection)(index, nextDir);

        const escapeDone = () => {
          cancelAnimation(robotRotate[index]);
          robotRotate[index].value = 0;
          runOnJS(handleEscape)(index);
        };

        if (nextDir === "UP" || nextDir === "DOWN") {
          robotY[index].value = withTiming(exitY, { duration: 400, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }, (finished) => {
            if (finished) runOnJS(escapeDone)();
          });
        } else {
          robotX[index].value = withTiming(exitX, { duration: 400, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }, (finished) => {
            if (finished) runOnJS(escapeDone)();
          });
        }
      };

      if (dir === "UP" || dir === "DOWN") {
        robotY[index].value = withTiming(intY, { duration: 350, easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(runStage2Escape)();
        });
      } else {
        robotX[index].value = withTiming(intX, { duration: 350, easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(runStage2Escape)();
        });
      }
    }
  };

  // Robot directional sasis visual rendering switch
  const renderRobotVisuals = (direction: "UP" | "DOWN" | "LEFT" | "RIGHT", status: string) => {
    const isMoving = status === "moving";
    
    if (direction === "DOWN") {
      // FRONT VIEW
      return (
        <View style={styles.frontRobot}>
          {/* Antenna */}
          <View style={styles.antennaStick} />
          <View style={styles.antennaBulb} />
          {/* Head */}
          <View style={styles.robotHead}>
            <View style={styles.visorScreen}>
              <View style={styles.eyesRow}>
                <View style={styles.eyeCircle}>
                  <View style={styles.pupil} />
                </View>
                <View style={styles.eyeCircle}>
                  <View style={styles.pupil} />
                </View>
              </View>
            </View>
          </View>
          {/* Neck */}
          <View style={styles.neckJoint} />
          {/* Torso */}
          <View style={styles.robotTorso}>
            <View style={styles.chestCore} />
          </View>
          {/* Base tracks */}
          <View style={styles.tracksBase}>
            <View style={styles.treadDot} />
            <View style={styles.treadDot} />
          </View>
          {/* Drop Glow Shadow */}
          {!isMoving && <View style={styles.hoverGlowShadow} />}
        </View>
      );
    } else if (direction === "UP") {
      // BACK VIEW
      return (
        <View style={styles.backRobot}>
          {/* Antenna Back */}
          <View style={styles.antennaStick} />
          <View style={[styles.antennaBulb, { backgroundColor: "#D97706" }]} />
          {/* Head Back */}
          <View style={styles.robotHeadBack}>
            <View style={styles.coolingVent} />
            <View style={styles.coolingVent} />
          </View>
          {/* Neck */}
          <View style={styles.neckJoint} />
          {/* Torso Back */}
          <View style={styles.robotTorsoBack}>
            <View style={styles.backPlateGrid} />
          </View>
          {/* Base tracks */}
          <View style={styles.tracksBase}>
            <View style={styles.treadDot} />
            <View style={styles.treadDot} />
          </View>
          {!isMoving && <View style={styles.hoverGlowShadow} />}
        </View>
      );
    } else {
      // SIDE PROFILE VIEW (LEFT/RIGHT)
      const isLeft = direction === "LEFT";
      return (
        <View style={[styles.sideRobot, isLeft && { transform: [{ scaleX: -1 }] }]}>
          {/* Antenna Side */}
          <View style={[styles.antennaStick, { marginLeft: -6 }]} />
          <View style={[styles.antennaBulb, { marginLeft: -11, backgroundColor: "#E11D48" }]} />
          {/* Head Side */}
          <View style={styles.robotHeadSide}>
            <View style={styles.sideVisor}>
              <View style={styles.sideEyeLed} />
            </View>
          </View>
          {/* Neck */}
          <View style={[styles.neckJoint, { width: 12 }]} />
          {/* Torso Side */}
          <View style={styles.robotTorsoSide}>
            <View style={styles.sideShoulderJoint} />
          </View>
          {/* Side base tracks */}
          <View style={styles.sideTracks}>
            <View style={styles.treadDot} />
            <View style={styles.treadDot} />
          </View>
          {!isMoving && <View style={styles.hoverGlowShadow} />}
        </View>
      );
    }
  };

  const roadLayout = getRoadLayoutType();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#A3E635" />

      {/* HEADER SECTION (Nyawa, Level, Koin) */}
      <View style={styles.header}>
        {/* Nyawa Hearts */}
        <View style={styles.heartsRow}>
          <Ionicons name="heart" size={22} color="#EF4444" />
          <Ionicons name="heart" size={22} color="#EF4444" />
          <Ionicons name="heart" size={22} color="#EF4444" />
        </View>

        {/* Level Badges & Reset Progress Button */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Level {level}</Text>
          </View>
          <Pressable
            onPress={handleResetLevelProgress}
            style={({ pressed }) => [
              styles.resetBtn,
              pressed && { opacity: 0.7 }
            ]}
          >
            <Ionicons name="reload" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Coins HUD */}
        <View style={styles.coinsHeaderBadge}>
          <MaterialCommunityIcons name="coin" size={18} color="#F59E0B" />
          <Text style={styles.coinsHeaderVal}>{userCoins}</Text>
        </View>
      </View>

      {/* GAMEPLAY SCENE */}
      <View style={styles.gameplayArea}>
        {/* Scenery details to fill map background */}
        <Tree style={{ left: 30, top: 25 }} />
        <Tree style={{ right: 25, top: 125 }} />
        <Rock style={{ right: 85, top: 165 }} />
        <Flower style={{ left: 80, top: 90 }} color="#EC4899" />
        <Flower style={{ left: 35, top: 145 }} color="#FBBF24" />
        
        <ChargingStation style={{ left: 25, bottom: 130 }} />
        <Tree style={{ right: 30, bottom: 135 }} />
        <Rock style={{ left: 100, bottom: 110 }} />
        <Flower style={{ right: 100, bottom: 115 }} color="#3B82F6" />
        <Flower style={{ right: 90, bottom: 200 }} color="#EC4899" />

        {/* DYNAMIC ROAD DRAWING ENGINE */}
        {roadLayout === "single" && (
          // Single Intersection (Level 1 - 3)
          <>
            <View style={[styles.verticalRoad, { left: centerX - 45 }]} />
            <View style={[styles.horizontalRoad, { top: centerY - 45 }]} />
            <View style={[styles.intersectionCore, { left: centerX - 45, top: centerY - 45 }]} />
            <View style={[styles.verticalRoadDivider, { left: centerX }]} />
            <View style={[styles.horizontalRoadDivider, { top: centerY }]} />
            
            {/* Zebra crossings */}
            <ZebraCrossing style={{ left: centerX - 45, top: centerY - 75 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 45, top: centerY + 58 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 75, top: centerY - 45 }} />
            <ZebraCrossing style={{ left: centerX + 58, top: centerY - 45 }} />
          </>
        )}

        {roadLayout === "double-vertical" && (
          // 2 Vertical Roads, 1 Horizontal Road (Level 4 - 7)
          <>
            <View style={[styles.verticalRoad, { left: centerX - 100 - 45 }]} />
            <View style={[styles.verticalRoad, { left: centerX + 100 - 45 }]} />
            <View style={[styles.horizontalRoad, { top: centerY - 45 }]} />
            
            <View style={[styles.intersectionCore, { left: centerX - 100 - 45, top: centerY - 45 }]} />
            <View style={[styles.intersectionCore, { left: centerX + 100 - 45, top: centerY - 45 }]} />
            
            <View style={[styles.verticalRoadDivider, { left: centerX - 100 }]} />
            <View style={[styles.verticalRoadDivider, { left: centerX + 100 }]} />
            <View style={[styles.horizontalRoadDivider, { top: centerY }]} />

            {/* Zebra crossings */}
            <ZebraCrossing style={{ left: centerX - 100 - 45, top: centerY - 75 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 100 - 45, top: centerY + 58 }} horizontal />
            <ZebraCrossing style={{ left: centerX + 100 - 45, top: centerY - 75 }} horizontal />
            <ZebraCrossing style={{ left: centerX + 100 - 45, top: centerY + 58 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 165, top: centerY - 45 }} />
            <ZebraCrossing style={{ left: centerX + 148, top: centerY - 45 }} />
          </>
        )}

        {roadLayout === "double-horizontal" && (
          // 1 Vertical Road, 2 Horizontal Roads (Level 8 - 9)
          <>
            <View style={[styles.verticalRoad, { left: centerX - 45 }]} />
            <View style={[styles.horizontalRoad, { top: centerY - 80 - 45 }]} />
            <View style={[styles.horizontalRoad, { top: centerY + 80 - 45 }]} />
            
            <View style={[styles.intersectionCore, { left: centerX - 45, top: centerY - 80 - 45 }]} />
            <View style={[styles.intersectionCore, { left: centerX - 45, top: centerY + 80 - 45 }]} />
            
            <View style={[styles.verticalRoadDivider, { left: centerX }]} />
            <View style={[styles.horizontalRoadDivider, { top: centerY - 80 }]} />
            <View style={[styles.horizontalRoadDivider, { top: centerY + 80 }]} />

            {/* Zebra crossings */}
            <ZebraCrossing style={{ left: centerX - 45, top: centerY - 80 - 75 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 45, top: centerY - 80 + 58 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 45, top: centerY + 80 - 75 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 45, top: centerY + 80 + 58 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 75, top: centerY - 80 - 45 }} />
            <ZebraCrossing style={{ left: centerX + 58, top: centerY - 80 - 45 }} />
            <ZebraCrossing style={{ left: centerX - 75, top: centerY + 80 - 45 }} />
            <ZebraCrossing style={{ left: centerX + 58, top: centerY + 80 - 45 }} />
          </>
        )}

        {roadLayout === "double-both" && (
          // 2 Vertical Roads, 2 Horizontal Roads (Level 10) - Ultimate Grid
          <>
            <View style={[styles.verticalRoad, { left: centerX - 100 - 45 }]} />
            <View style={[styles.verticalRoad, { left: centerX + 100 - 45 }]} />
            <View style={[styles.horizontalRoad, { top: centerY - 80 - 45 }]} />
            <View style={[styles.horizontalRoad, { top: centerY + 80 - 45 }]} />
            
            <View style={[styles.intersectionCore, { left: centerX - 100 - 45, top: centerY - 80 - 45 }]} />
            <View style={[styles.intersectionCore, { left: centerX + 100 - 45, top: centerY - 80 - 45 }]} />
            <View style={[styles.intersectionCore, { left: centerX - 100 - 45, top: centerY + 80 - 45 }]} />
            <View style={[styles.intersectionCore, { left: centerX + 100 - 45, top: centerY + 80 - 45 }]} />
            
            <View style={[styles.verticalRoadDivider, { left: centerX - 100 }]} />
            <View style={[styles.verticalRoadDivider, { left: centerX + 100 }]} />
            <View style={[styles.horizontalRoadDivider, { top: centerY - 80 }]} />
            <View style={[styles.horizontalRoadDivider, { top: centerY + 80 }]} />

            {/* Zebra crossings */}
            <ZebraCrossing style={{ left: centerX - 100 - 45, top: centerY - 80 - 75 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 100 - 45, top: centerY - 80 + 58 }} horizontal />
            <ZebraCrossing style={{ left: centerX + 100 - 45, top: centerY - 80 - 75 }} horizontal />
            <ZebraCrossing style={{ left: centerX + 100 - 45, top: centerY - 80 + 58 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 100 - 45, top: centerY + 80 - 75 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 100 - 45, top: centerY + 80 + 58 }} horizontal />
            <ZebraCrossing style={{ left: centerX + 100 - 45, top: centerY + 80 - 75 }} horizontal />
            <ZebraCrossing style={{ left: centerX + 100 - 45, top: centerY + 80 + 58 }} horizontal />
            <ZebraCrossing style={{ left: centerX - 165, top: centerY - 80 - 45 }} />
            <ZebraCrossing style={{ left: centerX + 148, top: centerY - 80 - 45 }} />
            <ZebraCrossing style={{ left: centerX - 165, top: centerY + 80 - 45 }} />
            <ZebraCrossing style={{ left: centerX + 148, top: centerY + 80 - 45 }} />
          </>
        )}

        {/* Level Helper Guidelines */}
        {level === 1 && (
          <View style={styles.tutorialContainer} pointerEvents="none">
            <Text style={styles.tutorialText}>TAP to move robots</Text>
            <View style={[styles.tutorialHand, { left: centerX + 115, top: centerY + 10 }]}>
              <MaterialCommunityIcons name="gesture-tap" size={32} color="#FFFFFF" />
            </View>
          </View>
        )}

        {/* Render Launch Dust Smoke Particles */}
        {robots.map((robot, index) => {
          if (robot.status === "escaped") return null;

          let dustX = robot.startX + ROBOT_SIZE / 2 - 15;
          let dustY = robot.startY + ROBOT_HEIGHT - 15;

          return (
            <Animated.View
              key={`dust-${robot.id}`}
              style={[
                styles.dustParticle,
                { left: dustX, top: dustY },
                dustStyles[index],
              ]}
            />
          );
        })}

        {/* Render Static Obstacles (Cones & Broken Robots) */}
        {(levels.find((l) => l.level === level)?.staticObstacles || []).map((obs) => {
          if (obs.type === "cone") {
            return (
              <View
                key={obs.id}
                style={[
                  styles.obstacleCone,
                  { left: obs.x, top: obs.y },
                ]}
              >
                <View style={styles.coneTop} />
                <View style={styles.coneMiddle} />
                <View style={styles.coneBase} />
              </View>
            );
          } else {
            return (
              <View
                key={obs.id}
                style={[
                  styles.obstacleBrokenRobot,
                  { left: obs.x, top: obs.y },
                ]}
              >
                <View style={[styles.robotVisor, { width: 34, height: 20 }]}>
                  <View style={styles.eyesRow}>
                    <View style={[styles.eyeLed, { backgroundColor: "#475569" }]} />
                    <View style={[styles.eyeLed, { backgroundColor: "#475569" }]} />
                  </View>
                </View>
                <View style={styles.brokenSymbol}>
                  <MaterialCommunityIcons name="lightning-bolt-off" size={16} color="#64748B" />
                </View>
              </View>
            );
          }
        })}

        {/* Render CSS Robots */}
        {robots.map((robot, index) => {
          if (robot.status === "escaped") return null;

          const animatedStyle = animatedStyles[index];

          return (
            <Animated.View
              key={robot.id}
              style={[
                styles.robotContainer,
                animatedStyle,
              ]}
            >
              <Pressable
                onPress={() => handleTapRobot(index)}
                style={styles.robotTapArea}
                disabled={robot.status !== "idle"}
              >
                {/* Dynamically render front/back/side view of robot */}
                {renderRobotVisuals(robot.direction, robot.status)}
                
                {/* Direction overlay arrows with custom SVG path turns */}
                <View style={styles.directionArrowBadge}>
                  <TurnArrow direction={robot.direction} turn={robot.turn || "straight"} />
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* BOTTOM MISSION CARD (Rich Game UI) */}
      <View style={styles.missionCardContainer}>
        <View style={styles.missionCard}>
          <View style={styles.missionCardHeader}>
            <View style={styles.skillBadge}>
              <Text style={styles.skillBadgeText}>🧩 LOGIKA</Text>
            </View>
            <Text style={styles.xpReward}>+15 XP</Text>
          </View>
          <Text style={styles.missionTitle}>Misi: Kemacetan Robot</Text>
          <Text style={styles.missionDescription}>
            Ketuk robot dalam urutan yang benar. Perhatikan arah belokan panah kustom pada sasis robot agar tidak menabrak rintangan!
          </Text>
        </View>
      </View>

      {/* VICTORY MODAL OVERLAY */}
      <Modal visible={gameState === "victory"} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.victoryIconCircle}>
              <Ionicons name="trophy" size={48} color="#F59E0B" />
            </View>
            <Text style={styles.modalTitle}>LEVEL SELESAI!</Text>
            <Text style={styles.modalSubtitle}>Persimpangan berhasil dibersihkan dari robot!</Text>

            <View style={styles.rewardSummary}>
              <Text style={styles.rewardLabel}>HADIAH</Text>
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons name="coin" size={20} color="#F59E0B" />
                <Text style={styles.rewardBadgeText}>+{coinsReward} Koin</Text>
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
            <Text style={styles.modalSubtitle}>Luar biasa! Kamu menyelesaikan semua tingkat persimpangan robot!</Text>

            <View style={styles.rewardSummary}>
              <Text style={styles.rewardLabel}>HADIAH TOTAL</Text>
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons name="coin" size={20} color="#F59E0B" />
                <Text style={styles.rewardBadgeText}>+{coinsReward} Koin</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#86EFAC", // Lawn green grass backdrop
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: "#A3E635", // Vibrant Lime Green Header
    borderBottomWidth: 2,
    borderBottomColor: "#84CC16",
    zIndex: 10,
  },
  heartsRow: {
    flexDirection: "row",
    gap: 4,
  },
  levelBadge: {
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 6,
    paddingHorizontal: SPACING.xl,
  },
  levelBadgeText: {
    ...FONTS.bodyBold,
    fontSize: 14,
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

  // GAMEPLAY SCENE LAYOUT
  gameplayArea: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  verticalRoad: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: ROAD_WIDTH,
    backgroundColor: "#334155", // Premium Asphalt Grey
    borderLeftWidth: 3,
    borderLeftColor: "#E2E8F0",
    borderRightWidth: 3,
    borderRightColor: "#E2E8F0",
  },
  horizontalRoad: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ROAD_WIDTH,
    backgroundColor: "#334155",
    borderTopWidth: 3,
    borderTopColor: "#E2E8F0",
    borderBottomWidth: 3,
    borderBottomColor: "#E2E8F0",
  },
  intersectionCore: {
    position: "absolute",
    width: ROAD_WIDTH,
    height: ROAD_WIDTH,
    backgroundColor: "#334155",
  },
  verticalRoadDivider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    borderWidth: 1,
    borderColor: "#FBBF24", // Double yellow center markings
    borderStyle: "dashed",
    opacity: 0.8,
  },
  horizontalRoadDivider: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    borderWidth: 1,
    borderColor: "#FBBF24",
    borderStyle: "dashed",
    opacity: 0.8,
  },

  // ZEBRA CROSSING STRIPES
  zebraContainer: {
    position: "absolute",
    zIndex: 1,
  },
  zebraRow: {
    flexDirection: "row",
    gap: 4,
    height: 18,
    width: ROAD_WIDTH,
    justifyContent: "center",
  },
  zebraColumn: {
    flexDirection: "column",
    gap: 4,
    width: 18,
    height: ROAD_WIDTH,
    justifyContent: "center",
  },
  zebraLineH: {
    width: 12,
    height: 18,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  zebraLineV: {
    width: 18,
    height: 12,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },

  // SCENERY DECORATIVE SHAPES
  treeContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-end",
    width: 60,
    height: 75,
    zIndex: 5,
  },
  treeTrunk: {
    width: 8,
    height: 18,
    backgroundColor: "#78350F",
    borderRadius: 2,
  },
  treeLeavesBack: {
    position: "absolute",
    bottom: 12,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#047857",
  },
  treeLeavesFront: {
    position: "absolute",
    bottom: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#059669",
  },
  rock: {
    position: "absolute",
    width: 34,
    height: 22,
    borderRadius: 12,
    backgroundColor: "#94A3B8",
    borderBottomWidth: 3,
    borderBottomColor: "#64748B",
    zIndex: 4,
  },
  flowerContainer: {
    position: "absolute",
    width: 12,
    height: 12,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 6,
  },
  flowerPetal: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flowerCenter: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FBBF24",
    zIndex: 2,
  },
  chargingContainer: {
    position: "absolute",
    width: 44,
    height: 60,
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 5,
  },
  chargingBase: {
    width: 32,
    height: 44,
    backgroundColor: "#475569",
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: "#64748B",
  },
  chargingScreen: {
    width: 20,
    height: 16,
    backgroundColor: "#0F172A",
    borderRadius: 3,
    position: "absolute",
    top: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  chargingCable: {
    width: 6,
    height: 12,
    borderWidth: 2,
    borderColor: "#F59E0B",
    borderTopWidth: 0,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    marginTop: -2,
  },

  // LAUNCH DUST PARTICLE
  dustParticle: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(241, 245, 249, 0.7)",
    zIndex: 8,
  },

  // MAIN ROBOTS REDESIGNED (Size 68x75)
  robotContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    width: ROBOT_SIZE,
    height: ROBOT_HEIGHT,
    zIndex: 50,
  },
  robotTapArea: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  directionArrowBadge: {
    position: "absolute",
    top: -12,
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    padding: 3,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 60,
  },

  // 1. FRONT VIEW ROBOT
  frontRobot: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  antennaStick: {
    width: 4,
    height: 10,
    backgroundColor: "#0284C7",
  },
  antennaBulb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F59E0B",
    position: "absolute",
    top: 4,
  },
  robotHead: {
    width: 58,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E0F2FE",
    borderWidth: 2.5,
    borderColor: "#0284C7",
    justifyContent: "center",
    alignItems: "center",
  },
  visorScreen: {
    width: 42,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  eyesRow: {
    flexDirection: "row",
    gap: 6,
  },
  eyeCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22D3EE",
    justifyContent: "center",
    alignItems: "center",
  },
  pupil: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  neckJoint: {
    width: 18,
    height: 6,
    backgroundColor: "#0284C7",
    zIndex: 4,
    marginTop: -2,
  },
  robotTorso: {
    width: 62,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    borderWidth: 2.5,
    borderColor: "#0284C7",
    marginTop: -2,
    justifyContent: "center",
    alignItems: "center",
  },
  chestCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#22D3EE",
    borderWidth: 1.5,
    borderColor: "#0284C7",
  },
  tracksBase: {
    width: 52,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#334155",
    borderWidth: 2,
    borderColor: "#0284C7",
    marginTop: -2,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  treadDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#94A3B8",
  },
  hoverGlowShadow: {
    position: "absolute",
    bottom: -6,
    width: 44,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(34, 211, 238, 0.35)",
    alignSelf: "center",
    zIndex: -1,
  },

  // 2. BACK VIEW ROBOT
  backRobot: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  robotHeadBack: {
    width: 58,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E0F2FE",
    borderWidth: 2.5,
    borderColor: "#0284C7",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  coolingVent: {
    height: 4,
    backgroundColor: "#64748B",
    borderRadius: 2,
    opacity: 0.6,
  },
  robotTorsoBack: {
    width: 62,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    borderWidth: 2.5,
    borderColor: "#0284C7",
    marginTop: -2,
    padding: 4,
  },
  backPlateGrid: {
    flex: 1,
    backgroundColor: "#94A3B8",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#64748B",
    borderStyle: "dashed",
    opacity: 0.7,
  },

  // 3. SIDE VIEW ROBOT (LEFT/RIGHT)
  sideRobot: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  robotHeadSide: {
    width: 44,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E0F2FE",
    borderWidth: 2.5,
    borderColor: "#0284C7",
    justifyContent: "center",
    paddingLeft: 12,
  },
  sideVisor: {
    width: 22,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  sideEyeLed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22D3EE",
  },
  robotTorsoSide: {
    width: 46,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    borderWidth: 2.5,
    borderColor: "#0284C7",
    marginTop: -2,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 6,
  },
  sideShoulderJoint: {
    width: 10,
    height: 18,
    borderRadius: 5,
    backgroundColor: "#0284C7",
  },
  sideTracks: {
    width: 40,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#334155",
    borderWidth: 2,
    borderColor: "#0284C7",
    marginTop: -2,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 4,
  },

  // OBSTACLES (CONE & BROKEN ROBOT)
  obstacleCone: {
    position: "absolute",
    width: ROBOT_SIZE,
    height: ROBOT_SIZE,
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 40,
  },
  coneTop: {
    width: 12,
    height: 16,
    backgroundColor: "#F97316", // Orange
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  coneMiddle: {
    width: 26,
    height: 16,
    backgroundColor: "#FFFFFF", // White stripe
    borderWidth: 3,
    borderColor: "#F97316",
  },
  coneBase: {
    width: 48,
    height: 8,
    backgroundColor: "#EA580C", // Dark Orange base
    borderRadius: 3,
  },
  obstacleBrokenRobot: {
    position: "absolute",
    width: ROBOT_SIZE,
    height: ROBOT_SIZE,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#64748B",
    backgroundColor: "#CBD5E1", // Grey/deactivated color
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.light,
    zIndex: 40,
  },
  eyeLed: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  brokenSymbol: {
    position: "absolute",
    bottom: 2,
  },

  // TUTORIAL OVERLAYS
  tutorialContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99,
  },
  tutorialText: {
    ...FONTS.heading,
    fontSize: 22,
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    position: "absolute",
    top: "35%",
  },
  tutorialHand: {
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },

  // BOTTOM MISSION CARD PANEL
  missionCardContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    backgroundColor: "#86EFAC",
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

  // VICTORY MODALS
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
  resetBtn: {
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
