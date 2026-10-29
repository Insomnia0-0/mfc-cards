import { CONFIG } from "./config.js";

const KEY_SESSION = "mfc_session";

function getToken() {
  const session = JSON.parse(localStorage.getItem(KEY_SESSION) || "null");
  return session ? session.token : null;
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* Sections */

export async function fetchSections() {
  const res = await fetch(`${CONFIG.apiBase}/sections/records?sort=sort_order`);
  if (!res.ok) {
    const errText = await res.text();
    console.error("Ошибка при загрузке разделов:", errText);
    throw new Error("Ошибка загрузки разделов");
  }
  return (await res.json()).items;
}

export async function createSection(data) {
  const res = await fetch(`${CONFIG.apiBase}/sections/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ ...data, sort_order: Math.floor(Date.now() / 1000) }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Ошибка при создании раздела:", errText);
    throw new Error(`Ошибка базы: ${res.status}`);
  }
  return res.json();
}

export async function deleteSection(id) {
  const res = await fetch(`${CONFIG.apiBase}/sections/records/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Ошибка удаления раздела");
}

/* Cards */

export async function fetchCards(sectionId = null) {
  const filter = sectionId ? `?filter=(section='${sectionId}')&sort=created` : "";
  const res = await fetch(`${CONFIG.apiBase}/cards/records${filter}`);
  if (!res.ok) throw new Error("Ошибка загрузки карточек");
  return (await res.json()).items;
}

export async function createCard(data) {
  const res = await fetch(`${CONFIG.apiBase}/cards/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Ошибка при создании карточки:", errText);
    throw new Error("Ошибка создания карточки");
  }
  return res.json();
}

export async function updateCard(id, data) {
  const res = await fetch(`${CONFIG.apiBase}/cards/records/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Ошибка обновления карточки");
  return res.json();
}

export async function deleteCard(id) {
  const res = await fetch(`${CONFIG.apiBase}/cards/records/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Ошибка удаления карточки");
}

/* Auth */

export async function login(email, password) {
  const res = await fetch(`${CONFIG.apiBase}/users/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: email, password: password }),
  });

  if (!res.ok) throw new Error("Неверный e-mail или пароль");

  const data = await res.json();
  const session = { token: data.token, user: data.record };
  localStorage.setItem(KEY_SESSION, JSON.stringify(session));
  return session.user;
}

export function logout() {
  localStorage.removeItem(KEY_SESSION);
}

export function isAdmin() {
  return !!getToken();
}