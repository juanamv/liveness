import { data, redirect, type ActionFunctionArgs } from "react-router";
import { useActionData, Form } from "react-router";
import { getDB, ensureUsersTable } from "~/lib/db.server";
import { hashPassword, uuidv4 } from "~/lib/auth.server";

export async function action({ request, context }: ActionFunctionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") || "");

  if (!email || !password) {
    return data(
      { ok: false, error: "Email y contraseña son requeridos." },
      { status: 400 }
    );
  }

  const env = (context as any).cloudflare?.env ?? {};
  const DB = getDB(env);
  await ensureUsersTable(DB);

  const exists = await DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (exists) {
    return data(
      { ok: false, error: "El email ya está registrado." },
      { status: 409 }
    );
  }

  const { salt, hash } = await hashPassword(password);
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  await DB.prepare(
    "INSERT INTO users (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, email, hash, salt, createdAt)
    .run();

  return redirect("/auth/login?registered=1");
}

export default function Register() {
  const actionData = useActionData<typeof action>() as any;
  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <Form method="post" className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Correo</label>
          <input
            name="email"
            type="email"
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Contraseña</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        {actionData?.error && (
          <div className="text-red-600 text-sm">{actionData.error}</div>
        )}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded px-4 py-2"
        >
          Registrarme
        </button>
      </Form>
      <div className="text-sm">
        ¿Ya tienes cuenta?{" "}
        <a href="/auth/login" className="text-blue-600 underline">
          Inicia sesión
        </a>
      </div>
    </div>
  );
}
