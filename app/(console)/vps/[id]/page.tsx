"use client";

import { useParams } from "next/navigation";
import { InfraDetailPage } from "@/components/infra/resource-page";

export default function VpsDetailRoute() {
  const params = useParams<{ id: string }>();
  return <InfraDetailPage kind="vps" id={params.id} />;
}
