import { Schema, model, type InferSchemaType } from "mongoose";

// Admin-managed list of book categories. Books reference a category by its
// name (Book.category is a free string), so this collection is the curated
// list the admin picks from / adds to.
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80, unique: true, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type CategoryDocument = InferSchemaType<typeof categorySchema>;
export const Category = model("Category", categorySchema);

// Starter categories for the ARADO library (admins can add/remove more).
const DEFAULT_CATEGORIES = [
  "القيادة",
  "الإدارة",
  "التنمية الإدارية",
  "الموارد البشرية",
  "التحول الرقمي",
  "التخطيط الاستراتيجي"
];

/** Seed the default category list once (no-op if any category already exists). */
export async function seedDefaultCategories(): Promise<void> {
  if (await Category.estimatedDocumentCount()) {
    return;
  }
  await Category.insertMany(
    DEFAULT_CATEGORIES.map((name) => ({ name })),
    { ordered: false }
  ).catch(() => undefined);
}
