import type { Metadata } from "next";
import { InstallAppPageContent } from "@/components/install-app-page-content";

export const metadata: Metadata = {
  title: "Instalar app | Agente Alma",
  description: "Instala Agente Alma como app web en iPhone o Android.",
};

export default function InstallAppPage() {
  return <InstallAppPageContent />;
}
