import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  StatusBar,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  cancelAnimation,
} from "react-native-reanimated";
import { COLORS, SPACING, SHAPES, FONTS, SHADOWS } from "../constants/Theme";
import Button from "../components/ui/Button";

// Key untuk penyimpanan koin
const COINS_STORAGE_KEY = "user_coins_balance";

interface Question {
  question: string;
  options: string[];
  answer: string;
}

interface QuestConfig {
  id: number;
  title: string;
  subtitle: string;
  difficulty: "Mudah" | "Sedang" | "Sulit";
  reward: number;
  icon: string;
  color: string;
  questions: Question[];
}

const QUEST_LEVELS: QuestConfig[] = [
  {
    id: 1,
    title: "Operasi Energi",
    subtitle: "Penjumlahan & Pengurangan Dasar",
    difficulty: "Mudah",
    reward: 50,
    icon: "flash",
    color: COLORS.brandGreen,
    questions: [
      { question: "12 + 15 = ?", options: ["25", "27", "29", "30"], answer: "27" },
      { question: "45 - 18 = ?", options: ["23", "27", "29", "31"], answer: "27" },
      { question: "30 - 12 = ?", options: ["16", "18", "20", "22"], answer: "18" },
      { question: "25 + 17 = ?", options: ["38", "42", "45", "40"], answer: "42" },
      { question: "50 - 24 = ?", options: ["24", "26", "28", "30"], answer: "26" },
      { question: "18 + 19 = ?", options: ["35", "37", "39", "41"], answer: "37" },
      { question: "60 - 22 = ?", options: ["36", "38", "40", "42"], answer: "38" },
      { question: "34 + 16 = ?", options: ["48", "50", "52", "54"], answer: "50" },
    ],
  },
  {
    id: 2,
    title: "Sandi Gerbang",
    subtitle: "Menemukan Pola Deret Angka",
    difficulty: "Sedang",
    reward: 100,
    icon: "lock-open",
    color: COLORS.brandBlue,
    questions: [
      { question: "2, 4, 6, 8, [?]", options: ["9", "10", "11", "12"], answer: "10" },
      { question: "5, 10, 15, [?], 25", options: ["18", "20", "22", "24"], answer: "20" },
      { question: "10, 9, 8, 7, [?]", options: ["5", "6", "4", "3"], answer: "6" },
      { question: "3, 6, 12, 24, [?]", options: ["30", "36", "48", "50"], answer: "48" },
      { question: "1, 3, 5, 7, [?]", options: ["8", "9", "10", "11"], answer: "9" },
      { question: "50, 45, 40, [?], 30", options: ["34", "35", "36", "38"], answer: "35" },
      { question: "2, 5, 8, 11, [?]", options: ["12", "13", "14", "15"], answer: "14" },
      { question: "100, 90, 80, [?], 60", options: ["75", "70", "65", "50"], answer: "70" },
    ],
  },
  {
    id: 3,
    title: "Reaktor Aljabar",
    subtitle: "Perkalian, Pembagian & Variabel",
    difficulty: "Sulit",
    reward: 150,
    icon: "radiation",
    color: COLORS.brandOrange,
    questions: [
      { question: "7 x 8 = ?", options: ["54", "56", "58", "60"], answer: "56" },
      { question: "54 / 6 = ?", options: ["8", "9", "10", "7"], answer: "9" },
      { question: "X + 12 = 30. X = ?", options: ["16", "18", "20", "22"], answer: "18" },
      { question: "3 x Y = 21. Y = ?", options: ["6", "7", "8", "9"], answer: "7" },
      { question: "9 x 6 = ?", options: ["52", "54", "56", "58"], answer: "54" },
      { question: "36 / 4 = ?", options: ["8", "9", "10", "12"], answer: "9" },
      { question: "20 - A = 8. A = ?", options: ["10", "12", "14", "16"], answer: "12" },
      { question: "15 x 2 - 10 = ?", options: ["15", "18", "20", "25"], answer: "20" },
    ],
  },
];

