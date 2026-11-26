import type { EntityManager } from 'typeorm';
import type { ReportObjectType } from '../../../domain/index.js';
import type { AgeRestriction } from '../../../../../common/index.js';

export type ContentType = Exclude<ReportObjectType, 'PROFILE'>;

const contentTables = {
  EVENT: 'events',
  COMMENT: 'discussion_comments',
  REVIEW: 'event_reviews'
} as const;

export interface ModerationTarget {
  id: string;
  ownerId: string;
  eventId: string | null;
  organizerId: string | null;
  eventStatus: string | null;
  ageRestriction: AgeRestriction | null;
  eventHidden: boolean;
  visible: boolean;
  content: Record<string, unknown>;
}

export async function readModerationTarget(
  manager: EntityManager,
  type: ReportObjectType,
  id: string
): Promise<ModerationTarget | undefined> {
  if (type === 'PROFILE') {
    const [row] = await manager.query<ModerationTarget[]>(
      `SELECT profile.id, profile.id AS "ownerId", NULL AS "eventId", NULL AS "organizerId",
              NULL AS "eventStatus", NULL AS "ageRestriction", false AS "eventHidden",
              profile.status NOT IN ('PENDING_DELETION', 'DELETED') AS visible,
              jsonb_build_object(
                'name', profile.name, 'status', profile.status, 'bio', profile.bio,
                'socialLinks', profile.social_links, 'photos', COALESCE((
                  SELECT jsonb_agg(photo.url ORDER BY photo.is_primary DESC, photo.order_num, photo.id)
                  FROM user_photos photo WHERE photo.user_id = profile.id
                ), '[]'::jsonb)
              ) AS content
       FROM users profile WHERE profile.id = $1`,
      [id]
    );
    return row;
  }

  const source =
    type === 'EVENT'
      ? {
          join: '',
          owner: 'event.organizer_id',
          visible: 'true',
          content:
            "jsonb_build_object('title', event.title, 'description', event.description, 'status', event.status, 'isHiddenByAdmin', event.is_hidden_by_admin)"
        }
      : type === 'COMMENT'
        ? {
            join: 'JOIN discussion_comments target ON target.event_id = event.id LEFT JOIN discussion_comments parent ON parent.id = target.parent_id',
            owner: 'target.author_id',
            visible: `event.status IN ('PUBLISHED', 'FULL') AND event.first_ends_at > now()
            AND NOT target.is_hidden_by_admin AND NOT target.is_archived
            AND (target.parent_id IS NULL OR (parent.event_id = event.id AND NOT parent.is_archived AND NOT parent.is_hidden_by_admin))`,
            content:
              "jsonb_build_object('text', target.text, 'parentId', target.parent_id, 'isHiddenByAdmin', target.is_hidden_by_admin, 'isArchived', target.is_archived)"
          }
        : {
            join: 'JOIN event_reviews target ON target.event_id = event.id',
            owner: 'target.author_id',
            visible: "NOT target.is_hidden_by_admin AND event.status = 'COMPLETED'",
            content:
              "jsonb_build_object('text', target.text, 'rating', target.rating, 'organizerReply', target.organizer_reply, 'isHiddenByAdmin', target.is_hidden_by_admin)"
          };
  const targetId = type === 'EVENT' ? 'event.id' : 'target.id';
  const [row] = await manager.query<ModerationTarget[]>(
    `SELECT ${targetId} AS id, ${source.owner} AS "ownerId", event.id AS "eventId",
            event.organizer_id AS "organizerId", event.status AS "eventStatus",
            event.age_restriction AS "ageRestriction", event.is_hidden_by_admin AS "eventHidden",
            (${source.visible}) AS visible, ${source.content} AS content
     FROM events event ${source.join}
     WHERE ${targetId} = $1`,
    [id]
  );
  return row;
}

export async function setModerationVisibility(
  manager: EntityManager,
  type: ContentType,
  id: string,
  eventId: string,
  hidden: boolean
): Promise<boolean | undefined> {
  const [event] = await manager.query<{ id: string }[]>(
    'SELECT id FROM events WHERE id = $1 FOR UPDATE',
    [eventId]
  );
  if (!event) return undefined;
  const table = contentTables[type];
  const [target] = await manager.query<{ is_hidden_by_admin: boolean }[]>(
    `SELECT is_hidden_by_admin FROM ${table} WHERE id = $1 FOR UPDATE`,
    [id]
  );
  if (!target) return undefined;
  if (target.is_hidden_by_admin !== hidden) {
    await manager.query(
      `UPDATE ${table} SET is_hidden_by_admin = $2, updated_at = now() WHERE id = $1`,
      [id, hidden]
    );
  }
  return target.is_hidden_by_admin;
}
