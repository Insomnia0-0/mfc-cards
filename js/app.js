import { initAuth } from "./auth.js";
import { initNavigation } from "./nav.js";
import { renderCards, bindCardActions } from "./cards.js";
import { initSearch } from "./search.js";
import { createSection, createCard, updateCard, deleteCard, fetchSections, fetchCards, escapeHtml } from "./api.js";

/* State */

let confirmCallback = null;
let currentQuery = "";

/* Dialogs */

function initDialogs() {
  document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dialog = document.getElementById(btn.dataset.closeDialog);
      if (dialog) dialog.close();
    });
  });

  const confirmBtn = document.getElementById("confirm-delete-btn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      if (typeof confirmCallback === "function") {
        await confirmCallback();
      }
      document.getElementById("confirm-dialog").close();
      confirmCallback = null;
    });
  }
}

function openConfirmDialog({ title, text, callback }) {
  const dialog = document.getElementById("confirm-dialog");
  if (!dialog) return;
  document.getElementById("confirm-title").textContent = title || "Удалить?";
  document.getElementById("confirm-text").textContent = text || "Действие нельзя отменить.";
  confirmCallback = callback;
  dialog.showModal();
}

function initViewDialog(openEditDialog, openConfirmDialog) {
  const dialog = document.getElementById("view-card-dialog");
  const titleEl = document.getElementById("view-card-title");
  const contentEl = document.getElementById("view-card-content");
  const editBtn = document.getElementById("view-card-edit");
  const deleteBtn = document.getElementById("view-card-delete");
  
  const searchInput = document.getElementById("modal-search-input");
  const searchCount = document.getElementById("modal-search-count");
  const prevBtn = document.getElementById("modal-search-prev");
  const nextBtn = document.getElementById("modal-search-next");

  let currentViewCard = null;
  let originalContent = "";
  let matches = [];
  let currentMatchIndex = -1;

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function updateHighlights(query) {
    contentEl.innerHTML = originalContent; 
    matches = [];
    currentMatchIndex = -1;
    
    if (!query) {
      searchCount.textContent = "0/0";
      return;
    }

    const regex = new RegExp(escapeRegExp(query), 'gi');
    const walk = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];
    
    let node;
    while ((node = walk.nextNode())) {
      if (node.parentNode.nodeName !== 'MARK' && regex.test(node.nodeValue)) {
        nodesToReplace.push(node);
      }
      regex.lastIndex = 0;
    }

    nodesToReplace.forEach(textNode => {
      const text = textNode.nodeValue;
      const parent = textNode.parentNode;
      const fragment = document.createDocumentFragment();
      
      let lastIndex = 0;
      let match;
      regex.lastIndex = 0;
      
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        }
        
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = match[0];
        fragment.appendChild(mark);
        
        lastIndex = regex.lastIndex;
      }
      
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }
      
      parent.replaceChild(fragment, textNode);
    });
    
    matches = Array.from(contentEl.querySelectorAll('mark.search-highlight'));
    
    if (matches.length > 0) {
      currentMatchIndex = 0;
      updateActiveMatch();
    } else {
      currentMatchIndex = -1;
      searchCount.textContent = "0/0";
    }
  }

  function updateActiveMatch() {
    matches.forEach((mark, idx) => {
      mark.classList.toggle("active", idx === currentMatchIndex);
    });
    
    if (currentMatchIndex >= 0 && currentMatchIndex < matches.length) {
      matches[currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      searchCount.textContent = `${currentMatchIndex + 1}/${matches.length}`;
    } else {
      searchCount.textContent = `0/${matches.length}`;
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      updateHighlights(e.target.value.trim());
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (matches.length === 0) return;
      currentMatchIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
      updateActiveMatch();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (matches.length === 0) return;
      currentMatchIndex = (currentMatchIndex + 1) % matches.length;
      updateActiveMatch();
    });
  }

  function openViewDialog(card) {
    currentViewCard = card;
    titleEl.textContent = card.title;
    originalContent = card.content;
    
    if (searchInput) searchInput.value = "";
    updateHighlights("");
    
    dialog.showModal();
  }

  editBtn.addEventListener("click", () => {
    dialog.close();
    openEditDialog(currentViewCard);
  });

  deleteBtn.addEventListener("click", () => {
    dialog.close();
    openConfirmDialog({
      title: "Удалить карточку?",
      text: "Действие нельзя отменить.",
      callback: async () => {
        await deleteCard(currentViewCard.id);
        await applyFilters();
      }
    });
  });

  return openViewDialog;
}

