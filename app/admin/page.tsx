import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminAnalyticsClient } from "@/components/admin/AdminAnalyticsClient";
import { isAdminAppMetadata } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin Analytics",
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminAppMetadata(user)) {
    return (
      <main className="min-h-screen bg-[#f6f3ec] px-4 py-12 sm:px-8">
        <section className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white/90 p-8 shadow-xl shadow-rose-100">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-700">403 Forbidden</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">Admin access required</h1>
          <p className="mt-2 text-sm text-slate-600">
            You are signed in, but your account does not have admin permissions for this page.
          </p>
        </section>
      </main>
    );
  }

  return <AdminAnalyticsClient />;
}
