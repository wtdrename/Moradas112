// ---------- referência para o goMAP ----------

// "av almirante reis 50 3 esq" + "Avenida Almirante Reis, 50" -> "Nº 50, 3º Esq."
const LADOS = { esq: "Esq.", e: "Esq.", esquerdo: "Esq.", dto: "Dto.", dt: "Dto.", d: "Dto.", dir: "Dto.", direito: "Dto.", frt: "Frente", f: "Frente", frente: "Frente", tras: "Trás" };
// separa o texto em palavras, desfazendo o que vem colado: "nº9" -> "9", "1ºc" -> "1º c", "1dir" -> "1 dir"
function palavrasMorada(texto) {
  return texto.trim().split(/[\s,]+/).flatMap(x => {
    const t = x.replace(/^n\s*[º°ª.o]?\s*(?=\d)/i, "");
    let m = t.match(/^(\d+)\s*[º°ªo]\s*([a-z]+)\.?$/i);
    if (m) return [m[1] + "º", m[2]];
    m = t.match(/^(\d+)([a-z]{2,})\.?$/i);
    if (m && LADOS[semAcentos(m[2]).toLowerCase()]) return [m[1], m[2]];
    return [t];
  }).filter(Boolean);
}

function referencia(texto, morada) {
  const m = morada.match(/,\s*(\S+)$/);
  if (!m) return "";
  const porta = m[1], p = palavrasMorada(texto);
  const portas = [porta, ...porta.split(/[-\/]/)].map(x => x.toLowerCase()); // "18-20": também vale escrever só 18 ou 20
  const i = p.findIndex((x, j) => j > 0 && portas.includes(x.toLowerCase()));
  const andar = (i < 0 ? [] : p.slice(i + 1)).map(x => {
    const n = semAcentos(x).replace(/ /g, "");
    if (/^\d+$/.test(n) || /^\d+(o|º)$/.test(x.toLowerCase())) return parseInt(n, 10) + "º";
    if (n === "rc" || n === "r/c" || x.toLowerCase() === "r/c") return "R/C";
    if (n === "cv" || n === "cave") return "Cave";
    if (LADOS[n]) return LADOS[n];
    if (/^[a-z]$/.test(n)) return n.toUpperCase();
    return x;
  });
  return ["Nº " + porta, andar.join(" ")].filter(Boolean).join(", ");
}

// edifício com nº duplo ("18-20"): se foi escrito um deles, é esse o número da frente
function numeroDaFrente(frente, texto) {
  const partes = frente.toLowerCase().split(/[-\/]/);
  if (partes.length < 2) return frente;
  return palavrasMorada(texto).slice(1).find(x => partes.includes(x.toLowerCase())) || frente;
}

// O número é o do edifício onde o pin ficou (o script diz qual): fora dele "[Frente ao nº 20] 3º Esq.", dentro de outro edifício
// "Nº 43, 3º Esq.". O andar é o que foi escrito (para o achar conta a morada escrita, não a do pin); com o pin longe da
// morada (semReferencia), o andar escrito já não é deste ponto
function referenciaDoPonto({ morada, escrita, semReferencia, frente, porta }, texto) {
  const feita = semReferencia ? "" : referencia(texto, escrita || morada);
  if (!frente && !porta) return feita;
  const n = numeroDaFrente(frente || porta, texto);
  const andar = feita.split(", ").slice(1).join(", ");
  return frente ? [`[Frente ao nº ${n}]`, andar].filter(Boolean).join(" ") : [`Nº ${n}`, andar].filter(Boolean).join(", ");
}

// o que vai para o goMAP: ponto, referência e telefone, nome e observações das notas da chamada, para o formulário Criar
function pedidoGoMAP() {
  const p = { ...ponto, referencia: referenciaDoPonto(ponto, caixa.value) };
  for (const k of ["semReferencia", "frente", "porta", "escrita"]) delete p[k];
  if (typeof dadosParaGoMAP === "function") Object.assign(p, dadosParaGoMAP());
  return p;
}

// última morada marcada no goMAP: mover o pin a seguir atualiza o ponto lá; outra morada ou outra pesquisa já não
let marcado = null;

