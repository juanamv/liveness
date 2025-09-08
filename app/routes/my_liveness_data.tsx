import {
  data,
  redirect,
  type LoaderFunctionArgs,
  useLoaderData,
} from "react-router";
import { verifySessionCookie } from "~/lib/session.server";
import { getDB } from "~/lib/db.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = (context as any).cloudflare?.env ?? {};
  const DB = getDB(env);
  const secret = String(env.SESSION_SECRET || "");

  const userId = await verifySessionCookie(
    request.headers.get("Cookie"),
    secret
  );
  if (!userId) return redirect("/auth/login");

  const user = await DB.prepare(
    "SELECT email, liveness_completed FROM users WHERE id = ?"
  )
    .bind(userId)
    .first<{ email: string; liveness_completed: number }>();

  if (!user) return redirect("/auth/login");
  if (!user.liveness_completed) return redirect("/liveness");

  return data({ email: user.email });
}

export default function MyLivenessData() {
  const { email } = useLoaderData<typeof loader>() as any;
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Mis datos de liveness</h1>
      <p className="text-gray-600">Email asociado: {email}</p>
      <div className="rounded border p-4 bg-white space-y-2">
        <h2 className="font-medium">Datos del titular</h2>
        <div className="text-sm">
          <div>
            <span className="font-medium">Nombre completo:</span> Juan Antonio
            Vichini Mamani
          </div>
          <div>
            <span className="font-medium">País:</span> Bolivia
          </div>
          <input type="hidden" name="dob" value="1990-01-01" />
          <input type="hidden" name="id_number" value="12345678" />
          <span className="font-medium">Fecha de nacimiento:</span> *********
          <br />
          <span className="font-medium">Número de identificación:</span> *********
        </div>
      </div>
      <a href="/me" className="inline-block mt-2 text-blue-600 underline">
        Volver a mi cuenta
      </a>
    </div>
  );
}