function initCardDialog() {
  const dialog = document.getElementById("card-dialog");
  const form = document.getElementById("card-form");
  const titleEl = document.getElementById("card-dialog-title");
  const errorEl = document.getElementById("card-error");
  const editor = document.getElementById("card-content");
  
  const openPickerBtn = document.getElementById('btn-open-picker');
  const colorInput = document.getElementById('tool-color');
  const resetBtn = document.getElementById('tool-reset-color');
  const swatchesContainer = document.getElementById('saved-colors');
  const DEFAULT_COLORS = ['#f87171', '#34d399', '#60a5fa', '#fbbf24', '#c084fc', '#e2e8f0'];
  
  let savedColors = JSON.parse(localStorage.getItem('mfc_saved_colors'));
  if (!Array.isArray(savedColors) || savedColors.length === 0) {
    savedColors = [...DEFAULT_COLORS];
  }

  function renderSwatches() {
    if (!swatchesContainer) return;
    swatchesContainer.innerHTML = savedColors.map(c => 
      `<button type="button" class="color-swatch" style="background-color: ${c}" data-color="${c}" title="Применить цвет"></button>`
    ).join('');
  }

  // --- Сохранение и восстановление выделения ---
  let savedRange = null;

  function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer) || editor === range.commonAncestorContainer) {
        savedRange = range;
      }
    }
  }

  function restoreSelection() {
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  }

  if (editor) {
    editor.addEventListener('keyup', saveSelection);
    editor.addEventListener('mouseup', saveSelection);
    editor.addEventListener('click', () => editor.focus());
    
    // Вставка только чистого текста
    editor.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.originalEvent || e).clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });
  }

  // Защита от потери фокуса при клике на панель
  const toolbar = document.querySelector('.editor-toolbar');
  if (toolbar) {
    toolbar.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Предотвращаем уход фокуса из редактора
      saveSelection();
    });
  }

  // --- Логика цветов ---
  function applyColor(color) {
    if (!editor) return;
    editor.focus();
    restoreSelection();
    document.execCommand('foreColor', false, color);
    saveSelection();
  }

  if (openPickerBtn) {
    openPickerBtn.addEventListener('click', () => {
      colorInput.click();
    });
  }

  if (colorInput) {
    colorInput.addEventListener('change', (e) => {
      const newColor = e.target.value;
      applyColor(newColor);
      
      if (!savedColors.includes(newColor)) {
        savedColors.push(newColor);
        if (savedColors.length > 10) savedColors.shift();
        localStorage.setItem('mfc_saved_colors', JSON.stringify(savedColors));
        renderSwatches();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!editor) return;
      editor.focus();
      restoreSelection();
      // Возвращаем стандартный цвет (--text-main)
      document.execCommand('foreColor', false, '#e5e7eb');
      saveSelection();
    });
  }

  if (swatchesContainer) {
    swatchesContainer.addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (swatch) {
        applyColor(swatch.dataset.color);
      }
    });
  }

  renderSwatches();

  // --- Открытие/закрытие и сохранение ---
  function openCardDialog(item) {
    if (!dialog || !form) return;
    errorEl.hidden = true;
    form.reset();
    
    document.getElementById("card-id").value = item?.id || "";
    document.getElementById("card-section-id").value =
      item?.section ||
      document.querySelector(".nav-item.active")?.dataset.section ||
      "";
    document.getElementById("card-title").value = item?.title || "";
    
    if (editor) {
      if (item && item.content) {
        if (!item.content.includes('<')) {
           editor.innerHTML = item.content.replace(/\n/g, '<br>');
        } else {
           editor.innerHTML = item.content;
        }
      } else {
        editor.innerHTML = "";
      }
    }
    
    savedRange = null;
    titleEl.textContent = item ? "Редактировать карточку" : "Новая карточка";
    dialog.showModal();
  }

  document.getElementById("btn-new-card")?.addEventListener("click", () => {
    openCardDialog(null);
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const id = document.getElementById("card-id").value;
    const sectionId = document.getElementById("card-section-id").value;
    const title = document.getElementById("card-title").value.trim();
    const content = editor ? editor.innerHTML.trim() : "";

    if (!title || !content || content === '<br>') {
      errorEl.textContent = "Заполните название и содержимое";
      errorEl.hidden = false;
      return;
    }
    if (!sectionId) {
      errorEl.textContent = "Выберите раздел";
      errorEl.hidden = false;
      return;
    }

    try {
      if (id) {
        await updateCard(id, { title, content });
      } else {
        await createCard({ section: sectionId, title, content });
      }
      dialog.close();
      await applyFilters();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });

  return openCardDialog;
}

