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
 *   "aguila" |
 *   "calm" |
 *   "cheesecake" |
 *   "frozen-llama" |
 *   "lavender" |
 *   "muted" |
 *   "nebula" |
 *   "olivia" |
 *   "paper" |
 *   "pastel" |
 *   "sagada-cellar-door" |
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
    typingCharMs: 22,
    typingStartDelayMs: 80,
    settingsGroups: {
      mode: [
        { label: "instant", value: "instant", attr: "data-mode" },
        { label: "fade", value: "fade", attr: "data-mode" },
        { label: "pop", value: "pop", attr: "data-mode" },
        { label: "typing", value: "typing", attr: "data-mode" },
      ],
      rate: [
        { label: "slow", value: "slow", attr: "data-speed" },
        { label: "normal", value: "normal", attr: "data-speed" },
        { label: "fast", value: "fast", attr: "data-speed" },
      ],
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
    mode: "fade",
    activeSettingsGroup: "mode",
    typingTimer: null,
    isTyping: false,
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
    Object.freeze(this.config.settingsGroups);
    Object.freeze(this.config.settingsGroups.mode);
    Object.freeze(this.config.settingsGroups.rate);
    this.applySavedTheme();
    this.applySavedSpeed();
    this.applySavedMode();
    this.setSettingsGroup(this.state.activeSettingsGroup);
    this.bindEvents();
    this.loadItems();
    this.loadNotifications();
    this.initFocusMode();
  },

  cacheElements() {
    this.elements.item = document.getElementById("item");
    this.elements.themeToggle = document.getElementById("theme-toggle");
    this.elements.themeModal = document.getElementById("theme-modal");
    this.elements.settingsModal = document.getElementById("settings-modal");
    this.elements.desktopSettingsOptions = document.getElementById(
      "desktop-settings-options",
    );
    this.elements.settingsOptions = document.getElementById("settings-options");
  },

  applySavedTheme() {
    const savedTheme = localStorage.getItem("Carousel-theme") || "calm";
    this.setTheme(savedTheme);
  },

  applySavedSpeed() {
    const saved = localStorage.getItem("Carousel-speed") || "normal";

    this.setSpeed(saved);
  },

  applySavedMode() {
    const saved = localStorage.getItem("Carousel-mode") || "fade";
    this.setMode(saved);
  },

  initFocusMode() {
    const btn = document.getElementById("focus-toggle");
    const hint = document.getElementById("focus-hint");
    if (!btn) return;

    const enterFocusMode = () => {
      document.body.classList.add("focus-mode");
      localStorage.setItem("focusMode", "true");
      this.updateFocusButton(btn, true);

      if (hint) {
        const isTouch =
          "ontouchstart" in window || navigator.maxTouchPoints > 0;

        hint.innerHTML = isTouch
          ? "tap <kbd>anywhere</kbd> to exit"
          : "<kbd>esc</kbd> to exit";

        clearTimeout(this._focusHintTimer);

        hint.classList.add("is-visible");

        this._focusHintTimer = setTimeout(() => {
          hint.classList.remove("is-visible");
        }, 2500);
      }
    };

    const exitFocusMode = () => {
      document.body.classList.remove("focus-mode");
      localStorage.setItem("focusMode", "false");
      this.updateFocusButton(btn, false);

      if (hint) {
        clearTimeout(this._focusHintTimer);

        // temporarily disable transition
        hint.style.transition = "none";
        hint.classList.remove("is-visible");

        // force reflow so browser applies instantly
        hint.offsetHeight;

        // restore transition
        hint.style.transition = "";
      }
    };

    const toggleFocusMode = () => {
      if (document.body.classList.contains("focus-mode")) {
        exitFocusMode();
      } else {
        enterFocusMode();
      }
    };

    // Load saved state
    const saved = localStorage.getItem("focusMode") === "true";
    if (saved) {
      enterFocusMode();
    } else {
      this.updateFocusButton(btn, false);
      if (hint) hint.classList.remove("is-visible");
    }

    // Click handler
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFocusMode();
    });

    // ESC to exit
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("focus-mode")) {
        exitFocusMode();
      }
    });

    // Tap / click anywhere to exit
    document.addEventListener("click", (e) => {
      if (!document.body.classList.contains("focus-mode")) return;
      if (e.target.closest("#focus-toggle")) return;
      exitFocusMode();
    });
  },

  updateFocusButton(btn, isActive) {
    btn.innerHTML = isActive
      ? '<i class="fa-solid fa-compress"></i> exit'
      : '<i class="fa-solid fa-expand"></i> focus';
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

    this.renderDesktopSettingsOptions();
    this.renderSettingsOptions(this.state.activeSettingsGroup);
  },

  setMode(mode) {
    this.state.mode = mode;
    localStorage.setItem("Carousel-mode", mode);

    document.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.mode === mode);
    });

    this.renderDesktopSettingsOptions();
    this.renderSettingsOptions(this.state.activeSettingsGroup);
  },

  getCurrentSpeedKey() {
    const speedMap = {
      1.5: "slow",
      1: "normal",
      0.5: "fast",
    };

    return speedMap[this.state.speedMultiplier] || "normal";
  },

  getSettingsOptions(group) {
    return this.config.settingsGroups[group] || [];
  },

  isSettingsOptionActive(group, value) {
    if (group === "mode") {
      return this.state.mode === value;
    }

    if (group === "rate") {
      return this.getCurrentSpeedKey() === value;
    }

    return false;
  },

  setSettingsGroup(group) {
    const container = this.elements.desktopSettingsOptions;

    document.querySelectorAll("[data-settings-group]").forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.settingsGroup === group,
      );
    });

    this.state.activeSettingsGroup = group;
    this.renderSettingsOptions(group);

    if (!container) {
      this.renderDesktopSettingsOptions();
      return;
    }

    if (!container.dataset.initialized) {
      this.renderDesktopSettingsOptions();
      container.style.width = "auto";
      container.dataset.initialized = "true";
      return;
    }

    const currentWidth = container.offsetWidth;
    const nextWidth = this.measureDesktopSettingsWidth(group);

    container.style.width = `${currentWidth}px`;
    container.style.transition = "width 0.25s ease";

    setTimeout(() => {
      this.renderDesktopSettingsOptions();
      container.style.width = `${nextWidth}px`;
    }, 90);
  },

  getDesktopSettingsMarkup(group) {
    const options = this.getSettingsOptions(group);

    return options
      .map((option) => {
        const isActive = this.isSettingsOptionActive(group, option.value);

        return `
        <button
          type="button"
          class="control-option ${isActive ? "is-active" : ""}"
          ${option.attr}="${option.value}">
          ${option.label}
        </button>
      `;
      })
      .join("");
  },

  renderInitialItem() {
    const item = this.getNextItem();
    if (!item) return;

    this.elements.item.textContent = this.formatItemText(item);
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

  renderItemDirect(item) {
    const el = this.elements.item;
    if (!el) return;

    this.clearTypingTimer();

    el.textContent = this.formatItemText(item);
    el.style.opacity = "1";
    el.style.filter = "blur(0px)";
    el.style.transform = "scale(1)";
    this.state.lastItemId = item.id;
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

  renderDesktopSettingsOptions() {
    const container = this.elements.desktopSettingsOptions;
    if (!container) return;

    const group = this.state.activeSettingsGroup;
    const options = this.getSettingsOptions(group);

    if (!options || options.length === 0) return;

    container.innerHTML = this.getDesktopSettingsMarkup(group);
  },

  renderSettingsOptions(group) {
    const container = document.getElementById("settings-options");
    if (!container) return;

    const options = this.getSettingsOptions(group);

    container.innerHTML = options
      .map((option) => {
        const isActive = this.isSettingsOptionActive(group, option.value);

        return `
        <button
          type="button"
          class="settings-option ${isActive ? "is-active" : ""}"
          ${option.attr}="${option.value}">
          ${option.label}
        </button>
      `;
      })
      .join("");
  },

  getTypingCharMs() {
    const map = {
      slow: 40,
      normal: 22,
      fast: 12,
    };

    return map[this.getCurrentSpeedKey()] || 22;
  },

  getTypingStartDelayMs() {
    const map = {
      slow: 120,
      normal: 80,
      fast: 40,
    };

    return map[this.getCurrentSpeedKey()] || 80;
  },

  clearTypingTimer() {
    if (this.state.typingTimer) {
      clearTimeout(this.state.typingTimer);
      this.state.typingTimer = null;
    }

    this.state.isTyping = false;

    if (this.elements.item) {
      this.elements.item.classList.remove("is-typing");
    }
  },

  typeItem(text) {
    const el = this.elements.item;
    if (!el) return;

    this.clearTypingTimer();
    this.state.isTyping = true;

    el.classList.add("is-typing");
    el.textContent = "";
    el.style.opacity = "1";
    el.style.filter = "blur(0px)";
    el.style.transform = "scale(1)";

    const speed = this.getCurrentSpeedKey();

    const charMsMap = {
      slow: 80,
      normal: 22,
      fast: 6,
    };

    const startDelayMap = {
      slow: 200,
      normal: 80,
      fast: 10,
    };

    const typingCharMs = charMsMap[speed] || 22;
    const typingStartDelayMs = startDelayMap[speed] || 80;

    let index = 0;

    const typeNext = () => {
      if (!this.state.isTyping) return;

      el.textContent = text.slice(0, index);
      index += 1;

      if (index <= text.length) {
        this.state.typingTimer = setTimeout(typeNext, typingCharMs);
      } else {
        this.state.isTyping = false;
        this.state.typingTimer = null;
      }
    };

    this.state.typingTimer = setTimeout(typeNext, typingStartDelayMs);
  },

  showNextItem() {
    const item = this.getNextItem();
    if (!item || !this.elements.item) return;

    const displayText = this.formatItemText(item);

    // update history
    this.state.history = this.state.history.slice(
      0,
      this.state.historyIndex + 1,
    );
    this.state.history.push(item);
    this.state.historyIndex++;

    const el = this.elements.item;
    const duration = this.config.fadeDurationMs;

    this.clearTypingTimer();

    if (this.state.mode === "instant") {
      el.textContent = displayText;
      el.style.opacity = "1";
      el.style.filter = "blur(0px)";
    } else if (this.state.mode === "fade") {
      el.style.transition = `opacity ${duration}ms ease, filter ${duration}ms ease`;
      el.style.opacity = "0";
      el.style.filter = "blur(1px)";

      setTimeout(() => {
        el.textContent = displayText;
        el.style.opacity = "1";
        el.style.filter = "blur(0px)";
      }, duration);
    } else if (this.state.mode === "typing") {
      this.typeItem(displayText);
    } else if (this.state.mode === "pop") {
      const popDuration = 120;

      el.style.transition = `transform ${popDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${popDuration}ms ease-out`;
      el.style.transform = "scale(0.75)";
      el.style.opacity = "0";

      setTimeout(() => {
        el.textContent = displayText;
        el.style.transform = "scale(1.16)";
        el.style.opacity = "1";

        requestAnimationFrame(() => {
          el.style.transition = `transform ${popDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${popDuration}ms ease-out`;
          el.style.transform = "scale(1)";
        });
      }, popDuration);
    }

    this.state.lastItemId = item.id;
    this.rememberItem(item.id);
    this.rememberType(item.type);
  },

  formatItemText(item) {
    if (item.type === "quote") {
      return `“${item.text}”\n— ${item.author}`;
    }
    return item.text;
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

  scheduleNextItem() {
    const currentText = this.elements.item.textContent || "";
    let delay =
      (this.getDisplayTime(currentText) + this.config.basePauseMs) *
      this.state.speedMultiplier;

    const cadenceFactors =
      this.state.mode === "typing"
        ? [0.9, 1, 1.15]
        : [0.75, 1, 1.35];
    const randomFactor =
      cadenceFactors[Math.floor(Math.random() * cadenceFactors.length)];

    delay *= randomFactor;

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

    if (this.state.mode === "typing") {
      const speed = this.getCurrentSpeedKey();

      const charMsMap = {
        slow: 90,
        normal: 22,
        fast: 6,
      };

      const startDelayMap = {
        slow: 260,
        normal: 80,
        fast: 10,
      };

      const typingCharMs = charMsMap[speed] || 22;
      const typingStartDelayMs = startDelayMap[speed] || 80;

      let typingTime = typingStartDelayMs;

      for (const char of text) {
        let delay = typingCharMs;

        if (/[.,!?]/.test(char)) {
          delay *= 3.5;
        } else if (char === " ") {
          delay *= 1.4;
        }

        typingTime += delay;
      }

      time += typingTime + 700;
    }

    return Math.min(Math.max(time, 7000), 30000);
  },

  async loadItems() {
    try {
      const response = await fetch(this.config.itemsUrl);

      // handle missing file (first run)
      if (response.status === 404) {
        this.renderMessage(
          "No feed found. Copy feed.example.json to feed.json to get started.",
        );
        return;
      }

      if (!response.ok) throw new Error();

      const data = await response.json();
      this.state.items = this.normalizeItems(data.items);

      if (!this.state.items.length) {
        this.renderMessage("Your feed is empty. Add items to feed.json.");
        return;
      }

      this.renderInitialItem();
      this.scheduleNextItem();
    } catch {
      this.renderMessage(
        "Could not load feed.json. Check that it exists and contains valid JSON.",
      );
    }
  },

  normalizeItems(items) {
    return (items || [])
      .filter((item) => item && item.active !== false)
      .filter((item) => typeof item.text === "string" && item.text.trim());
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

  openThemeModal() {
    const modal = this.elements.themeModal;
    const toggle = this.elements.themeToggle;
    const panel = modal.querySelector(".theme-modal-panel");

    if (!modal || !toggle || !panel) return;

    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 500;

    if (!isMobile) {
      const rect = toggle.getBoundingClientRect();
      panel.style.left = `${rect.left + rect.width / 2}px`;
      panel.style.top = `${rect.top - 12}px`;
    } else {
      panel.style.left = "";
      panel.style.top = "";
    }

    modal.hidden = false;

    requestAnimationFrame(() => {
      if (!isMobile) {
        panel.style.transform = "translateX(-50%) translateY(-100%) scale(1)";
      } else {
        panel.style.transform = "none";
      }
      panel.style.opacity = "1";
    });
  },

  closeThemeModal() {
    const modal = this.elements.themeModal;
    const panel = modal.querySelector(".theme-modal-panel");

    if (!modal || !panel) return;

    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 500;

    panel.style.opacity = "0";
    panel.style.transform = isMobile
      ? "none"
      : "translateX(-50%) translateY(-90%) scale(0.96)";

    setTimeout(() => {
      modal.hidden = true;
    }, 150);
  },

  openSettingsModal(group = this.state.activeSettingsGroup) {
    const modal = this.elements.settingsModal;
    if (!modal) return;

    modal.hidden = false;
    this.setSettingsGroup(group);

    requestAnimationFrame(() => {
      modal.classList.add("is-open");
    });
  },

  closeSettingsModal() {
    const modal = this.elements.settingsModal;
    if (!modal) return;

    const panel = modal.querySelector(".settings-modal-panel");

    panel.style.transition = "transform 0.1s ease, opacity 0.1s ease";
    panel.style.transform = "scale(0.9)";
    panel.style.opacity = "0";

    setTimeout(() => {
      modal.hidden = true;

      panel.style.transition = "";
      panel.style.transform = "";
      panel.style.opacity = "";
    }, 70);
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

  bindEvents() {
    document.body.addEventListener("click", (event) => {
      const speedButton = event.target.closest("[data-speed]");
      const modeButton = event.target.closest("[data-mode]");
      const settingsGroupButton = event.target.closest("[data-settings-group]");
      const settingsToggle = event.target.closest("#settings-toggle");
      const settingsClose = event.target.closest("#settings-close");
      const settingsModal = event.target.closest("#settings-modal");
      const settingsPanel = event.target.closest(".settings-modal-panel");
      const themeToggle = event.target.closest("#theme-toggle");
      const themeButton = event.target.closest("[data-theme]");
      const modalPanel = event.target.closest(".theme-modal-panel");
      const githubLink = event.target.closest(".bottom-bar a");
      const noticeToggle = event.target.closest("#notice-toggle");

      if (settingsGroupButton) {
        const group = settingsGroupButton.dataset.settingsGroup;
        this.setSettingsGroup(group);

        if (window.innerWidth <= 480) {
          this.openSettingsModal(group);
        }

        return;
      }

      if (speedButton) {
        this.setSpeed(speedButton.dataset.speed);
        return;
      }

      if (modeButton) {
        this.setMode(modeButton.dataset.mode);
        return;
      }

      if (settingsToggle) return this.openSettingsModal();
      if (settingsClose) return this.closeSettingsModal();

      if (
        this.elements.settingsModal &&
        !this.elements.settingsModal.hidden &&
        settingsModal &&
        !settingsPanel
      ) {
        return this.closeSettingsModal();
      }

      if (this.elements.settingsModal && !this.elements.settingsModal.hidden) {
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
        this.closeSettingsModal();
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

    window.addEventListener("resize", () => {
      this.refreshDesktopSettingsLayout();
    });
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

  formatThemeName(name) {
    return name.replace(/-/g, " ");
  },

  measureDesktopSettingsWidth(group) {
    const probe = document.createElement("div");
    probe.className = "control-group desktop-controls";
    probe.id = "desktop-settings-options-probe";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.width = "auto";
    probe.style.whiteSpace = "nowrap";
    probe.style.left = "-9999px";
    probe.style.top = "0";

    probe.innerHTML = this.getDesktopSettingsMarkup(group);
    document.body.appendChild(probe);

    const width = probe.offsetWidth;
    probe.remove();

    return width;
  },

  refreshDesktopSettingsLayout() {
    const container = this.elements.desktopSettingsOptions;
    if (!container) return;

    container.style.transition = "none";
    container.style.width = "auto"; // 🔥 reset fully
    container.style.opacity = "";

    this.renderDesktopSettingsOptions();

    requestAnimationFrame(() => {
      container.style.width = `${container.scrollWidth}px`;
      container.style.transition = "";
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
};

document.addEventListener("DOMContentLoaded", () => {
  Carousel.init();
});
