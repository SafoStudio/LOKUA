import type { Request, Response } from 'express';
import type { ReviewPageQuery } from '../../application/ports/event-review.repository.js';
import type { EventReviewsUseCase } from '../../application/use-cases/event-reviews.use-case.js';
import { toEventContext } from './event-context.js';
import type { CreateReviewBody, EditReviewBody, ReviewParams } from './event-review.schema.js';
import { toReviewPageView, toReviewView } from './event-review.view.js';

export function createEventReviewController(reviews: EventReviewsUseCase) {
  function historyView(history: Awaited<ReturnType<EventReviewsUseCase['listOrganizerHistory']>>) {
    return {
      data: history.items.map((event) => ({
        id: event.id,
        title: event.title,
        categoryId: event.categoryId,
        coverUrl: event.coverUrl,
        format: event.format,
        ageRestriction: event.ageRestriction,
        firstStartsAt: event.firstStartsAt,
        firstEndsAt: event.firstEndsAt
      })),
      pagination: { nextCursor: history.nextCursor, hasMore: history.nextCursor !== null }
    };
  }

  return {
    async listForEvent(req: Request, res: Response): Promise<void> {
      const { id } = req.params as { id: string };
      res.set('Cache-Control', 'private, no-store');
      const query = req.query as unknown as ReviewPageQuery;
      const page = await reviews.listForEvent(id, req.user ?? null, query);
      res.json(toReviewPageView(page));
    },

    async listForOrganizer(req: Request, res: Response): Promise<void> {
      const { id } = req.params as { id: string };
      res.set('Cache-Control', 'private, no-store');
      const query = req.query as unknown as ReviewPageQuery;
      const page = await reviews.listForOrganizer(id, req.user ?? null, query);
      res.json(toReviewPageView(page));
    },

    async profile(req: Request, res: Response): Promise<void> {
      const { id } = req.params as { id: string };
      res.set('Cache-Control', 'private, no-store');
      const {
        profile,
        age,
        rating,
        reviews: page,
        history
      } = await reviews.profile(id, req.user ?? null);
      res.json({
        data: {
          id: profile.id,
          name: profile.name,
          age,
          avatarUrl: profile.avatarUrl,
          photoUrls: profile.photoUrls ?? (profile.avatarUrl ? [profile.avatarUrl] : []),
          ...rating,
          reviews: toReviewPageView(page),
          history: historyView(history)
        }
      });
    },

    async listOrganizerHistory(req: Request, res: Response): Promise<void> {
      const { id } = req.params as { id: string };
      const query = req.query as unknown as ReviewPageQuery;
      res.set('Cache-Control', 'private, no-store');
      res.json(historyView(await reviews.listOrganizerHistory(id, req.user ?? null, query)));
    },

    async create(req: Request, res: Response): Promise<void> {
      const { id } = req.params as { id: string };
      const { rating, text } = req.body as CreateReviewBody;
      const review = await reviews.create(toEventContext(req).user, id, rating, text ?? null);
      res.status(201).json({ data: toReviewView(review) });
    },

    async reply(req: Request, res: Response): Promise<void> {
      const { id, reviewId } = req.params as ReviewParams;
      const { text } = req.body as { text: string };
      const review = await reviews.reply(toEventContext(req).user, id, reviewId, text);
      res.json({ data: toReviewView(review) });
    },

    async edit(req: Request, res: Response): Promise<void> {
      const { id, reviewId } = req.params as ReviewParams;
      const review = await reviews.edit(
        toEventContext(req).user,
        id,
        reviewId,
        req.body as EditReviewBody
      );
      res.json({ data: toReviewView(review) });
    },

    async pin(req: Request, res: Response): Promise<void> {
      const { id, reviewId } = req.params as ReviewParams;
      const { isPinned } = req.body as { isPinned: boolean };
      const review = await reviews.pin(toEventContext(req).user, id, reviewId, isPinned);
      res.json({ data: toReviewView(review) });
    }
  };
}

export type EventReviewController = ReturnType<typeof createEventReviewController>;
