/**
 * A single item
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} text
 * @property {string} [type]
 * @property {number} [priority]
 * @property {boolean} [active]
 * @property {string} [eventDate]
 */

/**
 * App configuration
 * @typedef {Object} Config
 * @property {string} itemsUrl
 * @property {string} notificationsUrl
 * @property {number} fadeDurationMs
 * @property {number} basePauseMs
 * @property {number} recentItemsLimit
 * @property {number} maxSameTypeInRow
 * @property {{ cache: string }} fetchOptions
 * @property {{ empty: string, error: string }} messages
 */

/**
 * Runtime state
 * @typedef {Object} State
 * @property {Item[]} items
 * @property {string[]} recentItemIds
 * @property {string[]} recentTypes
 * @property {string|null} lastItemId
 * @property {number|null} rotationTimer
 */

/**
 * Available theme names
 * @typedef {
 *   "calm" |
 *   "cheesecake" |
 *   "frozen-llama" |
 *   "lavender" |
 *   "muted" |
 *   "olivia" |
 *   "paper" |
 *   "pastel" |
 *   "trackspec" |
 *   "trackspec-dark" |
 *   "quiet" |
 *   "ube"
 * } Theme
 */

const Carousel = {
  config: {
    itemsUrl: "/feed.json",
    notificationsUrl: "/notifications.json",
    fadeDurationMs: 2000,
    basePauseMs: 600,
    recentItemsLimit: 5,
    maxSameTypeInRow: 2,
    fetchOptions: { cache: "no-store" },
    messages: {
      empty: "No content available.",
      error: "Could not load content.",
    },
  },

  state: {
    items: [],
    recentItemIds: [],
    recentTypes: [],
    lastItemId: null,
    rotationTimer: null,
  },

  elements: {
    item: null,
    themeToggle: null,
    themeModal: null,
  },

  init() {
    this.cacheElements();
    this.applySavedTheme();
    this.bindEvents();
    this.loadItems();
    this.loadNotifications();
  },

  cacheElements() {
    this.elements.item = document.getElementById("fact"); // unchanged
    this.elements.themeToggle = document.getElementById("theme-toggle");
    this.elements.themeModal = document.getElementById("theme-modal");
  },

  applySavedTheme() {
    const savedTheme = localStorage.getItem("Carousel-theme") || "calm";
    this.setTheme(savedTheme);
  },

  openThemeModal() {
    const modal = this.elements.themeModal;
    const toggle = this.elements.themeToggle;
    const panel = modal.querySelector(".theme-modal-panel");

    if (!modal || !toggle || !panel) return;

    const rect = toggle.getBoundingClientRect();

    panel.style.left = `${rect.left + rect.width / 2}px`;
    panel.style.top = `${rect.top - 12}px`;

    modal.hidden = false;

    requestAnimationFrame(() => {
      panel.style.transform = "translateX(-50%) translateY(-100%) scale(1)";
      panel.style.opacity = "1";
    });
  },

  closeThemeModal() {
    const modal = this.elements.themeModal;
    const panel = modal.querySelector(".theme-modal-panel");

    if (!modal || !panel) return;

    panel.style.opacity = "0";
    panel.style.transform = "translateX(-50%) translateY(-90%) scale(0.96)";

    setTimeout(() => {
      modal.hidden = true;
    }, 150);
  },

  bindEvents() {
    document.body.addEventListener("click", (event) => {
      const themeToggle = event.target.closest("#theme-toggle");
      const themeButton = event.target.closest("[data-theme]");
      const modalPanel = event.target.closest(".theme-modal-panel");
      const githubLink = event.target.closest(".bottom-bar a");
      const noticeToggle = event.target.closest("#notice-toggle");

      if (githubLink) return;

      if (noticeToggle) return this.openDrawer();
      if (event.target.closest(".drawer-overlay")) return this.closeDrawer();

      if (themeToggle) return this.openThemeModal();

      if (themeButton) {
        this.setTheme(themeButton.dataset.theme);
        return this.closeThemeModal();
      }

      if (
        this.elements.themeModal &&
        !this.elements.themeModal.hidden &&
        !modalPanel
      ) {
        return this.closeThemeModal();
      }

      if (!this.state.items.length) return;

      this.showNextItem();
      this.resetRotationTimer();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.closeThemeModal();
      }
    });
  },

  async loadItems() {
    try {
      const response = await fetch(this.config.itemsUrl);

      if (!response.ok) throw new Error();

      const data = await response.json();
      this.state.items = this.normalizeItems(data.items);

      if (!this.state.items.length) {
        this.renderMessage(this.config.messages.empty);
        return;
      }

      this.renderInitialItem();
      this.scheduleNextItem();
    } catch {
      this.renderMessage(this.config.messages.error);
    }
  },

  normalizeItems(items) {
    return (items || [])
      .filter((item) => item && item.active !== false)
      .filter((item) => typeof item.text === "string" && item.text.trim());
  },

  getItemWeight(item) {
    return item.priority || 1;
  },

  getWeightedRandomItem(items) {
    const totalWeight = items.reduce(
      (sum, item) => sum + this.getItemWeight(item),
      0,
    );
    let random = Math.random() * totalWeight;

    for (const item of items) {
      random -= this.getItemWeight(item);
      if (random <= 0) return item;
    }

    return items[items.length - 1] || null;
  },

  rememberItem(itemId) {
    this.state.recentItemIds.push(itemId);
    if (this.state.recentItemIds.length > this.config.recentItemsLimit) {
      this.state.recentItemIds.shift();
    }
  },

  rememberType(type) {
    this.state.recentTypes.push(type);
    if (this.state.recentTypes.length > this.config.maxSameTypeInRow) {
      this.state.recentTypes.shift();
    }
  },

  isTypeOverused(type) {
    if (this.state.recentTypes.length < this.config.maxSameTypeInRow)
      return false;
    return this.state.recentTypes.every((t) => t === type);
  },

  getNextItem() {
    if (!this.state.items.length) return null;

    let eligibleItems = this.state.items.filter(
      (item) =>
        !this.state.recentItemIds.includes(item.id) &&
        !this.isTypeOverused(item.type),
    );

    if (!eligibleItems.length) {
      eligibleItems = this.state.items.filter(
        (item) => !this.state.recentItemIds.includes(item.id),
      );
    }

    if (!eligibleItems.length) {
      eligibleItems = this.state.items.filter(
        (item) => item.id !== this.state.lastItemId,
      );
    }

    if (!eligibleItems.length) {
      eligibleItems = [...this.state.items];
    }

    return this.getWeightedRandomItem(eligibleItems);
  },

  renderInitialItem() {
    const item = this.getNextItem();
    if (!item) return;

    this.elements.item.textContent = item.text;
    this.elements.item.style.opacity = "1";

    this.state.lastItemId = item.id;
    this.rememberItem(item.id);
    this.rememberType(item.type);
  },

  renderMessage(message) {
    this.elements.item.textContent = message;
    this.elements.item.style.opacity = "1";
  },

  showNextItem() {
    const item = this.getNextItem();
    if (!item || !this.elements.item) return;

    const el = this.elements.item;
    const duration = this.config.fadeDurationMs;

    el.style.transition = `opacity ${duration}ms ease, filter ${duration}ms ease`;
    el.style.opacity = "0";
    el.style.filter = "blur(1px)";

    setTimeout(() => {
      el.textContent = item.text;

      el.style.transition = `opacity ${duration}ms ease, filter ${duration}ms ease`;
      el.style.opacity = "1";
      el.style.filter = "blur(0px)";

      this.state.lastItemId = item.id;
      this.rememberItem(item.id);
      this.rememberType(item.type);
    }, duration);
  },

  scheduleNextItem() {
    const currentText = this.elements.item.textContent || "";
    const delay = this.getDisplayTime(currentText) + this.config.basePauseMs;

    this.state.rotationTimer = setTimeout(() => {
      this.showNextItem();
      this.scheduleNextItem();
    }, delay);
  },

  resetRotationTimer() {
    if (this.state.rotationTimer) {
      clearTimeout(this.state.rotationTimer);
    }
    this.scheduleNextItem();
  },

  getDisplayTime(text) {
    const words = text.trim().split(/\s+/).length;
    const punctuation = (text.match(/[.,;:!?—-]/g) || []).length;

    let time = (words / 2.4) * 1000;
    time += punctuation * 350;
    time += 3500;

    return Math.min(Math.max(time, 7000), 14000);
  },

  async loadNotifications() {
    try {
      const res = await fetch(this.config.notificationsUrl);
      const data = await res.json();
      this.renderNotifications(data.notifications || []);
    } catch {
      this.renderNotifications([]);
    }
  },

  renderNotifications(notifications) {
    const container = document.querySelector("#notifications-content");
    if (!container) return;

    container.innerHTML = "";

    notifications.forEach((notification) => {
      const row = document.createElement("div");
      row.className = "notification-row";

      const type = item.type
        ? item.type.charAt(0).toUpperCase() + item.type.slice(1)
        : "Notification";

      row.innerHTML = `
        <div class="notification-bar"></div>
        <div class="notification-content">
          <span class="notification-type">${type}</span>
          <p class="notification-text">${item.text}</p>
        </div>
      `;

      container.appendChild(row);
    });
  },

  setTheme(theme) {
    const themeClasses = Array.from(document.body.classList).filter((c) =>
      c.startsWith("theme-"),
    );

    document.body.classList.remove(...themeClasses);
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem("Carousel-theme", theme);
  },

  openDrawer() {
    const d = document.getElementById("notices-drawer");
    d.hidden = false;
    requestAnimationFrame(() => d.classList.add("is-open"));
  },

  closeDrawer() {
    const d = document.getElementById("notices-drawer");
    d.classList.remove("is-open");
    setTimeout(() => (d.hidden = true), 250);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  Carousel.init();
});
