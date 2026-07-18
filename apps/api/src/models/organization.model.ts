import { Schema, model, type InferSchemaType } from "mongoose";

// A university (or similar institution) that subscribes to a catalog of
// books/categories for its students. Students still pay the organization
// directly (outside this system) — an org admin then grants individual
// students access from this catalog once they've paid, mirroring how a
// platform admin grants access after an AccessRequest is approved.
const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    allowedBookIds: { type: [Schema.Types.ObjectId], ref: "Book", default: [] },
    allowedCategories: { type: [String], default: [] },
    // Per-book seat limit: how many students may be granted each book,
    // keyed by book id (what the org paid for per title). A book with no
    // entry here has no cap.
    bookQuotas: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type OrganizationDocument = InferSchemaType<typeof organizationSchema>;
export const Organization = model("Organization", organizationSchema);
