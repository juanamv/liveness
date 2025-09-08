import { data, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import DocumentVerificationForm from "~/components/DocumentVerificationForm";
import { generatePresignedUrls } from "~/lib/generate_presigned_url_s3.server";
import { verifySessionCookie } from "~/lib/session.server";
import { getDB } from "~/lib/db.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = (context as any).cloudflare?.env ?? {};
  const DB = getDB(env);
  const secret = String(env.SESSION_SECRET || "");

  const userId = await verifySessionCookie(request.headers.get("Cookie"), secret);
  if (!userId) return redirect("/auth/login");

  const user = await DB.prepare("SELECT email FROM users WHERE id = ?")
    .bind(userId)
    .first<{ email: string }>();

  if (!user?.email) return redirect("/auth/login");

  const presigned_urls = await generatePresignedUrls(user.email, env);
  return data({ presigned_urls, email: user.email });
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return data({ ok: false, error: "Método no permitido" }, { status: 405 });
  }
  const env = (context as any).cloudflare?.env ?? {};
  const DB = getDB(env);
  const secret = String(env.SESSION_SECRET || "");

  const userId = await verifySessionCookie(request.headers.get("Cookie"), secret);
  if (!userId) return redirect("/auth/login");

  let intent = "";
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as Partial<{ intent: string }>;
      intent = String(body.intent ?? "");
    } catch {}
  } else {
    const form = await request.formData();
    intent = String(form.get("intent") || "");
  }

  if (intent !== "complete") {
    return data({ ok: false, error: "Intent inválido" }, { status: 400 });
  }

  await DB.prepare("UPDATE users SET liveness_completed = 1 WHERE id = ?")
    .bind(userId)
    .run();

  return data({ ok: true });
}

export default function MainHome() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <DocumentVerificationForm
        presignedUrls={loaderData.presigned_urls}
        email={loaderData.email}
      />
    </div>
  );
}
