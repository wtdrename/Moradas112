// lista de sugestões: contador no separador e texto quando não há
function atualizarSugestoes() {
  const n = lista.hidden ? 0 : candidatos.length;
  $("tabSugestoesN").textContent = n ? String(n) : "";
  $("listaVazia").hidden = !!n;
}

function limpar() {
  candidatos = [];
  ponto = null;
  botaoGoMAP.disabled = true;
  lista.hidden = resultado.hidden = avisoEl.hidden = true;
  atualizarSugestoes();
  limparMapa();
}

function mostrar(c, aviso) {
  const vistas = new Set();
  candidatos = c.filter(x => !vistas.has(x.MORADA) && vistas.add(x.MORADA)).slice(0, 10);
  lista.innerHTML = "";
  candidatos.forEach((x, i) => {
    const li = document.createElement("li");
    li.textContent = x.MORADA;
    li.addEventListener("click", () => { escolher(i); caixa.focus(); });
    lista.appendChild(li);
  });
  lista.hidden = candidatos.length < 2;
  atualizarSugestoes();
  avisoEl.hidden = !aviso;
  if (aviso) avisoEl.textContent = aviso;
  estado("");
  escolher(0);
}

function escolher(i) {
  sel = i;
  [...lista.children].forEach((li, j) => li.classList.toggle("sel", j === i));
  const c = candidatos[i];
  ponto = null;
  seqPino++;
  delete c.moradaAjustada;
  $("mapaRepor").hidden = true;
  botaoGoMAP.disabled = true;
  resultado.hidden = false;
  $("rMorada").textContent = c.MORADA;
  $("rMoradaNota").hidden = true;
  linha($("rQuartel"), "Quartel", "…");
  linha($("rChefe"), "Chefe de serviço", "…");
  $("rOcorr").textContent = "A ver ocorrências…";
  $("rCarros").textContent = $("rVoluntarios").textContent = "";
  mapaEmEspera("A localizar " + c.MORADA + "…");
  verOcorrencias(c);
  areas(c).then(d => {
    if (candidatos[sel] !== c) return;
    if (!d) { linha($("rQuartel"), "Quartel", "geometria não encontrada", true); linha($("rChefe"), "Chefe de serviço", "—"); mapaEmEspera("Sem localização para esta morada."); return; }
    ponto = d.ponto ? { ...d.ponto, morada: c.MORADA } : null;
    c.pontoMorada = d.ponto;
    mostrarMapa(d.ponto, c.MORADA);
    botaoGoMAP.disabled = !ponto;
    mostrarAreas(c, d);
    atualizarGoMAP(c); // "Voltar ao ponto da morada" depois de marcar
  }).catch(e => {
    if (candidatos[sel] !== c) return;
    mapaEmEspera("Sem localização: " + e.message);
    linha($("rQuartel"), "Quartel", e.message, true);
    linha($("rChefe"), "Chefe de serviço", "—");
  });
}

// quartel, chefe, carros e voluntários de um ponto (o da morada ou o do pin arrastado)
function mostrarAreas(c, d) {
  if (d.quartel.erro) {
    linha($("rQuartel"), "Quartel", d.quartel.erro, true);
    c.quarteis = null; // sem quartel, os carros de um ponto anterior já não valem
    $("rCarros").textContent = $("rVoluntarios").textContent = "";
  } else {
    linha($("rQuartel"), "Quartel", (d.quartel.length ? d.quartel.join(" / ") : "fora das áreas do RSB")
      + (d.tambem && d.tambem.length ? ` (a rua passa também por: ${d.tambem.join(", ")} — põe o nº de porta para ter a certeza)` : ""));
    c.quarteis = d.quartel;
    c.ponto = d.ponto;
    c.chefe = d.chefe.erro ? [] : d.chefe.nomes;
    $("rCarros").textContent = "A ver carros…";
    verCarros(c);
    verVoluntarios(c);
  }
  if (d.chefe.erro) linha($("rChefe"), "Chefe de serviço", d.chefe.erro, true);
  else {
    // "3º Batalhão- Zona Norte e Oriental" -> "3º Batalhão"
    const curtos = [...new Set(d.chefe.nomes.map(n => n.split("-")[0].trim()))];
    linha($("rChefe"), "Chefe de serviço", curtos.length ? curtos.join(" / ") : "—");
  }
}

function linha(el, rotulo, valor, erro) {
  el.innerHTML = '<span class="rotulo"></span><span></span>';
  el.firstChild.textContent = rotulo;
  el.lastChild.textContent = valor;
  el.classList.toggle("erro", !!erro);
}

// números que existem ao lado do nº que não existe: ficam no aviso como botões, que pesquisam esse número
async function verPortasAoLado(c, meu) {
  if (!c.semNumero) return;
  const portas = await portasAoLado(c.rua, c.semNumero, () => meu === seq);
  if (meu !== seq || !portas.length) return;
  const el = document.createElement("div");
  el.className = "portasLado";
  el.textContent = "Números ao lado:";
  for (const x of portas) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = x.MORADA.split(",").pop().trim();
    b.title = x.MORADA;
    b.addEventListener("click", () => { caixa.value = x.MORADA; pesquisar(); caixa.focus(); });
    el.append(" ", b);
  }
  avisoEl.appendChild(el);
}

async function pesquisar() {
  const meu = ++seq;
  const texto = caixa.value.trim();
  if (texto.length < 3) { limpar(); estado(""); return; }
  estado("A procurar…");
  try {
    let c = await procurar(texto);
    // "rua x 10, 3º esq, lisboa" -> tenta só a parte antes da vírgula
    if (!c.length && texto.includes(",")) c = await procurar(texto.split(",")[0]);
    if (meu !== seq) return;
    if (c.length) { mostrar(c, avisoSemNumero(c)); return verPortasAoLado(c, meu); }
    // erro de escrita: procura na lista de ruas e confirma cada sugestão na pesquisa de moradas
    const sugestoes = corrigirLocal(texto);
    if (sugestoes.length) {
      // de cada sugestão ficam os primeiros resultados (a correspondência exata vem primeiro)
      const listas = await Promise.all(sugestoes.map(s => procurar(s).catch(() => [])));
      if (meu !== seq) return;
      const cl = listas.flatMap(l => l.slice(0, 5));
      const semN = listas.find(l => l.length && l.semNumero);
      if (cl.length) {
        mostrar(cl, ["Corrigido: " + sugestoes.join(" · "), semN && avisoSemNumero(semN)].filter(Boolean).join(" — "));
        return semN && verPortasAoLado(semN, meu);
      }
    }
    limpar();
    estado("Morada não encontrada.");
  } catch (e) {
    if (meu === seq) { limpar(); estado(e.message, true); }
  }
}

caixa.addEventListener("input", () => {
  // o texto mudou: o ponto mostrado já não é o desta morada até a pesquisa nova acabar
  ponto = null;
  botaoGoMAP.disabled = true;
  aquecer();
  clearTimeout(tPesquisa); tPesquisa = setTimeout(pesquisar, 300);
});
caixa.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); marcarGoMAP(); }
  else if (e.key === "Escape") { caixa.value = ""; ++seq; clearTimeout(tPesquisa); limpar(); estado(""); }
  else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && candidatos.length) {
    e.preventDefault();
    escolher((sel + (e.key === "ArrowDown" ? 1 : candidatos.length - 1)) % candidatos.length);
  }
});

botaoGoMAP.addEventListener("click", () => { marcarGoMAP(); caixa.focus(); });
