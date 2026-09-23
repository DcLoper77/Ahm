"use client";

import { useParams } from "next/navigation";
import { DatabaseDetailPage } from "@/components/infra/database-pages";

export default function DatabaseDetailRoute() {
  const params = useParams<{ id: string }>();
  return <DatabaseDetailPage id={params.id} />;
}
