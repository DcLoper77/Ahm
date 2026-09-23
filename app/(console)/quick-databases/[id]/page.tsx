"use client";

import { useParams } from "next/navigation";
import { QuickDatabaseDetailPage } from "@/components/infra/quick-database-pages";

export default function QuickDatabaseDetailRoute() {
  const params = useParams<{ id: string }>();
  return <QuickDatabaseDetailPage id={params.id} />;
}
