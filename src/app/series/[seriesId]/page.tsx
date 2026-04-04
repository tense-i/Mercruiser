import { notFound } from "next/navigation";
import { buildSeriesDetailView } from "@/server/mvp/ui-views";
import { SeriesDetailClient } from "./series-detail-client";

type PageProps = {
  params: Promise<{ seriesId: string }>;
};

export default async function SeriesDetailPage({ params }: PageProps) {
  const { seriesId } = await params;
  const series = buildSeriesDetailView(seriesId);

  if (!series) {
    notFound();
  }

  return <SeriesDetailClient series={series} />;
}
