import React, { useState, useCallback } from "react";
import { StyleSheet, View, Text, ScrollView, Pressable, StatusBar, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, SPACING, SHAPES, FONTS, SHADOWS } from "../../constants/Theme";
import { useAuth } from "../../hooks/useAuth";

interface GameItem {
  id: string;
  title: string;
  category: "Kognitif" | "Moral" | "Literasi" | "Fokus";
  image: any;
  levelInfo?: string;
  coinsReward?: number;
  isLocked?: boolean;
}

export default function PlayScreen() {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [userCoins, setUserCoins] = useState(1250);

  useFocusEffect(
    useCallback(() => {
      const loadCoins = async () => {
        try {
          const val = await AsyncStorage.getItem("user_coins_balance");
          if (val !== null) {
            setUserCoins(parseInt(val));
          }
        } catch (e) {
          console.error("Failed to load coins", e);
        }
      };
      loadCoins();
    }, [])
  );

  const categories = ["Semua", "Kognitif", "Moral", "Literasi", "Fokus"];

  const games: GameItem[] = [
    {
      id: "math_quest",
      title: "Math Quest",
      category: "Kognitif",
      image: require("../../assets/images/game_math.png"),
      levelInfo: "Level 4",
      coinsReward: 150,
    },
    {
      id: "moral_story",
      title: "Moral Story",
      category: "Moral",
      image: require("../../assets/images/hero_classroom.png"),
      levelInfo: "Level 3",
      coinsReward: 120,
    },
    {
      id: "hoax_detection",
      title: "Hoax vs Fact",
      category: "Literasi",
      image: require("../../assets/images/modul_coding.png"),
      levelInfo: "Level 1",
      coinsReward: 200,
    },
    {
      id: "problem_solving",
      title: "Problem Solving",
      category: "Fokus",
      image: require("../../assets/images/robomind_hero.png"),
      levelInfo: "Level 5",
      coinsReward: 180,
      isLocked: false,
    },
    {
      id: "focus_challenge",
      title: "Focus Challenge",
      category: "Fokus",
      image: require("../../assets/images/news_nature.png"),
      levelInfo: "Level 2",
      coinsReward: 250,
      isLocked: true,
    },
  ];

  const filteredGames = selectedCategory === "Semua" 
    ? games 
    : games.filter(game => game.category === selectedCategory);

  const renderGameCard = ({ item }: { item: GameItem }) => {
    return (
      <Pressable 
        style={[styles.card, item.isLocked && styles.cardLocked]}
        onPress={() => {
          if (item.isLocked) {
            alert("Misi game ini masih terkunci! Selesaikan misi sebelumnya.");
          } else {
            if (item.id === "math_quest") {
              router.push("/math-quest");
            } else if (!isLoggedIn) {
              Alert.alert(
                "Harap Login Dahulu",
                "Anda belum login. Silakan login terlebih dahulu untuk menyimpan progres belajar anak.",
                [
                  {
                    text: "Lanjutkan Bermain",
                    onPress: () => alert(`Memulai game ${item.title}...`),
                  },
                  {
                    text: "Batal",
                    style: "cancel",
                  },
                ]
              );
            } else {
              alert(`Memulai game ${item.title}...`);
            }
          }
        }}
      >
        <View style={styles.cardImageContainer}>
          <Image source={item.image} style={styles.cardImage} contentFit="cover" />
          
          {item.isLocked && (
            <View style={styles.lockedOverlay}>
              <View style={styles.lockCircle}>
                <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
              </View>
            </View>
          )}

          {!item.isLocked && item.levelInfo && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{item.levelInfo}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={styles.cardFooter}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>
            {item.coinsReward && (
              <View style={styles.coinsRow}>
                <MaterialCommunityIcons name="coins" size={14} color="#F59E0B" />
                <Text style={styles.coinsText}>{item.coinsReward}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />
      
      {/* Header Panel */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>PILIH MISI GAME</Text>
          <Text style={styles.headerTitle}>Petualangan Belajar</Text>
        </View>
        
        {/* Coins HUD Badge */}
        <View style={styles.coinsHud}>
          <MaterialCommunityIcons name="coins" size={18} color="#F59E0B" />
          <Text style={styles.coinsHudText}>{userCoins.toLocaleString("id-ID")}</Text>
        </View>
      </View>

      {/* Category Chips Scroll */}
      <View style={styles.chipsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Grid of games */}
      <FlatList
        data={filteredGames}
        renderItem={renderGameCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.rowWrapper}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerSubtitle: {
    ...FONTS.caption,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: COLORS.brandGreen,
  },
  headerTitle: {
    ...FONTS.heading,
    fontSize: 20,
    color: COLORS.textDark,
  },
  coinsHud: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FFEDD5",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    gap: 4,
    ...SHADOWS.light,
  },
  coinsHudText: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: "#D97706",
  },
  chipsContainer: {
    paddingVertical: 0,
  },
  chipsScroll: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: SPACING.lg,
    borderRadius: SHAPES.radiusRound,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
  },
  chipActive: {
    backgroundColor: COLORS.brandGreen,
    borderColor: COLORS.brandGreen,
  },
  chipText: {
    ...FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textMedium,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  gridContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  rowWrapper: {
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  card: {
    width: "48%",
    backgroundColor: COLORS.cardWhite,
    borderRadius: SHAPES.radiusLg,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    overflow: "hidden",
    ...SHADOWS.light,
  },
  cardLocked: {
    opacity: 0.85,
  },
  cardImageContainer: {
    width: "100%",
    height: 120,
    position: "relative",
    backgroundColor: "#F1F5F9",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  levelBadge: {
    position: "absolute",
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: "rgba(0, 195, 160, 0.85)",
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: SHAPES.radiusSm,
  },
  levelBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  cardInfo: {
    padding: SPACING.md,
  },
  cardTitle: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textDark,
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryBadge: {
    backgroundColor: COLORS.bgPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: SHAPES.radiusSm,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  categoryBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: COLORS.textMedium,
  },
  coinsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  coinsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
});
