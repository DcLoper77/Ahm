"use client";

import { useParams } from "next/navigation";
import { InfraDetailPage } from "@/components/infra/resource-page";

export default function DomainDetailRoute() {
  const params = useParams<{ id: string }>();
  return <InfraDetailPage kind="domains" id={params.id} />;
}
