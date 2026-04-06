import { NextResponse } from 'next/server';

import { studioRepository, StudioCommandConflictError } from '@/lib/server/repository/studio-repository';
import { assertLocalMutationRequest } from '@/lib/server/request-guard';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get('episodeId');
  const seriesId = searchParams.get('seriesId');
  const view = searchParams.get('view');

  if (episodeId) {
    const episodeView = await studioRepository.getEpisodeWorkspaceView(episodeId);
    if (!episodeView) {
      return NextResponse.json({ ok: false, error: 'Episode not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, episodeView });
  }

  if (seriesId) {
    const seriesView = await studioRepository.getSeriesView(seriesId);
    if (!seriesView) {
      return NextResponse.json({ ok: false, error: 'Series not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, seriesView });
  }

  if (view === 'tasks') {
    const workspace = await studioRepository.getWorkspace();
    return NextResponse.json({ ok: true, tasks: workspace.tasks });
  }

  if (view === 'settings') {
    const workspace = await studioRepository.getWorkspace();
    return NextResponse.json({ ok: true, settings: workspace.settings, usageAlerts: workspace.usageAlerts, presets: workspace.generationPresets });
  }

  return NextResponse.json({ ok: true, dashboard: await studioRepository.getDashboardView() });
}

export async function POST(request: Request) {
  const guard = assertLocalMutationRequest(request);
  if (guard) {
    return guard;
  }

  try {
    const body = await request.json();
    const result = await studioRepository.dispatch(body.command);
    const response: Record<string, unknown> = { ok: true, result };

    if (body.context?.episodeId) {
      response.episodeView = await studioRepository.getEpisodeWorkspaceView(body.context.episodeId);
    }

    if (body.context?.seriesId) {
      response.seriesView = await studioRepository.getSeriesView(body.context.seriesId);
    }

    if (body.context?.refreshSettings) {
      const workspace = await studioRepository.getWorkspace();
      response.settings = workspace.settings;
      response.usageAlerts = workspace.usageAlerts;
      response.presets = workspace.generationPresets;
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof StudioCommandConflictError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          expectedRevision: error.expectedRevision,
          actualRevision: error.actualRevision,
          entityId: error.entityId,
          entityType: error.entityType,
        },
        { status: error.statusCode },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: false, error: 'Unknown studio command failure' }, { status: 500 });
  }
}
