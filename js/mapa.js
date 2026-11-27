// ---------- mapa da morada: o mapa base do goMAP (público, sem token) em Leaflet, com o pin arrastável ----------

const MAPA_BASE = "https://gisrsb.cm-lisboa.pt/arcgisrsb/rest/services/MapaBase_WGS84/MapServer/tile/{z}/{y}/{x}";
const PINO_SVG = '<svg viewBox="0 0 24 36" width="30" height="45"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#c62828" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>';
const mapaFrame = $("mapaFrame"), mapaVazio = $("mapaVazio"), mapaNota = $("mapaNota"), mapaLigacoes = $("mapaLigacoes");
let mapaPonto = null, mapaL = null, pino = null, seqPino = 0;

// só se cria com o mapa visível: o Leaflet precisa do tamanho da caixa
function criarMapa() {
  if (mapaL) return;
  mapaL = L.map(mapaFrame).setView([mapaPonto.lat, mapaPonto.lng], 18);
  const camada = L.tileLayer(MAPA_BASE, { minZoom: 11, maxZoom: 21, maxNativeZoom: 20, attribution: "CM Lisboa" }).addTo(mapaL);
  // Quadrados que falham (erro ou sem resposta): o Leaflet não os volta a pedir e dá-os como carregados, por isso ao fazer
  // zoom in tira o quadrado ampliado do zoom de baixo e fica um buraco cinzento. Aqui: pede-se outra vez (até 5 vezes, cada vez
  // com mais espera), o do zoom de baixo fica à vista enquanto este não chega, e ao mexer no mapa voltam a pedir-se os desistidos
  const carregado = tile => tile.classList.contains("leaflet-tile-loaded");
  const pedir = (tile, coords, n) => { if (tile.isConnected && !carregado(tile)) tile.src = camada.getTileUrl(coords) + "?tentativa=" + n; };
  // O servidor do mapa está na rede interna da Câmara: o browser só deixa a página (no GitHub) chegar lá com a autorização
  // "acesso à rede local". Enquanto essa caixa está aberta, cada pedido novo redesenha-a e apaga o que lá estava, por isso
  // até haver acesso (um quadrado que chegou, ou a autorização dada) não se volta a pedir nada sozinho; com acesso, pedem-se
  // logo outra vez todos os que faltam
  let acesso = false;
  function haAcesso() {
    if (acesso) return;
    acesso = true;
    for (const t of Object.values(camada._tiles)) if (!carregado(t.el)) {
      delete t.el.dataset.desistiu; delete t.el.dataset.espera; t.el.dataset.tentativas = 0; pedir(t.el, t.coords, 0);
    }
  }
  camada.on("tileload", haAcesso);
  if (navigator.permissions) for (const name of ["local-network-access", "local-network"]) {
    navigator.permissions.query({ name }).then(p => {
      if (p.state === "granted") haAcesso();
      p.addEventListener("change", () => { if (p.state === "granted") haAcesso(); });
    }).catch(() => {}); // este browser não tem esta permissão
  }
  function tentarOutraVez(tile, coords) {
    if (!acesso) { tile.dataset.espera = "1"; return; }
    const n = (Number(tile.dataset.tentativas) || 0) + 1;
    if (n > 5) { tile.dataset.desistiu = "1"; console.warn("[Moradas 112] mapa: quadrado sem resposta depois de 5 tentativas", coords); return; }
    tile.dataset.tentativas = n;
    setTimeout(() => pedir(tile, coords, n), 700 * n);
  }
  camada.on("tileerror", ({ tile, coords }) => {
    tentarOutraVez(tile, coords);
    // logo a seguir a este aviso o Leaflet marca-o como carregado: volta a "por carregar" (com opacidade 0, já posta pelo
    // Leaflet), para o quadrado do zoom de baixo não ser tirado
    const k = camada._tileCoordsToKey(coords);
    setTimeout(() => { const t = camada._tiles[k]; if (t && t.el === tile && !carregado(tile)) { t.loaded = 0; t.active = false; } });
  });
  // sem resposta ao fim de 8 s (o pedido ficou pendurado): pede-se outra vez
  camada.on("tileloadstart", ({ tile, coords }) => {
    const vigiar = (src = tile.src) => setTimeout(() => {
      if (!tile.isConnected || carregado(tile) || tile.dataset.desistiu || tile.dataset.espera) return;
      // o mesmo pedido continua por responder (outro pedido entretanto tem a sua própria espera)
      if (tile.src === src && !tile.complete) tentarOutraVez(tile, coords);
      vigiar();
    }, 8000);
    vigiar();
  });
  mapaL.on("moveend", () => {
    if (acesso) for (const t of Object.values(camada._tiles)) if (t.el.dataset.desistiu && !carregado(t.el)) {
      delete t.el.dataset.desistiu; t.el.dataset.tentativas = 0; tentarOutraVez(t.el, t.coords);
    }
  });
  pino = L.marker([mapaPonto.lat, mapaPonto.lng], {
    draggable: true, autoPan: true, keyboard: false, title: "Arrasta para acertar o local",
    icon: L.divIcon({ className: "pino", html: PINO_SVG, iconSize: [30, 45], iconAnchor: [15, 45] })
  }).addTo(mapaL);
  pino.on("dragend", () => pinoMovido(pino.getLatLng()));
  // a caixa do mapa mudou de tamanho (pegas das colunas, notas a crescer, janela): sem isto o Leaflet não pede os
  // quadrados da parte nova e ficam cinzentos. Escondido (outro separador) não tem tamanho: acerta-se ao voltar
  new ResizeObserver(([e]) => { if (e.contentRect.width && e.contentRect.height) mapaL.invalidateSize(); }).observe(mapaFrame);
}

