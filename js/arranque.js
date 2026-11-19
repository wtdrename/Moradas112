// compara a versão do script instalado no Tampermonkey com a que está na pasta (sem servidor não há pasta: só se
// avisa de cópias repetidas)
function avisarVersao(instalada) {
  const naPasta = COM_SERVIDOR
    ? fetch("/quarteis-112.user.js", { cache: "no-store" }).then(r => r.text()).then(js => (js.match(/@version\s+(\S+)/) || [])[1])
    : Promise.resolve(undefined);
  naPasta.then(versao => {
    const a = $("atualizar");
    if (versoesVistas.size > 1) {
      const antigas = versao ? [...versoesVistas].filter(v => v !== versao) : null;
      a.textContent = `⚠ O script Quartéis 112 está instalado ${versoesVistas.size} vezes (${[...versoesVistas].join(", ")}). No Tampermonkey (painel de controlo) apaga `
        + (antigas ? `a cópia ${antigas.join(", ")}` : "as cópias mais antigas") + " e faz F5.";
      a.removeAttribute("href");
      a.hidden = false;
      return;
    }
    // versão nova: não se avisa nem se abre a página de instalação; o Tampermonkey atualiza-o sozinho (@updateURL)
    if (versao && versao !== instalada) console.log(`[Moradas 112] script ${instalada} instalado, ${versao} na pasta: o Tampermonkey atualiza-o sozinho`);
  }).catch(() => {});
}

// moradas#diagnostico: mostra as camadas e os nomes dos quartéis do mapa, e a ligação aos quartéis da folha
async function diagnostico() {
  const pre = document.createElement("pre");
  pre.style.cssText = "white-space:pre-wrap;font-size:13px;background:var(--cartao);border:1px solid var(--borda);border-radius:8px;padding:12px";
  pre.textContent = "A ler o mapa…";
  document.querySelector("main").appendChild(pre);
  try {
    const d = await q112("diagnostico", null, 60000);
    const linhas = ["CAMADAS DOS TEMAS RSB:", ...d.camadas];
    for (const [titulo, x] of [["QUARTÉIS", d.pq], ["VOLUNTÁRIOS", d.vol]]) {
      linhas.push("", titulo + ":");
      if (x.erro) linhas.push("  erro: " + x.erro);
      else linhas.push("  origem: " + x.origem, ...x.postos.map(p => `  ${p.nome}${p.aprox ? "  [centro da área]" : ""}  (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`));
    }
    linhas.push("", "QUARTÉIS DA FOLHA → MAPA:");
    // a ligação é feita pelo script (a regra está só lá)
    if (d.ligacoes.erro) linhas.push("  erro: " + d.ligacoes.erro);
    else for (const [q, p] of d.ligacoes) linhas.push(`  ${q} → ${p || "NÃO ENCONTRADO"}`);
    pre.textContent = linhas.join("\n");
  } catch (e) { pre.textContent = "Erro: " + e.message; }
}
if (location.hash === "#diagnostico") diagnostico();

if (location.protocol === "file:") estado("Esta página tem de ser aberta em http://localhost:8765/moradas (atalho \"Moradas 112\" na pasta), com o iniciar.bat a correr.", true);
else q112("ping", null, 1500)
  .then(d => {
    setTimeout(() => avisarVersao(d.versao), 800); // dá tempo às outras cópias de responderem
    if (!d.token) estado("Sem token — abre o goMAP uma vez para o script o apanhar.", true);
    else if (!indiceRuas().length) estado("Lista de ruas não carregada: " + (COM_SERVIDOR ? "fecha e volta a abrir o iniciar.bat" : "faz F5")
      + " (sem ela os erros de escrita não são corrigidos).", true);
  })
  .catch(e => estado(e.message, true));

// "Preparar PC": as páginas que já estiverem abertas só recarregam e abrem-se as que faltam.
// Com uma Moradas 112 aberta, o pedido vem pelo servidor (/abrir) e não se abre separador nenhum;
// sem nenhuma, o Preparar PC abre esta página com moradas#abrir.
// As páginas a abrir vêm sempre do servidor, nunca do endereço: qualquer site pode abrir "moradas#abrir|<url>" (ou pô-la
// num iframe), e assim punha o script a abrir páginas à escolha dele e a recarregar o oncall e o rsbGO.
// Quem abre e quais as páginas permitidas é o script (paginasPermitidas).
function abrirPedidas(urls, separadorNovo) {
  q112("abrir", urls, 8000).then(r => {
    if (r.recusadas && r.recusadas.length) estado("Pedido de abrir páginas que não são do programa: ignorado.", true);
    // separador a mais: quem o fecha é o script (@grant window.close); esta mensagem só fica se ele não conseguir
    if (separadorNovo && r.moradasOutra) {
      estado("As páginas já estavam abertas e foram atualizadas: podes fechar este separador.");
      q112("fechar", null, 3000).catch(() => {});
    } else if (r.jaAbertas.length) estado("As páginas que já estavam abertas foram atualizadas.");
  }).catch(() => {
    // script antigo (sem "abrir"): ligações para abrir à mão (só https, como as do Preparar PC)
    const certas = urls.filter(u => typeof u === "string" && /^https:\/\/[^/]+/i.test(u));
    if (!certas.length) return;
    avisoEl.hidden = false;
    avisoEl.textContent = "Abre: ";
    certas.forEach((u, i) => {
      if (i) avisoEl.append(" · ");
      avisoEl.appendChild(Object.assign(document.createElement("a"), { href: u, target: "_blank", rel: "noopener", textContent: new URL(u).hostname.split(".")[0] }));
    });
  });
}
// dentro de um iframe (de outro site) não se abre nem se recarrega nada; sem servidor (GitHub Pages) não há Preparar PC
if (window.top === window && COM_SERVIDOR) {
  if (location.hash.startsWith("#abrir")) {
    history.replaceState(null, "", location.pathname); // um F5 depois disto já não volta a abrir nada
    // o pedido que o Preparar PC deixou no servidor (POST /abrir) nos últimos 60 segundos; sem ele, o #abrir não veio do Preparar PC
    fetch("/abrir?preparar", { cache: "no-store" }).then(r => r.json())
      .then(r => {
        if (r.urls && r.urls.length) abrirPedidas(r.urls, true);
        else estado("Pedido para abrir as páginas ignorado: não veio do Preparar PC. Se foste tu, fecha e volta a abrir o iniciar.bat e corre outra vez o Preparar PC.", true);
      })
      .catch(() => estado("Sem ligação ao servidor: abre o iniciar.bat.", true));
  }
  setInterval(() => {
    fetch("/abrir", { cache: "no-store" }).then(r => r.json())
      .then(r => { if (r.urls && r.urls.length) abrirPedidas(r.urls, false); })
      .catch(() => {}); // servidor desligado: volta a tentar daqui a 2 segundos
  }, 2000);
}