const ROBOT_MESSAGES = {
  intro: "Halo Teman! Aku Robo-Aljabar. Kapal antariksa robotku kehabisan energi! Bantu aku memecahkan tantangan matematika di planet ini untuk mengisi daya baterai robotku!",
  correct: [
    "Hebat! Daya baterai bertambah!",
    "Luar biasa, kalkulasimu tepat sekali!",
    "Bagus! Sistem kelistrikanku pulih!",
    "Keren! Kamu memang pintar matematika!",
  ],
  incorrect: [
    "Aduh, bateraiku mengalami penurunan daya!",
    "Oops! Sepertinya ada kesalahan sirkuit.",
    "Jangan menyerah, coba lagi soal berikutnya!",
    "Ah! Sensor dayaku terganggu.",
  ],
  timeout: "Waktu habis! Daya baterai berkurang.",
  almostFull: "Baterai hampir terisi penuh! Ayo sedikit lagi!",
  failed: "Daya baterai kritis. Sistem robot nonaktif. Coba lagi ya!",
  success: "Hore! Daya baterai terisi 100%! Kapal antariksa siap meluncur! Terima kasih ya!",
};

export default function MathQuestScreen() {
  const router = useRouter();
  
  // Game states: 'intro' | 'playing' | 'failed' | 'success'
  const [gameState, setGameState] = useState<"intro" | "playing" | "failed" | "success">("intro");
  const [selectedQuest, setSelectedQuest] = useState<QuestConfig>(QUEST_LEVELS[0]);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState(40); // Dimulai dari 40%
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [coinsReward, setCoinsReward] = useState(0);
  const [robotSpeech, setRobotSpeech] = useState(ROBOT_MESSAGES.intro);
  const [userCoins, setUserCoins] = useState(1250);

  // --- REANIMATED SHARED VALUES ---
  const batteryLevelShared = useSharedValue(40);
  const timerProgress = useSharedValue(1);

  const robotTranslateX = useSharedValue(0);
  const robotTranslateY = useSharedValue(0);
  const robotScale = useSharedValue(1);
  const robotRotate = useSharedValue(0);

  // --- GESTURE DRAG SHARED VALUES ---
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  const feedbackOpacity = useSharedValue(0);
  const feedbackTranslateY = useSharedValue(20);

  const particleX = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const particleY = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const particleOpacity = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];

  const [showParticles, setShowParticles] = useState(false);

  // --- REANIMATED ANIMATED STYLES ---
  const batteryStyle = useAnimatedStyle(() => ({
    width: `${batteryLevelShared.value}%`,
  }));

  const timerStyle = useAnimatedStyle(() => ({
    width: `${timerProgress.value * 100}%`,
  }));

  const robotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: robotTranslateX.value + dragX.value },
      { translateY: robotTranslateY.value + dragY.value },
      { scale: robotScale.value },
      { rotate: `${robotRotate.value}deg` },
    ],
  }));

  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
    transform: [{ translateY: feedbackTranslateY.value }],
  }));

  // Statically define styles for the 5 particles to satisfy Hook rules
  const particleStyle0 = useAnimatedStyle(() => ({
    opacity: particleOpacity[0].value,
    transform: [{ translateX: particleX[0].value }, { translateY: particleY[0].value }],
  }));
  const particleStyle1 = useAnimatedStyle(() => ({
    opacity: particleOpacity[1].value,
    transform: [{ translateX: particleX[1].value }, { translateY: particleY[1].value }],
  }));
  const particleStyle2 = useAnimatedStyle(() => ({
    opacity: particleOpacity[2].value,
    transform: [{ translateX: particleX[2].value }, { translateY: particleY[2].value }],
  }));
  const particleStyle3 = useAnimatedStyle(() => ({
    opacity: particleOpacity[3].value,
    transform: [{ translateX: particleX[3].value }, { translateY: particleY[3].value }],
  }));
  const particleStyle4 = useAnimatedStyle(() => ({
    opacity: particleOpacity[4].value,
    transform: [{ translateX: particleX[4].value }, { translateY: particleY[4].value }],
  }));

  const particleStyles = [particleStyle0, particleStyle1, particleStyle2, particleStyle3, particleStyle4];

  // --- GESTURE PAN DRAG HANDLER ---
  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextX.value = dragX.value;
      contextY.value = dragY.value;
      // Cancel idle loops while dragging
      cancelAnimation(robotTranslateY);
      cancelAnimation(robotScale);
      cancelAnimation(robotRotate);
    })
    .onUpdate((event) => {
      dragX.value = contextX.value + event.translationX;
      dragY.value = contextY.value + event.translationY;
    })
    .onEnd(() => {
      // Bouncy snap back to origin
      dragX.value = withSpring(0, { damping: 12 });
      dragY.value = withSpring(0, { damping: 12 });
      
      // Resume idle loops
      robotTranslateY.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 1800 }),
          withTiming(8, { duration: 1800 })
        ),
        -1,
        true
      );
      robotScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 2000 }),
          withTiming(0.97, { duration: 2000 })
        ),
        -1,
        true
      );
      robotRotate.value = withRepeat(
        withSequence(
          withTiming(3, { duration: 2200 }),
          withTiming(-3, { duration: 2200 })
        ),
        -1,
        true
      );
    });

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
    const loadCoins = async () => {
      try {
        const storedCoins = await AsyncStorage.getItem(COINS_STORAGE_KEY);
        if (storedCoins !== null) {
          setUserCoins(parseInt(storedCoins));
        } else {
          await AsyncStorage.setItem(COINS_STORAGE_KEY, "1250");
        }
      } catch (_e) {
        console.error("Failed to load coins", _e);
      }
    };
    loadCoins();
  }, []);

  // Timer effect
  useEffect(() => {
    if (gameState !== "playing" || selectedAnswer !== null) return;

    if (timeLeft <= 0) {
      handleTimeout();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    // Animate timer progress bar
    timerProgress.value = withTiming(timeLeft / 15, { duration: 1000 });

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, gameState, selectedAnswer]);

  // Battery bar animation
  useEffect(() => {
    batteryLevelShared.value = withSpring(batteryLevel, { damping: 15 });
  }, [batteryLevel, batteryLevelShared]);

  // Robot idle loop (Breathing, Floating, Swaying)
  useEffect(() => {
    if (selectedAnswer === null && (gameState === "playing" || gameState === "intro")) {
      // 1. Floating (Y-axis float bounce)
      robotTranslateY.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 1800 }),
          withTiming(8, { duration: 1800 })
        ),
        -1,
        true
      );

      // 2. Breathing (scale pulsing)
      robotScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 2000 }),
          withTiming(0.97, { duration: 2000 })
        ),
        -1,
        true
      );

      // 3. Swaying (rotation)
      robotRotate.value = withRepeat(
        withSequence(
          withTiming(3, { duration: 2200 }),
          withTiming(-3, { duration: 2200 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(robotTranslateY);
      cancelAnimation(robotScale);
      cancelAnimation(robotRotate);
    }

    return () => {
      cancelAnimation(robotTranslateY);
      cancelAnimation(robotScale);
      cancelAnimation(robotRotate);
    };
  }, [gameState, selectedAnswer, robotTranslateY, robotScale, robotRotate]);

  // Cartoon Active Animations
  const playVictoryAnimation = () => {
    cancelAnimation(robotTranslateY);
    cancelAnimation(robotScale);
    cancelAnimation(robotRotate);
    
    robotRotate.value = 0;
    
    // Squash & Stretch, Jump, Spin
    robotScale.value = withSequence(
      withTiming(0.82, { duration: 100 }),
      withTiming(1.25, { duration: 300 }),
      withTiming(0.88, { duration: 250 }),
      withSpring(1, { damping: 12 })
    );

    robotTranslateY.value = withSequence(
      withTiming(12, { duration: 100 }),
      withTiming(-65, { duration: 300 }),
      withTiming(0, { duration: 250 }),
      withSpring(0, { damping: 12 })
    );

    robotRotate.value = withTiming(360, { duration: 450 });
  };

  const playDamageAnimation = () => {
    cancelAnimation(robotTranslateY);
    cancelAnimation(robotScale);
    cancelAnimation(robotRotate);
    cancelAnimation(robotTranslateX);
    
    robotTranslateX.value = 0;
    
    robotScale.value = withSequence(
      withTiming(0.85, { duration: 80 }),
      withDelay(340, withSpring(1))
    );

    robotRotate.value = withSequence(
      withTiming(-15, { duration: 80 }),
      withDelay(340, withSpring(0))
    );

    robotTranslateX.value = withSequence(
      withTiming(-15, { duration: 40 }),
      withTiming(15, { duration: 60 }),
      withTiming(-12, { duration: 60 }),
      withTiming(12, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withSpring(0)
    );
  };

  const emitParticles = () => {
    setShowParticles(true);
    const { width: sw, height: sh } = Dimensions.get("window");
    
    // Start at bottom center (where the choice buttons are)
    const startX = sw / 2 - 12; // Adjusted for particle width
    const startY = sh - 280;
    
    // Target at top-left/center (near battery bar HUD)
    const targetX = 80;
    const targetY = 32;

    for (let i = 0; i < 5; i++) {
      const randX = startX + (Math.random() - 0.5) * 100;
      const randY = startY + (Math.random() - 0.5) * 50;

      particleX[i].value = randX;
      particleY[i].value = randY;
      particleOpacity[i].value = 0;

      const delayTime = i * 100;

      particleOpacity[i].value = withDelay(
        delayTime,
        withSequence(
          withTiming(1, { duration: 80 }),
          withDelay(450, withTiming(0, { duration: 250 }))
        )
      );

      particleX[i].value = withDelay(
        delayTime,
        withTiming(targetX, { duration: 650 })
      );

      particleY[i].value = withDelay(
        delayTime,
        withTiming(targetY, { duration: 650 })
      );
    }

    setTimeout(() => {
      setShowParticles(false);
    }, 1200);
  };

  const startQuest = (quest: QuestConfig) => {
    triggerHaptic("light");
    setSelectedQuest(quest);
    setCoinsReward(quest.reward);
    
    // Shuffle and pick 6 questions
    const shuffled = [...quest.questions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 6);
    
    setCurrentQuestions(selected);
    setQuestionIndex(0);
    setBatteryLevel(40);
    setTimeLeft(15);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setRobotSpeech(ROBOT_MESSAGES.intro);
    setGameState("playing");
  };

  const handleTimeout = () => {
    triggerHaptic("error");
    setIsCorrect(false);
    setSelectedAnswer("WAKTU_HABIS");
    setRobotSpeech(ROBOT_MESSAGES.timeout);
    playDamageAnimation();
    
    // Reduce battery
    const nextBattery = Math.max(0, batteryLevel - 10);
    setBatteryLevel(nextBattery);

    // Show floating error feedback
    showFloatingFeedback();

    setTimeout(() => {
      if (nextBattery <= 0) {
        setGameState("failed");
        setRobotSpeech(ROBOT_MESSAGES.failed);
      } else {
        nextQuestion();
      }
    }, 1500);
  };

  const handleAnswerSelect = (option: string) => {
    if (selectedAnswer !== null) return;
    
    const currentQ = currentQuestions[questionIndex];
    const correct = option === currentQ.answer;
    
    setSelectedAnswer(option);
    setIsCorrect(correct);
    
    if (correct) {
      triggerHaptic("success");
      playVictoryAnimation();
      emitParticles();
      
      const randomMsg = ROBOT_MESSAGES.correct[Math.floor(Math.random() * ROBOT_MESSAGES.correct.length)];
      
      const nextBattery = Math.min(100, batteryLevel + 20);
      setBatteryLevel(nextBattery);
      
      if (nextBattery >= 100) {
        setRobotSpeech(ROBOT_MESSAGES.success);
      } else if (nextBattery >= 80) {
        setRobotSpeech(ROBOT_MESSAGES.almostFull);
      } else {
        setRobotSpeech(randomMsg);
      }
      
      showFloatingFeedback();
      
      setTimeout(() => {
        if (nextBattery >= 100) {
          setGameState("success");
        } else {
          nextQuestion();
        }
      }, 1500);
    } else {
      triggerHaptic("error");
      playDamageAnimation();
      
      const randomMsg = ROBOT_MESSAGES.incorrect[Math.floor(Math.random() * ROBOT_MESSAGES.incorrect.length)];
      setRobotSpeech(randomMsg);
      
      const nextBattery = Math.max(0, batteryLevel - 10);
      setBatteryLevel(nextBattery);
      
      showFloatingFeedback();
      
      setTimeout(() => {
        if (nextBattery <= 0) {
          setGameState("failed");
          setRobotSpeech(ROBOT_MESSAGES.failed);
        } else {
          nextQuestion();
        }
      }, 1500);
    }
  };

  const showFloatingFeedback = () => {
    feedbackTranslateY.value = 20;
    feedbackOpacity.value = 0;
    
    feedbackOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(500, withTiming(0, { duration: 300 }))
    );
    feedbackTranslateY.value = withTiming(-20, { duration: 500 });
  };

  const nextQuestion = () => {
    if (questionIndex + 1 < currentQuestions.length) {
      setQuestionIndex(questionIndex + 1);
      setTimeLeft(15);
      setSelectedAnswer(null);
      setIsCorrect(null);
    } else {
      // Loop questions if run out of questions but battery is not 100% yet
      const shuffled = [...selectedQuest.questions].sort(() => 0.5 - Math.random());
      setCurrentQuestions(shuffled);
      setQuestionIndex(0);
      setTimeLeft(15);
      setSelectedAnswer(null);
      setIsCorrect(null);
    }
  };

  const handleClaimReward = async () => {
    triggerHaptic("success");
    const finalBalance = userCoins + coinsReward;
    
    try {
      await AsyncStorage.setItem(COINS_STORAGE_KEY, finalBalance.toString());
      router.back();
    } catch (e) {
      console.error("Failed to save reward coins", e);
      router.back();
    }
  };

  // Helper to color battery bar
  const getBatteryColor = () => {
    if (batteryLevel <= 20) return COLORS.error;
    if (batteryLevel <= 50) return COLORS.warning;
    return COLORS.brandGreen;
  };

  // Layar Intro / Pemilihan Level
  const renderIntro = () => {
    return (
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.introHeader}>
          <GestureDetector gesture={panGesture}>
            <Animated.View 
              style={[robotAnimatedStyle, { cursor: "grab" } as any]}
            >
              <Image
                source={require("../assets/images/modul_robot.png")}
                style={styles.introRobotImage}
                contentFit="contain"
              />
            </Animated.View>
          </GestureDetector>
          <Text style={styles.introTitle}>MATH QUEST</Text>
          <Text style={styles.introSubtitle}>Bantu robot mengisi energi baterai dengan belajar matematika!</Text>
        </View>

        {/* Dialog bubble */}
        <View style={styles.dialogBox}>
          <View style={styles.dialogTail} />
          <Text style={styles.dialogText}>{ROBOT_MESSAGES.intro}</Text>
        </View>

        <Text style={styles.sectionTitle}>PILIH MISI PETUALANGAN</Text>

        {QUEST_LEVELS.map((quest) => (
          <Pressable
            key={quest.id}
            style={[styles.questCard, { borderColor: quest.color + "40" }]}
            onPress={() => startQuest(quest)}
          >
            <View style={[styles.questIconCircle, { backgroundColor: quest.color + "15" }]}>
              <MaterialCommunityIcons name={quest.icon as any} size={28} color={quest.color} />
            </View>
            <View style={styles.questInfo}>
              <View style={styles.questTitleRow}>
                <Text style={styles.questTitle}>{quest.title}</Text>
                <View style={[styles.diffBadge, { backgroundColor: quest.color + "20" }]}>
                  <Text style={[styles.diffText, { color: quest.color }]}>{quest.difficulty}</Text>
                </View>
              </View>
              <Text style={styles.questSubtitle}>{quest.subtitle}</Text>
              
              <View style={styles.rewardRow}>
                <MaterialCommunityIcons name="coin" size={16} color="#F59E0B" />
                <Text style={styles.rewardText}>+{quest.reward} Koin</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
          </Pressable>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  // Layar Gameplay
  const renderPlaying = () => {
    const currentQ = currentQuestions[questionIndex];
    if (!currentQ) return null;

    const timerColor = timeLeft <= 5 ? COLORS.error : COLORS.brandBlue;

    return (
      <View style={styles.gameplayContainer}>
        {/* HUD Area */}
        <View style={styles.hudHeader}>
          <Pressable 
            onPress={() => {
              triggerHaptic("light");
              setGameState("intro");
            }}
            style={styles.hudBackButton}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.textDark} />
          </Pressable>

          {/* Battery Bar Container */}
          <View style={styles.batteryContainer}>
            <MaterialCommunityIcons 
              name={batteryLevel <= 20 ? "battery-alert" : batteryLevel <= 50 ? "battery-medium" : "battery-high"} 
              size={20} 
              color={getBatteryColor()} 
            />
            <View style={styles.batteryOuter}>
              <Animated.View 
                style={[
                  styles.batteryInner, 
                  batteryStyle,
                  { backgroundColor: getBatteryColor() }
                ]} 
              />
            </View>
            <Text style={[styles.batteryText, { color: getBatteryColor() }]}>{batteryLevel}%</Text>

            {/* Floating Energy Indicator */}
            <Animated.View
              style={[
                styles.floatingFeedback,
                feedbackStyle
              ]}
            >
              <Text 
                style={[
                  styles.floatingFeedbackText, 
                  { color: isCorrect ? COLORS.success : COLORS.error }
                ]}
              >
                {isCorrect ? "+20%" : "-10%"}
              </Text>
            </Animated.View>
          </View>

          {/* Coin Score */}
          <View style={styles.hudCoins}>
            <MaterialCommunityIcons name="coin" size={16} color="#F59E0B" />
            <Text style={styles.hudCoinsText}>{userCoins}</Text>
          </View>
        </View>

        {/* Time Left Bar */}
        <View style={styles.timerTrack}>
          <Animated.View 
            style={[
              styles.timerBar, 
              timerStyle,
              { backgroundColor: timerColor }
            ]} 
          />
        </View>

        <ScrollView contentContainerStyle={styles.gameplayScroll} showsVerticalScrollIndicator={false}>
          {/* Robot Dialogue & Image */}
          <View style={styles.robotArea}>
            <View 
              style={[
                styles.robotBubble, 
                { 
                  borderColor: isCorrect === true ? COLORS.success + "40" : isCorrect === false ? COLORS.error + "40" : COLORS.borderLight 
                }
              ]}
            >
              <View style={styles.robotBubbleTail} />
              <Text style={styles.robotBubbleText}>{robotSpeech}</Text>
            </View>

            <GestureDetector gesture={panGesture}>
              <Animated.View 
                style={[robotAnimatedStyle, { cursor: "grab" } as any]}
              >
                <Image
                  source={require("../assets/images/robomind_hero.png")}
                  style={styles.robotGameplayImage}
                  contentFit="contain"
                />
              </Animated.View>
            </GestureDetector>
          </View>

          {/* Question Card */}
          <View style={styles.questionCard}>
            <Text style={styles.questCategoryLabel}>TANTANGAN: {selectedQuest.title.toUpperCase()}</Text>
            <Text style={styles.questionText}>{currentQ.question}</Text>
          </View>

          {/* Choices Grid */}
          <View style={styles.choicesContainer}>
            {currentQ.options.map((option, idx) => {
              const isSelected = selectedAnswer === option;
              const isOptionCorrect = option === currentQ.answer;
              
              // Styling variable
              let btnStyle = [styles.choiceButton];
              let txtStyle = [styles.choiceText];
              
              if (selectedAnswer !== null) {
                if (isOptionCorrect) {
                  btnStyle.push(styles.choiceCorrect);
                  txtStyle.push(styles.choiceTextCorrect);
                } else if (isSelected) {
                  btnStyle.push(styles.choiceIncorrect);
                  txtStyle.push(styles.choiceTextIncorrect);
                } else {
                  btnStyle.push(styles.choiceMuted);
                }
              }

              return (
                <Pressable
                  key={idx}
                  style={btnStyle}
                  onPress={() => handleAnswerSelect(option)}
                  disabled={selectedAnswer !== null}
                >
                  <Text style={txtStyle}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Layar Hasil Menang
  const renderSuccess = () => {
    return (
      <View style={styles.resultContainer}>
        <View style={styles.resultCard}>
          <View style={styles.victoryBanner}>
            <Ionicons name="trophy" size={56} color="#F59E0B" />
          </View>

          <Text style={styles.resultTitle}>MISI BERHASIL!</Text>
          <Text style={styles.resultSubtitle}>Baterai Robot Telah Terisi Penuh 100%!</Text>

          <Image
            source={require("../assets/images/robomind_character_2d.png")}
            style={styles.resultRobotImage}
            contentFit="contain"
          />

          <View style={styles.rewardSummary}>
            <Text style={styles.rewardTitle}>HADIAH PETUALANGAN</Text>
            <View style={styles.rewardBadgeBig}>
              <MaterialCommunityIcons name="coin" size={24} color="#F59E0B" />
              <Text style={styles.rewardBadgeTextBig}>+{coinsReward} Koin</Text>
            </View>
          </View>

          <View style={styles.dialogBoxSuccess}>
            <Text style={styles.dialogTextSuccess}>{ROBOT_MESSAGES.success}</Text>
          </View>

          <Button
            title="Klaim Hadiah & Kembali"
            onPress={handleClaimReward}
            variant="primary"
            style={styles.actionButton}
          />
        </View>
      </View>
    );
  };

  // Layar Hasil Kalah
  const renderFailed = () => {
    return (
      <View style={styles.resultContainer}>
        <View style={[styles.resultCard, { borderColor: COLORS.error + "30" }]}>
          <View style={[styles.victoryBanner, { backgroundColor: "#FEF2F2" }]}>
            <Ionicons name="close-circle" size={56} color={COLORS.error} />
          </View>

          <Text style={[styles.resultTitle, { color: COLORS.error }]}>MISI GAGAL</Text>
          <Text style={styles.resultSubtitle}>Daya baterai kritis. Sirkuit robot nonaktif.</Text>

          <Image
            source={require("../assets/images/robomind_hero.png")}
            style={[styles.resultRobotImage, { opacity: 0.5 }]}
            contentFit="contain"
          />

          <View style={styles.dialogBoxFailed}>
            <Text style={styles.dialogTextFailed}>{ROBOT_MESSAGES.failed}</Text>
          </View>

          <View style={styles.failedActions}>
            <Button
              title="Coba Lagi"
              onPress={() => startQuest(selectedQuest)}
              variant="accent"
              style={{ flex: 1 }}
            />
            <Button
              title="Kembali"
              onPress={() => setGameState("intro")}
              variant="secondary"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        
        {/* Top Navigation Header for intro page */}
        {gameState === "intro" && (
          <View style={styles.mainHeader}>
            <Pressable 
              onPress={() => {
                triggerHaptic("light");
                router.back();
              }}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
            </Pressable>
            <Text style={styles.mainHeaderTitle}>Math Quest</Text>
            
            <View style={styles.coinsHeaderBadge}>
              <MaterialCommunityIcons name="coin" size={16} color="#F59E0B" />
              <Text style={styles.coinsHeaderVal}>{userCoins}</Text>
            </View>
          </View>
        )}

        {/* Screen Dispatcher */}
        {gameState === "intro" && renderIntro()}
        {gameState === "playing" && renderPlaying()}
        {gameState === "success" && renderSuccess()}
        {gameState === "failed" && renderFailed()}

        {/* Floating Particles Overlay */}
        {showParticles && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {particleStyles.map((style, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.particle,
                  style,
                ]}
              >
                <MaterialCommunityIcons name="flash" size={12} color="#00C3A0" />
              </Animated.View>
            ))}
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  mainHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: SHAPES.radiusRound,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  mainHeaderTitle: {
    ...FONTS.heading,
    fontSize: 18,
    color: COLORS.textDark,
  },
  coinsHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    gap: 4,
  },
  coinsHeaderVal: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: "#D97706",
  },
  scrollContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  introHeader: {
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  introRobotImage: {
    width: 140,
    height: 140,
    marginBottom: SPACING.md,
  },
  introTitle: {
    ...FONTS.heading,
    fontSize: 28,
    color: COLORS.brandDarkBlue,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  introSubtitle: {
    ...FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.textMedium,
    textAlign: "center",
    paddingHorizontal: SPACING.md,
    marginTop: 4,
  },
  dialogBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: SHAPES.radiusLg,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.xl,
    position: "relative",
    ...SHADOWS.light,
  },
  dialogTail: {
    position: "absolute",
    top: -12,
    left: "50%",
    marginLeft: -10,
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: COLORS.borderLight,
  },
  dialogText: {
    ...FONTS.bodyMedium,
    fontSize: 13.5,
    lineHeight: 20,
    color: COLORS.textMedium,
    textAlign: "center",
  },
  sectionTitle: {
    ...FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
  },
  questCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: SHAPES.radiusLg,
    borderWidth: 2,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.light,
  },
  questIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  questInfo: {
    flex: 1,
  },
  questTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  questTitle: {
    ...FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.textDark,
    marginRight: SPACING.sm,
  },
  diffBadge: {
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: SHAPES.radiusRound,
  },
  diffText: {
    fontSize: 9,
    fontWeight: "800",
  },
  questSubtitle: {
    ...FONTS.bodyRegular,
    fontSize: 12,
    color: COLORS.textMedium,
    marginBottom: 6,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rewardText: {
    ...FONTS.bodyBold,
    fontSize: 12,
    color: "#D97706",
  },

  // GAMEPLAY SCREEN
  gameplayContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  hudHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 4,
    backgroundColor: "#FFFFFF",
  },
  hudBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  batteryContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginHorizontal: SPACING.lg,
    gap: SPACING.xs,
    position: "relative",
  },
  batteryOuter: {
    flex: 1,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E5E7EB",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    overflow: "hidden",
  },
  batteryInner: {
    height: "100%",
    borderRadius: 8,
  },
  batteryText: {
    fontSize: 11,
    fontWeight: "800",
    width: 32,
    textAlign: "right",
  },
  floatingFeedback: {
    position: "absolute",
    top: -24,
    right: 40,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: SHAPES.radiusRound,
    ...SHADOWS.light,
  },
  floatingFeedbackText: {
    fontSize: 10,
    fontWeight: "900",
  },
  hudCoins: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 4,
    paddingHorizontal: SPACING.md,
    gap: 4,
  },
  hudCoinsText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#D97706",
  },
  timerTrack: {
    height: 4,
    backgroundColor: "#E5E7EB",
    width: "100%",
  },
  timerBar: {
    height: "100%",
  },
  gameplayScroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  robotArea: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  robotBubble: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: SHAPES.radiusLg,
    padding: SPACING.md,
    position: "relative",
    ...SHADOWS.light,
  },
  robotBubbleTail: {
    position: "absolute",
    right: -10,
    top: "50%",
    marginTop: -8,
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#FFFFFF",
    zIndex: 1,
  },
  robotBubbleText: {
    ...FONTS.bodyMedium,
    fontSize: 12.5,
    color: COLORS.textDark,
    lineHeight: 18,
  },
  robotGameplayImage: {
    width: 90,
    height: 90,
  },
  questionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: SHAPES.radiusXl,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.xl,
    ...SHADOWS.medium,
  },
  questCategoryLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.textLight,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  questionText: {
    ...FONTS.heading,
    fontSize: 32,
    color: COLORS.brandDarkBlue,
    textAlign: "center",
  },
  choicesContainer: {
    gap: SPACING.md,
  },
  choiceButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    borderRadius: SHAPES.radiusLg,
    paddingVertical: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.light,
  },
  choiceText: {
    ...FONTS.heading,
    fontSize: 20,
    color: COLORS.textDark,
  },
  choiceCorrect: {
    backgroundColor: "#ECFDF5",
    borderColor: COLORS.success,
  },
  choiceTextCorrect: {
    color: COLORS.success,
  },
  choiceIncorrect: {
    backgroundColor: "#FEF2F2",
    borderColor: COLORS.error,
  },
  choiceTextIncorrect: {
    color: COLORS.error,
  },
  choiceMuted: {
    opacity: 0.5,
  },

  // RESULTS SCREEN
  resultContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
  },
  resultCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: SHAPES.radiusXl,
    borderWidth: 2,
    borderColor: COLORS.brandGreen + "30",
    padding: SPACING.xl,
    alignItems: "center",
    ...SHADOWS.medium,
  },
  victoryBanner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FFFBEB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  resultTitle: {
    ...FONTS.heading,
    fontSize: 24,
    color: COLORS.success,
    letterSpacing: 1.5,
    textAlign: "center",
  },
  resultSubtitle: {
    ...FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textMedium,
    textAlign: "center",
    marginTop: 4,
    marginBottom: SPACING.xl,
  },
  resultRobotImage: {
    width: 130,
    height: 130,
    marginBottom: SPACING.xl,
  },
  rewardSummary: {
    backgroundColor: "#F9FAFB",
    borderRadius: SHAPES.radiusLg,
    padding: SPACING.md,
    alignItems: "center",
    width: "100%",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  rewardTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.textLight,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  rewardBadgeBig: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FFEDD5",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  rewardBadgeTextBig: {
    ...FONTS.heading,
    fontSize: 18,
    color: "#D97706",
  },
  dialogBoxSuccess: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: COLORS.success + "20",
    borderRadius: SHAPES.radiusLg,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    width: "100%",
  },
  dialogTextSuccess: {
    ...FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.success,
    textAlign: "center",
    lineHeight: 18,
  },
  dialogBoxFailed: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: COLORS.error + "20",
    borderRadius: SHAPES.radiusLg,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    width: "100%",
  },
  dialogTextFailed: {
    ...FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.error,
    textAlign: "center",
    lineHeight: 18,
  },
  actionButton: {
    width: "100%",
  },
  failedActions: {
    flexDirection: "row",
    gap: SPACING.md,
    width: "100%",
  },
  particle: {
    position: "absolute",
    width: 24,
    height: 24,
    backgroundColor: "#E6FBF7",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#00C3A0",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.light,
    zIndex: 999,
  },
});
