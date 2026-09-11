const CATEGORY_ORDER = [
  "Hortifruti", "Padaria", "Açougue e Peixaria", "Laticínios e Frios",
  "Mercearia", "Bebidas", "Limpeza", "Higiene e Farmácia", "Congelados", "Outros"
];
const DEFAULT_CATEGORY = "Outros";

let items = INITIAL_ITEMS.map(normalizeItem);
let customCategories = CUSTOM_CATEGORIES.slice();
let artifactApi = null;
let mode = "connecting"; // connecting | synced | readonly | local
let cachedSource = null;
let lastCategory = DEFAULT_CATEGORY;

const statusEl = document.getElementById("status");
const bannerEl = document.getElementById("banner");
const listToBuyEl = document.getElementById("listToBuy");
const listBoughtEl = document.getElementById("listBought");
const boughtSectionEl = document.getElementById("boughtSection");
const emptyStateEl = document.getElementById("emptyState");
const clearWrapEl = document.getElementById("clearWrap");
const formEl = document.getElementById("addForm");
const inputEl = document.getElementById("newItem");
const newCatEl = document.getElementById("newCat");
const addCatBtnEl = document.getElementById("addCatBtn");
const newCatRowEl = document.getElementById("newCatRow");
const newCatInputEl = document.getElementById("newCatInput");
const confirmNewCatEl = document.getElementById("confirmNewCat");
const toggleImportEl = document.getElementById("toggleImport");
const importPanelEl = document.getElementById("importPanel");
const importTextEl = document.getElementById("importText");
const importCatEl = document.getElementById("importCat");

function normalizeItem(it){
  return { id: it.id, text: it.text, done: !!it.done, category: (it.category && String(it.category).trim()) || DEFAULT_CATEGORY };
}

function escapeHTML(str){
  return String(str).replace(/[&<>"']/g, function(c){
    return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
  });
}

