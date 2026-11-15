import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Db } from "@/lib/db";

export const COOKIE_SESION = "sesion";
export const DURACION_SESION_DIAS = 30;

export interface Usuario {
  id: number;
  email: string;
  plan: string;
}

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
}

export async function registrarUsuario(db: Db, emailCrudo: string, clave: string): Promise<Usuario | string> {
  const email = emailCrudo.trim().toLowerCase();
  if (!emailValido(email)) return "Revisá el email.";
  if (clave.length < 8) return "La contraseña tiene que tener al menos 8 caracteres.";
  const hash = await bcrypt.hash(clave, 10);
  const r = await db.query<Usuario>(
    `INSERT INTO usuarios (email, hash_clave) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id, email, plan`,
    [email, hash],
  );
  return r.rows[0] ?? "Ya hay una cuenta con ese email.";
}

export async function verificarClave(db: Db, emailCrudo: string, clave: string): Promise<Usuario | null> {
  const email = emailCrudo.trim().toLowerCase();
  const r = await db.query<Usuario & { hash_clave: string }>(
    `SELECT id, email, plan, hash_clave FROM usuarios WHERE email = $1`,
    [email],
  );
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(clave, u.hash_clave))) return null;
  return { id: u.id, email: u.email, plan: u.plan };
}

/** Crea una sesión y devuelve el token para la cookie. En la base solo queda su hash. */
export async function crearSesion(db: Db, usuarioId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO sesiones (token_hash, usuario_id, expira) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), usuarioId, DURACION_SESION_DIAS],
  );
  return token;
}

export async function usuarioDeToken(db: Db, token: string | undefined): Promise<Usuario | null> {
  if (!token) return null;
  const r = await db.query<Usuario>(
    `SELECT u.id, u.email, u.plan FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = $1 AND s.expira > now()`,
    [hashToken(token)],
  );
  return r.rows[0] ?? null;
}

export async function borrarSesion(db: Db, token: string | undefined): Promise<void> {
  if (token) await db.query(`DELETE FROM sesiones WHERE token_hash = $1`, [hashToken(token)]);
}

export function esAdmin(u: Usuario | null): boolean {
  if (!u) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return admins.includes(u.email);
}