function desenharMapa(recentrar = true) {
  if (!mapaPonto) return;
  const { lat, lng } = mapaPonto, ll = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  mapaFrame.hidden = false;
  mapaFrame.classList.remove("velho");
  mapaVazio.hidden = true;
  criarMapa();
  mapaL.invalidateSize();
  pino.setLatLng([lat, lng]);
  pino.dragging.enable();
  if (recentrar) mapaL.setView([lat, lng], 18, { animate: false });
  $("mapaAbrir").href = `https://www.google.com/maps/search/?api=1&query=${ll}`;
  $("mapaStreet").href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll}`;
  mapaLigacoes.hidden = false;
  atualizarGoogle();
}

// separador Google Maps: o mesmo ponto (também o do pin arrastado), só para ver. Só carrega com o separador aberto.
function atualizarGoogle() {
  const f = $("googleFrame"), vazio = $("googleVazio");
  if (!mapaPonto) {
    f.classList.add("velho");
    if (f.hidden) vazio.hidden = false;
    return;
  }
  if ($("painelGoogle").hidden) return;
  const src = `https://maps.google.com/maps?q=${mapaPonto.lat.toFixed(6)},${mapaPonto.lng.toFixed(6)}&z=18&hl=pt-PT&output=embed`;
  if (f.getAttribute("src") !== src) f.src = src;
  f.classList.remove("velho");
  f.hidden = false;
  vazio.hidden = true;
}

// p = {lat, lng} do script; sem número de porta o ponto é o meio da rua
function mostrarMapa(p, morada) {
  mapaPonto = p && isFinite(p.lat) && isFinite(p.lng) ? p : null;
  if (!mapaPonto) { mapaEmEspera("Sem localização para esta morada."); return; }
  const regra = regraDoPonto(morada);
  mapaNota.textContent = morada + (regra ? ` — ponto: ${regra.nome}` : /\d/.test(morada) ? "" : " — ponto no meio da rua; põe o nº de porta para afinar") + " · arrasta o pin para acertar";
  desenharMapa();
}

