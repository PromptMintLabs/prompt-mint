export interface ReportAssignmentUpdate {
  assignedReviewer: string | null;
  assignedAt: Date | null;
  assignedBy: string | null;
}

interface ReportAssignmentInput {
  reviewerAddress: unknown;
  assignedBy?: string | null;
  now?: Date;
}

export function buildReportAssignmentUpdate({
  reviewerAddress,
  assignedBy = null,
  now = new Date(),
}: ReportAssignmentInput): ReportAssignmentUpdate {
  if (reviewerAddress !== null && reviewerAddress !== undefined && typeof reviewerAddress !== "string") {
    throw new Error("reviewerAddress must be a string or null");
  }

  const normalizedReviewer = typeof reviewerAddress === "string"
    ? reviewerAddress.trim().toLowerCase()
    : "";

  if (normalizedReviewer.length > 128) {
    throw new Error("reviewerAddress must be 128 characters or fewer");
  }

  if (!normalizedReviewer) {
    return { assignedReviewer: null, assignedAt: null, assignedBy: null };
  }

  return {
    assignedReviewer: normalizedReviewer,
    assignedAt: now,
    assignedBy: assignedBy?.trim().toLowerCase() || null,
  };
}