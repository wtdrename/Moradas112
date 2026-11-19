// ---------- comum: elementos da página, estado da pesquisa e mensagens (usados por vários ficheiros) ----------

const $ = id => document.getElementById(id);
const caixa = $("caixa"), lista = $("lista"), estadoEl = $("estado"), avisoEl = $("aviso"), resultado = $("resultado");

let seq = 0, candidatos = [], sel = 0, tPesquisa, ponto = null;
const botaoGoMAP = $("botaoGoMAP");

function estado(msg, erro) { estadoEl.textContent = msg || ""; estadoEl.className = erro ? "erro" : ""; }
