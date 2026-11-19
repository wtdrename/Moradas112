// ---------- regras das notas: palavras que indicam uma morada, um ponto exato e uma natureza ----------
// Para uma deteção nova basta acrescentar uma linha. "re" corre sobre o texto sem acentos e em minúsculas; "morada" tem de ser
// igual à da pesquisa da Câmara; "ponto", "natureza" (o código do goMAP, antes do "-") e "fonte" (o texto da opção do goMAP, que
// vai com a natureza) são opcionais. O ponto só vale com a palavra nas notas: quem pesquisar a morada sem ela fica no ponto normal
const REGRAS_NOTAS = [
  { nome: "Heliporto", re: /\b(heliporto|heliport|helip|heli)\b/, morada: "Rua Particular do Hospital de Santa Maria",
    ponto: { lat: 38.749327087652745, lng: -9.16062891483307 }, natureza: "7108", fonte: "PUB" }
];
const regrasDasNotas = base => REGRAS_NOTAS.filter(r => r.re.test(base));
// ---------- notas da chamada: escreve-se à vontade, como no bloco de notas, e a página deteta
// telefones, nomes, entidades, ruas, andar/porta e palavras de alerta ----------
// Os dados são pessoais: ficam neste browser (localStorage) e num ficheiro deste PC (servidor.ps1, em
// %LOCALAPPDATA%\Moradas112\notas-112.json), e apagam-se ao fim de 24 horas.

// texto sem acentos e em minúsculas, com o mesmo comprimento do original (para recortar o original nas mesmas posições)
const notasBase = s => s.replace(/[\s\S]/g, c => c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().charAt(0) || c);

