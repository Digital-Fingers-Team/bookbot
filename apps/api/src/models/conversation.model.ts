import { Schema, model, type InferSchemaType } from "mongoose";

const sourceSchema = new Schema(
  {
    bookId: { type: String },
    bookName: { type: String },
    pageNumber: { type: Number },
    supportingText: { type: String }
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, default: "" },
    sources: { type: [sourceSchema], default: [] }
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Set for the in-book assistant; null/absent for the main chat history.
    bookId: { type: Schema.Types.ObjectId, ref: "Book", default: null },
    title: { type: String, default: "محادثة جديدة" },
    messages: { type: [messageSchema], default: [] }
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, updatedAt: -1 });
conversationSchema.index({ userId: 1, bookId: 1 });

export type ConversationDocument = InferSchemaType<typeof conversationSchema>;
export const Conversation = model("Conversation", conversationSchema);
