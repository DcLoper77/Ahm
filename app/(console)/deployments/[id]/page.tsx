"use client";

import { useParams } from "next/navigation";
import { DeploymentDetailPage } from "@/components/infra/deployment-pages";

export default function DeploymentDetailRoute() {
  const params = useParams<{ id: string }>();
  return <DeploymentDetailPage id={params.id} />;
}
