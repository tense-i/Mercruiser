import { notFound } from 'next/navigation';

import { SeriesDetail } from '@/components/series/series-detail';
import { studioRepository } from '@/lib/server/repository/studio-repository';

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  const view = await studioRepository.getSeriesView(seriesId);

  if (!view) {
    notFound();
  }

  return <SeriesDetail view={view} />;
}
