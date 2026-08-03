# Encha a Jarra

Garrafa física com sensor de inclinação (ESP32-C3 + MPU-6050) por BLE. Inclinar
abre um jato; acertar a jarra que oscila embaixo enche a barra.

Duas telas:

- **`/`** — a tela de trabalho: placar completo, mira, barra lateral com todos os
  controles. É a reserva do evento.
- **`/totem`** — o painel vertical de 1080×1920, para TV ou totem em pé.

## Totem 1080×1920

O jogo é o mesmo de `/`, mas a cena 3D roda **sobre uma arte de fundo** e o HUD
fica reduzido a tempo e nível da jarra.

**Trocar a arte:**

1. Exporte a arte em **1080×1920 exatos** e salve em `public/totem/`.
2. Aponte `imagem` em `lib/totem/arte.ts` para o arquivo novo.
3. Abra `http://localhost:3000/totem?calibrar`, arraste as peças do HUD para o
   lugar e clique **copiar**.
4. Cole o bloco em `lib/totem/arte.ts`.

**Operação no evento:** com a garrafa conectada a tela mostra só o jogo. Um toque
no **canto superior direito** reabre o painel do operador, onde ficam o
**Marcar posição atual como 0°** e o **Desconectar**. A partida reinicia sozinha
8 s depois de a jarra encher.

O "marcar 0°" não é opcional: a inclinação é medida a partir de uma pose de
referência, e sem recalibrar entre pessoas o jato abre na hora errada.

**Restrições herdadas do Web Bluetooth:** só Chrome e Edge, e só em `localhost`.
Aberto pelo IP da rede o navegador bloqueia — a tela avisa quando isso acontece.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
