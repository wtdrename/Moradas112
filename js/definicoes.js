// ---------- larguras das três colunas (Mapa | morada | Notas): pegas para arrastar, gravadas neste PC ----------
// Arrastar uma pega troca largura só entre as duas colunas vizinhas. Duplo clique repõe. Só com as três lado a lado.
function reporColunas() {
  const main = document.querySelector("main");
  main.classList.remove("ajustado");
  main.style.removeProperty("--colunas");
  try { localStorage.removeItem("moradasColunas"); } catch {}
}
(() => {
  const main = document.querySelector("main"), colunas = [$("mapa"), $("coluna"), $("notas")];
  const MINIMO = 300, CHAVE = "moradasColunas";
  const pegas = [0, 1].map(() => {
    const p = document.createElement("div");
    p.className = "pega";
    p.title = "Arrasta para mudar a largura das colunas · duplo clique repõe";
    main.appendChild(p);
    return p;
  });
  const tresColunas = () => pegas[0].offsetParent !== null;   // as pegas só se veem com o ecrã largo (CSS)

  function aplicar(larguras) {
    main.style.setProperty("--colunas", larguras.map(w => `minmax(${MINIMO}px, ${Math.round(w)}fr)`).join(" "));
    main.classList.add("ajustado");
  }
  function posicionar() {
    if (!tresColunas()) return;
    const base = main.getBoundingClientRect().left;
    pegas.forEach((p, i) => {
      const fim = colunas[i].getBoundingClientRect().right, inicio = colunas[i + 1].getBoundingClientRect().left;
      p.style.left = `${(fim + inicio) / 2 - base - p.offsetWidth / 2}px`;
    });
  }

  try {
    const g = JSON.parse(localStorage.getItem(CHAVE));
    if (Array.isArray(g) && g.length === 3 && g.every(w => typeof w === "number" && w > 0)) aplicar(g);
  } catch {}

  pegas.forEach((p, i) => {
    p.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const inicio = e.clientX, w = colunas.map(c => c.getBoundingClientRect().width);
      let atual = null;   // só grava se a pega mexeu (um clique não muda nada)
      p.setPointerCapture(e.pointerId);
      document.body.classList.add("a-arrastar");
      const mover = ev => {
        const total = w[i] + w[i + 1];
        const a = Math.min(Math.max(w[i] + ev.clientX - inicio, MINIMO), total - MINIMO);
        atual = w.slice();
        atual[i] = a;
        atual[i + 1] = total - a;
        aplicar(atual);
      };
      const largar = () => {
        p.removeEventListener("pointermove", mover);
        p.removeEventListener("pointerup", largar);
        p.removeEventListener("pointercancel", largar);
        document.body.classList.remove("a-arrastar");
        if (atual) try { localStorage.setItem(CHAVE, JSON.stringify(atual.map(Math.round))); } catch {}
      };
      p.addEventListener("pointermove", mover);
      p.addEventListener("pointerup", largar);
      p.addEventListener("pointercancel", largar);
    });
    p.addEventListener("dblclick", reporColunas);
  });

  // qualquer mudança de tamanho (pega, janela, conteúdo): acerta as pegas e o mapa
  new ResizeObserver(() => { posicionar(); if (mapaL) mapaL.invalidateSize(); }).observe(main);
  for (const c of colunas) new ResizeObserver(posicionar).observe(c);
})();
// ---------- definições da página (separador ⚙ Definições): tema e larguras das colunas, gravados neste PC ----------
const defTema = $("defTema");
defTema.value = document.documentElement.dataset.tema || "";
defTema.addEventListener("change", () => {
  const t = defTema.value;
  if (t) document.documentElement.dataset.tema = t; else delete document.documentElement.dataset.tema;
  try { if (t) localStorage.setItem("moradasTema", t); else localStorage.removeItem("moradasTema"); } catch {}
});
$("defColunas").addEventListener("click", reporColunas);
