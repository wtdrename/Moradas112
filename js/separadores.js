// ---------- separadores Mapa / Sugestões de moradas / folha de viaturas ----------
const tabMapa = $("tabMapa"), tabGoogle = $("tabGoogle"), tabSugestoes = $("tabSugestoes"), tabFolha = $("tabFolha");
function mudarTab(nome) {
  for (const [tab, painel, n] of [[tabMapa, "painelMapa", "mapa"], [tabGoogle, "painelGoogle", "google"], [tabSugestoes, "painelSugestoes", "sugestoes"], [tabFolha, "painelFolha", "folha"]]) {
    tab.classList.toggle("ativa", n === nome);
    tab.setAttribute("aria-selected", String(n === nome));
    $(painel).hidden = n !== nome;
  }
  // o mapa escondido não tem tamanho: acerta-o ao voltar a este separador
  if (nome === "mapa" && mapaL) { mapaL.invalidateSize(); if (mapaPonto) mapaL.panTo([mapaPonto.lat, mapaPonto.lng], { animate: false }); }
  if (nome === "google") atualizarGoogle();
  try { localStorage.setItem("moradasTab", nome); } catch {}
}
tabMapa.addEventListener("click", () => { mudarTab("mapa"); caixa.focus(); });
tabGoogle.addEventListener("click", () => { mudarTab("google"); caixa.focus(); });
tabSugestoes.addEventListener("click", () => { mudarTab("sugestoes"); caixa.focus(); });
tabFolha.addEventListener("click", () => mudarTab("folha"));
try { if (localStorage.getItem("moradasTab") === "sugestoes" || localStorage.getItem("moradasTab") === "google") mudarTab(localStorage.getItem("moradasTab")); } catch {}
