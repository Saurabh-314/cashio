import { createHash } from "crypto";
import bcrypt from "bcryptjs";

export function emailKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function peppered(password: string): string {
  return `${process.env.AUTH_PEPPER ?? ""}${password}`;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(peppered(password), 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(peppered(password), passwordHash);
}