function makeId(){
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function getKnownCategories(){
  const seen = [];
  const lower = new Set();
  CATEGORY_ORDER.concat(customCategories).concat(items.map(function(i){ return i.category; })).forEach(function(c){
    const key = c.toLowerCase();
    if (!lower.has(key)){ lower.add(key); seen.push(c); }
  });
  return seen;
}

function categoryOptionsHTML(selected){
  return getKnownCategories().map(function(c){
    return '<option value="' + escapeHTML(c) + '"' + (c === selected ? " selected" : "") + '>' + escapeHTML(c) + '</option>';
  }).join("");
}

function refreshCategorySelects(){
  const cats = getKnownCategories();
  if (cats.indexOf(lastCategory) === -1) lastCategory = DEFAULT_CATEGORY;
  const optsHTML = categoryOptionsHTML(lastCategory);
  newCatEl.innerHTML = optsHTML;
  importCatEl.innerHTML = optsHTML;
}

function rowHTML(item){
  return '<li class="row ' + (item.done ? "done" : "") + '" data-id="' + item.id + '">' +
    '<button type="button" class="check" data-action="toggle" aria-pressed="' + (item.done ? "true" : "false") + '" aria-label="Marcar ' + escapeHTML(item.text) + '">' +
      '<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>' +
    '</button>' +
    '<span class="text">' + escapeHTML(item.text) + '</span>' +
    '<button type="button" class="cat-edit" data-action="editcat" aria-label="Mudar categoria de ' + escapeHTML(item.text) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 12.6 12 21l-9-9V4h8l9.4 9.4a2 2 0 0 1 0 2.6Z"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none"/></svg>' +
    '</button>' +
    '<button type="button" class="del" data-action="delete" aria-label="Remover ' + escapeHTML(item.text) + '">&times;</button>' +
    '<div class="cat-editor" hidden>' +
      '<select data-action="catselect" aria-label="Categoria de ' + escapeHTML(item.text) + '">' + categoryOptionsHTML(item.category) + '</select>' +
    '</div>' +
  '</li>';
}

function groupByCategory(list){
  const map = new Map();
  list.forEach(function(it){
    if (!map.has(it.category)) map.set(it.category, []);
    map.get(it.category).push(it);
  });
  const known = CATEGORY_ORDER.filter(function(c){ return map.has(c); });
  const others = Array.from(map.keys()).filter(function(c){ return CATEGORY_ORDER.indexOf(c) === -1; }).sort(function(a,b){ return a.localeCompare(b, "pt"); });
  return known.concat(others).map(function(cat){ return { cat: cat, list: map.get(cat) }; });
}

function render(){
  refreshCategorySelects();

  const toBuy = items.filter(function(i){ return !i.done; });
  const bought = items.filter(function(i){ return i.done; });

  const groups = groupByCategory(toBuy);
  listToBuyEl.innerHTML = groups.map(function(g){
    return '<div class="cat-group"><h3 class="cat-heading">' + escapeHTML(g.cat) + '</h3><ul class="list">' +
      g.list.map(rowHTML).join("") + '</ul></div>';
  }).join("");
  emptyStateEl.hidden = items.length !== 0;

  listBoughtEl.innerHTML = bought.map(rowHTML).join("");
  boughtSectionEl.hidden = bought.length === 0;
  clearWrapEl.hidden = bought.length === 0;

  if (mode === "connecting"){
    statusEl.textContent = "Carregando…";
  } else if (items.length === 0){
    statusEl.textContent = "Lista vazia";
  } else if (toBuy.length === 0){
    statusEl.textContent = "Tudo comprado! ✅";
  } else {
    statusEl.textContent = toBuy.length + (toBuy.length === 1 ? " item para comprar" : " itens para comprar");
  }
}

function showBanner(text){
  bannerEl.textContent = text;
  bannerEl.hidden = false;
}
function hideBanner(){
  bannerEl.hidden = true;
}

function saveLocal(){
  try{ localStorage.setItem("lista-mercado-state", JSON.stringify({ items: items, customCategories: customCategories })); }catch(e){}
}
function loadLocal(){
  try{
    const raw = localStorage.getItem("lista-mercado-state");
    if (raw) return JSON.parse(raw);
  }catch(e){}
  return null;
}

async function persist(){
  if (mode === "readonly") return;

  if (!artifactApi){
    mode = "local";
    saveLocal();
    render();
    return;
  }

  try{
    if (!cachedSource){
      const res = await fetch(location.href, { cache: "no-store" });
      cachedSource = await res.text();
    }
    const newSource = cachedSource.replace(
      /\/\*ITEMS_START\*\/[\s\S]*?\/\*ITEMS_END\*\//,
      "/*ITEMS_START*/\nconst INITIAL_ITEMS = " + JSON.stringify(items) + ";\n/*ITEMS_END*/"
    ).replace(
      /\/\*CATS_START\*\/[\s\S]*?\/\*CATS_END\*\//,
      "/*CATS_START*/\nconst CUSTOM_CATEGORIES = " + JSON.stringify(customCategories) + ";\n/*CATS_END*/"
    );
    await artifactApi.publish(newSource);
    mode = "synced";
    hideBanner();
  }catch(err){
    cachedSource = null;
    if (err && err.code === "conflict"){
      return; // this view is already being reloaded to the winning version
    }
    if (err && (err.code === "not_writer" || err.code === "not_granted")){
      mode = "readonly";
      showBanner("Este link é somente leitura. Peça a quem criou a lista para compartilhar com permissão de edição.");
      render();
      return;
    }
    showBanner("Não foi possível salvar agora. Suas alterações ficam nesta tela até a conexão voltar.");
  }
}

function addItem(text, category){
  items.push({ id: makeId(), text: text, done: false, category: category || DEFAULT_CATEGORY });
  render();
  persist();
}
function toggleItem(id){
  const it = items.find(function(i){ return i.id === id; });
  if (!it) return;
  it.done = !it.done;
  render();
  persist();
}
function deleteItem(id){
  items = items.filter(function(i){ return i.id !== id; });
  render();
  persist();
}
function setCategory(id, category){
  const it = items.find(function(i){ return i.id === id; });
  if (!it) return;
  it.category = category || DEFAULT_CATEGORY;
  render();
  persist();
}
function clearBought(){
  items = items.filter(function(i){ return !i.done; });
  render();
  persist();
}

function commitNewCategory(){
  const val = newCatInputEl.value.trim();
  newCatInputEl.value = "";
  newCatRowEl.hidden = true;
  if (!val) return;
  const known = getKnownCategories();
  const existing = known.find(function(c){ return c.toLowerCase() === val.toLowerCase(); });
  const finalCat = existing || val;
  if (!existing) customCategories.push(val);
  lastCategory = finalCat;
  render();
  persist();
  inputEl.focus();
}

function stripBullet(line){
  return line.replace(/^\s*(?:[-*•]|\d+[.)]|\[\s?[xX]?\s?\])\s*/, "").trim();
}