async function atualizarGoMAP(c) {
  if (!marcado || marcado.c !== c || !ponto) return;
  if (marcado.lat === ponto.lat && marcado.lng === ponto.lng) return;
  const p = pedidoGoMAP();
  delete p.cortado;
  marcado.lat = ponto.lat;
  marcado.lng = ponto.lng;
  try {
    const r = await q112("gomapAjuste", { ...p, sessao: marcado.sessao });
    if (r === "mover") return estado("📍 Ponto atualizado no goMAP: o formulário Criar recomeça com o ponto novo.");
    if (r === "mexido") return estado("⚠ O ponto NÃO mudou no goMAP: o formulário já tem dados teus. Carrega em Marcar no goMAP para o mudar (o formulário recomeça).", true);
    if (r === "fechado") { marcado = null; return estado("⚠ O ponto NÃO mudou no goMAP: a ocorrência já foi criada ou cancelada.", true); }
    estado("⚠ O ponto NÃO mudou no goMAP: já não está nesta morada. Carrega em Marcar no goMAP.", true);
  } catch (e) { estado("goMAP: " + e.message, true); }
}

function marcarGoMAP() {
  // ainda sem ponto (a pesquisar ou a localizar): não marca nada, para nunca mandar a morada anterior
  if (!ponto) { if (caixa.value.trim().length >= 3) estado("Ainda a localizar — carrega Enter outra vez quando aparecer o quartel."); return; }
  const p = pedidoGoMAP();
  if (p.cortado) setTimeout(() => estado("As observações têm mais de 150 caracteres: no goMAP só cabe o início, confirma lá."), 1500);
  delete p.cortado;
  p.sessao = Date.now() + "-" + Math.random();
  marcado = { c: candidatos[sel], sessao: p.sessao, lat: ponto.lat, lng: ponto.lng };
  // põe o goMAP em primeiro plano. Tem de ser já, dentro do clique/Enter: o Firefox só deixa abrir ou pôr à frente
  // um separador a partir de um clique, e só põe à frente um separador aberto por esta página
  // (encontra-o pelo nome "gomap112", que o script dá ao goMAP)
  if (janelaGoMAP && !janelaGoMAP.closed) {
    janelaGoMAP.focus();
    return enviarGoMAP(p, "📍 Marcado no goMAP.");
  }
  let j = null, href = null;
  try { j = window.open("", "gomap112"); } catch (e) { console.warn("[Moradas 112] window.open falhou:", e); }
  if (!j) { console.warn("[Moradas 112] goMAP: window.open bloqueado — abre o script"); return enviarGoMAP(p, null, true); }
  try { href = j.location.href; } catch {}
  console.log("[Moradas 112] goMAP: window.open deu", href === null ? "(outro site: o goMAP)" : href);
  // encontrou o goMAP (não é o separador em branco que o window.open cria quando não o encontra)
  if (href !== "about:blank") { janelaGoMAP = j; j.focus(); return enviarGoMAP(p, "📍 Marcado no goMAP."); }
  // separador novo em branco: se um goMAP aberto fora daqui responder, fecha-o; senão abre lá o goMAP
  const fechar = () => { try { j.close(); } catch {} };
  q112("gomap", { ...p, naoAbrir: true }).then(d => {
    if (d.aberto) {
      fechar();
      console.log("[Moradas 112] goMAP que respondeu:", d.de);
      estado("📍 Marcado no goMAP — muda para o separador do goMAP (foi aberto fora daqui, não o consigo pôr à frente)." + (d.de ? " Respondeu: " + d.de : ""));
      return;
    }
    try {
      if (!d.url || j.closed) throw new Error(d.url ? "separador fechado" : "o script não deu o endereço do goMAP");
      j.location.href = d.url;
      janelaGoMAP = j;
      estado("📍 A abrir o goMAP…");
    } catch (e) {
      // não deu para abrir no separador novo: o script abre o goMAP como antes (não fica à frente da próxima vez)
      console.warn("[Moradas 112] goMAP: não abri no separador novo:", e);
      fechar();
      enviarGoMAP(p, null, true);
    }
  }).catch(e => { fechar(); estado("goMAP: " + e.message, true); });
}
let janelaGoMAP = null;

function enviarGoMAP(p, msg, abrir) {
  q112("gomap", { ...p, naoAbrir: !abrir })
    .then(d => estado(msg || (d.aberto ? "📍 Marcado no goMAP — muda para o separador do goMAP." : "📍 A abrir o goMAP…")))
    .catch(e => estado("goMAP: " + e.message, true));
}
