export const gallery = document.getElementById("gallery");
export const fileInput = document.getElementById("fileInput");
export const canvas = document.getElementById("canvas");
export const overlay = document.getElementById("overlay");
export const statusEl = document.getElementById("status");
export const statsEl = document.getElementById("stats");
export const stageEl = document.getElementById("stage");
export const btnNewPoints = document.getElementById("btnNewPoints");
export const btnClear = document.getElementById("btnClear");

export function setStatus(html) {
  statusEl.innerHTML = html;
}

export function setStats(text) {
  statsEl.textContent = text || "";
}

export function showOverlay(text) {
  overlay.textContent = text;
  overlay.classList.add("show");
}

export function hideOverlay() {
  overlay.classList.remove("show");
}

export function selectCard(card) {
  [...gallery.querySelectorAll(".card")].forEach((c) => {
    c.classList.remove("selected", "anim");
    c.setAttribute("aria-selected", "false");
  });
  card.classList.add("selected", "anim");
  card.setAttribute("aria-selected", "true");
}

export function flashStage() {
  stageEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  stageEl.classList.add("flash");
  setTimeout(() => stageEl.classList.remove("flash"), 800);
}

export function initThumbLoaders() {
  document.querySelectorAll(".thumb").forEach((img) => {
    if (img.complete) {
      img.classList.remove("skeleton");
    } else {
      img.addEventListener("load", () => img.classList.remove("skeleton"), {
        once: true,
      });
    }
  });
}
