import { data, redirect, type ActionFunctionArgs } from "react-router";
import { useActionData, Form, useSearchParams } from "react-router";
import { getDB, ensureUsersTable } from "~/lib/db.server";
import { hashPassword } from "~/lib/auth.server";
import { createSessionCookie } from "~/lib/session.server";

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

  const user = await DB.prepare(
    "SELECT id, password_hash, password_salt FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ id: string; password_hash: string; password_salt: string }>();

  if (!user) {
    return data(
      { ok: false, error: "Credenciales inválidas." },
      { status: 401 }
    );
  }

  const { hash } = await hashPassword(password, user.password_salt);
  if (hash !== user.password_hash) {
    return data(
      { ok: false, error: "Credenciales inválidas." },
      { status: 401 }
    );
  }

  const secret = String(env.SESSION_SECRET || "");
  const cookie = await createSessionCookie(user.id, secret);
  return redirect("/me", { headers: { "Set-Cookie": cookie } });
}

export default function Login() {
  const actionData = useActionData<typeof action>() as any;
  const [params] = useSearchParams();
  const registered = params.get("registered") === "1";

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
      {registered && (
        <div className="text-green-700 bg-green-50 border border-green-200 rounded p-2 text-sm">
          Registro exitoso. Ahora puedes iniciar sesión.
        </div>
      )}
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
          Entrar
        </button>
      </Form>
      <div className="text-sm">
        ¿No tienes cuenta?{" "}
        <a href="/auth/register" className="text-blue-600 underline">
          Regístrate
        </a>
      </div>
    </div>
  );
}
