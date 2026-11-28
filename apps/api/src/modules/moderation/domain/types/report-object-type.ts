export type ReportObjectType = 'EVENT' | 'COMMENT' | 'REVIEW' | 'PROFILE';
export type ContentType = Exclude<ReportObjectType, 'PROFILE'>;
