import { notFound } from "next/navigation";
import { getSeriesById } from "@/lib/mock-data";
import { SeriesDetailClient } from "./series-detail-client";

type PageProps = {
  params: Promise<{ seriesId: string }>;
};

export default async function SeriesDetailPage({ params }: PageProps) {
  const { seriesId } = await params;
  const series = getSeriesById(seriesId);

  if (!series) {
    notFound();
  }

  return <SeriesDetailClient series={series} />;
}