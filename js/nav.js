import { fetchSections, deleteSection, fetchCards, escapeHtml } from "./api.js";
import { renderCards } from "./cards.js";

export async function initNavigation(openConfirmDialog, onRefresh) {
  const nav = document.getElementById("section-nav");
  const grid = document.getElementById("cards-grid");
  const emptyEl = document.getElementById("empty-state");
  if (!nav) return;

  let activeSectionId = nav.querySelector(".nav-item.active")?.dataset.section;
  const sections = await fetchSections();

  if (!sections.length) {
    nav.innerHTML = "";
    if (grid) grid.innerHTML = "";
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = "Разделов пока нет. Нажмите «+ Раздел», чтобы создать первый.";
    }
    return;
  }

  const hasActive = sections.some((s) => s.id === activeSectionId);
  if (!hasActive) activeSectionId = sections[0].id;

  nav.innerHTML = sections
    .map(
      (s) =>
        `<div class="nav-group" data-id="${s.id}">
          <button class="nav-item ${s.id === activeSectionId ? "active" : ""}" data-section="${s.id}">${escapeHtml(s.title)}</button>
          <button class="nav-delete admin-only" data-delete-section="${s.id}" title="Удалить раздел">&times;</button>
        </div>`
    )
    .join("");

  nav.onclick = async (e) => {
    const delBtn = e.target.closest(".nav-delete");
    
    if (delBtn) {
      e.stopPropagation();
      e.preventDefault();
      const id = delBtn.dataset.deleteSection;
      
      const cardsInSection = await fetchCards(id);
      if (cardsInSection.length > 0) {
        alert("Нельзя удалить раздел, так как в нём есть карточки. Сначала удалите их.");
        return;
      }

      openConfirmDialog({
        title: "Удалить раздел?",
        text: "Вы уверены, что хотите удалить этот пустой раздел?",
        callback: async () => {
          await deleteSection(id);
          await onRefresh();
        }
      });
      return;
    }

    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    nav.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    await renderCards(btn.dataset.section, window.currentSearchQuery || "");
  };

  await renderCards(activeSectionId, window.currentSearchQuery || "");
}