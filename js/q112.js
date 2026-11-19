// ---------- ligação ao script Quartéis 112 (Tampermonkey) ----------

let nPedido = 0;
const pendentes = new Map();
// cada cópia instalada do script responde ao ping com a sua versão
const versoesVistas = new Set();
document.addEventListener("q112-resposta", e => {
  const r = JSON.parse(e.detail);
  if (r.dados && r.dados.versao) versoesVistas.add(r.dados.versao);
  const p = pendentes.get(r.id);
  if (!p) return;
  pendentes.delete(r.id);
  r.erro ? p.falha(new Error(r.erro)) : p.ok(r.dados);
});

function q112(tipo, dados, espera = 30000) {
  return new Promise((ok, falha) => {
    const id = ++nPedido;
    pendentes.set(id, { ok, falha });
    setTimeout(() => {
      if (pendentes.delete(id)) falha(new Error(tipo === "ping"
        ? "o script Quartéis 112 não está ativo nesta página — atualiza-o no Tampermonkey"
        : "sem resposta"));
    }, espera);
    document.dispatchEvent(new CustomEvent("q112-pedido", { detail: JSON.stringify({ id, tipo, dados }) }));
  });
}

// começou a escrever-se: o script lê já a folha de viaturas, a lista de ocorrências e o resto que os carros precisam,
// para não esperarem pelo quartel. No máximo uma vez a cada 15 segundos (o script guarda as leituras 30 segundos; com a
// sessão do Google ou do rsbGO expirada a leitura falha e não fica guardada, e assim não se repete a cada tecla);
// um script antigo responde "pedido desconhecido", que se ignora
let aquecidoEm = 0;
function aquecer() {
  if (Date.now() - aquecidoEm < 15000) return;
  aquecidoEm = Date.now();
  q112("aquecer", null, 3000).catch(() => {});
}

// a mesma porta/rua aparece em vários números; guarda as áreas por edifício/rua
const cacheAreas = new Map();
function areas(c) {
  // morada com ponto exato nas regras das notas: quartel, chefe e mapa são os desse ponto, sem cache porque dependem das notas
  const regra = regraDoPonto(c.MORADA);
  if (regra) return q112("noPonto", regra.ponto);
  const chave = c.COD_SIG ? "S" + c.COD_SIG : "L" + c.COD_LOCAL;
  if (!cacheAreas.has(chave)) {
    const p = q112("areas", c);
    p.then(d => { if (!d || d.quartel.erro || d.chefe.erro) cacheAreas.delete(chave); }, () => cacheAreas.delete(chave));
    cacheAreas.set(chave, p);
  }
  return cacheAreas.get(chave);
}

// se o número de porta não existir, devolve a mesma rua (o quartel sai pela rua inteira), nunca outra rua
// parecida, e marca o resultado com semNumero para a página avisar que a morada pode não existir
async function procurar(texto) {
  const c = (await q112("procurar", texto)) || [];
  const m = texto.match(/[\s,]+(\d+\s*[a-z]?)\s*$/i);
  if (c.length || !m) return c;
  const rua = texto.slice(0, m.index);
  const r = (await q112("procurar", rua)) || [];
  // só os resultados da rua escrita (a pesquisa pela rua também traz ruas parecidas)
  const q = partes(semAcentos(rua).split(" "));
  const dist = x => pontuar(q, partes(semAcentos(x.MORADA.replace(/,[^,]*\d[^,]*$/, "")).split(" ")));
  const comD = r.map(x => ({ x, d: dist(x) })).filter(o => o.d <= 0.34);
  const melhor = Math.min(...comD.map(o => o.d));
  const mesma = comD.filter(o => o.d <= melhor + 0.05).map(o => o.x);
  const lista = mesma.filter(x => !/\d/.test(x.MORADA)).concat(mesma.filter(x => /\d/.test(x.MORADA)));
  lista.semNumero = m[1].toUpperCase().replace(/\s+/g, "");
  lista.rua = rua;
  return lista;
}
const avisoSemNumero = c => c.semNumero && c.length
  ? `⚠ Atenção: não encontrei o nº ${c.semNumero} nesta rua — esta morada pode não existir. Confirma com quem liga.` : null;

// primeira porta que existe a partir de n, de "passo" em "passo". Pergunta número a número, porque a pesquisa
// só devolve 15 resultados por ordem alfabética ("1, 10, 100…"); "ativa" diz se a pesquisa ainda é a atual
async function portaNoSentido(rua, n, passo, ativa) {
  for (let i = 0, k = n; i <= 10 && k >= 1 && ativa(); i++, k += passo) {
    const c = (await q112("procurar", `${rua} ${k}`).catch(() => null)) || [];
    const x = c.find(o => new RegExp(`,\\s*${k}\\s*[a-z]?$`, "i").test(o.MORADA));
    if (x) return x;
  }
  return null;
}

// as portas ao lado do nº que não existe, do mesmo lado da rua (os números de 2 em 2), até 20 números de distância.
// "41B" pode não existir e o 41 existir: nesse caso o 41 conta como porta ao lado
async function portasAoLado(rua, semNumero, ativa) {
  const n = parseInt(semNumero, 10), comLetra = /\D/.test(semNumero);
  const l = await Promise.all([portaNoSentido(rua, comLetra ? n : n - 2, -2, ativa), portaNoSentido(rua, n + 2, 2, ativa)]);
  return l.filter(Boolean);
}
