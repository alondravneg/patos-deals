
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error || !data.session) {
          setMessage(
            "El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo."
          );
          return;
        }

        setReady(true);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Contraseña actualizada correctamente.");

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/admin/login");
      }, 1500);
    } catch {
      setMessage("Ocurrió un error. Intenta solicitar otro enlace.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f5f1] px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-sm"
      >
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-purple-700">
          Patos Deals
        </p>

        <h1 className="text-2xl font-semibold text-gray-900">
          Recuperar contraseña
        </h1>

        <p className="text-sm text-gray-500">
          Crea una nueva contraseña para tu cuenta de administradora.
        </p>

        {ready && (
          <>
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm text-gray-700"
              >
                Nueva contraseña
              </label>

              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-purple-600"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm text-gray-700"
              >
                Confirmar contraseña
              </label>

              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-purple-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-700 px-4 py-3 font-medium text-white hover:bg-purple-800 disabled:opacity-60"
            >
              {loading ? "Actualizando..." : "Guardar contraseña"}
            </button>
          </>
        )}

        {message && (
          <p role="status" className="text-sm text-gray-700">
            {message}
          </p>
        )}

        {!ready && !message && (
          <p className="text-sm text-gray-500">
            Validando el enlace de recuperación...
          </p>
        )}

        <button
          type="button"
          onClick={() => router.replace("/admin/login")}
          className="w-full text-sm text-purple-700 hover:underline"
        >
          Volver al inicio de sesión
        </button>
      </form>
    </main>
  );
}