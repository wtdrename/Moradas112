// ---------- comum: elementos da página, estado da pesquisa e mensagens (usados por vários ficheiros) ----------

const $ = id => document.getElementById(id);
const caixa = $("caixa"), lista = $("lista"), estadoEl = $("estado"), avisoEl = $("aviso"), resultado = $("resultado");
// aberta pelo servidor deste PC (iniciar.bat) ou pelo GitHub Pages; sem servidor não há notas no disco, nem Preparar PC,
// nem o script da pasta para comparar versões
const COM_SERVIDOR = location.hostname === "localhost";

let seq = 0, candidatos = [], sel = 0, tPesquisa, ponto = null;
const botaoGoMAP = $("botaoGoMAP");

function estado(msg, erro) { estadoEl.textContent = msg || ""; estadoEl.className = erro ? "erro" : ""; }
