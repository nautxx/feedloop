/**
 * A single fact item
 * @typedef {Object} Fact
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
 * @property {string} factsUrl
 * @property {number} fadeDurationMs
 * @property {number} basePauseMs
 * @property {number} recentFactsLimit
 * @property {number} maxSameTypeInRow
 * @property {{ cache: string }} fetchOptions
 * @property {{ empty: string, error: string }} messages
 */

/**
 * Runtime state
 * @typedef {Object} State
 * @property {Fact[]} facts
 * @property {string[]} recentFactIds
 * @property {string[]} recentTypes
 * @property {string|null} lastFactId
 * @property {number|null} rotationTimer
 */

/**
 * Available theme names
 * @typedef {"calm" | "lavender" | "quiet" | "sage" | "ocean" | "sunset" | "ink"} Theme
 */

/** @type {{ config: Config, state: State }} */
const Carousel = {
  // Core configuration for timing, data source, and messages
  config: {
    factsUrl: "/facts.json",
    fadeDurationMs: 2000,
    basePauseMs: 600,
    recentFactsLimit: 5,
    maxSameTypeInRow: 2,
    fetchOptions: { cache: "no-store" },
    messages: {
      empty: "No facts available.",
      error: "Could not load facts.",
    },
  },

  // Runtime state
  state: {
    facts: [],
    recentFactIds: [],
    recentTypes: [],
    lastFactId: null,
    rotationTimer: null,
  },

  // Cached DOM elements
  elements: {
    fact: null,
    themeToggle: null,
    themeModal: null,
  },

  // Initialize app
  init() {
    this.cacheElements();
    this.applySavedTheme();
    this.bindEvents();
    this.loadFacts();
  },

  // Cache DOM references
  cacheElements() {
    this.elements.fact = document.getElementById("fact");
    this.elements.themeToggle = document.getElementById("theme-toggle");
    this.elements.themeModal = document.getElementById("theme-modal");
  },

  // Apply saved theme on load
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

    // position horizontally centered on button
    panel.style.left = `${rect.left + rect.width / 2}px`;

    // position above button (with spacing)
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

  // Bind user interactions
  bindEvents() {
    document.body.addEventListener("click", (event) => {
      const themeToggle = event.target.closest("#theme-toggle");
      const themeButton = event.target.closest("[data-theme]");
      const modalPanel = event.target.closest(".theme-modal-panel");
      const githubLink = event.target.closest(".bottom-bar a");

      if (githubLink) {
        return;
      }

      if (themeToggle) {
        this.openThemeModal();
        return;
      }

      if (themeButton) {
        this.setTheme(themeButton.dataset.theme);
        this.closeThemeModal();
        return;
      }

      if (
        this.elements.themeModal &&
        !this.elements.themeModal.hidden &&
        !modalPanel
      ) {
        this.closeThemeModal();
        return;
      }

      if (!this.state.facts.length) return;
      this.showNextFact();
      this.resetRotationTimer();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.closeThemeModal();
      }
    });
  },

  // Fetch and initialize facts
  async loadFacts() {
    try {
      const response = await fetch(
        this.config.factsUrl,
        this.config.fetchOptions,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.state.facts = this.normalizeFacts(data.facts);

      if (!this.state.facts.length) {
        this.renderMessage(this.config.messages.empty);
        return;
      }

      this.renderInitialFact();
      this.scheduleNextFact();
    } catch (error) {
      console.error("Failed to load facts:", error);
      this.renderMessage(this.config.messages.error);
    }
  },

  /**
   * Return full years since a given date.
   * @param {string} dateString
   * @returns {number}
   */
  getFullYearsSince(dateString) {
    const today = new Date();
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return 0;

    let years = today.getFullYear() - date.getFullYear();

    const hasNotReachedAnniversary =
      today.getMonth() < date.getMonth() ||
      (today.getMonth() === date.getMonth() &&
        today.getDate() < date.getDate());

    if (hasNotReachedAnniversary) {
      years -= 1;
    }

    return Math.max(0, years);
  },

  /**
   * Format singular/plural count.
   * @param {number} value
   * @param {string} singular
   * @param {string} plural
   * @returns {string}
   */
  formatCount(value, singular, plural) {
    return `${value} ${value === 1 ? singular : plural}`;
  },

  /**
   * Expand dynamic template values.
   * Supported placeholder:
   * - {years}
   *
   * @param {string} template
   * @param {Fact} fact
   * @returns {string}
   */
  renderFactTemplate(template, fact) {
    let text = template;

    if (text.includes("{years}") && fact.eventDate) {
      const years = this.getFullYearsSince(fact.eventDate);
      text = text.replaceAll(
        "{years}",
        this.formatCount(years, "year", "years"),
      );
    }

    return text;
  },

  /**
   * Validate, clean, and expand incoming facts.
   * @param {Fact[]} facts
   * @returns {Fact[]}
   */
  normalizeFacts(facts) {
    return (facts || [])
      .filter((fact) => fact && fact.active !== false)
      .map((fact) => {
        const normalizedFact = { ...fact };

        if (
          typeof normalizedFact.template === "string" &&
          normalizedFact.template.trim()
        ) {
          normalizedFact.text = this.renderFactTemplate(
            normalizedFact.template,
            normalizedFact,
          );
        }

        return normalizedFact;
      })
      .filter((fact) => {
        return typeof fact.text === "string" && fact.text.trim();
      });
  },

  // Return a weight for each fact based on priority
  getFactWeight(fact) {
    return fact.priority || 1;
  },

  // Set active theme and persist it
  setTheme(themeName) {
    const themeClasses = Array.from(document.body.classList).filter(
      (className) => className.startsWith("theme-"),
    );

    document.body.classList.remove(...themeClasses);
    document.body.classList.add(`theme-${themeName}`);
    localStorage.setItem("Carousel-theme", themeName);

    document.querySelectorAll("[data-theme]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.theme === themeName);
    });

    if (this.elements.themeToggle) {
      const label = this.elements.themeToggle.querySelector(".theme-label");
      if (label) {
        label.textContent = themeName;
      }
    }
  },

  // Pick one fact using weighted random selection
  getWeightedRandomFact(facts) {
    const totalWeight = facts.reduce((sum, fact) => {
      return sum + this.getFactWeight(fact);
    }, 0);

    let random = Math.random() * totalWeight;

    for (const fact of facts) {
      random -= this.getFactWeight(fact);

      if (random <= 0) {
        return fact;
      }
    }

    return facts[facts.length - 1] || null;
  },

  // Track recently shown facts and keep only the latest N items
  rememberFact(factId) {
    this.state.recentFactIds.push(factId);

    if (this.state.recentFactIds.length > this.config.recentFactsLimit) {
      this.state.recentFactIds.shift();
    }
  },

  // Track recent fact types and keep only the latest N items
  rememberType(type) {
    this.state.recentTypes.push(type);

    if (this.state.recentTypes.length > this.config.maxSameTypeInRow) {
      this.state.recentTypes.shift();
    }
  },

  // Check whether a type has appeared too many times in a row
  isTypeOverused(type) {
    if (this.state.recentTypes.length < this.config.maxSameTypeInRow) {
      return false;
    }

    return this.state.recentTypes.every((recentType) => recentType === type);
  },

  // Get next fact while avoiding recently shown facts and repeated types
  getNextFact() {
    if (!this.state.facts.length) return null;

    let eligibleFacts = this.state.facts.filter((fact) => {
      return (
        !this.state.recentFactIds.includes(fact.id) &&
        !this.isTypeOverused(fact.type)
      );
    });

    // If type balancing is too restrictive, ignore type but keep no-repeat window
    if (!eligibleFacts.length) {
      eligibleFacts = this.state.facts.filter((fact) => {
        return !this.state.recentFactIds.includes(fact.id);
      });
    }

    // If the no-repeat window is too restrictive, avoid only the last fact
    if (!eligibleFacts.length) {
      eligibleFacts = this.state.facts.filter((fact) => {
        return fact.id !== this.state.lastFactId;
      });
    }

    // Final fallback if only one fact exists
    if (!eligibleFacts.length) {
      eligibleFacts = [...this.state.facts];
    }

    return this.getWeightedRandomFact(eligibleFacts);
  },

  // Render first fact immediately
  renderInitialFact() {
    const fact = this.getNextFact();
    if (!fact) return;

    this.elements.fact.textContent = fact.text;
    this.elements.fact.style.opacity = "1";
    this.state.lastFactId = fact.id;
    this.rememberFact(fact.id);
    this.rememberType(fact.type);
  },

  // Render fallback message
  renderMessage(message) {
    this.elements.fact.textContent = message;
    this.elements.fact.style.opacity = "1";
  },

  // Transition with equal fade + blur
  showNextFact() {
    const fact = this.getNextFact();
    if (!fact || !this.elements.fact) return;

    const { fact: factEl } = this.elements;
    const duration = this.config.fadeDurationMs;

    // Fade out + blur (same speed)
    factEl.style.transition = `
    opacity ${duration}ms ease,
    filter ${duration}ms ease
  `;
    factEl.style.opacity = "0";
    factEl.style.filter = "blur(2px)";

    window.setTimeout(() => {
      factEl.textContent = fact.text || "";

      // Fade in + unblur (same speed)
      factEl.style.transition = `
      opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1),
      filter ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)
    `;
      factEl.style.opacity = "1";
      factEl.style.filter = "blur(0px)";

      this.state.lastFactId = fact.id;
      this.rememberFact(fact.id);
      this.rememberType(fact.type);
    }, duration);
  },

  // Schedule next fact based on smart timing
  scheduleNextFact() {
    const currentText = this.elements.fact.textContent || "";
    const delay = this.getDisplayTime(currentText) + this.config.basePauseMs;

    this.state.rotationTimer = window.setTimeout(() => {
      this.showNextFact();
      this.scheduleNextFact();
    }, delay);
  },

  // Reset rotation timer after manual interaction
  resetRotationTimer() {
    if (this.state.rotationTimer) {
      window.clearTimeout(this.state.rotationTimer);
    }

    this.scheduleNextFact();
  },

  // Calculate display time based on reading speed and punctuation
  getDisplayTime(text) {
    const words = text.trim().split(/\s+/).length;
    const punctuation = (text.match(/[.,;:!?—-]/g) || []).length;

    let time = (words / 2.4) * 1000;
    time += punctuation * 350;
    time += 3500;

    return Math.min(Math.max(time, 7000), 14000);
  },
};

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  Carousel.init();
});
