import Link from "next/link";
import { Compass, Heart, PackageCheck } from "lucide-react";
import { adminNavigation } from "./admin-navigation";

export default function AdminFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[#EFE7DE] bg-white text-[#0C304F]">
      <div className="mx-auto max-w-[1600px] px-4 py-9 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 xl:grid-cols-5">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/admin" className="inline-flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black text-white">
                <img
                  src="/res/img/patos-deals.svg"
                  alt="Patos Deals"
                  className="h-12 w-[150px] shrink-0 object-contain object-left"
                />
              </span>
              <span className="font-serif text-lg font-bold">Patos Deals</span>
            </Link>
            <p className="mt-3 max-w-[230px] text-xs leading-5 text-[#78909C]">
              Tus compras, operaciones y finanzas en un solo lugar.
            </p>
            <Link
              href="/admin/mapa-sitio"
              className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#36709E] hover:text-[#CC6255]"
            >
              <Compass size={14} /> Ver mapa completo
            </Link>
          </div>

          {adminNavigation.map((group) => (
            <div key={group.label}>
              <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#78909C]">
                {group.label}
              </h2>
              <ul className="space-y-2.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-xs font-semibold text-[#526C7D] transition hover:text-[#CC6255]"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-[#EFE7DE] pt-5 text-[11px] text-[#78909C] sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Patos Deals. Panel de operaciones.</p>
          <p className="inline-flex items-center gap-1.5">
            <PackageCheck size={13} /> Información centralizada{" "}
            <Heart size={12} className="text-[#CC6255]" />
          </p>
        </div>
      </div>
    </footer>
  );
}
