import { AppShell } from "@/components/console/app-shell";

export default function ConsoleLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
