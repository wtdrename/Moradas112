// ---------- correção de erros de escrita: compara com a lista de ruas de Lisboa (ruas.js) ----------

const TIPOS = {
  r: "rua", rua: "rua", av: "avenida", avd: "avenida", avda: "avenida", avenida: "avenida",
  tv: "travessa", trav: "travessa", travessa: "travessa", cc: "calcada", calc: "calcada", calcada: "calcada",
  lg: "largo", largo: "largo", pc: "praca", pca: "praca", praca: "praca", est: "estrada", estr: "estrada", estrada: "estrada",
  bc: "beco", beco: "beco", al: "alameda", alameda: "alameda", esc: "escadinhas", escadinhas: "escadinhas", escadas: "escadas",
  pct: "praceta", praceta: "praceta", qt: "quinta", qta: "quinta", quinta: "quinta", bairro: "bairro", azinhaga: "azinhaga",
  caminho: "caminho", vila: "vila", patio: "patio"
};
// abreviaturas expandidas dos dois lados; as ligações ignoram-se
const SINONIMOS = {
  s: "sao", sto: "santo", sta: "santa", dr: "doutor", dra: "doutora", eng: "engenheiro", prof: "professor",
  gen: "general", alm: "almirante", cap: "capitao", cel: "coronel", mal: "marechal", cmdt: "comandante"
};
const LIGACOES = new Set(["de", "da", "do", "dos", "das", "d", "e", "dom", "dona", "n", "no", "nr", "num", "numero"]);

const semAcentos = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function partes(palavras) {
  const tipo = palavras.length > 1 && TIPOS[palavras[0]] ? TIPOS[palavras[0]] : null;
  const resto = tipo ? palavras.slice(1) : palavras;
  return { tipo, nucleo: resto.map(p => SINONIMOS[p] || p).filter(p => !LIGACOES.has(p)).join(" ") };
}

let indice = null;
function indiceRuas() {
  if (!indice) indice = (typeof RUAS === "undefined" ? [] : RUAS).map(nome => ({ nome, ...partes(semAcentos(nome).split(" ")) }));
  return indice;
}

// distância de edição, contando a troca de duas letras seguidas como um só erro
function distancia(a, b) {
  let ante = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (ante && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, ante[j - 2] + 1);
      cur.push(v);
    }
    ante = prev; prev = cur;
  }
  return prev[b.length];
}

function pontuar(q, r) {
  let d = distancia(q.nucleo, r.nucleo) / Math.max(q.nucleo.length, r.nucleo.length);
  // nome escrito só em parte ("rua joao ortigao" -> "Rua João Ortigão Ramos")
  if (q.nucleo.length >= 5 && r.nucleo.length > q.nucleo.length)
    d = Math.min(d, distancia(q.nucleo, r.nucleo.slice(0, q.nucleo.length)) / q.nucleo.length + 0.08);
  if (q.tipo && q.tipo !== r.tipo) d += 0.15;
  return d;
}

// devolve até 3 moradas prováveis, no formato "Nome oficial, número"
function corrigirLocal(texto) {
  const palavras = semAcentos(texto).split(" ").filter(Boolean);
  // o número de porta é um número a seguir ao nome e o resto (andar, lado) ignora-se;
  // há ruas com números no nome ("Avenida 24 de Julho 50"), por isso experimenta cortar em cada número
  const cortes = [{ nome: palavras, porta: "" }];
  palavras.forEach((p, i) => { if (i > 0 && /^\d+[a-z]?$/.test(p)) cortes.push({ nome: palavras.slice(0, i), porta: p.toUpperCase() }); });
  const melhores = new Map();
  for (const c of cortes) {
    const q = partes(c.nome);
    if (q.nucleo.length < 3) continue;
    for (const r of indiceRuas()) {
      const d = pontuar(q, r);
      if (d <= 0.34 && (!melhores.has(r.nome) || d < melhores.get(r.nome).d)) melhores.set(r.nome, { d, porta: c.porta });
    }
  }
  const lista = [...melhores].sort((a, b) => a[1].d - b[1].d);
  if (!lista.length) return [];
  const limite = lista[0][1].d + 0.1;
  return lista.filter(([, x]) => x.d <= limite).slice(0, 3).map(([nome, x]) => x.porta ? `${nome}, ${x.porta}` : nome);
}
// ---------- fim da correção local ----------
