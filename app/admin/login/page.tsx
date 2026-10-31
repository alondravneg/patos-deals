"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError("No se pudo iniciar sesión. Verifica tus credenciales.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile ||
        !profile.active
      ) {
        await supabase.auth.signOut();
        setError("Tu cuenta no tiene un perfil activo configurado.");
        return;
      }

      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      if (roleError) {
        await supabase.auth.signOut();
        setError("No fue posible verificar los permisos de tu cuenta.");
        return;
      }

      const isAdmin = roleRows?.some((row) => row.role === "admin");

      if (!isAdmin) {
        await supabase.auth.signOut();
        setError("Tu cuenta no tiene permisos de administrador.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Ocurrió un error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F5F1] px-5 py-10 text-[#222222]">
      <section className="w-full max-w-md rounded-2xl border border-[#EFE7DE] bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5B0AB3]">
            Patos Deals
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Bienvenido
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#737373]">
            Inicia sesión para acceder al panel administrativo.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium"
            >
              Correo electrónico
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-[#E5DED5] px-4 py-3 outline-none transition focus:border-[#5B0AB3] focus:ring-2 focus:ring-[#5B0AB3]/10"
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Contraseña
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[#E5DED5] px-4 py-3 outline-none transition focus:border-[#5B0AB3] focus:ring-2 focus:ring-[#5B0AB3]/10"
              placeholder="Tu contraseña"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#5B0AB3] px-4 py-3 font-medium text-white transition hover:bg-[#4A0893] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verificando..." : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-[#737373]">
          Acceso exclusivo para usuarios autorizados.
        </p>
      </section>
    </main>
  );
}