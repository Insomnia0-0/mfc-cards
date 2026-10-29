import { login, logout, isAdmin } from "./api.js";

function applyRole() {
  document.body.classList.toggle("is-admin", isAdmin());
}

function initLoginPage() {
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      await login(email, password);
      window.location.href = "index.html";
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
}

function initLogoutButton() {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;
  btn.addEventListener("click", () => {
    logout();
    window.location.href = "index.html";
  });
}

export function initAuth() {
  applyRole();
  initLogoutButton();
}

if (document.getElementById("login-form")) {
  if (isAdmin()) {
    window.location.href = "index.html";
  } else {
    initLoginPage();
  }
}