const ENTIDADES = [
  ["PSP", /\bpsp\b/], ["Polícia Municipal", /\b(pm|policia municipal)\b/], ["GNR", /\bgnr\b/], ["PJ", /\bpj\b/],
  ["INEM", /\binem\b/], ["CODU", /\bcodu\b/], ["Cruz Vermelha", /\b(cvp|cruz vermelha)\b/],
  ["Proteção Civil", /\b(protecao civil|anepc|smpc|cdos)\b/], ["EMEL", /\bemel\b/], ["EPAL", /\bepal\b/],
  ["Lisboagás", /\blisboa ?gas\b/], ["E-Redes/EDP", /\b(edp|e-?redes)\b/], ["Carris", /\bcarris\b/], ["Metro", /\bmetro\b/],
  ["Junta de Freguesia", /\b(junta|jf)\b/], ["Câmara", /\b(cml|camara)\b/], ["Hospital", /\bhospital\b/],
  ["Bombeiros Voluntários", /\b(bv|bvs|voluntarios)\b/]
];
// telemóveis (9…), fixos (2…; Lisboa 21…) e linhas 800/808, com ou sem +351 e com espaços, pontos ou hífens pelo meio
const RE_TEL = /(?<![\d+])(?:(?:\+|00)351[\s.-]?)?([29](?:[\s.-]?\d){8}|80[08](?:[\s.-]?\d){6})(?!\d)/g;
const RE_NOME = /(?:^|[^a-z])(sr|sra|snr|snra|senhor|senhora|dona|d\.|nome|reclamante|chamo-me|chama-se)\.?\s*:?\s+([a-z]+(?:[ '-]+[a-z]+){0,4})/g;
const NAO_NOME = new Set(["diz", "que", "refere", "informa", "liga", "ligou", "esta", "estao", "tem", "ha", "tlm", "tel", "telefone",
  "contacto", "no", "na", "nos", "nas", "em", "com", "e", "para", "porque", "mas", "ja", "nao", "sim", "do", "o", "a", "os", "as", "vizinho", "vizinha"]);
const LIGA_NOME = new Set(["de", "da", "do", "dos", "das", "e"]);
const RE_LOCAL = /\b(\d{1,2}\s*[ºo°]?\s*(?:andar|piso)|r\/c|rc|res[\s-]do[\s-]chao|cave|sotao|\d{1,2}\s*[ºo°]?\s*(?:esq|dto|dt|drt|frt|frente)[a-z]*\.?|lote\s+[a-z0-9]+|porta\s+[a-z0-9]+|bloco\s+[a-z0-9]+|apartamento\s+[a-z0-9]+)(?![a-z0-9])/g;
const RE_ALERTA = /\b(ferid[oa]s?|encarcerad[oa]s?|pres[oa]s?|fumo|gas|chamas?|fogo|explos[a-z]*|crianc[a-z]*|bebes?|idos[oa]s?|acamad[oa]s?|inconscien[a-z]*|nao respira|sangue|queda|vitimas?|mort[oa]s?|inalac[a-z]*|elevador|cheiro)\b/g;
const RE_RUA = /(?:^|[^a-z])((?:rua|r\.|avenida|av\.?|avda|travessa|trav\.?|tv\.?|calcada|largo|lg\.?|praca|pca|estrada|beco|alameda|praceta|azinhaga|bairro|quinta|escadinhas|escadas)\s+[^\n,;:]+)/g;
const FIM_RUA = new Set(["diz", "que", "ha", "onde", "perto", "junto", "ao", "esquina", "frente", "tel", "tlm", "telefone", "psp", "inem",
  "fumo", "fogo", "andar", "piso", "esq", "dto", "porta", "lote", "bloco", "cave", "sr", "sra", "reclamante"]);

const RE_CODU = /\bcodu\b[\s:#.-]*(?:(?:nº|n\.?\s*º|nr|n|numero|número|ocorrencia|ocorrência|oc)(?![a-z])\.?[\s:#.-]*)?(\d{4,10})(?!\d)/g;
// tira os telefones de uma linha, e a entidade escrita mesmo antes ("psp 213…"): vão em linha própria ("PSP 213 456 789")
function tirarTelefones(linha) {
  let fora = "", desde = 0;
  for (const m of linha.matchAll(RE_TEL)) {
    let antes = linha.slice(desde, m.index);
    const p = antes.match(/(\S+)[\s:-]*$/);
    if (p && ENTIDADES.some(([, re]) => re.test(notasBase(p[1].replace(/[.,;]+$/, ""))))) antes = antes.slice(0, p.index);
    fora += antes + " ";
    desde = m.index + m[0].length;
  }
  return fora + linha.slice(desde);
}
const RE_7 = /(?<![\d+])(\d{7})(?!\d)/g;
const fmtTel = d => d.length === 9 ? d.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : d;
const tipoTel = d => /^9[1236]/.test(d) ? "telemóvel" : /^21/.test(d) ? "fixo Lisboa" : /^2/.test(d) ? "fixo" : /^80[08]/.test(d) ? "linha " + d.slice(0, 3) : "começa por " + d.slice(0, 2);
const capital = s => s.split(" ").map((w, i) => i && LIGA_NOME.has(w.toLowerCase()) ? w.toLowerCase() : w.replace(/(^|['-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())).join(" ");

function detetarNotas(texto) {
  texto = texto.normalize("NFC");
  const base = notasBase(texto);
  const r = { telefones: [], nomes: [], entidades: [], local: [], alertas: [], ruas: [], naturezas: [] };

  for (const [nome, re] of ENTIDADES) if (re.test(base)) r.entidades.push(nome);

  for (const m of texto.matchAll(RE_TEL)) {
    const digitos = m[1].replace(/\D/g, "");
    if (r.telefones.some(t => t.digitos === digitos)) continue;
    // de quem é: a última entidade escrita antes do número, na mesma linha e depois do número anterior
    const ini = Math.max(base.lastIndexOf("\n", m.index) + 1, ...r.telefones.map(t => t.fim).filter(f => f <= m.index));
    const antes = base.slice(ini, m.index);
    let de = "";
    for (const [nome, re] of ENTIDADES) {
      const g = new RegExp(re.source, "g"); let x, ultimo = -1;
      while ((x = g.exec(antes))) ultimo = x.index;
      if (ultimo >= 0 && (!de || ultimo > de.pos)) de = { nome, pos: ultimo };
    }
    r.telefones.push({ digitos, tipo: tipoTel(digitos), de: de ? de.nome : "", fim: m.index + m[0].length });
  }

  // número da ocorrência do CODU: "codu 1234567" / "codu: nº 1234567", ou um número solto de 7 algarismos
  // (os de 9 algarismos são telefones, mesmo a seguir a "codu")
  const tels = [...texto.matchAll(RE_TEL)].map(m => [m.index, m.index + m[0].length]);
  const dentroDeTel = i => tels.some(([a, b]) => i >= a && i < b);
  r.codu = [];
  for (const re of [RE_CODU, RE_7]) for (const m of base.matchAll(re)) {
    const i = m.index + m[0].length - m[1].length;
    if (!dentroDeTel(i) && !r.codu.includes(m[1])) r.codu.push(m[1]);
  }

  for (const m of base.matchAll(RE_NOME)) {
    const ini = m.index + m[0].length - m[2].length;
    const palavras = texto.slice(ini, ini + m[2].length).split(/\s+/);
    const bases = m[2].split(/\s+/);
    // o nome acaba na primeira palavra que não é nome ("diz", "que"…); "de/da/dos/e" só contam no meio de um nome
    let n = 0;
    for (; n < bases.length; n++) {
      const w = bases[n], seguinte = bases[n + 1];
      if (LIGA_NOME.has(w) && n > 0 && seguinte && !NAO_NOME.has(seguinte) && !LIGA_NOME.has(seguinte)) continue;
      if (NAO_NOME.has(w) || LIGA_NOME.has(w)) break;
    }
    if (n) { const nome = capital(palavras.slice(0, n).join(" ")); if (!r.nomes.includes(nome)) r.nomes.push(nome); }
  }

  for (const m of base.matchAll(RE_LOCAL)) { const s = texto.slice(m.index, m.index + m[0].length); if (!r.local.includes(s)) r.local.push(s); }
  for (const m of base.matchAll(RE_ALERTA)) { const s = texto.slice(m.index, m.index + m[0].length).toLowerCase(); if (!r.alertas.includes(s)) r.alertas.push(s); }

  // linha a linha, como se costuma escrever: [rua] / [nome] / [telefone] / [informações], por qualquer ordem
  r.info = [];
  const linhasT = texto.split("\n"), linhasB = base.split("\n"), linhasRua = new Set();
  linhasB.forEach((lb, i) => {
    // sem telefones nem números do CODU (vão para os seus campos)
    const semTel = tirarTelefones(linhasT[i]).replace(new RegExp(RE_CODU.source, "gi"), " ").replace(RE_7, " ").replace(RE_ROTULO_TEL, " ").replace(/\s+/g, " ").replace(/^[\s,;:.-]+|[\s,;:-]+$/g, "");
    let resto = notasBase(semTel);
    for (const [, re] of ENTIDADES) resto = resto.replace(new RegExp(re.source, "g"), " ");
    resto = resto.replace(/[^a-z0-9º°\/' -]/g, " ").replace(/\s+/g, " ").trim();
    if (!resto) return; // só telefone(s), já estão em r.telefones
    const rua = ruaDaLinha(semTel);
    if (rua) {
      linhasRua.add(i);
      const lado = [...lb.matchAll(RE_LOCAL)].map(m => linhasT[i].slice(m.index, m.index + m[0].length));
      const s = [rua, ...lado].join(" ");
      if (!r.ruas.includes(s)) r.ruas.push(s);
    } else if (pareceNome(resto)) {
      const nome = capital(semTel.replace(RE_TRATAMENTO, "").replace(/[.,;:]+$/, ""));
      if (!r.nomes.some(n => notasBase(n) === notasBase(nome))) r.nomes.push(nome);
    } else if (semTel) r.info.push(semTel);
  });

  for (const m of base.matchAll(RE_RUA)) {
    const ini = m.index + m[0].length - m[1].length;
    if (linhasRua.has(base.slice(0, ini).split("\n").length - 1)) continue; // a linha já foi reconhecida como morada
    const pal = m[1].split(/\s+/), orig = texto.slice(ini, ini + m[1].length).split(/\s+/);
    let n = 1;
    while (n < pal.length && n < 9 && !FIM_RUA.has(pal[n].replace(/\.$/, ""))) {
      n++;
      if (/^\d+[a-z]?$/.test(pal[n - 1])) break; // o número da porta fecha a rua
    }
    const escrita = orig.slice(0, n).join(" ").replace(/[.\s]+$/, "");
    const rua = n > 1 ? ruaDaLinha(escrita) || escrita : ""; // o nome oficial, se estiver na lista de ruas
    if (rua && !r.ruas.includes(rua)) r.ruas.push(rua);
  }

  for (const g of regrasDasNotas(base)) {
    if (g.morada && !r.ruas.includes(g.morada)) r.ruas.push(g.morada);
    if (g.natureza) r.naturezas.push({ codigo: g.natureza, nome: g.nome, fonte: g.fonte || "" });
  }
  return r;
}

// morada das notas a pôr na caixa de pesquisa, ou "" para não mexer. "moradaAuto" é a última que foi para a caixa.
// Uma morada normal não substitui o que foi escrito à mão; a de uma regra (heliporto) substitui, uma vez, quando aparece
function moradaParaCaixa(texto, moradaAuto, caixa) {
  const regra = regrasDasNotas(notasBase(texto.normalize("NFC"))).find(g => g.morada);
  const rua = regra ? regra.morada : detetarNotas(texto).ruas[0];
  if (!rua || rua === moradaAuto) return "";
  if (!regra && caixa.trim() && caixa !== moradaAuto) return "";
  return rua;
}

// regra das notas com ponto exato para esta morada, ou null
function regraDoPonto(morada) {
  const el = document.getElementById("notasTexto");
  return (el && regrasDasNotas(notasBase(el.value)).find(g => g.ponto && g.morada === morada)) || null;
}

// "sr.", "sra", "dona", "nome:"… no início da linha do nome (as mais compridas primeiro, para "sra" não ficar "sr" + "a")
const RE_TRATAMENTO = /^\s*(senhora|senhor|snra|snr|sra|sr|dona|d\.|nome|reclamante)\b\.?\s*:?\s*/i;
const RE_ROTULO_TEL = /(^|\s)(tlm|tel|telef|telefone|telem[oó]vel|contacto|contato)\.?:?(?=\s|$)/gi;
// palavras que aparecem em informações e nunca num nome de pessoa
const NAO_E_NOME = /\b(morada|rutura|roturas?|canaliza[a-z]*|inunda[a-z]*|agua|incendio|cozinha|casa|predio|quarto|varanda|telhado|fachada|janela|porta|cabos?|fios?|arvores?|carro|viatura|mota|acidente|colisao|animal|gato|cao|abertura|socorro|lixo|contentor|esgoto|infiltra[a-z]*|tecto|teto|parede|andar|piso|vizinh[a-z]*|local|lisboa|fra[c]?tura|membro|superior|inferior|dor|dores|braco|perna|cabeca|anca|joelho|pulso|tornozelo|ombro|peito|desmaio|convuls[a-z]*|avc|enfarte|respira[a-z]*|hemorrag[a-z]*|corte|queimad[a-z]*|intoxica[a-z]*|doente|utente|paciente|gravida)\b/;

// nomes próprios comuns (sem acentos): uma linha só é nome se começar por um destes, ou por "sr/sra/dona…"
// (sem isto, "fractura membro superior" parecia um nome). Acrescentar aqui os que faltarem.
const NOMES_PROPRIOS = new Set(`
  maria ana joana sofia ines beatriz mariana catarina rita marta sara patricia carla sandra paula cristina isabel teresa helena
  luisa susana claudia filipa margarida leonor matilde carolina francisca daniela andreia vanessa raquel diana alexandra barbara
  fernanda rosa rosario fatima conceicao lurdes graca gloria celeste natalia olga lucia silvia sonia tania vera monica elisabete
  manuela adelaide alice amelia aurora clara laura irene judite lidia madalena micaela odete julia lara alicia benedita carmo
  emilia ermelinda eduarda gabriela ivone joaquina josefa luana lucilia marisa noemia piedade regina rute salome simone
  telma valeria virginia yolanda zulmira albertina antonia deolinda dulce estela florbela georgina hortense irina leticia
  joao jose antonio manuel francisco carlos paulo pedro luis miguel rui jorge nuno ricardo tiago bruno andre rafael diogo
  goncalo duarte tomas martim rodrigo afonso santiago guilherme gabriel henrique vasco simao lourenco salvador david daniel
  fernando alberto armando artur augusto bernardo caetano cesar claudio domingos eduardo emanuel fabio filipe gil hugo
  ivo jaime joaquim julio leandro leonel lucas marco mario mauricio nelson norberto octavio orlando oscar raul renato
  roberto rogerio rolando samuel sebastiao sergio silvio telmo valter vitor xavier adriano alexandre alvaro americo
  abel adao agostinho alfredo amadeu anibal aurelio benjamim casimiro custodio delfim elias ernesto eugenio fausto
  feliciano gaspar germano gustavo herminio horacio inacio isidro jacinto jeronimo justino libanio lino marcelo
  marcos mateus matias moises narciso patricio quim reinaldo romeu tito ulisses vicente zeca
  ahmed mohamed mohammed ali fatma aisha li wei raj priya anna olena olga ivan sergey dmitri natasha
`.trim().split(/\s+/));

// linha com 1 a 5 palavras só de letras, a começar por um nome próprio (ou "sr/sra…"), sem palavras de informação:
// é (provavelmente) o nome de quem liga
function pareceNome(resto) {
  const comTratamento = RE_TRATAMENTO.test(resto);
  resto = resto.replace(RE_TRATAMENTO, "");
  const p = resto.split(" ");
  if (!comTratamento && !NOMES_PROPRIOS.has(p[0])) return false;
  if (!p[0] || p.length > 5 || !p.every(w => /^[a-z'-]{2,}$/.test(w) || LIGA_NOME.has(w))) return false;
  if (LIGA_NOME.has(p[0]) || LIGA_NOME.has(p[p.length - 1])) return false;
  if (p.some(w => NAO_NOME.has(w) && !LIGA_NOME.has(w))) return false;
  if (NAO_E_NOME.test(resto) || new RegExp(RE_ALERTA.source).test(resto)) return false;
  if (typeof TIPOS !== "undefined" && TIPOS[p[0]]) return false; // "rua …", "av …"
  return true;
}

// a linha é uma morada? usa a lista de ruas de Lisboa (ruas.js) e a correção de erros de escrita da página.
// Com número de porta ou tipo de via ("rua", "av"…) aceita erros de escrita; só com o nome, tem de ser quase igual.
function ruaDaLinha(linha) {
  if (typeof indiceRuas !== "function" || !indiceRuas().length) return "";
  const pal = semAcentos(linha).split(" ").filter(Boolean);
  const i = pal.findIndex((p, k) => k > 0 && /^\d+[a-z]?$/.test(p));
  const q = partes(i > 0 ? pal.slice(0, i) : pal);
  if (q.nucleo.replace(/[\s\d]/g, "").length < 4) return "";
  let melhor = null;
  for (const r of indiceRuas()) { const d = pontuar(q, r); if (!melhor || d < melhor.d) melhor = { d, nome: r.nome }; }
  const limite = i > 0 || q.tipo ? 0.2 : 0.05;
  return melhor && melhor.d <= limite ? melhor.nome + (i > 0 ? " " + pal[i].toUpperCase() : "") : "";
}

// resumo no formato habitual, sem rótulos: rua / contactos das entidades / informações
// (o nome e o telefone de quem liga não entram: copiam-se à parte, nos botões do painel)
// sem a morada (vai pelo ponto marcado no goMAP; está no painel, com 🔍) e sem o número do CODU
// (vai só para "Numeração outras Entidades")
function resumoNotas(texto) {
  const d = detetarNotas(texto), linhas = [];
  for (const t of d.telefones) if (t.de) linhas.push(t.de + " " + fmtTel(t.digitos));
  let nomes = d.nomes.map(n => new RegExp("\\b" + notasBase(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"));
  for (const linha of d.info) {
    // tira o nome de quem liga também das linhas de informação ("sr joao silva diz que…" -> "diz que…")
    let base = notasBase(linha), s = linha;
    for (const re of nomes) { const m = re.exec(base); if (m) { s = s.slice(0, m.index) + s.slice(m.index + m[0].length); base = notasBase(s); } }
    s = s.replace(/(^|\s)(senhora|senhor|snra|snr|sra|sr|dona|d\.|reclamante)\.?:?(?=\s|$)/gi, " ").replace(/\s+/g, " ").replace(/^[\s,;:.-]+/, "").trim();
    if (s) linhas.push(s);
  }
  return linhas.join("\n");
}

// o que vai para o formulário Criar do goMAP (Telefone: 9 algarismos; Nome: 50; Observações: 150).
// A morada não entra nas observações: o goMAP já a tem pelo ponto marcado
function dadosParaGoMAP() {
  const el = document.getElementById("notasTexto");
  const texto = el ? el.value : "";
  if (!texto.trim()) return {};
  const d = detetarNotas(texto);
  const tel = d.telefones.find(t => !t.de && t.digitos.length === 9);
  const obs = resumoNotas(texto).split("\n").filter(Boolean).join("; ");
  const nat = d.naturezas[0] || { codigo: "", fonte: "" };
  return { telefone: tel ? tel.digitos : "", nome: (d.nomes[0] || "").slice(0, 50), observacoes: obs.slice(0, 150), cortado: obs.length > 150,
    refEntidades: d.codu.map(n => "CODU:" + n).join(" ").slice(0, 50), natureza: nat.codigo, fonte: nat.fonte };
}

(() => {
  const notas = document.getElementById("notasTexto"), det = document.getElementById("notasDetetado");
  const estadoN = document.getElementById("notasEstado"), lista = document.getElementById("notasHistorico");
  const VALIDADE = 12 * 3600e3; // chamada vista na Finesse

  // ---- todas as notas das últimas 24 horas: [{ id, inicio, quando, texto }]; a aberta é a do id atualId ----
  const HIST = "notas112.historico", ATUAL = "notas112.atual", GUARDA = 24 * 3600e3;
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const validas = h => (Array.isArray(h) ? h : []).filter(n => n && n.id && typeof n.texto === "string" && n.texto.trim() && Date.now() - n.quando < GUARDA);
  const lerLS = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let historico = validas(lerLS(HIST)), atualId = lerLS(ATUAL);
  // notas da versão antiga (só a atual e uma anterior)
  for (const k of ["notas112.anterior", "notas112"]) {
    const v = lerLS(k);
    if (v && v.texto && Date.now() - v.quando < GUARDA && !historico.some(n => n.texto === v.texto)) {
      const id = novoId() + k.length; historico.push({ id, inicio: v.quando, quando: v.quando, texto: v.texto });
      if (k === "notas112" && !atualId) atualId = id;
    }
    try { localStorage.removeItem(k); } catch {}
  }
  if (!atualId) atualId = novoId();

  // o ficheiro no PC (pelo servidor): enviado 1,5 s depois da última alteração; sem servidor fica só no browser
  // Só escreve no ficheiro depois de o ler, para um browser sem notas (dados limpos) não apagar as que lá estão:
  // as do ficheiro que faltam aqui juntam-se à lista.
  // Aberta pelo GitHub Pages não há servidor: as notas ficam só no browser e nunca saem do PC (discoLido fica false,
  // por isso também não se manda nada ao fechar a página)
  let tDisco, discoLido = false;
  function lerDisco() {
    if (!COM_SERVIDOR) return Promise.resolve();
    return fetch("/notas").then(r => r.ok ? r.json() : []).then(doDisco => {
      const novas = validas(doDisco).filter(d => !historico.some(n => n.id === d.id));
      discoLido = true;
      if (novas.length) { historico.push(...novas); preencherLista(); }
      guardar(true);
    }).catch(() => {});
  }
  const paraDisco = () => discoLido
    ? fetch("/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(historico) }).catch(() => {})
    : lerDisco();
  function guardar(jaDisco) {
    historico = validas(historico);
    gravarLS(HIST, historico); gravarLS(ATUAL, atualId);
    clearTimeout(tDisco);
    if (jaDisco) paraDisco(); else tDisco = setTimeout(paraDisco, 1500);
  }
  window.addEventListener("pagehide", () => { if (tDisco && discoLido) navigator.sendBeacon("/notas", new Blob([JSON.stringify(historico)], { type: "application/json" })); });
  // noutro separador da Moradas 112 mudaram as notas: fica com as de lá, menos a que está aberta aqui
  window.addEventListener("storage", e => {
    if (e.key !== HIST) return;
    const aqui = historico.find(n => n.id === atualId);
    historico = validas(lerLS(HIST)).filter(n => n.id !== atualId).concat(aqui ? [aqui] : []);
    preencherLista();
  });

  const hora = t => new Date(t).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const quandoTxt = t => (new Date(t).toDateString() === new Date().toDateString() ? "" : "ontem ") + hora(t);
  function etiqueta(n) {
    const d = detetarNotas(n.texto);
    const partes = [d.ruas[0], d.telefones[0] && fmtTel(d.telefones[0].digitos), d.nomes[0], d.alertas[0] && "⚠ " + d.alertas[0]].filter(Boolean);
    const txt = partes.length ? partes.join(" · ") : n.texto.trim().replace(/\s+/g, " ");
    return quandoTxt(n.inicio) + " — " + (txt.length > 70 ? txt.slice(0, 69) + "…" : txt);
  }
  function preencherLista() {
    const outras = historico.filter(n => n.id !== atualId).sort((a, b) => b.inicio - a.inicio);
    lista.hidden = !outras.length;
    lista.replaceChildren(new Option(`🕘 Notas anteriores (${outras.length}) — últimas 24 horas`, ""), ...outras.map(n => new Option(etiqueta(n), n.id)));
  }
  let tEstado;
  const avisar = msg => { estadoN.textContent = msg; clearTimeout(tEstado); tEstado = setTimeout(() => estadoN.textContent = "", 2500); };

  async function copiar(texto, msg) {
    try { await navigator.clipboard.writeText(texto); avisar(msg); }
    catch { avisar("Não consegui copiar: seleciona e usa Ctrl+C."); }
  }

  // escreve no formulário Criar aberto no goMAP (substitui o que lá estiver); sem formulário aberto, copia como antes
  async function paraGoMAP(campos, textoCopiar, nome, natureza) {
    let r = null, porque = "o formulário do goMAP não está aberto";
    try { r = await q112("gomapCampo", { campos, morada: ponto ? ponto.morada : "", natureza: natureza && natureza.codigo, fonte: natureza && natureza.fonte }, 5000); }
    catch (e) {
      // script antigo (sem este pedido) ou sem script nesta página
      porque = /desconhecido/.test(e.message) ? "o script Quartéis 112 desta página é antigo: Tampermonkey → Verificar atualizações e F5"
        : "o script Quartéis 112 não respondeu: " + e.message;
      console.warn("[Moradas 112] gomapCampo:", e.message);
    }
    if (r && r.ok) return avisar("✓ " + nome + " atualizado no goMAP.");
    copiar(textoCopiar, nome + " copiado (" + porque + ").");
  }

  function secao(titulo, itens, desenhar) {
    if (!itens.length) return;
    det.appendChild(Object.assign(document.createElement("div"), { className: "titulo", textContent: titulo }));
    for (const x of itens) { const div = document.createElement("div"); div.className = "item"; desenhar(div, x); det.appendChild(div); }
  }
  const span = (el, texto, classe) => el.appendChild(Object.assign(document.createElement("span"), { textContent: texto, className: classe || "" }));
  const botao = (el, texto, titulo, fazer) => { const b = Object.assign(document.createElement("button"), { type: "button", textContent: texto, title: titulo }); b.onclick = fazer; el.appendChild(b); };

  function desenhar() {
    const texto = notas.value;
    det.innerHTML = "";
    if (!texto.trim()) { det.appendChild(Object.assign(document.createElement("div"), { className: "vazio", textContent: "O que for detetado aparece aqui." })); return; }
    const d = detetarNotas(texto);
    secao("Telefones", d.telefones, (el, t) => {
      // o Telefone do goMAP só aceita 9 algarismos: os outros números só se copiam
      if (t.digitos.length === 9) botao(el, fmtTel(t.digitos), "Pôr no Telefone do formulário do goMAP (sem formulário aberto, copia)", () => paraGoMAP([["oco_n_telefone", t.digitos]], t.digitos, "Telefone"));
      else botao(el, fmtTel(t.digitos), "Copiar o número (não tem 9 algarismos, não vai para o goMAP)", () => copiar(t.digitos, "Número copiado."));
      span(el, t.tipo + (t.de ? " · " + t.de : ""), "tipo");
    });
    secao("Numeração outras entidades", d.codu, (el, n) => botao(el, "CODU:" + n, "Pôr nas Ref. entidades do goMAP (sem formulário aberto, copia)", () => paraGoMAP([["oco_ref_entidades", "CODU:" + n]], "CODU:" + n, "CODU")));
    secao("Natureza", d.naturezas, (el, n) => {
      botao(el, n.codigo, "Pôr a natureza no formulário do goMAP (substitui; sem formulário aberto, copia)", () => paraGoMAP([], n.codigo, "Natureza", n));
      span(el, n.nome, "tipo");
    });
    secao("Nome", d.nomes, (el, n) => botao(el, n, "Pôr no Nome do formulário do goMAP (sem formulário aberto, copia)", () => paraGoMAP([["oco_nome", n.slice(0, 50)]], n, "Nome")));
    secao("Morada referida", d.ruas, (el, rua) => {
      span(el, rua);
      botao(el, "🔍", "Pesquisar esta morada", () => {
        const caixa = document.getElementById("caixa");
        caixa.value = rua; caixa.dispatchEvent(new Event("input")); caixa.focus();
      });
    });
    secao("Andar / porta", d.local, (el, s) => span(el, s));
    secao("Entidades", d.entidades, (el, e) => span(el, e));
    secao("Alertas", d.alertas, (el, a) => span(el, "⚠ " + a, "alerta"));
    if (!det.children.length) det.appendChild(Object.assign(document.createElement("div"), { className: "vazio", textContent: "Nada detetado ainda." }));
    const tit = det.appendChild(Object.assign(document.createElement("div"), { className: "titulo item", textContent: "Resumo (o que o 📋 copia) " }));
    botao(tit, "📝 Observações goMAP", "Põe o resumo nas Observações do formulário do goMAP (substitui; sem formulário aberto, copia)", () => {
      const g = dadosParaGoMAP();
      if (g.cortado) setTimeout(() => avisar("O resumo tem mais de 150 caracteres: no goMAP só fica o início."), 2600);
      paraGoMAP([["oco_desc", g.observacoes]], resumoNotas(notas.value), "Observações");
    });
    det.appendChild(Object.assign(document.createElement("pre"), { className: "resumo", textContent: resumoNotas(texto) }));
  }

  // grava o que está escrito na nota aberta (uma nota vazia não fica na lista)
  function gravarAtual() {
    let n = historico.find(x => x.id === atualId);
    if (!n) historico.push(n = { id: atualId, inicio: Date.now() });
    n.texto = notas.value; n.quando = Date.now();
    guardar();
  }
  function abrirNota(id) {
    const n = historico.find(x => x.id === id); if (!n) return;
    gravarAtual(); atualId = id; guardar(true);
    notas.value = n.texto; moradaAuto = ""; desenhar(); preencherLista(); notas.focus();
    avisar("Aberta a nota das " + quandoTxt(n.inicio) + " — a que estava escrita ficou nas notas anteriores.");
  }
  lista.onchange = () => { const id = lista.value; lista.value = ""; if (id) abrirNota(id); };

  notas.value = (historico.find(n => n.id === atualId) || { texto: "" }).texto;
  guardar(); // tira as de há mais de 24 horas
  preencherLista();
  desenhar();
  lerDisco();
  // a morada detetada nas notas vai logo para a caixa de pesquisa (0,7 s depois de parar de escrever, para não
  // pesquisar uma rua a meio, nem "heli" a meio de "helicóptero"). O cursor fica nas notas.
  let moradaAuto = "", tAuto;
  function moradaParaPesquisa() {
    const caixa = document.getElementById("caixa");
    // a morada saiu das notas e a caixa já tem outra: se voltar a aparecer, volta a contar
    if (!detetarNotas(notas.value).ruas.length && caixa.value !== moradaAuto) moradaAuto = "";
    const rua = moradaParaCaixa(notas.value, moradaAuto, caixa.value);
    if (!rua) return;
    moradaAuto = rua;
    caixa.value = rua;
    caixa.dispatchEvent(new Event("input"));
  }
  notas.addEventListener("input", () => {
    aquecer(); // a chamada começou: a morada e os carros vêm a seguir
    gravarAtual(); desenhar();
    clearTimeout(tAuto); tAuto = setTimeout(moradaParaPesquisa, 700);
  });

  // número de quem está na chamada, lido na Finesse pelo script Quartéis 112 (a Finesse tem de estar aberta neste Firefox)
  document.getElementById("notasFinesse").onclick = async () => {
    let f;
    try { f = await q112("finesse", null, 3000); }
    catch (e) { avisar("Finesse: " + e.message); return; }
    if (!f || !f.numeros || !f.numeros.length || Date.now() - f.quando > VALIDADE) {
      avisar("Nenhuma chamada vista na Finesse — tem de estar aberta neste Firefox.");
      return;
    }
    const hora = t => new Date(t).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    const numero = f.numeros.join(" / ");
    if (f.numeros.every(n => notas.value.replace(/\D/g, "").includes(n.replace(/\D/g, "")))) { avisar("O número " + numero + " já está nas notas."); notas.focus(); return; }
    notas.value = notas.value.replace(/\s+$/, "") + (notas.value.trim() ? "\n" : "") + numero + "\n";
    gravarAtual(); desenhar(); notas.focus();
    notas.selectionStart = notas.selectionEnd = notas.value.length;
    avisar(f.ativa ? "Número da chamada atual: " + numero : "⚠ Número da última chamada (terminou às " + hora(f.fim || f.quando) + "): " + numero);
  };

  // igual ao Enter na caixa da morada; sem morada localizada não faz nada (o goMAP precisa do ponto)
  document.getElementById("notasGoMAP").onclick = () => {
    if (!ponto) return avisar(document.getElementById("caixa").value.trim() ? "Ainda a localizar a morada — espera que apareça o quartel." : "Põe primeiro a morada (na caixa ou nas notas).");
    marcarGoMAP();
  };
  document.getElementById("notasCopiar").onclick =() => notas.value.trim() ? copiar(resumoNotas(notas.value), "Resumo copiado.") : avisar("Não há notas.");
  document.getElementById("notasNova").onclick = () => {
    if (!notas.value.trim()) { notas.focus(); return; } // já está vazia
    gravarAtual(); atualId = novoId(); guardar(true);
    notas.value = ""; desenhar(); preencherLista(); notas.focus(); moradaAuto = "";
  };

  // F2 salta entre a caixa da morada e as notas
  document.addEventListener("keydown", e => {
    if (e.key !== "F2") return;
    e.preventDefault();
    (document.activeElement === notas ? document.getElementById("caixa") : notas).focus();
  });
})();
