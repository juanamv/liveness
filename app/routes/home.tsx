export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white shadow rounded-lg p-6 space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Bienvenido</h1>
        <p className="text-gray-600">Elige una opción para continuar</p>
        <div className="flex gap-4 justify-center">
          <a
            href="/auth/register"
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Registrarse
          </a>
          <a
            href="/auth/login"
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    </div>
  );
}
