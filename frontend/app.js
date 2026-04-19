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
    history: [],
    historyIndex: -1,
    speedMultiplier: 1,
    touch: {
      startX: 0,
      endX: 0,
    },
  },

  elements: {
    item: null,
    themeToggle: null,
    themeModal: null,
  },

  init() {
    this.cacheElements();
    this.applySavedTheme();
    this.applySavedSpeed();
    this.bindEvents();
    this.loadItems();
    this.loadNotifications();
  },

  cacheElements() {
    this.elements.item = document.getElementById("item");
    this.elements.themeToggle = document.getElementById("theme-toggle");
    this.elements.themeModal = document.getElementById("theme-modal");
  },

  applySavedTheme() {
    const savedTheme = localStorage.getItem("Carousel-theme") || "calm";
    this.setTheme(savedTheme);
  },

  applySavedSpeed() {
    const saved = localStorage.getItem("Carousel-speed") || "normal";

    this.setSpeed(saved);
  },

  setSpeed(speed) {
    const map = {
      slow: 1.5,

      normal: 1,

      fast: 0.5,
    };

    this.state.speedMultiplier = map[speed] || 1;

    localStorage.setItem("Carousel-speed", speed);

    document.querySelectorAll("[data-speed]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.speed === speed);
    });
  },

  formatThemeName(name) {
    return name
      .replace(/-/g, " ");
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
      const speedButton = event.target.closest("[data-speed]");
      const themeToggle = event.target.closest("#theme-toggle");
      const themeButton = event.target.closest("[data-theme]");
      const modalPanel = event.target.closest(".theme-modal-panel");
      const githubLink = event.target.closest(".bottom-bar a");
      const noticeToggle = event.target.closest("#notice-toggle");

      if (speedButton) {
        this.setSpeed(speedButton.dataset.speed);
        return;
      }

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
      const tag = document.activeElement?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        document.activeElement?.isContentEditable;

      if (isTyping) return;

      if (event.key === "Escape") {
        this.closeThemeModal();
        this.closeDrawer();
        return;
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        if (!this.state.items.length) return;
        this.showNextItem();
        this.resetRotationTimer();
        return;
      }

      if (event.key.toLowerCase() === "t") {
        if (this.elements.themeModal && !this.elements.themeModal.hidden) {
          this.closeThemeModal();
        } else {
          this.openThemeModal();
        }
      }

      if (event.key.toLowerCase() === "n") {
        const drawer = document.getElementById("notices-drawer");

        if (!drawer) return;

        if (drawer.hidden) {
          this.openDrawer();
        } else {
          this.closeDrawer();
        }
      }

      if (event.key === "ArrowLeft") {
        this.goToPreviousItem();
        this.resetRotationTimer();
        return;
      }

      if (event.key === "ArrowRight") {
        this.goToNextFromHistory();
        this.resetRotationTimer();
        return;
      }
    });

    document.addEventListener("touchstart", (e) => {
      this.state.touch.startX = e.touches[0].clientX;
    });

    document.addEventListener("touchend", (e) => {
      this.state.touch.endX = e.changedTouches[0].clientX;
      this.handleSwipe();
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

    this.state.history = [item];
    this.state.historyIndex = 0;
  },

  renderMessage(message) {
    this.elements.item.textContent = message;
    this.elements.item.style.opacity = "1";
  },

  showNextItem() {
    const item = this.getNextItem();
    if (!item || !this.elements.item) return;

    this.state.history = this.state.history.slice(
      0,
      this.state.historyIndex + 1,
    );
    this.state.history.push(item);
    this.state.historyIndex++;

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

  goToPreviousItem() {
    if (this.state.historyIndex <= 0) return;

    this.state.historyIndex--;
    const item = this.state.history[this.state.historyIndex];

    this.renderItemDirect(item);
  },

  goToNextFromHistory() {
    if (this.state.historyIndex < this.state.history.length - 1) {
      this.state.historyIndex++;
      const item = this.state.history[this.state.historyIndex];
      this.renderItemDirect(item);
      return;
    }

    this.showNextItem();
  },

  renderItemDirect(item) {
    const el = this.elements.item;
    if (!el) return;

    el.textContent = item.text;
    el.style.opacity = "1";
    el.style.filter = "blur(0px)";
    this.state.lastItemId = item.id;
  },

  scheduleNextItem() {
    const currentText = this.elements.item.textContent || "";
    const delay =
      (this.getDisplayTime(currentText) + this.config.basePauseMs) *
      this.state.speedMultiplier;

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

    if (!notifications.length) {
      container.innerHTML = `<p class="drawer-empty">Nothing to show.</p>`;
      return;
    }

    notifications.forEach((notification) => {
      const row = document.createElement("div");
      row.className = "notification-row";

      const type = notification.type
        ? notification.type.charAt(0).toUpperCase() + notification.type.slice(1)
        : "Notification";

      row.innerHTML = `
        <div class="notification-bar"></div>
        <div class="notification-content">
          <span class="notification-type">${type}</span>
          <p class="notification-text">${notification.text}</p>
        </div>
      `;

      container.appendChild(row);
    });
  },

  setTheme(theme) {
    const themeClasses = Array.from(document.body.classList).filter(
      (className) => className.startsWith("theme-"),
    );

    document.body.classList.remove(...themeClasses);
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem("Carousel-theme", theme);

    // Highlight active theme button
    document.querySelectorAll("[data-theme]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.theme === theme);
    });

    // Update footer label text
    if (this.elements.themeToggle) {
      const label = this.elements.themeToggle.querySelector(".theme-label");

      if (label) {
        label.textContent = this.formatThemeName(theme);
      }
    }
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

  handleSwipe() {
    const threshold = 50;
    const diff = this.state.touch.endX - this.state.touch.startX;

    if (Math.abs(diff) < threshold) return;

    if (diff > 0) {
      this.goToPreviousItem();
    } else {
      this.goToNextFromHistory();
    }

    this.resetRotationTimer();
  },
};

document.addEventListener("DOMContentLoaded", () => {
  Carousel.init();
});
