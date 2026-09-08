"use client";

import { useParams } from "next/navigation";
import { BillingDetailPage } from "@/components/billing/billing-pages";

export default function RefundDetailRoute() {
  const params = useParams<{ id: string }>();
  return <BillingDetailPage kind="refunds" id={params.id} />;
}
