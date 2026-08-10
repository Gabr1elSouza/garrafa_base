"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Calibrador } from "./Calibrador";
import { CenaTotem } from "./CenaTotem";
import { Hud } from "./Hud";
import { LiquidoNaArte } from "./LiquidoNaArte";
import { Operador } from "./Operador";
import { nivelDeEnchimento } from "@/lib/game/pour";
import { resolverTema } from "@/lib/temas";
import { modoCalibracao, temaDaUrl } from "@/lib/totem/ambiente";
import { PALCO_A, PALCO_L, usePalco } from "@/lib/totem/palco";
import { BleSpinSource, ConnectionCancelled } from "@/lib/spin-source/ble";
import { MockSpinSource } from "@/lib/spin-source/mock";
import {
  INITIAL_STATE,
  type SpinSource,
  type SpinState,
} from "@/lib/spin-source/types";

type Fase = "pronto" | "jogando" | "venceu";

/** Quanto a tela de vitoria fica no ar antes de a proxima partida comecar. */
const TEMPO_DE_VITORIA = 8000;

export default function Totem() {
  const escala = usePalco();
  const [semArte, setSemArte] = useState(false);

  const [source, setSource] = useState<SpinSource | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [painelAberto, setPainelAberto] = useState(true);
  const calibrando = useSyncExternalStore(
    modoCalibracao.subscribe,
    modoCalibracao.getSnapshot,
    modoCalibracao.getServerSnapshot,
  );
  const nomeDoTema = useSyncExternalStore(
    temaDaUrl.subscribe,
    temaDaUrl.getSnapshot,
    temaDaUrl.getServerSnapshot,
  );
  const tema = resolverTema(nomeDoTema);
  const [state, setState] = useState<SpinState>(INITIAL_STATE);

  const [fase, setFase] = useState<Fase>("pronto");
  const [acertos, setAcertos] = useState(0);
  const [tempo, setTempo] = useState(0);
  const [round, setRound] = useState(0);
  const inicio = useRef(0);
  const faseRef = useRef<Fase>("pronto");

  useEffect(() => {
    if (!source) return;
    const unsubState = source.subscribe(setState);
    const unsubConn = source.subscribeConnection((isConnected) => {
      setConnected(isConnected);
      if (!isConnected) {
        setState(INITIAL_STATE);
        setErro("A garrafa desconectou.");
        // O aviso cabe no painel, nunca sobre o jogo.
        setPainelAberto(true);
      }
    });
    return () => {
      unsubState();
      unsubConn();
    };
  }, [source]);

  useEffect(() => {
    if (fase !== "jogando") return;
    const id = setInterval(
      () => setTempo((performance.now() - inicio.current) / 1000),
      50,
    );
    return () => clearInterval(id);
  }, [fase]);

  const reiniciar = useCallback(() => {
    faseRef.current = "pronto";
    setRound((r) => r + 1);
    setAcertos(0);
    setTempo(0);
    setFase("pronto");
  }, []);

  // Num totem publico ninguem aperta "recomecar": a fila anda sozinha.
  useEffect(() => {
    if (fase !== "venceu") return;
    const id = setTimeout(reiniciar, TEMPO_DE_VITORIA);
    return () => clearTimeout(id);
  }, [fase, reiniciar]);

  // As viradas de fase sao reacao ao que a cena reporta, nao sincronizacao de
  // estado. O ref espelha a fase para este callback nao precisar ser recriado.
  const onProgress = useCallback((a: number, p: number) => {
    setAcertos(a);

    if (faseRef.current === "pronto" && a + p > 0) {
      // A partida comeca na primeira gota, nao num botao: o cronometro mede so
      // tempo de jogo.
      faseRef.current = "jogando";
      inicio.current = performance.now();
      setFase("jogando");
    } else if (faseRef.current === "jogando" && nivelDeEnchimento(a) >= 1) {
      faseRef.current = "venceu";
      setFase("venceu");
    }
  }, []);

  const iniciar = useCallback(async (nova: SpinSource) => {
    setErro(null);
    setConnecting(true);
    try {
      await nova.connect();
      setSource(nova);
      // Fecha aqui, e nao num efeito que observa `connected`: conectou com
      // sucesso e a causa direta de a tela ficar limpa para o publico.
      setPainelAberto(false);
    } catch (e) {
      // Fechar o seletor de dispositivos e uma decisao, nao um problema.
      if (e instanceof ConnectionCancelled) return;
      setErro(e instanceof Error ? e.message : "Falha ao conectar.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const desconectar = useCallback(async () => {
    await source?.disconnect();
    setSource(null);
    setConnected(false);
    setState(INITIAL_STATE);
  }, [source]);

  const mock = source instanceof MockSpinSource ? source : null;

  useEffect(() => {
    if (!mock) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      mock.setPouring(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      mock.setPouring(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [mock]);

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
        {/* Ordem das camadas, de tras para frente: backdrop, liquido, arte,
            cena 3D, HUD. O liquido precisa ficar atras da arte porque o copo
            do tema tem o interior transparente — e a propria arte que o
            recorta, e o gelo e as paredes ficam por cima dele. */}
        {!semArte && tema.backdrop && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: tema.backdrop }}
          />
        )}

        {!semArte && <LiquidoNaArte tema={tema} nivel={nivelDeEnchimento(acertos)} />}

        {!semArte && (
          // Arte de tamanho fixo conhecido, ocupando o palco inteiro: nao se
          // beneficia do srcset do next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tema.fundo}
            alt=""
            width={PALCO_L}
            height={PALCO_A}
            className="absolute inset-0 h-full w-full select-none"
            onError={() => setSemArte(true)}
          />
        )}

        <CenaTotem
          tilt={state.tilt}
          angle={state.angle}
          running={connected && fase !== "venceu"}
          round={round}
          onProgress={onProgress}
          tema={tema}
        />

        <Hud
          tema={tema}
          acertos={acertos}
          nivel={nivelDeEnchimento(acertos)}
          tempo={tempo}
          venceu={fase === "venceu"}
        />

        <button
          type="button"
          aria-label="Abrir painel do operador"
          onClick={() => setPainelAberto(true)}
          className="absolute right-0 top-0 z-10 h-40 w-40 cursor-default opacity-0"
        />

        <Operador
          aberto={painelAberto && !calibrando}
          source={source}
          connected={connected}
          connecting={connecting}
          erro={erro}
          aoConectar={() => iniciar(new BleSpinSource())}
          aoSimular={() => iniciar(new MockSpinSource())}
          aoDesconectar={desconectar}
          aoZerar={() => source?.send("level")}
          aoFechar={() => setPainelAberto(false)}
        />

        {calibrando && <Calibrador tema={tema} />}
      </div>
    </main>
  );
}
