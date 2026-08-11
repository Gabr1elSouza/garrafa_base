"use client";

import { useEffect, useRef, useState } from "react";

/** Segundos de aviso antes de a medida comecar. */
const PREPARO = 5;

/** De quanto em quanto tempo a tela olha o bit do firmware, em ms. */
const RITMO_DA_ESPERA = 80;

/**
 * Teto para a espera, em ms.
 *
 * Se o bit nunca subir — simulador, firmware antigo, garrafa que caiu no meio —
 * a tela devolve o controle mesmo assim. Sem isto, um sensor mudo prenderia a
 * pessoa para sempre no aviso de "nao encoste".
 */
const LIMITE_DA_MEDIDA = 8000;

/**
 * Etapas da calibracao.
 *
 * Uma medida so, igual a do aviao: a media do giroscopio parado, que descobre o
 * quanto ele acusa de rotacao sem ninguem mexer nele. E o unico ajuste que
 * precisa do sensor imovel, e a mesa e o lugar mais imovel que existe.
 *
 * Nao existe mais etapa de segurar a garrafa. Chegou a existir, mandando
 * tambem o `level`, que grava a pose do momento como zero grau — e como o
 * aviso mandava deitar a garrafa na mesa, o zero saia gravado deitado e
 * levantar a garrafa para jogar ja marcava inclinacao maxima. O zero continua
 * disponivel, no painel do operador, para quem quiser regravar de proposito.
 */
type Etapa = null | "aviso" | "medindo";

export type Props = {
  /** Reinicia a partida. E a acao obvia: ocupa a tela inteira em largura. */
  aoJogarNovamente: () => void;
  /** Manda `calibrate`. Resolve assim que o comando sai. */
  aoCalibrar: () => Promise<void>;
  aoDesconectar: () => void;
  /**
   * Se ha um sensor real do outro lado. No simulador nao existe o que calibrar,
   * entao o botao some em vez de ficar la sem efeito.
   */
  temSensor: boolean;
  /** O bit que o firmware levanta durante a medida. */
  calibrando: boolean;
};

/** Tela cheia de instrucao. Mesmo formato nas duas etapas. */
function Aviso({
  titulo,
  detalhe,
  contagem,
}: {
  titulo: string;
  detalhe: string;
  contagem?: number;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-10 bg-black/90 p-16 text-center text-white">
      <p className="text-6xl font-black leading-tight text-amber-300">
        {titulo}
      </p>
      <p className="text-4xl font-bold leading-tight text-white/70">
        {detalhe}
      </p>
      {contagem !== undefined && (
        <p className="font-mono text-[12rem] font-black leading-none tabular-nums">
          {contagem}
        </p>
      )}
    </div>
  );
}

export function FimDePartida({
  aoJogarNovamente,
  aoCalibrar,
  aoDesconectar,
  temSensor,
  calibrando,
}: Props) {
  const [etapa, setEtapa] = useState<Etapa>(null);
  const [contagem, setContagem] = useState(PREPARO);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bitAtual = useRef(calibrando);

  // Espelho do bit para a sequencia abaixo poder consultar o valor de agora sem
  // ser recriada a cada pacote — sao 50 por segundo.
  useEffect(() => {
    bitAtual.current = calibrando;
  }, [calibrando]);

  // Sair da tela no meio da calibracao cancela tudo. Os `setTimeout` pendentes
  // sao os unicos donos das promessas abaixo: limpos, a sequencia simplesmente
  // para onde estava, sem mandar mais nada para a garrafa.
  useEffect(() => {
    const agendados = timers.current;
    return () => agendados.forEach(clearTimeout);
  }, []);

  const dormir = (ms: number) =>
    new Promise<void>((resolve) => {
      timers.current.push(setTimeout(resolve, ms));
    });

  /**
   * Espera a garrafa dizer que terminou.
   *
   * Quem marca o fim e o firmware, nao um cronometro daqui: ele sobe o bit no
   * ultimo pacote antes de travar e desce no primeiro depois. Antes disto a
   * tela dormia uma duracao fixa chutada no codigo, que ficava errada no dia em
   * que o numero de amostras do firmware mudasse.
   *
   * A subida tem que ser vista antes da descida. O comando sai por uma
   * characteristic e o bit volta por outra, entao no instante logo depois do
   * `send` o bit ainda esta em zero: quem so olhasse "esta baixo?" fecharia o
   * aviso na hora e devolveria a garrafa no meio da medida.
   */
  const esperarMedida = async () => {
    const limite = Date.now() + LIMITE_DA_MEDIDA;
    let subiu = false;
    while (Date.now() < limite) {
      if (bitAtual.current) subiu = true;
      else if (subiu) return;
      await dormir(RITMO_DA_ESPERA);
    }
  };

  const calibrar = async () => {
    setEtapa("aviso");
    for (let s = PREPARO; s >= 1; s--) {
      setContagem(s);
      await dormir(1000);
    }
    setEtapa("medindo");
    await aoCalibrar();
    await esperarMedida();
    setEtapa(null);
  };

  if (etapa === "aviso") {
    return (
      <Aviso
        titulo="DEIXE A GARRAFA NA MESA"
        detalhe="Numa superficie reta e firme. Solte a garrafa antes do zero."
        contagem={contagem}
      />
    );
  }

  if (etapa === "medindo") {
    return <Aviso titulo="CALIBRANDO" detalhe="Nao encoste na garrafa." />;
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-stretch justify-center gap-8 bg-black/85 p-16 text-white">
      <button
        type="button"
        onClick={aoJogarNovamente}
        className="rounded-3xl bg-emerald-500 px-12 py-16 text-7xl font-black text-black"
      >
        Jogar novamente
      </button>

      {/* Fechado por padrao: numa fila de totem quem chega quer jogar, nao
          configurar. `details` guarda o proprio estado de aberto e fecha
          sozinho quando a tela e desmontada na proxima partida. */}
      <details className="group rounded-3xl border-4 border-white/30">
        <summary className="cursor-pointer list-none px-12 py-8 text-center text-4xl font-bold text-white/70">
          Opcoes
          <span className="ml-4 inline-block transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>

        <div className="flex flex-col gap-6 border-t-4 border-white/20 p-6">
          {temSensor && (
            <button
              type="button"
              onClick={calibrar}
              className="rounded-2xl border-4 border-white/30 px-10 py-8 text-4xl font-bold"
            >
              Calibrar
            </button>
          )}

          <button
            type="button"
            onClick={aoDesconectar}
            className="rounded-2xl border-4 border-white/30 px-10 py-8 text-4xl font-bold"
          >
            Desconectar
          </button>
        </div>
      </details>
    </div>
  );
}
