import React from "react";
import {
  Skeleton,
  SkeletonCard,
  SkeletonChart,
  SkeletonTable,
  SkeletonText,
} from "@/components/Skeleton";

/**
 * AnalyticsDashboardSkeleton
 *
 * Full-page loading placeholder for the creator analytics dashboard. Mirrors the
 * real layout: a 4-up stat-card row followed by a 2×2 grid of chart widgets so
 * the page doesn't reflow when the query resolves.
 */
export const AnalyticsDashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonChart height={256} />
        <SkeletonChart height={256} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonChart height={256} />
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-3 rounded-xl bg-white/5 p-4"
              >
                <Skeleton className="h-6 w-6 rounded-lg" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * TransactionHistorySkeleton
 *
 * Loading placeholder for the transaction history table/list. Uses a header +
 * data rows so width and spacing match the rendered history once it loads.
 */
export const TransactionHistorySkeleton: React.FC<{
  rows?: number;
}> = ({ rows = 6 }) => {
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label="Loading transaction history"
    >
      {[...Array(rows)].map((_, i) => (
        <SkeletonCard key={i} withMedia={false} lines={2} />
      ))}
    </div>
  );
};

/**
 * ProfileSkeleton
 *
 * Loading placeholder for the user profile page. Mirrors the hero header plus
 * the three primary tab panels (created / purchased / saved) so the layout is
 * stable while the wallet/creator queries are in flight.
 */
export const ProfileSkeleton: React.FC = () => {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading profile">
      <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <SkeletonCard key={i} withMedia={false} lines={2} />
        ))}
      </div>

      <SkeletonTable rows={4} columns={4} />
    </div>
  );
};
