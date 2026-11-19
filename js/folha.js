// ---------- folha de viaturas: a página só mostra e pede; a lista e a leitura ficam no script ----------
const folhaLista = $("folhaLista"), folhaEstado = $("folhaEstado");
let folhaEmUso = null;

function mostrarFolhas(d) {
  folhaLista.innerHTML = "";
  for (const f of d.lista) folhaLista.add(new Option(f.nome + (f.codigo ? " · " + f.codigo : ""), f.id));
  folhaLista.value = folhaEmUso = d.ativa;
  const ativa = d.lista.find(f => f.id === d.ativa);
  tabFolha.title = "Definições — folha de viaturas em uso: " + ativa.nome;
  $("folhaRemover").disabled = !ativa.turno;
  return ativa;
}
function avisoFolha(texto, erro) {
  folhaEstado.textContent = texto;
  folhaEstado.classList.toggle("erro", !!erro);
}
const textoLida = (nome, l) => `Em uso: ${nome} — ${l.viaturas} viaturas em ${l.quarteis.length} quartéis (${l.quarteis.join(", ")}). Confirma se os quartéis estão certos.`;

// os carros da morada aberta são os da folha anterior: pede-os outra vez
async function acaoFolha(tipo, dados, espera, fim) {
  $("folhaCampos").disabled = true;
  avisoFolha(espera);
  try {
    const d = await q112(tipo, dados);
    avisoFolha(fim(d, mostrarFolhas(d)));
    if (candidatos[sel]) verCarros(candidatos[sel]);
    return true;
  } catch (e) {
    folhaLista.value = folhaEmUso;
    avisoFolha(e.message, true);
    return false;
  } finally {
    $("folhaCampos").disabled = false;
  }
}

folhaLista.addEventListener("change", () =>
  acaoFolha("folhaSelecionar", folhaLista.value, "A ler a folha…", (d, ativa) => textoLida(ativa.nome, d.lida)));
$("folhaRemover").addEventListener("click", () => {
  if (!confirm("Remover esta folha da lista? Passas a usar a folha original.")) return;
  acaoFolha("folhaRemover", folhaEmUso, "A remover…", (d, ativa) => "Folha removida. Em uso: " + ativa.nome + ".");
});
$("formFolha").addEventListener("submit", async e => {
  e.preventDefault();
  const ok = await acaoFolha("folhaAdicionar", { link: $("folhaLink").value, turno: $("folhaTurno").value }, "A testar a folha…", (d, ativa) => textoLida(ativa.nome, d.lida));
  if (ok) $("formFolha").reset();
});

// ao voltar a esta página: a folha pode ter mudado noutro separador
function carregarFolhas() {
  q112("folhas", null, 3000).then(mostrarFolhas)
    .catch(e => avisoFolha(`Não consegui ler a lista de folhas (${e.message}) — atualiza o script no Tampermonkey.`, true));
}
carregarFolhas();
window.addEventListener("focus", carregarFolhas);
