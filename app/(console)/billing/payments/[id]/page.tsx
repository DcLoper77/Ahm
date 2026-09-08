"use client";

import { useParams } from "next/navigation";
import { BillingDetailPage } from "@/components/billing/billing-pages";

export default function PaymentDetailRoute() {
  const params = useParams<{ id: string }>();
  return <BillingDetailPage kind="payments" id={params.id} />;
}
