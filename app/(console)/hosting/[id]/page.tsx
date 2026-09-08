"use client";

import { useParams } from "next/navigation";
import { InfraDetailPage } from "@/components/infra/resource-page";

export default function HostingDetailRoute() {
  const params = useParams<{ id: string }>();
  return <InfraDetailPage kind="hosting" id={params.id} />;
}
