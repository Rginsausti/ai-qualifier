import { LoginForm } from "@/components/login-form";
import { LanguageSwitcher } from "@/components/language-switcher";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ingresá a Alma",
  description: "Prototipo de login con Supabase Auth",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f6f3ec] px-4 py-12 sm:px-8">
      <div className="mx-auto max-w-2xl flex flex-col gap-8">
        <div className="flex justify-end">
          <LanguageSwitcher variant="minimal" />
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
