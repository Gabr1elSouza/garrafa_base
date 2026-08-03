"use client";

import { PALCO_A, PALCO_L, usePalco } from "@/lib/totem/palco";

export default function Totem() {
  const escala = usePalco();

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      <div
        className="absolute left-1/2 top-1/2 origin-center overflow-hidden bg-[#09090b]"
        style={{
          width: PALCO_L,
          height: PALCO_A,
          transform: `translate(-50%, -50%) scale(${escala})`,
        }}
      >
        <div className="absolute inset-8 rounded-3xl border-4 border-dashed border-white/20" />
      </div>
    </main>
  );
}
