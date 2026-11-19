// avisa quando o script Quartéis 112 está instalado mais do que uma vez no Tampermonkey
// (o script é instalado à mão, sem atualizações automáticas)
function avisarVersao() {
  if (versoesVistas.size < 2) return;
  const a = $("atualizar");
  a.textContent = `⚠ O script Quartéis 112 está instalado ${versoesVistas.size} vezes (${[...versoesVistas].join(", ")}). `
    + "No Tampermonkey (painel de controlo) apaga as cópias mais antigas e faz F5.";
  a.removeAttribute("href");
  a.hidden = false;
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

if (location.protocol === "file:") estado("Esta página tem de ser aberta em https://wtdrename.github.io/Moradas112/", true);
else q112("ping", null, 1500)
  .then(d => {
    setTimeout(avisarVersao, 800); // dá tempo às outras cópias de responderem
    if (!d.token) estado("Sem token — abre o goMAP uma vez para o script o apanhar.", true);
    else if (!indiceRuas().length) estado("Lista de ruas não carregada: faz F5 (sem ela os erros de escrita não são corrigidos).", true);
  })
  .catch(e => estado(e.message, true));
