import { LoadingState } from "@/components/ui";

export default function Loading() {
  return (
    <main className="route-fallback">
      <LoadingState label="Loading control panel…" />
    </main>
  );
}
