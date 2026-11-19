// ---------- ocorrências já abertas (lista do rsbgo-dispatch) ----------

// linhas da lista que têm todas as palavras do nome da rua; marca as que têm também o número de porta
function ocorrenciasNaMorada(linhas, morada) {
  const [rua, porta = ""] = morada.split(/,\s*/);
  const chave = partes(semAcentos(rua).split(" ")).nucleo.split(" ").filter(p => p.length >= 3 || /\d/.test(p));
  if (!chave.length) return [];
  const p0 = semAcentos(porta).replace(/ /g, ""), soNumero = (p0.match(/^\d+/) || [""])[0];
  const res = [];
  for (const l of linhas) {
    const pal = semAcentos(l.map(([, v]) => v).join(" ")).split(" ").map(p => SINONIMOS[p] || p);
    const pos = chave.map(c => pal.indexOf(c));
    if (pos.some(i => i < 0)) continue;
    const fim = Math.max(...pos);
    const mesmaPorta = !!p0 && pal.slice(fim + 1, fim + 4).some(p => p === p0 || p === soNumero);
    res.push({ l, mesmaPorta });
  }
  return res.sort((a, b) => b.mesmaPorta - a.mesmaPorta);
}

function verOcorrencias(c) {
  const el = $("rOcorr");
  q112("ocorrencias", null, 20000).then(d => {
    if (candidatos[sel] !== c) return;
    const encontradas = ocorrenciasNaMorada(d.linhas || [], c.moradaAjustada || c.MORADA);
    el.innerHTML = "";
    const titulo = document.createElement("div");
    titulo.className = "titulo";
    el.appendChild(titulo);
    if (!encontradas.length) { titulo.textContent = "Sem ocorrências na lista para esta rua"; return; }
    const noNumero = encontradas.filter(x => x.mesmaPorta), naRua = encontradas.filter(x => !x.mesmaPorta);
    // só quantas e as viaturas de cada uma, sem os detalhes (no número e na mesma rua)
    const viaturas = l => l.some(x => viaturasDe(x.l).length) ? " — " + l.map(x => viaturasDe(x.l).join(", ") || "sem viatura").join(" · ") : "";
    const resumoRua = `${naRua.length} ocorrência(s) na mesma rua` + viaturas(naRua);
    if (!noNumero.length) { titulo.classList.add("rua"); titulo.textContent = resumoRua; return; }
    titulo.classList.add("alerta");
    titulo.textContent = `⚠ ${noNumero.length} ocorrência(s) neste número` + viaturas(noNumero);
    if (naRua.length) {
      const r = document.createElement("div");
      r.className = "titulo rua";
      r.textContent = resumoRua;
      el.appendChild(r);
    }
  }).catch(e => { if (candidatos[sel] === c) el.textContent = "Ocorrências: " + e.message; });
}

// viaturas de uma linha da lista de ocorrências: da coluna das viaturas/meios, se houver; senão procura nomes de carros na linha toda
const RE_VIATURAS = /\b(?:VUCI|VSAT|VTTU|VE|ABSC|VLCI|VCOT|VOPE|VFCI|VECI|VPMT|VPMA|VAME|VLTP|VALE|VSAE|VP)(?:\/[A-Z]+)?\s*\d+(?:\s\d{2})?\b/g;
function viaturasDe(l) {
  const col = l.find(([cab]) => /viat|meio/i.test(cab));
  const nomes = (col ? col[1] : l.map(([, v]) => v).join(" ")).match(RE_VIATURAS);
  return nomes ? [...new Set(nomes.map(n => n.replace(/\s+/g, " ")))] : col ? [col[1]] : [];
}
