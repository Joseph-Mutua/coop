import { TooltipProvider } from '@/coop-ui/Tooltip';
import { render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import ManualReviewQueuesDashboard from './ManualReviewQueuesDashboard';

let reviewableQueues: {
  id: string;
  name: string;
  description: string | null;
  pendingJobCount: number;
  hasUnskippedJobs: boolean;
  oldestJobCreatedAt: string | null;
  isDefaultQueue: boolean;
  isAppealsQueue: boolean;
}[] = [];

vi.mock('../../../graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../graphql/generated')>()),
  useGQLManualReviewQueuesQuery: () => ({
    loading: false,
    error: undefined,
    refetch: vi.fn(),
    data: {
      myOrg: { hasAppealsEnabled: true, previewJobsViewEnabled: false },
      me: {
        id: 'user-1',
        permissions: [],
        favoriteMRTQueues: [],
        reviewableQueues,
      },
    },
  }),
  useGQLGetResolvedJobsForUserQuery: () => ({ data: undefined }),
  useGQLGetSkippedJobsForUserQuery: () => ({ data: undefined }),
  useGQLRoutingRulesQuery: () => ({ data: undefined }),
  useGQLAddFavoriteMrtQueueMutation: () => [vi.fn()],
  useGQLRemoveFavoriteMrtQueueMutation: () => [vi.fn()],
  useGQLDeleteManualReviewQueueMutation: () => [vi.fn()],
  useGQLDeleteAllJobsFromQueueMutation: () => [vi.fn()],
}));

function appealsQueue(pendingJobCount: number) {
  return {
    id: 'appeals-queue',
    name: 'Appeals Queue',
    description: null,
    pendingJobCount,
    hasUnskippedJobs: pendingJobCount > 0,
    oldestJobCreatedAt: null,
    isDefaultQueue: false,
    isAppealsQueue: true,
  };
}

function reportsQueue(pendingJobCount: number) {
  return {
    ...appealsQueue(pendingJobCount),
    id: 'reports-queue',
    name: 'Reports Queue',
    isAppealsQueue: false,
  };
}

function renderDashboard() {
  return render(
    <HelmetProvider>
      <TooltipProvider>
        <MemoryRouter>
          <ManualReviewQueuesDashboard />
        </MemoryRouter>
      </TooltipProvider>
    </HelmetProvider>,
  );
}

describe('ManualReviewQueuesDashboard appeals tab indicator', () => {
  it('shows a dot on the Appeals tab when an appeals queue has pending jobs', () => {
    reviewableQueues = [appealsQueue(3)];
    renderDashboard();
    const appealsTab = screen.getByRole('tab', { name: /Appeals$/ });
    expect(
      within(appealsTab).getByRole('img', { name: 'Pending appeals' }),
    ).toBeInTheDocument();
  });

  it('hides the dot when only non-appeals queues have pending jobs', () => {
    reviewableQueues = [appealsQueue(0), reportsQueue(5)];
    renderDashboard();
    expect(screen.getByRole('tab', { name: 'Appeals' })).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Pending appeals' }),
    ).not.toBeInTheDocument();
  });
});

describe('ManualReviewQueuesDashboard review eligibility', () => {
  it('disables reviewing an empty queue', () => {
    reviewableQueues = [reportsQueue(0)];
    renderDashboard();
    expect(
      screen.getByRole('button', { name: 'Start Reviewing' }),
    ).toBeDisabled();
  });

  it('disables reviewing when all pending jobs are skipped by this reviewer', () => {
    reviewableQueues = [{ ...reportsQueue(3), hasUnskippedJobs: false }];
    renderDashboard();
    expect(
      screen.getByRole('button', { name: 'Start Reviewing' }),
    ).toBeDisabled();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('enables reviewing when an unskipped job remains', () => {
    reviewableQueues = [reportsQueue(3)];
    renderDashboard();
    expect(
      screen.getByRole('button', { name: 'Start Reviewing' }),
    ).toBeEnabled();
  });

  it('updates eligibility when polling finds a new job or expired skip', () => {
    reviewableQueues = [{ ...reportsQueue(3), hasUnskippedJobs: false }];
    const { rerender } = renderDashboard();
    expect(
      screen.getByRole('button', { name: 'Start Reviewing' }),
    ).toBeDisabled();
    reviewableQueues = [reportsQueue(3)];
    rerender(
      <HelmetProvider>
        <TooltipProvider>
          <MemoryRouter>
            <ManualReviewQueuesDashboard />
          </MemoryRouter>
        </TooltipProvider>
      </HelmetProvider>,
    );
    expect(
      screen.getByRole('button', { name: 'Start Reviewing' }),
    ).toBeEnabled();
  });
});
