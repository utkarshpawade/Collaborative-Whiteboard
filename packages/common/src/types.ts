import { z } from "zod";

/**
 * The `username` field is stored in the unique `email` column, so it is
 * validated as an email address.
 */
export const CreateUserSchema = z.object({
  username: z.string().email("A valid email address is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required").max(50),
});

export const SigninSchema = z.object({
  username: z.string().email("A valid email address is required"),
  password: z.string().min(1, "Password is required"),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type SigninInput = z.infer<typeof SigninSchema>;
