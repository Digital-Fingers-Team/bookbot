import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A single browser's Web Push registration. One user can have several — a
 * phone, a laptop, a second browser — so the endpoint, not the user, is the
 * unique key. Push services hand us a permanent 404/410 once a registration
 * dies; `prunePushSubscription` deletes those rather than retrying forever.
 */
const pushSubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 1000 },
    keys: {
      p256dh: { type: String, required: true, maxlength: 200 },
      auth: { type: String, required: true, maxlength: 100 }
    },
    userAgent: { type: String, trim: true, maxlength: 300 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type PushSubscriptionDocument = InferSchemaType<typeof pushSubscriptionSchema>;
export const PushSubscription = model("PushSubscription", pushSubscriptionSchema);
