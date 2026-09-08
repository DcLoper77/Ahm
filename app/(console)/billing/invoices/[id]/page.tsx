"use client";

import { useParams } from "next/navigation";
import { BillingDetailPage } from "@/components/billing/billing-pages";

export default function InvoiceDetailRoute() {
  const params = useParams<{ id: string }>();
  return <BillingDetailPage kind="invoices" id={params.id} />;
}
