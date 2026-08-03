"use client";

import { useState } from "react";
import { CenaTotem } from "./CenaTotem";
import { ARTE } from "@/lib/totem/arte";
import { PALCO_A, PALCO_L, usePalco } from "@/lib/totem/palco";

export default function Totem() {
  const escala = usePalco();
  const [semArte, setSemArte] = useState(false);

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
        {!semArte && (
          // Arte de tamanho fixo conhecido, ocupando o palco inteiro: nao se
          // beneficia do srcset do next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ARTE.imagem}
            alt=""
            width={PALCO_L}
            height={PALCO_A}
            className="absolute inset-0 h-full w-full select-none"
            onError={() => setSemArte(true)}
          />
        )}

        <CenaTotem tilt={0} running={false} round={0} onProgress={() => {}} />
      </div>
    </main>
  );
}
