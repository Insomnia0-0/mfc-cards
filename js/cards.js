import { fetchCards, escapeHtml } from "./api.js";

let currentSectionId = null;
let renderedCards = [];

export async function renderCards(sectionId, query = "") {
  currentSectionId = sectionId;
  const grid = document.getElementById("cards-grid");
  const emptyEl = document.getElementById("empty-state");
  if (!grid) return;

  let cards = await fetchCards(sectionId);
  
  if (query) {
    cards = cards.filter((c) => c.title.toLowerCase().includes(query));
  }

  renderedCards = cards;

  if (!cards.length) {
    grid.innerHTML = "";
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = query
        ? "По вашему запросу ничего не найдено."
        : "В этом разделе пока нет карточек.";
    }
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  grid.innerHTML = cards.map(cardTemplate).join("");
}

function cardTemplate(card) {
  return `
    <article class="card" data-id="${card.id}">
      <h3 class="card-title">${escapeHtml(card.title)}</h3>
      <div class="card-content">${card.content}</div>
    </article>
  `;
}

export function bindCardActions(openViewDialog) {
  const grid = document.getElementById("cards-grid");
  if (!grid) return;

  grid.onclick = (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const id = card.dataset.id;
    const item = renderedCards.find((c) => c.id === id);
    if (item) openViewDialog(item);
  };
}