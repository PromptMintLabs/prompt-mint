export interface CollaborationNotesUpdate {
  collaborationNotes: string;
  collaborationNotesUpdatedAt: Date;
  collaborationNotesUpdatedBy: string | null;
}

interface CollaborationNotesInput {
  notes: unknown;
  updatedBy?: string | null;
  now?: Date;
}

const MAX_COLLABORATION_NOTES_LENGTH = 5000;

export function buildCollaborationNotesUpdate({
  notes,
  updatedBy = null,
  now = new Date(),
}: CollaborationNotesInput): CollaborationNotesUpdate {
  if (typeof notes !== "string") {
    throw new Error("notes must be a string");
  }

  const normalizedNotes = notes.trim();
  if (normalizedNotes.length > MAX_COLLABORATION_NOTES_LENGTH) {
    throw new Error(`notes must be ${MAX_COLLABORATION_NOTES_LENGTH} characters or fewer`);
  }

  return {
    collaborationNotes: normalizedNotes,
    collaborationNotesUpdatedAt: now,
    collaborationNotesUpdatedBy: updatedBy?.trim().toLowerCase() || null,
  };
}