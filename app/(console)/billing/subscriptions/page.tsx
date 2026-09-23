import { BillingListPage } from "@/components/billing/billing-pages";

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ org_id?: string | string[] }>;
}) {
  const query = await searchParams;
  const initialOrgId = Array.isArray(query.org_id) ? (query.org_id[0] ?? "") : (query.org_id ?? "");
  return <BillingListPage kind="subscriptions" initialOrgId={initialOrgId} />;
}
