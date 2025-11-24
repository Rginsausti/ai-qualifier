import { createClient } from "@/lib/supabase/server";
import { getUserProfile, calculateStreak, getDailyStats } from "@/lib/actions";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dailyPlan = null;
  let streak = 0;
  let dailyStats = null;

  if (user) {
    const profile = await getUserProfile(user.id);
    if (!profile) {
      redirect("/onboarding");
    }

    // Fetch today's plan
    const today = new Date().toISOString().split("T")[0];
    const { data: planData } = await supabase
      .from("daily_plans")
      .select("content")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();
    
    if (planData) {
      dailyPlan = planData.content;
    }

    // Calculate streak
    streak = await calculateStreak(user.id);

    // Fetch daily stats
    dailyStats = await getDailyStats(user.id);
  }

  return <DashboardClient dailyPlan={dailyPlan} streak={streak} dailyStats={dailyStats} />;
}
