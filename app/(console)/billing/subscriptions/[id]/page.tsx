"use client";

import { useParams } from "next/navigation";
import { BillingDetailPage } from "@/components/billing/billing-pages";

export default function SubscriptionDetailRoute() {
  const params = useParams<{ id: string }>();
  return <BillingDetailPage kind="subscriptions" id={params.id} />;
}
