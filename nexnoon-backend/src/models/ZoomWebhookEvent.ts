import mongoose, { Document, Schema } from 'mongoose';

/**
 * Dedup record for processed Zoom webhook deliveries. Zoom retries webhooks that
 * don't return 2xx quickly, so every event is recorded here (unique index) before
 * being acted on - a duplicate delivery short-circuits to a safe 200 without
 * re-applying the event.
 */
export interface IZoomWebhookEvent extends Document {
  eventId: string;
  eventType: string;
  receivedAt: Date;
}

const ZoomWebhookEventSchema = new Schema<IZoomWebhookEvent>({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  receivedAt: { type: Date, default: Date.now },
});

// Hygiene only: processed-event rows are not needed past Zoom's own retry window.
ZoomWebhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 });

export const ZoomWebhookEventModel = mongoose.model<IZoomWebhookEvent>(
  'ZoomWebhookEvent',
  ZoomWebhookEventSchema
);