// Pin largado: quartel, chefe e carros passam a ser os do ponto. A morada escrita não muda; até 30 m mantém o andar no goMAP.
// O número é o do edifício onde o pin ficou: noutro edifício passa a ser o dele, e fora dele a referência diz
// "[Frente ao nº X]" (a regra está no script, em moradaPerto).
async function pinoMovido({ lat, lng }) {
  const c = candidatos[sel];
  if (!ponto || !c) return;
  const meu = ++seqPino;
  const longe = !c.pontoMorada || mapaL.distance([lat, lng], c.pontoMorada) > 30;
  ponto = { lat, lng, morada: longe ? "Ponto ajustado à mão" : c.MORADA, escrita: c.MORADA, semReferencia: longe };
  delete c.moradaAjustada;
  mapaPonto = { lat, lng };
  desenharMapa(false);
  // o título é o sítio onde o pin está; a morada escrita fica por baixo
  $("rMorada").textContent = longe ? "A procurar a morada…" : c.MORADA;
  $("rMoradaNota").textContent = longe ? "Ponto ajustado à mão · morada escrita: " + c.MORADA : "Ponto ajustado à mão";
  $("rMoradaNota").hidden = false;
  $("mapaRepor").hidden = false;
  mapaNota.textContent = "Ponto ajustado à mão — a procurar a morada mais próxima…";
  linha($("rQuartel"), "Quartel", "…");
  linha($("rChefe"), "Chefe de serviço", "…");
  try {
    const d = await q112("noPonto", { lat, lng, escrita: { MORADA: c.MORADA, COD_SIG: c.COD_SIG, COD_LOCAL: c.COD_LOCAL, ponto: c.pontoMorada } });
    if (meu !== seqPino || candidatos[sel] !== c || !ponto) return;
    const p = d.perto, achada = p && !p.erro && p.morada, outraPorta = achada && p.outraPorta;
    // prédio grande ou de esquina: longe do centro, mas ainda no edifício e na rua escritos, por isso mantém nº e andar
    if (longe && p && !p.erro && p.escrita) {
      ponto.morada = c.MORADA;
      ponto.semReferencia = false;
      $("rMorada").textContent = c.MORADA;
      $("rMoradaNota").textContent = "Ponto ajustado à mão";
    } else if (longe || outraPorta) {
      if (achada) ponto.morada = c.moradaAjustada = achada;
      $("rMorada").textContent = achada || "Sem morada neste ponto";
      $("rMoradaNota").textContent = "Ponto ajustado à mão · morada escrita: " + c.MORADA;
    }
    if (achada) { ponto.frente = p.frente; ponto.porta = p.porta; }
    mapaNota.textContent = "Ponto ajustado à mão — " + (achada ? `perto de ${achada}` + (p.d == null ? "" : ` (${Math.round(p.d)} m)`)
      : p && p.erro ? "morada: " + p.erro : "sem morada conhecida neste ponto")
      + (ponto.frente || ponto.porta ? ` · referência: ${referenciaDoPonto(ponto, caixa.value)}` : "");
    mostrarAreas(c, d);
    verOcorrencias(c);
    atualizarGoMAP(c);
  } catch (e) {
    if (meu !== seqPino || candidatos[sel] !== c) return;
    mapaNota.textContent = "Ponto ajustado à mão — " + e.message;
    if (longe) $("rMorada").textContent = "Morada do ponto desconhecida";
    linha($("rQuartel"), "Quartel", e.message, true);
    linha($("rChefe"), "Chefe de serviço", "—");
    atualizarGoMAP(c);
  }
}
$("mapaRepor").addEventListener("click", () => { escolher(sel); caixa.focus(); });

// a procurar outra morada: o mapa anterior fica esbatido até chegar o novo (nunca parece ser desta morada)
function mapaEmEspera(msg) {
  mapaPonto = null;
  mapaFrame.classList.add("velho");
  if (pino) pino.dragging.disable();
  mapaLigacoes.hidden = true;
  mapaNota.textContent = msg || "";
  if (mapaFrame.hidden) { mapaVazio.hidden = false; mapaVazio.textContent = msg || "O mapa da morada aparece aqui."; }
  atualizarGoogle();
}

function limparMapa() {
  mapaPonto = null;
  seqPino++;
  mapaFrame.hidden = true;
  mapaVazio.hidden = false;
  mapaVazio.textContent = "O mapa da morada aparece aqui.";
  mapaNota.textContent = "";
  mapaLigacoes.hidden = true;
  $("googleFrame").hidden = true;
  $("googleFrame").removeAttribute("src");
  $("googleVazio").hidden = false;
}
