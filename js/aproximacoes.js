// ---------- separador Aproximações: tempo e km por estrada de cada quartel até à morada, percursos e viaturas ----------
// O cálculo vem do projeto AreasQuarteis (grafo das ruas do OSM + Dijkstra). Aqui faz-se UM Dijkstra, no grafo invertido,
// a partir da morada: dá o tempo de todos os pontos até lá e, seguindo "seguinte[]", o percurso de cada quartel.
// Tudo dentro de uma função para os nomes (grafo, dijkstra, CORES…) não colidirem com os outros js/*.js, que partilham o global.
(() => {
  const URL_RUAS = "https://wtdrename.github.io/AreasQuarteis/dados/ruas.js"; // define window.RUAS_OSM (~31 MB)
  // velocidade média (km/h) de um carro de socorro em cada tipo de via; as ligações (*_link) contam como a via
  const VELOCIDADES = { motorway: 80, trunk: 70, primary: 50, secondary: 45, tertiary: 40, unclassified: 30, residential: 30, road: 30, living_street: 15, service: 15 };
  // pela ordem de QUARTEIS; escolhidas para os vizinhos não terem cores parecidas
  const CORES = ["#d62728", "#ff7f0e", "#8c564b", "#e6c200", "#9467bd", "#2ca02c", "#e377c2", "#1f77b4", "#17becf", "#393b79", "#e7298a"];
  // os 11 quartéis do RSB (posição de saída dos VUCI)
  const QUARTEIS = [
    ["Dom Carlos", 38.709966421832064, -9.153511838833419], ["Martim Moniz", 38.714893, -9.136737], ["Graça", 38.71703284226991, -9.129548312251869],
    ["Defensores de Chaves", 38.732815, -9.142205], ["Santo Amaro", 38.703316, -9.184975], ["Monsanto", 38.72648, -9.197547],
    ["Benfica", 38.750084, -9.196485], ["Alvalade", 38.756626, -9.140233], ["Encarnação", 38.77001, -9.123547],
    ["Alta de Lisboa", 38.77936, -9.143878], ["Marvila", 38.752216, -9.104897]
  ].map(([nome, lat, lng]) => ({ nome, lat, lng }));
  const MOSTRAR = 6; // quartéis na tabela (os mais rápidos)

  // metros num plano local (chega para o tamanho de Lisboa)
  const LAT0 = 38.74, LNG0 = -9.15, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110540;
  const metros = (lat1, lng1, lat2, lng2) => Math.hypot((lng2 - lng1) * KX, (lat2 - lat1) * KY);
  const minutos = s => { if (!isFinite(s)) return "—"; s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const semAcentos = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  // ---------- grafo das ruas ----------

  // ligações do OSM com o tempo em segundos, guardadas ao contrário (inicio[b]..inicio[b+1] são as que chegam a b),
  // para um só Dijkstra a partir da morada; sentidos únicos respeitados
  function construirGrafo(osm) {
    const indice = new Map(), lat = [], lng = [];
    for (const e of osm.elements) if (e.type === "node") { indice.set(e.id, lat.length); lat.push(e.lat); lng.push(e.lon); }
    const n = lat.length, de = [], para = [], seg = [];
    const principal = new Uint8Array(n); // ponto numa via que não é de serviço: é aqui que os quartéis se ligam à rede
    for (const w of osm.elements) {
      if (w.type !== "way" || !w.tags || !w.nodes) continue;
      const t = w.tags, tipo = t.highway.replace(/_link$/, ""), base = VELOCIDADES[tipo];
      if (!base || t.access === "no" || t.area === "yes" || /^(parking_aisle|drive-through)$/.test(t.service || "")) continue;
      const max = parseFloat(t.maxspeed), ms = Math.min(base, max > 0 ? max : Infinity) / 3.6;
      // 1 = só no sentido do desenho, -1 = só ao contrário, 0 = os dois
      const sentido = t.oneway === "-1" ? -1
        : /^(yes|true|1)$/.test(t.oneway || "") || /^(roundabout|circular)$/.test(t.junction || "") || (tipo === "motorway" && t.oneway !== "no") ? 1 : 0;
      const nos = w.nodes.map(id => indice.get(id)).filter(i => i !== undefined);
      if (nos.length < 2) continue;
      for (let k = 1; k < nos.length; k++) {
        const a = nos[k - 1], b = nos[k], s = metros(lat[a], lng[a], lat[b], lng[b]) / ms;
        if (sentido >= 0) { de.push(a); para.push(b); seg.push(s); }
        if (sentido <= 0) { de.push(b); para.push(a); seg.push(s); }
        if (tipo !== "service" && tipo !== "living_street") principal[a] = principal[b] = 1;
      }
    }
    const inicio = new Int32Array(n + 1), saida = new Uint8Array(n); // saida[i] = tem ligações a sair
    for (let k = 0; k < para.length; k++) { inicio[para[k] + 1]++; saida[de[k]] = 1; }
    for (let i = 0; i < n; i++) inicio[i + 1] += inicio[i];
    const pos = inicio.slice(0, n), alvo = new Int32Array(de.length), custo = new Float32Array(de.length);
    for (let k = 0; k < de.length; k++) { const p = pos[para[k]]++; alvo[p] = de[k]; custo[p] = seg[k]; }
    return { n, lat: Float64Array.from(lat), lng: Float64Array.from(lng), inicio, alvo, custo, principal, saida };
  }

  // tempo (s) de cada ponto até ao destino (Dijkstra com fila de prioridade binária, pelas ligações invertidas);
  // seguinte[i] = ponto para onde se vai a seguir no caminho mais rápido. Pára quando os "alvos" (pontos dos quartéis) estão fechados
  function dijkstra(g, destino, alvos) {
    const t = new Float64Array(g.n).fill(Infinity), seguinte = new Int32Array(g.n).fill(-1), fn = [], ft = [];
    const porFechar = new Set(alvos);
    const juntar = (no, tempo) => {
      let i = fn.length;
      fn.push(no); ft.push(tempo);
      while (i > 0) { const p = (i - 1) >> 1; if (ft[p] <= tempo) break; fn[i] = fn[p]; ft[i] = ft[p]; i = p; }
      fn[i] = no; ft[i] = tempo;
    };
    const tirar = () => {
      const topo = fn[0], ultN = fn.pop(), ultT = ft.pop(), m = fn.length;
      if (m) {
        let i = 0;
        for (;;) {
          let f = 2 * i + 1;
          if (f >= m) break;
          if (f + 1 < m && ft[f + 1] < ft[f]) f++;
          if (ft[f] >= ultT) break;
          fn[i] = fn[f]; ft[i] = ft[f]; i = f;
        }
        fn[i] = ultN; ft[i] = ultT;
      }
      return topo;
    };
    t[destino] = 0;
    juntar(destino, 0);
    while (fn.length) {
      const tt = ft[0], b = tirar();
      if (tt > t[b]) continue;
      if (porFechar.delete(b) && porFechar.size === 0) break;
      for (let k = g.inicio[b]; k < g.inicio[b + 1]; k++) {
        const a = g.alvo[k], nt = tt + g.custo[k];
        if (nt < t[a]) { t[a] = nt; seguinte[a] = b; juntar(a, nt); }
      }
    }
    return { tempo: t, seguinte };
  }

  // índice espacial dos pontos da rede, em baldes de 100 m
  const BALDE = 100;
  const chaveBalde = (bx, by) => (bx + 50000) * 100000 + by + 50000;
  function indiceEspacial(g, filtro) {
    const m = new Map();
    for (let i = 0; i < g.n; i++) {
      if (!filtro(i)) continue;
      const k = chaveBalde(Math.floor((g.lng[i] - LNG0) * KX / BALDE), Math.floor((g.lat[i] - LAT0) * KY / BALDE));
      (m.get(k) || m.set(k, []).get(k)).push(i);
    }
    return m;
  }
  function pertoNoIndice(g, ind, lat, lng, raio) {
    const bx = Math.floor((lng - LNG0) * KX / BALDE), by = Math.floor((lat - LAT0) * KY / BALDE), r = Math.ceil(raio / BALDE);
    let melhor = -1, dm = raio;
    for (let x = bx - r; x <= bx + r; x++) for (let y = by - r; y <= by + r; y++) {
      for (const i of ind.get(chaveBalde(x, y)) || []) {
        const d = metros(lat, lng, g.lat[i], g.lng[i]);
        if (d <= dm) { dm = d; melhor = i; }
      }
    }
    return melhor;
  }

  // ponto da rede mais perto, só entre os que passam no filtro
  function pontoMaisPerto(g, lat, lng, filtro) {
    let melhor = -1, dm = Infinity;
    for (let i = 0; i < g.n; i++) {
      if (!filtro(i)) continue;
      const d = metros(lat, lng, g.lat[i], g.lng[i]);
      if (d < dm) { dm = d; melhor = i; }
    }
    return { no: melhor, d: dm };
  }

  // ---------- carregar as ruas (só na primeira vez que se abre o separador) ----------

  let g = null, origens = null, ind = null, carga = null; // carga: promessa do carregamento
  const estadoEl = $("apxEstado");
  const mostrarEstado = (texto, erro = false) => { estadoEl.textContent = texto; estadoEl.classList.toggle("erro", erro); };
  const pausa = () => new Promise(r => setTimeout(r, 30)); // deixa o texto de estado desenhar-se antes do trabalho pesado

  function carregarRuas() {
    if (carga) return carga;
    carga = (async () => {
      mostrarEstado("A carregar as ruas (31 MB, só a primeira vez)…");
      await new Promise((ok, falhou) => {
        const s = document.createElement("script");
        s.src = URL_RUAS;
        s.onload = ok;
        s.onerror = () => falhou(new Error("não consegui carregar as ruas"));
        document.head.appendChild(s);
      });
      mostrarEstado("A preparar o grafo…");
      await pausa();
      if (!window.RUAS_OSM) throw new Error("as ruas vieram vazias");
      const t0 = performance.now();
      g = construirGrafo(window.RUAS_OSM);
      delete window.RUAS_OSM; // liberta a memória: o grafo já tem tudo o que é preciso
      origens = QUARTEIS.map(q => pontoMaisPerto(g, q.lat, q.lng, i => g.principal[i] && g.saida[i]));
      ind = indiceEspacial(g, i => g.inicio[i + 1] > g.inicio[i]); // só pontos a que chegam ligações (o destino tem de se poder expandir)
      console.info(`[Moradas 112] aproximações: grafo com ${g.n} pontos em ${Math.round(performance.now() - t0)} ms`);
    })().catch(e => { carga = null; throw e; }); // com erro, da próxima vez volta a tentar
    return carga;
  }

  // ---------- cálculo ----------

  let calc = null;            // { lat, lng, no, d, lista } do último cálculo
  let visiveis = new Set();   // quartéis (índice) com o percurso desenhado

  function percurso(seguinte, no) {
    const nos = [];
    for (let i = no; i >= 0; i = seguinte[i]) nos.push(i);
    return nos;
  }

  function calcular(lat, lng) {
    const no = pertoNoIndice(g, ind, lat, lng, 300);
    if (no < 0) return { lat, lng, no, lista: [] };
    const { tempo, seguinte } = dijkstra(g, no, origens.map(o => o.no));
    const lista = QUARTEIS.map((q, k) => {
      const t = tempo[origens[k].no];
      let pts = [], km = NaN;
      if (isFinite(t)) {
        pts = percurso(seguinte, origens[k].no).map(i => [g.lat[i], g.lng[i]]);
        let m = 0;
        for (let j = 1; j < pts.length; j++) m += metros(pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1]);
        km = m / 1000;
      }
      return { k, q, t, km, pts };
    }).sort((a, b) => a.t - b.t).slice(0, MOSTRAR);
    return { lat, lng, no, d: metros(lat, lng, g.lat[no], g.lng[no]), lista };
  }

  // ---------- viaturas disponíveis de cada quartel (da última resposta de verCarros) ----------

  // null = ainda sem resposta para esta morada
  function viaturasDe(quartel) {
    if (typeof ultimosCarros === "undefined" || !ultimosCarros || ultimosCarros.c !== candidatos[sel]) return null;
    const a = semAcentos(quartel), nomes = [];
    for (const x of ultimosCarros.todos) {
      if (x.classe !== "ok" || !x.quartel) continue;
      const b = semAcentos(x.quartel);
      if ((a.includes(b) || b.includes(a)) && !nomes.includes(x.nome)) nomes.push(x.nome);
    }
    return nomes;
  }

  // ---------- mapa ----------

  let mapa = null, pinoApx = null;
  const camadaQuarteis = L.layerGroup(), camadaPercursos = L.layerGroup();

  // só se cria com o painel visível: o Leaflet precisa do tamanho da caixa
  function criarMapa() {
    if (mapa) return;
    mapa = L.map("apxMapa").setView([38.74, -9.15], 13);
    const camada = L.tileLayer(MAPA_BASE, { minZoom: 11, maxZoom: 20, maxNativeZoom: 20, attribution: "CM Lisboa" }).addTo(mapa);
    // um quadrado que falha fica cinzento (o Leaflet não o volta a pedir): pede-se outra vez, até 3 vezes, com mais espera
    camada.on("tileerror", ({ tile, coords }) => {
      const n = (Number(tile.dataset.tentativas) || 0) + 1;
      if (n > 3) return;
      tile.dataset.tentativas = n;
      setTimeout(() => { if (tile.isConnected) tile.src = camada.getTileUrl(coords) + "?tentativa=" + n; }, 700 * n);
    });
    camadaQuarteis.addTo(mapa);
    camadaPercursos.addTo(mapa);
    new ResizeObserver(([e]) => { if (e.contentRect.width && e.contentRect.height) mapa.invalidateSize(); }).observe($("apxMapa"));
  }

  function desenharPercursos() {
    camadaPercursos.clearLayers();
    const pontos = [[calc.lat, calc.lng]];
    calc.lista.forEach((x, pos) => {
      if (!visiveis.has(x.k) || !x.pts.length) return;
      const cor = CORES[x.k], tracejado = pos > 0;
      L.polyline(x.pts, { color: "#fff", weight: 8, opacity: 0.9, interactive: false }).addTo(camadaPercursos);
      L.polyline(x.pts, { color: cor, weight: 5, dashArray: tracejado ? "10 8" : null, interactive: false }).addTo(camadaPercursos);
      // do quartel à rua e da rua à morada, a direito
      L.polyline([[x.q.lat, x.q.lng], x.pts[0]], { color: cor, weight: 2, dashArray: "2 5", interactive: false }).addTo(camadaPercursos);
      L.polyline([x.pts[x.pts.length - 1], [calc.lat, calc.lng]], { color: cor, weight: 2, dashArray: "2 5", interactive: false }).addTo(camadaPercursos);
      pontos.push(...x.pts, [x.q.lat, x.q.lng]);
    });
    if (pontos.length > 1) mapa.fitBounds(L.latLngBounds(pontos), { padding: [30, 30], animate: false, maxZoom: 17 });
    else mapa.setView([calc.lat, calc.lng], 16, { animate: false });
  }

  function desenharMapa() {
    criarMapa();
    mapa.invalidateSize();
    camadaQuarteis.clearLayers();
    QUARTEIS.forEach((q, k) => {
      L.circleMarker([q.lat, q.lng], { radius: 7, color: "#fff", weight: 2, fillColor: CORES[k], fillOpacity: 1 })
        .bindTooltip(q.nome, { direction: "right", offset: [8, 0] }).addTo(camadaQuarteis);
    });
    if (pinoApx) pinoApx.remove();
    pinoApx = L.marker([calc.lat, calc.lng], { keyboard: false, interactive: false, icon: L.divIcon({ className: "pino", html: PINO_SVG, iconSize: [30, 45], iconAnchor: [15, 45] }) }).addTo(mapa);
    desenharPercursos();
  }

  // ---------- tabela ----------

  function desenharTabela() {
    const corpo = $("apxCorpo");
    corpo.innerHTML = "";
    for (const x of calc.lista) {
      const tr = document.createElement("tr"), viat = viaturasDe(x.q.nome);
      tr.className = "apx-linha" + (visiveis.has(x.k) ? " visto" : "");
      tr.title = "Mostrar / esconder o percurso";
      const cor = document.createElement("span");
      cor.className = "apx-cor";
      cor.style.background = CORES[x.k];
      const nome = document.createElement("td");
      nome.append(cor, x.q.nome); // texto, nunca HTML
      const outras = [minutos(x.t), isFinite(x.km) ? x.km.toFixed(1).replace(".", ",") + " km" : "—",
        viat === null ? "…" : viat.length ? viat.join(", ") : "nenhuma"].map(txt => Object.assign(document.createElement("td"), { textContent: txt }));
      outras[0].className = outras[1].className = "apx-num";
      outras[2].className = "apx-viat";
      tr.append(nome, ...outras);
      tr.addEventListener("click", () => {
        if (!x.pts.length) return;
        if (!visiveis.delete(x.k)) visiveis.add(x.k);
        tr.classList.toggle("visto", visiveis.has(x.k));
        desenharPercursos();
      });
      corpo.appendChild(tr);
    }
  }

  // ---------- atualizar (chamada pelo separador, por desenharMapa e por verCarros) ----------

  let seq = 0;
  async function atualizarAproximacoes() {
    const painel = $("painelAproximacoes");
    if (painel.hidden) return;
    if (!mapaPonto) { apxSemMorada(); return; }
    const { lat, lng } = mapaPonto, meu = ++seq;
    painel.classList.remove("velho");
    if (!g) {
      $("apxConteudo").hidden = true;
      try { await carregarRuas(); } catch (e) {
        if (meu === seq) mostrarEstado("Aproximações: " + e.message + ". Muda de separador e volta para tentar outra vez.", true);
        return;
      }
      if (meu !== seq) return; // entretanto veio outra chamada, que trata de tudo
    }
    $("apxConteudo").hidden = false;
    if (!calc || calc.lat !== lat || calc.lng !== lng) {
      mostrarEstado("A calcular…");
      await pausa();
      if (meu !== seq) return;
      calc = calcular(lat, lng);
      visiveis = new Set(calc.lista.length ? [calc.lista[0].k] : []);
      if (calc.no < 0) {
        mostrarEstado("Sem ruas a menos de 300 m desta morada: não dá para calcular por estrada.", true);
        $("apxCorpo").innerHTML = "";
        return;
      }
      desenharMapa();
    }
    if (calc.no < 0) return;
    mostrarEstado("");
    $("apxNota").textContent = `Tempos estimados pelas velocidades médias por tipo de via (OSM); até ao ponto de rua a ${Math.round(calc.d)} m.`;
    desenharTabela();
  }

  // sem morada localizada (a procurar outra, ou limpa): o painel fica esbatido com a mensagem
  function apxSemMorada() {
    seq++;
    const painel = $("painelAproximacoes");
    painel.classList.add("velho");
    if (!painel.hidden) mostrarEstado("Sem morada localizada: escreve uma morada para ver as aproximações.");
  }

  window.atualizarAproximacoes = atualizarAproximacoes;
  window.apxSemMorada = apxSemMorada;
})();
