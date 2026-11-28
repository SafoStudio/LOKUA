import type { ReportObjectType } from '../types/report-object-type.js';
import type { ReportStatus } from '../types/report-status.js';

export interface ModerationReport {
  id: string;
  reporterId: string;
  objectType: ReportObjectType;
  objectId: string;
  reason: string;
  text: string;
  status: ReportStatus;
  assignedModeratorId: string | null;
  resolutionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
