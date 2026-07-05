import React, { useState, useCallback } from "react";
import { StyleSheet, View, Text, ScrollView, Pressable, StatusBar, Modal, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import Svg, { Polygon, Line, Circle, Text as SvgText } from "react-native-svg";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, SPACING, SHAPES, FONTS, SHADOWS } from "../../constants/Theme";
import Robot3DView from "../../components/Robot3DView";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../hooks/useAuth";


export default function Index() {
  const { isLoggedIn, childName, updateChildName, avatarUrl, updateAvatarUrl } = useAuth();
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

  // Name Editing States
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Avatar Picking State
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  const handlePickAvatar = async () => {
    if (!isLoggedIn) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert("Maaf, kami memerlukan izin akses galeri untuk mengubah foto profil.");
      return;
    }

    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setIsSavingAvatar(true);
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await updateAvatarUrl(base64Uri);
      }
    } catch (err: any) {
      alert(err?.message || "Gagal mengubah foto profil.");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleSaveName = async () => {
    setNameError("");
    if (!editName.trim()) {
      setNameError("Nama tidak boleh kosong.");
      return;
    }
    setIsSavingName(true);
    try {
      await updateChildName(editName.trim());
      setNameModalVisible(false);
    } catch (err: any) {
      setNameError(err?.message || "Terjadi kesalahan saat menyimpan nama.");
    } finally {
      setIsSavingName(false);
    }
  };

  // Radar Chart calculation constants
  const cx = 110;
  const cy = 110;
  const r = 70; // Max radius
  const axisLabels = ["Logika", "Kreativitas", "Bahasa", "Fokus", "Pemecahan Masalah"];

  // Helper function to get coordinates for radar charts
  const getCoordinates = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
    const x = cx + r * value * Math.cos(angle);
    const y = cy + r * value * Math.sin(angle);
    return { x, y };
  };

  const getLabelCoordinates = (index: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
    const x = cx + (r + 14) * Math.cos(angle);
    const y = cy + (r + 12) * Math.sin(angle);
    return { x, y };
  };

  // Concentric pentagon grid lines paths
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const gridPolygons = gridLevels.map((lvl) => {
    const pts = [0, 1, 2, 3, 4].map((i) => {
      const { x, y } = getCoordinates(i, lvl);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return pts.join(" ");
  });

  type SimulationLevel = "Beginner" | "Intermediate" | "Advanced";
  const [selectedLevel, setSelectedLevel] = useState<SimulationLevel>("Intermediate");

  const levelsMetrics = {
    Beginner: {
      skills: "5",
      activities: "10+",
      curriculum: "5h",
      status: "Beginner",
      desc: "Berkembang sesuai progres bermain anak.",
    },
    Intermediate: {
      skills: "12",
      activities: "24",
      curriculum: "15",
      status: "Intermediate",
      desc: "Anak mulai menguasai algoritma menengah.",
    },
    Advanced: {
      skills: "15+",
      activities: "50+",
      curriculum: "24h",
      status: "Advanced",
      desc: "Mampu memecahkan masalah logika kompleks.",
    },
  };

  const levelsChartData: Record<SimulationLevel, { logika: number; kreativitas: number; bahasa: number; fokus: number; pemecahanMasalah: number }> = {
    Beginner: {
      logika: 0.35,
      kreativitas: 0.45,
      bahasa: 0.85,
      fokus: 0.4,
      pemecahanMasalah: 0.3,
    },
    Intermediate: {
      logika: 0.65,
      kreativitas: 0.7,
      bahasa: 0.9,
      fokus: 0.6,
      pemecahanMasalah: 0.55,
    },
    Advanced: {
      logika: 0.9,
      kreativitas: 0.85,
      bahasa: 0.95,
      fokus: 0.8,
      pemecahanMasalah: 0.85,
    },
  };

  const activeSkills = levelsChartData[selectedLevel];
  const skillValues = [
    activeSkills.logika,
    activeSkills.kreativitas,
    activeSkills.bahasa,
    activeSkills.fokus,
    activeSkills.pemecahanMasalah,
  ];

  const valuePoints = [0, 1, 2, 3, 4]
    .map((i) => {
      const { x, y } = getCoordinates(i, skillValues[i]);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const activeMetrics = levelsMetrics[selectedLevel];



  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgPrimary} />

      {/* Child Header HUD Panel */}
      <View style={styles.header}>
        {/* Child Profile info */}
        <View style={styles.profileSection}>
          <Pressable 
            onPress={handlePickAvatar}
            disabled={!isLoggedIn || isSavingAvatar}
            style={({ pressed }) => [
              styles.avatarOutline,
              pressed && { opacity: 0.8 }
            ]}
          >
            {isSavingAvatar ? (
              <View style={[styles.avatar, { justifyContent: "center", alignItems: "center", backgroundColor: `${COLORS.brandGreen}15` }]}>
                <ActivityIndicator size="small" color={COLORS.brandGreen} />
              </View>
            ) : (
              <Image
                source={avatarUrl ? { uri: avatarUrl } : require("../../assets/images/robomind_hero.png")}
                style={styles.avatar}
                contentFit="cover"
              />
            )}
            {isLoggedIn && (
              <View style={styles.homeEditAvatarBadge}>
                <Ionicons name="camera" size={8} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          
          <Pressable
            onPress={() => {
              if (isLoggedIn) {
                setEditName(childName);
                setNameModalVisible(true);
                setNameError("");
              }
            }}
            disabled={!isLoggedIn}
            style={({ pressed }) => [
              pressed && { opacity: 0.85 }
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={styles.greetingText}>Halo, {childName}! 👋</Text>
              {isLoggedIn && (
                <Ionicons name="pencil-sharp" size={12} color={COLORS.textMedium} style={{ opacity: 0.6, marginTop: 2 }} />
              )}
            </View>
            <Text style={styles.levelText}>Level 12 • Junior Explorer</Text>
          </Pressable>
        </View>
      </View>

      {/* Quick stats HUD row (coins, energy, gems) */}
      <View style={styles.hudRow}>
        <View style={styles.hudBadge}>
          <MaterialCommunityIcons name="coins" size={14} color="#F59E0B" />
          <Text style={[styles.hudBadgeText, { color: "#D97706" }]}>{userCoins.toLocaleString("id-ID")}</Text>
        </View>
        
        <View style={[styles.hudBadge, { backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" }]}>
          <Ionicons name="flash" size={14} color={COLORS.brandBlue} />
          <Text style={[styles.hudBadgeText, { color: COLORS.brandBlue }]}>85/100</Text>
        </View>
        
        <View style={[styles.hudBadge, { backgroundColor: "#FDF2F8", borderColor: "#FCE7F3" }]}>
          <Ionicons name="diamond" size={12} color="#EC4899" />
          <Text style={[styles.hudBadgeText, { color: "#DB2777" }]}>12</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >


        {/* Robot Section Placeholder Card */}
        <View style={styles.robotCardContainer}>
          <Robot3DView />
        </View>

        {/* Radar Chart Card (Skala Progress) */}
        <View style={styles.chartCard}>
          {/* Header Row */}
          <View style={styles.chartHeaderRow}>
            <Text style={styles.simulasiLabel}>LEVEL SIMULASI</Text>
            <View style={styles.syncBadge}>
              <View style={styles.syncDot} />
              <Text style={styles.syncBadgeText}>Auto-sync: Real-time</Text>
            </View>
          </View>

          {/* Level Selector Tabs */}
          <View style={styles.simChipsRow}>
            {(["Beginner", "Intermediate", "Advanced"] as SimulationLevel[]).map((level) => {
              const isActive = selectedLevel === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => setSelectedLevel(level)}
                  style={[styles.simTab, isActive && styles.simTabActive]}
                >
                  <Text style={[styles.simTabText, isActive && styles.simTabTextActive]}>
                    {level}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Robot Status Info */}
          <View style={styles.robotStatusRow}>
            <View style={styles.robotAvatarOuter}>
              <Image
                source={require("../../assets/images/robomind_hero.png")}
                style={styles.robotAvatarImg}
                contentFit="cover"
              />
            </View>
            <View style={styles.robotStatusTextContainer}>
              <Text style={styles.robotStatusTitle}>
                Status Robot: <Text style={styles.robotStatusHighlight}>{activeMetrics.status}</Text>
              </Text>
              <Text style={styles.robotStatusDesc}>{activeMetrics.desc}</Text>
            </View>
          </View>

          {/* Radar Chart Visual */}
          <View style={styles.svgWrapper}>
            <Svg width={230} height={230} viewBox="0 0 220 220">
              {gridPolygons.map((pts, idx) => (
                <Polygon
                  key={idx}
                  points={pts}
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
              ))}

              {[0, 1, 2, 3, 4].map((i) => {
                const end = getCoordinates(i, 1.0);
                return (
                  <Line
                    key={i}
                    x1={cx}
                    y1={cy}
                    x2={end.x}
                    y2={end.y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                );
              })}

              <Polygon
                points={valuePoints}
                fill="rgba(13, 148, 136, 0.15)"
                stroke="#0D9488"
                strokeWidth="2"
              />

              {[0, 1, 2, 3, 4].map((i) => {
                const { x, y } = getCoordinates(i, skillValues[i]);
                return (
                  <Circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="4.5"
                    fill="#F59E0B"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                );
              })}

              {axisLabels.map((lbl, idx) => {
                const { x, y } = getLabelCoordinates(idx);
                let textAnchor: any = "middle";
                if (idx === 1) textAnchor = "start";
                if (idx === 2) textAnchor = "start";
                if (idx === 3) textAnchor = "end";
                if (idx === 4) textAnchor = "end";
                
                return (
                  <SvgText
                    key={idx}
                    x={x}
                    y={idx === 0 ? y - 2 : y + 4}
                    fontSize="9"
                    fontWeight="700"
                    fill={COLORS.textMedium}
                    textAnchor={textAnchor}
                  >
                    {lbl}
                  </SvgText>
                );
              })}
            </Svg>
          </View>

          {/* Three Stat Cards */}
          <View style={styles.simMetricsRow}>
            <View style={styles.simMetricCard}>
              <Text style={styles.simMetricValue}>{activeMetrics.skills}</Text>
              <Text style={styles.simMetricLabel}>KETERAMPILAN{"\n"}TARGET</Text>
            </View>
            
            <View style={styles.simMetricCard}>
              <Text style={[styles.simMetricValue, { color: "#F59E0B" }]}>{activeMetrics.activities}</Text>
              <Text style={styles.simMetricLabel}>AKTIVITAS{"\n"}INTERAKTIF</Text>
            </View>

            <View style={styles.simMetricCard}>
              <Text style={[styles.simMetricValue, { color: "#0B84FF" }]}>{activeMetrics.curriculum}</Text>
              <Text style={styles.simMetricLabel}>UKURAN{"\n"}KURIKULUM</Text>
            </View>
          </View>
        </View>



        {/* Progress XP Bar Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressCardTitle}>Progress Hari ini</Text>
            <Text style={styles.xpText}>+120 XP</Text>
          </View>
          <View style={styles.xpBarContainer}>
            <View style={styles.xpBarWrapper}>
              <View style={[styles.xpBarFill, { width: "60%" }]} />
            </View>
            <MaterialCommunityIcons name="robot" size={18} color={COLORS.brandGreen} style={styles.robotIndicator} />
          </View>
        </View>

      </ScrollView>

      {/* Ubah Nama Modal */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.pencilIconCircle}>
              <Ionicons name="pencil" size={24} color={COLORS.brandGreen} />
            </View>
            
            <Text style={styles.modalTitle}>Ubah Nama Anak</Text>
            <Text style={styles.modalSubtitle}>
              Masukkan nama baru untuk mengubah panggilan anak di aplikasi.
            </Text>

            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Masukkan nama anak"
              placeholderTextColor={COLORS.textLight}
              style={styles.nameInput}
              autoCapitalize="words"
              maxLength={20}
              onSubmitEditing={handleSaveName}
            />

            {nameError ? (
              <Text style={styles.errorText}>{nameError}</Text>
            ) : null}

            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalBtn, styles.modalBtnSecondary]} 
                onPress={() => setNameModalVisible(false)}
                disabled={isSavingName}
              >
                <Text style={styles.modalBtnTextSecondary}>Batal</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.modalBtn, styles.modalBtnPrimary]} 
                onPress={handleSaveName}
                disabled={isSavingName}
              >
                {isSavingName ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnTextPrimary}>Simpan</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.bgPrimary,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarOutline: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: `${COLORS.brandBlue}25`,
    padding: 2,
    marginRight: SPACING.md,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
  greetingText: {
    ...FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.textDark,
  },
  levelText: {
    ...FONTS.caption,
    fontSize: 11,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  hudRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  hudBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FFEDD5",
    borderRadius: SHAPES.radiusMd,
    paddingVertical: 6,
    gap: 4,
    ...SHADOWS.light,
  },
  hudBadgeText: {
    ...FONTS.bodyBold,
    fontSize: 12,
  },
  scrollContent: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  robotHeroContainer: {
    height: 200,
    borderRadius: SHAPES.radiusXl,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.xl,
    ...SHADOWS.medium,
  },
  heroBackground: {
    width: "100%",
    height: "100%",
    opacity: 0.85,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  robotModel: {
    width: 140,
    height: 140,
  },
  petBadge: {
    position: "absolute",
    bottom: SPACING.md,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingVertical: 4,
    paddingHorizontal: SPACING.md,
    borderRadius: SHAPES.radiusRound,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  petBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  missionsCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: SHAPES.radiusLg,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.light,
  },
  missionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  missionsTitle: {
    ...FONTS.subheading,
    fontSize: 15,
    color: COLORS.textDark,
  },
  missionsCounter: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.brandGreen,
  },
  missionsList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bgPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: SHAPES.radiusMd,
    padding: SPACING.md,
  },
  missionRowCompleted: {
    borderColor: `${COLORS.brandGreen}30`,
    backgroundColor: "#F0FDF4",
  },
  missionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  missionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  missionText: {
    ...FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textDark,
  },
  missionTextCompleted: {
    color: COLORS.textMedium,
  },
  emptyCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textLight,
  },
  playBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.brandGreen,
    borderRadius: SHAPES.radiusRound,
    paddingVertical: SPACING.md,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.light,
  },
  playBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  playBtnText: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: "#FFFFFF",
  },
  robotCardContainer: {
    width: "100%",
    marginBottom: SPACING.md,
  },
  chartCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: SHAPES.radiusLg,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    padding: SPACING.lg,
    alignItems: "center",
    marginBottom: SPACING.xl,
    ...SHADOWS.light,
  },
  chartHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: SPACING.md,
  },
  simulasiLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0F766E",
    letterSpacing: 0.5,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: SHAPES.radiusRound,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    gap: 4,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  syncBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.textMedium,
  },
  simChipsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    width: "100%",
    marginBottom: SPACING.md,
  },
  simTab: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: SHAPES.radiusRound,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  simTabActive: {
    backgroundColor: "#0D9488",
    borderColor: "#0D9488",
  },
  simTabText: {
    ...FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.textMedium,
  },
  simTabTextActive: {
    color: "#FFFFFF",
  },
  robotStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: SHAPES.radiusLg,
    padding: SPACING.md,
    width: "100%",
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  robotAvatarOuter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#0D9488",
    padding: 2,
    backgroundColor: "#E0F2FE",
  },
  robotAvatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 25,
  },
  robotStatusTextContainer: {
    flex: 1,
  },
  robotStatusTitle: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  robotStatusHighlight: {
    color: "#F59E0B",
  },
  robotStatusDesc: {
    ...FONTS.bodyRegular,
    fontSize: 10,
    color: COLORS.textMedium,
    lineHeight: 14,
  },
  svgWrapper: {
    justifyContent: "center",
    alignItems: "center",
    marginVertical: SPACING.sm,
  },
  simMetricsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    width: "100%",
    marginTop: SPACING.md,
  },
  simMetricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: SHAPES.radiusMd,
    paddingVertical: SPACING.md,
    paddingHorizontal: 6,
    alignItems: "center",
    ...SHADOWS.light,
  },
  simMetricValue: {
    ...FONTS.heading,
    fontSize: 18,
    color: "#0D9488",
    marginBottom: 2,
  },
  simMetricLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: COLORS.textLight,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  progressCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: SHAPES.radiusLg,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.light,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  progressCardTitle: {
    ...FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textDark,
  },
  xpText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.brandGreen,
  },
  xpBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    paddingRight: 24,
  },
  xpBarWrapper: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: COLORS.brandGreen,
    borderRadius: 4,
  },
  robotIndicator: {
    position: "absolute",
    right: 0,
  },
  
  // Modal & Edit Name Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  modalContent: {
    backgroundColor: COLORS.cardWhite,
    width: "100%",
    maxWidth: 320,
    borderRadius: SHAPES.radiusXl,
    padding: SPACING.xl + 4,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    ...SHADOWS.medium,
  },
  pencilIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#DCFCE7",
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...FONTS.subheading,
    fontSize: 16,
    color: COLORS.textDark,
    textAlign: "center",
    marginBottom: 6,
  },
  modalSubtitle: {
    ...FONTS.bodyRegular,
    fontSize: 11,
    color: COLORS.textMedium,
    textAlign: "center",
    lineHeight: 15,
    marginBottom: SPACING.lg,
  },
  nameInput: {
    backgroundColor: COLORS.bgPrimary,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: SHAPES.radiusMd,
    width: "100%",
    height: 45,
    textAlign: "left",
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: 10,
    color: COLORS.error,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  modalButtons: {
    flexDirection: "row",
    width: "100%",
    gap: SPACING.md,
  },
  modalBtn: {
    flex: 1,
    height: 40,
    borderRadius: SHAPES.radiusRound,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnPrimary: {
    backgroundColor: COLORS.brandGreen,
  },
  modalBtnSecondary: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  modalBtnTextPrimary: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalBtnTextSecondary: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMedium,
  },
  homeEditAvatarBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.brandGreen,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
});
