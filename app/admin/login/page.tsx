"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/app/lib/supabase";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";

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

      if (profileError || !profile || !profile.active) {
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-navy px-5 py-10 sm:px-8">
      {/* Decoración del fondo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-blue/30 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-brand-orange/20 blur-3xl"
      />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-brand-white shadow-2xl md:min-h-[600px] md:grid-cols-2">
        {/* Panel de identidad de marca: escritorio */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-brand-navy p-10 text-brand-white md:flex lg:p-12">
          {/* Elementos decorativos */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-white/10"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 top-36 h-44 w-44 rounded-full border border-white/10"
          />

          <div className="relative z-10">
            {/* Logo */}
            {/* Logo en naranja claro */}
            <div
              role="img"
              aria-label="Patos Deals"
              className="mb-4 h-24 w-56"
              style={{
                backgroundColor: "var(--brand-orange-light)",
                WebkitMaskImage: "url('/res/img/patos-deals.svg')",
                maskImage: "url('/res/img/patos-deals.svg')",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "left center",
                maskPosition: "left center",
                WebkitMaskSize: "contain",
                maskSize: "contain",
              }}
            />

            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-orange-light">
              Panel administrativo
            </p>

            <h2
              className="mt-8 max-w-sm font-heading text-4xl font-semibold leading-tight lg:text-5xl"
              style={{ color: "var(--brand-white)" }}
            >
              Las mejores oportunidades empiezan aquí.
            </h2>

            <p className="mt-6 max-w-sm text-base leading-7 text-brand-white/70">
              Administra tus ofertas, mantén tu información organizada y
              continúa haciendo crecer tu plataforma.
            </p>
          </div>

          {/* Tarjeta informativa */}
          <div className="relative z-10 mt-12 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange-light">
                <ShieldCheck size={21} />
              </div>

              <div>
                <p className="font-semibold text-brand-white">Acceso seguro</p>

                <p className="mt-1 text-sm leading-6 text-brand-white/60">
                  Un espacio exclusivo para administrar Patos Deals.
                </p>
              </div>
            </div>
          </div>

          <p className="relative z-10 mt-8 text-xs tracking-wide text-brand-white/40">
            PATOS DEALS · PANEL ADMINISTRATIVO
          </p>
        </section>

        {/* Formulario de inicio de sesión */}
        <section className="flex items-center justify-center bg-brand-white px-6 py-10 sm:px-10 md:px-10 lg:px-14">
          <div className="w-full max-w-md">
            {/* Logo para móvil */}
            <div className="mb-9 md:hidden">
              <div
                role="img"
                aria-label="Patos Deals"
                className="h-14 w-52"
                style={{
                  backgroundColor: "var(--brand-navy)",
                  WebkitMaskImage: "url('/res/img/patos-deals.svg')",
                  maskImage: "url('/res/img/patos-deals.svg')",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "left center",
                  maskPosition: "left center",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                }}
              />
              <p className="mt-2 text-xs text-muted">Panel administrativo</p>
            </div>

            {/* Encabezado */}
            <div className="mb-9">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-brand-orange">
                Bienvenido de nuevo
              </p>

              <h1 className="font-heading text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
                Inicia sesión
              </h1>

              <p className="mt-4 text-sm leading-6 text-muted sm:text-base">
                Ingresa tus credenciales para acceder a tu espacio de
                administración.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Correo electrónico */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-brand-navy"
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
                  placeholder="tu@correo.com"
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-brand-navy outline-none transition placeholder:text-muted/70 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                />
              </div>

              {/* Contraseña */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-brand-navy"
                  >
                    Contraseña
                  </label>

                  <LockKeyhole
                    size={16}
                    className="text-muted"
                    aria-hidden="true"
                  />
                </div>

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-brand-navy outline-none transition placeholder:text-muted/70 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                />
              </div>

              {/* Mensajes de error */}
              {error && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm leading-6 text-danger"
                >
                  {error}
                </p>
              )}

              {/* Botón de acceso */}
              <button
                type="submit"
                disabled={loading}
                className="pd-button-primary group w-full !rounded-xl !py-3.5"
              >
                <span>
                  {loading ? "Verificando acceso..." : "Iniciar sesión"}
                </span>

                {!loading && (
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                )}
              </button>
            </form>

            {/* Separador */}
            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />

              <span className="text-xs tracking-wide text-muted">
                ACCESO PRIVADO
              </span>

              <div className="h-px flex-1 bg-border" />
            </div>

            <p className="text-center text-xs leading-6 text-muted">
              Esta plataforma es de uso exclusivo para usuarios autorizados. Si
              necesitas acceso, contacta con el administrador.
            </p>

            <p className="mt-8 text-center text-xs text-muted/70">
              © {new Date().getFullYear()} Patos Deals
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
