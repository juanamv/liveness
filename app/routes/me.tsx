import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, useLoaderData, Form } from "react-router";
import { getDB } from "~/lib/db.server";
import { verifySessionCookie, serializeCookie } from "~/lib/session.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = (context as any).cloudflare?.env ?? {};
  const DB = getDB(env);
  const secret = String(env.SESSION_SECRET || "");

  const userId = await verifySessionCookie(request.headers.get("Cookie"), secret);
  if (!userId) return redirect("/auth/login");

  const user = await DB.prepare("SELECT id, email, created_at, liveness_completed FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; email: string; created_at: string; liveness_completed: number }>();
  if (!user) return redirect("/auth/login");

  return data({ user });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = (context as any).cloudflare?.env ?? {};
  const secret = String(env.SESSION_SECRET || "");
  const DB = getDB(env);

  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  if (intent === "logout") {
    const expired = serializeCookie("session", "", { expires: new Date(0) });
    return redirect("/auth/login", { headers: { "Set-Cookie": expired } });
  }
  if (intent === "delete_account") {
    const userId = await verifySessionCookie(request.headers.get("Cookie"), secret);
    if (!userId) return redirect("/auth/login");
    await DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    const expired = serializeCookie("session", "", { expires: new Date(0) });
    return redirect("/", { headers: { "Set-Cookie": expired } });
  }
  return data({ ok: false }, { status: 400 });
}

export default function Me() {
  const { user } = useLoaderData<typeof loader>() as any;
  const isCompleted = Boolean(user?.liveness_completed);
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Mi cuenta</h1>
      <div className="border rounded p-4">
        <div><span className="font-medium">Email:</span> {user?.email}</div>
        <div><span className="font-medium">ID:</span> {user?.id}</div>
        <div><span className="font-medium">Creado:</span> {user?.created_at}</div>
        <div>
          <span className="font-medium">Liveness:</span>{" "}
          {isCompleted ? (
            <span className="text-green-700">Completado</span>
          ) : (
            <span className="text-yellow-700">Pendiente</span>
          )}
        </div>
      </div>
      <div className="flex gap-3">
        {isCompleted ? (
          <a href="/my_liveness_data" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Ver mis datos de liveness</a>
        ) : (
          <a href="/liveness" className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700">Completar liveness</a>
        )}
      </div>
      <Form method="post">
        <input type="hidden" name="intent" value="logout" />
        <button className="bg-gray-800 text-white rounded px-4 py-2">Cerrar sesión</button>
      </Form>
      <Form
        method="post"
        onSubmit={(e) => {
          if (!confirm("¿Seguro que deseas eliminar tu cuenta? Esta acción es irreversible.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="intent" value="delete_account" />
        <button className="bg-red-600 hover:bg-red-700 text-white rounded px-4 py-2 mt-2">
          Eliminar mi cuenta
        </button>
      </Form>
    </div>
  );
}
