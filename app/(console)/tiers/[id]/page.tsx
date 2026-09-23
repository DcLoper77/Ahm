import { CustomTierDetailPage } from "@/components/tiers-pages";

export default async function TierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomTierDetailPage id={id} />;
}
