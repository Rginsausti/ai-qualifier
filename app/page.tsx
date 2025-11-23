import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/actions";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const profile = await getUserProfile(user.id);
    if (!profile) {
      redirect("/onboarding");
    }
  }

  return <DashboardClient />;
}
