"use client";

import { useParams } from "next/navigation";
import { InfraDetailPage } from "@/components/infra/resource-page";

export default function DatabaseDetailRoute() {
  const params = useParams<{ id: string }>();
  return <InfraDetailPage kind="databases" id={params.id} />;
}