function parseImport(text, defaultCategory){
  const known = getKnownCategories();
  let current = defaultCategory || DEFAULT_CATEGORY;
  const result = [];
  text.split(/\r?\n/).forEach(function(raw){
    const line = raw.trim();
    if (!line) return;
    const bare = line.replace(/:\s*$/, "").trim();
    const match = known.find(function(c){ return c.toLowerCase() === bare.toLowerCase(); });
    if (match){
      current = match;
      return;
    }
    const cleaned = stripBullet(line);
    if (!cleaned) return;
    result.push({ id: makeId(), text: cleaned, done: false, category: current });
  });
  return result;
}

formEl.addEventListener("submit", function(e){
  e.preventDefault();
  const val = inputEl.value.trim();
  if (!val) return;
  const cat = newCatEl.value || DEFAULT_CATEGORY;
  lastCategory = cat;
  inputEl.value = "";
  addItem(val, cat);
  inputEl.focus();
});

newCatEl.addEventListener("change", function(){
  lastCategory = newCatEl.value;
});

addCatBtnEl.addEventListener("click", function(){
  const opening = newCatRowEl.hidden;
  newCatRowEl.hidden = !opening;
  if (opening) newCatInputEl.focus();
});
confirmNewCatEl.addEventListener("click", commitNewCategory);
newCatInputEl.addEventListener("keydown", function(e){
  if (e.key === "Enter"){
    e.preventDefault();
    commitNewCategory();
  }
});

toggleImportEl.addEventListener("click", function(){
  const opening = importPanelEl.hidden;
  importPanelEl.hidden = !opening;
  if (opening){
    importCatEl.value = lastCategory;
    importTextEl.focus();
  }
});
document.getElementById("cancelImport").addEventListener("click", function(){
  importTextEl.value = "";
  importPanelEl.hidden = true;
});
document.getElementById("doImport").addEventListener("click", function(){
  const defaultCat = importCatEl.value || DEFAULT_CATEGORY;
  const parsed = parseImport(importTextEl.value, defaultCat);
  if (parsed.length){
    items = items.concat(parsed);
    lastCategory = parsed[parsed.length - 1].category;
    render();
    persist();
  }
  importTextEl.value = "";
  importPanelEl.hidden = true;
});

function handleListClick(e){
  if (mode === "readonly") return;
  const row = e.target.closest("li.row");
  if (!row) return;
  const id = row.dataset.id;
  if (e.target.closest('[data-action="delete"]')){
    deleteItem(id);
    return;
  }
  if (e.target.closest('[data-action="editcat"]')){
    const editor = row.querySelector(".cat-editor");
    editor.hidden = !editor.hidden;
    if (!editor.hidden) editor.querySelector("select").focus();
    return;
  }
  if (e.target.closest(".cat-editor")) return;
  toggleItem(id);
}
function handleListChange(e){
  const sel = e.target.closest('select[data-action="catselect"]');
  if (!sel) return;
  const row = e.target.closest("li.row");
  const id = row.dataset.id;
  row.querySelector(".cat-editor").hidden = true;
  setCategory(id, sel.value);
}
listToBuyEl.addEventListener("click", handleListClick);
listBoughtEl.addEventListener("click", handleListClick);
listToBuyEl.addEventListener("change", handleListChange);
listBoughtEl.addEventListener("change", handleListChange);
document.getElementById("clearBought").addEventListener("click", function(){
  if (mode === "readonly") return;
  clearBought();
});

(async function init(){
  render();
  try{
    if (window.claude && typeof claude.use === "function"){
      artifactApi = await claude.use("artifact");
    }
  }catch(e){
    artifactApi = null;
  }

  if (!artifactApi && items.length === 0 && customCategories.length === 0){
    const local = loadLocal();
    if (local){
      items = (local.items || []).map(normalizeItem);
      customCategories = local.customCategories || [];
    }
  }

  if (!artifactApi){
    mode = "local";
    showBanner("Sincronização indisponível: a lista está sendo salva só neste aparelho.");
  } else {
    mode = "synced";
    try{
      const res = await fetch(location.href, { cache: "no-store" });
      cachedSource = await res.text();
    }catch(e){
      cachedSource = null;
    }
  }
  render();
})();
