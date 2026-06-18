import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "user"], required: true, default: "user" },
    language: { type: String, enum: ["en", "ar"], required: true, default: "en" }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type UserRole = "admin" | "user";
export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: unknown;
  role: UserRole;
};

export const User = model("User", userSchema);