function initSectionDialog(onSectionCreated) {
  const dialog = document.getElementById("section-dialog");
  const form = document.getElementById("section-form");
  const errorEl = document.getElementById("section-error");

  document.getElementById("btn-new-section")?.addEventListener("click", () => {
    if (!dialog || !form) return;
    form.reset();
    errorEl.hidden = true;
    document.getElementById("section-id").value = "";
    dialog.showModal();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const title = document.getElementById("section-title").value.trim();
    if (!title) {
      errorEl.textContent = "Введите название раздела";
      errorEl.hidden = false;
      return;
    }

    try {
      await createSection({ title });
      dialog.close();
      if (onSectionCreated) await onSectionCreated();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
}

async function applyFilters() {
  window.currentSearchQuery = currentQuery;
  const sections = await fetchSections();
  const allCards = await fetchCards();

  sections.forEach((sec) => {
    const group = document.querySelector(`.nav-group[data-id="${sec.id}"]`);
    if (!group) return;

    if (!currentQuery) {
      group.style.display = "";
    } else {
      const hasMatch = allCards.some(
        (c) => c.section === sec.id && c.title.toLowerCase().includes(currentQuery)
      );
      group.style.display = hasMatch ? "" : "none";
    }
  });

  const activeBtn = document.querySelector(".nav-item.active");
  const activeGroup = activeBtn?.closest(".nav-group");

  if (activeGroup && activeGroup.style.display === "none") {
    const firstVisibleBtn = document.querySelector(".nav-group:not([style*='display: none']) .nav-item");
    if (firstVisibleBtn) {
      firstVisibleBtn.click();
      return;
    } else {
      document.getElementById("cards-grid").innerHTML = "";
      const emptyEl = document.getElementById("empty-state");
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = "По вашему запросу ничего не найдено.";
      }
      return;
    }
  }

  const activeId = activeBtn ? activeBtn.dataset.section : null;
  if (activeId) {
    await renderCards(activeId, currentQuery);
  }
}

function init() {
  initAuth();
  initDialogs();

  const openEditDialog = initCardDialog();
  const openViewDialog = initViewDialog(openEditDialog, openConfirmDialog);
  
  bindCardActions(openViewDialog);

  initSearch((query) => {
    currentQuery = query;
    applyFilters();
  });

  function refreshNav() {
    return initNavigation(openConfirmDialog, refreshNav).then(() => {
      if (currentQuery) applyFilters();
    });
  }

  initSectionDialog(refreshNav);
  refreshNav();
}

init();