import React from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import CalorieProgressRing from "../components/CalorieProgressRing";
import MacroCard from "../components/MacroCard";
import WaterTracker from "../components/WaterTracker";
import StreakTracker from "../components/StreakTracker";

const TodayDashboard = () => {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <CalorieProgressRing caloriesConsumed={1345} calorieGoal={2100} />
      </View>

      <View style={[styles.section, styles.macrosRow]}>
        <MacroCard label="Proteínas" value={82} goal={110} unit="g" />
        <MacroCard label="Carbs" value={145} goal={220} unit="g" />
        <MacroCard label="Grasas" value={48} goal={65} unit="g" />
      </View>

      <View style={styles.section}>
        <WaterTracker totalGlasses={8} completedGlasses={5} />
      </View>

      <View style={styles.section}>
        <StreakTracker currentStreak={18} nextGoal={21} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf7e8",
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 2,
  },
  macrosRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
});

export default TodayDashboard;
