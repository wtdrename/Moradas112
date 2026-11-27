// ---------- carros do quartel da zona (folha VIATURAS OPERACIONAIS + lista de ocorrências) ----------

// quantos mostrar de cada tipo nos "Disponíveis mais próximos" (os VOPE têm secções próprias)
const TIPOS_PROXIMOS = { VUCI: 2, VE: 1, VTTU: 1, VSAT: 1 };
// as regras (estado de cada carro, distâncias, VOPE da área, VLCI que contam como VOPE) estão só no script
// Quartéis 112 (carrosPara); aqui só se desenha o que ele devolve
const fmtDist = x => x.d == null ? "distância desconhecida" : (x.aprox ? "~" : "") + x.d.toFixed(1).replace(".", ",") + " km";
const umaVez = l => l.filter((x, i) => l.findIndex(o => o.nome === x.nome) === i); // o mesmo carro em duas linhas da folha

function linhaCarro(el, nome, texto, classe) {
  const div = document.createElement("div");
  div.className = "carro";
  div.innerHTML = '<span class="nome"></span><span></span>';
  div.firstChild.textContent = nome;
  div.lastChild.textContent = texto;
  div.lastChild.className = classe;
  el.appendChild(div);
}

function titulo(el, texto) {
  const t = document.createElement("div");
  t.className = "titulo";
  t.textContent = texto;
  el.appendChild(t);
}

// última resposta dos carros (para o separador Aproximações); só vale para a morada em c
let ultimosCarros = null;
function verCarros(c) {
  if (ultimosCarros && ultimosCarros.c !== c) ultimosCarros = null;
  const el = $("rCarros");
  if (!c.quarteis || !c.quarteis.length) { el.textContent = ""; return; }
  q112("carros", { ponto: c.ponto, quarteis: c.quarteis, chefe: c.chefe || [] }, 30000).then(r => {
    if (candidatos[sel] !== c) return;
    const todos = r.todos;
    ultimosCarros = { c, todos };
    if (typeof atualizarAproximacoes === "function") atualizarAproximacoes();
    el.innerHTML = "";

    const daZona = todos.filter(x => x.doLocal);
    titulo(el, daZona.length ? "Carros do quartel" : `"${c.quarteis.join(" / ")}" não encontrado na folha de viaturas`);
    for (const x of daZona) linhaCarro(el, x.nome, x.texto, x.classe);

    // os disponíveis mais próximos de cada tipo, de outros quartéis (os do quartel do local já estão em "Carros do quartel")
    titulo(el, "Disponíveis mais próximos, de outros quartéis" + (r.porEstrada ? " (por estrada)" : " (em linha reta)"));
    for (const [tipo, quantos] of Object.entries(TIPOS_PROXIMOS)) {
      const livres = umaVez(todos.filter(x => x.tipo === tipo && x.classe === "ok" && !daZona.some(z => z.nome === x.nome)))
        .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9));
      for (const x of livres.slice(0, quantos))
        linhaCarro(el, x.nome, `✅ ${x.quartel} · ${fmtDist(x)}` + (x.condicao.length ? ` (à condição de ${x.condicao.join(", ")})` : ""), "ok");
      if (livres.length < quantos) linhaCarro(el, tipo, livres.length ? `só ${livres.length} livre noutros quartéis` : "nenhum livre noutros quartéis", "mal");
    }

    // Área de VOPE (os do batalhão do chefe de serviço da área, pela folha) e os outros VOPE disponíveis mais perto
    titulo(el, "Área de VOPE" + (r.bat ? (r.bat === "BIDF" ? " (BIDF)" : ` (${r.bat}º Batalhão)`) : ""));
    for (const x of r.vopeArea) linhaCarro(el, x.nome, `${x.texto} · ${x.quartel} · ${fmtDist(x)}`, x.classe);
    if (!r.vopeArea.length) linhaCarro(el, "VOPE", r.bat ? "nenhum VOPE a sair para socorro neste batalhão" : "batalhão da área desconhecido", "mal");
    titulo(el, "VOPE disponíveis mais perto");
    for (const x of r.vopeOutros.slice(0, 3)) linhaCarro(el, x.nome, `${x.texto} · ${x.quartel} · ${fmtDist(x)}`, x.classe);
    if (!r.vopeOutros.length) linhaCarro(el, "VOPE", "nenhum outro VOPE disponível", "mal");

    if (r.notas.length) el.appendChild(Object.assign(document.createElement("div"), { textContent: "(" + r.notas.join("; ") + ")" }));
  }).catch(e => { if (candidatos[sel] === c) el.textContent = "Carros: " + e.message; });
}

// os 3 quartéis de bombeiros voluntários mais próximos da morada (camada "B. Voluntários" do goMAP)
function verVoluntarios(c) {
  const el = $("rVoluntarios");
  if (!c.ponto) { el.textContent = ""; return; }
  q112("voluntarios", c.ponto, 25000).then(v => {
    if (candidatos[sel] !== c) return;
    el.innerHTML = "";
    titulo(el, "Bombeiros voluntários mais próximos" + (/área/i.test(v.origem) ? " (distância ao centro da área)" : ""));
    v.perto.forEach(p => linhaCarro(el, p.nome, p.d.toFixed(1).replace(".", ",") + " km", ""));
  }).catch(e => { if (candidatos[sel] === c) el.textContent = "Voluntários: " + e.message; });
}

// a lista muda: volta a ver a morada mostrada de 15 em 15 segundos
setInterval(() => {
  if (resultado.hidden || !candidatos[sel]) return;
  verOcorrencias(candidatos[sel]);
  verCarros(candidatos[sel]);
}, 15000);
