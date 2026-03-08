const state = {
  menuData: null,
  cart: {},
  currency: "₹",
  addonGroups: {},
  itemMap: {},
  addonModalOpen: false
};

const storageKey = "gregsCafeCart";

// Business Details
function loadMenuData() {
  if (state.menuData) {
    return Promise.resolve(state.menuData);
  }
  return fetch("data/menu.json")
    .then((response) => response.json())
    .then((data) => {
      state.menuData = data;
      state.currency = data.currency || "₹";
      state.addonGroups = (data.addonGroups || []).reduce((acc, group) => {
        acc[group.id] = group;
        return acc;
      }, {});
      state.itemMap = data.categories
        .flatMap((category) => category.items)
        .reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});
      return data;
    })
    .catch(() => null);
}

function formatCurrency(amount) {
  const safeAmount = Number(amount || 0);
  return `${state.currency} ${safeAmount}`;
}

function persistCart() {
  localStorage.setItem(storageKey, JSON.stringify(state.cart));
}

function normalizeCart(raw) {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    return raw.reduce((acc, item) => {
      if (!item?.key) return acc;
      acc[item.key] = item;
      return acc;
    }, {});
  }
  if (typeof raw === "object") {
    const normalized = {};
    Object.values(raw).forEach((item) => {
      if (!item) return;
      if (item.key) {
        normalized[item.key] = item;
        return;
      }
      const key = `legacy-${item.id || Math.random().toString(36).slice(2)}`;
      normalized[key] = {
        ...item,
        key,
        unitPrice: Number(item.price || item.unitPrice || 0),
        basePrice: Number(item.price || item.unitPrice || 0),
        addons: item.addons || [],
        isOffer: Boolean(item.isOffer)
      };
    });
    return normalized;
  }
  return {};
}

function restoreCart() {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.cart = normalizeCart(parsed);
    } catch {
      state.cart = {};
    }
  }
}

function getCartItems() {
  return Object.values(state.cart);
}

function updateCartCount() {
  const count = getCartItems().reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll("#cartCount").forEach((el) => {
    el.textContent = count;
  });
  const cartBar = document.getElementById("cartBar");
  if (cartBar) {
    const label = document.getElementById("cartBarCount");
    if (label) {
      label.textContent = `${count} ${count === 1 ? "item" : "items"}`;
    }
    const isMobile = window.matchMedia("(max-width: 700px)").matches;
    cartBar.style.display = count > 0 && isMobile ? "flex" : "none";
  }
  refreshMobileViewCartBar();
}

// Today Offer
function hasOfferItem() {
  return getCartItems().some((item) => item.isOffer);
}

function hasRegularItems() {
  return getCartItems().some((item) => !item.isOffer);
}

function enforceOfferRules() {
  if (hasRegularItems()) return false;
  const nextCart = {};
  let removed = false;
  getCartItems().forEach((item) => {
    if (!item.isOffer) {
      nextCart[item.key] = item;
    } else {
      removed = true;
    }
  });
  if (removed) {
    state.cart = nextCart;
  }
  return removed;
}

function renderTodayOffer(data) {
  const offerGrid = document.getElementById("todayOfferGrid");
  const offerNote = document.getElementById("offerUnlockNote");
  if (!offerGrid) return;

  offerGrid.innerHTML = "";
  const offerItems = data.todayOffer || [];
  const vegOffer = offerItems.find((entry) => entry.veg === true);
  const nonVegOffer = offerItems.find((entry) => entry.veg === false);
  const displayOffers = [vegOffer, nonVegOffer].filter(Boolean);
  const eligible = hasRegularItems();
  const selectedOffer = getCartItems().find((cartItem) => cartItem.isOffer);
  const selectedOfferId = selectedOffer?.id || null;
  const hasSelectedOffer = Boolean(selectedOfferId);

  displayOffers.forEach((item) => {
    const card = document.createElement("article");
    card.className = "offer-card";
    const isSelected = hasSelectedOffer && selectedOfferId === item.id;
    const isLocked = (!eligible && !isSelected) || (hasSelectedOffer && !isSelected);
    if (isSelected) card.classList.add("is-selected");
    if (isLocked) card.classList.add("is-locked");
    const disabled = !eligible || (hasSelectedOffer && !isSelected) || item.available === false;
    const buttonLabel = item.available === false ? "Sold Out" : "Add Offer";
    const imagePath = item.image || "";
    const hasImage = Boolean(imagePath);
    let instruction = "";
    if (!eligible) {
      instruction = "Add one regular menu item to unlock Today’s Offer.";
    } else if (!hasSelectedOffer) {
      instruction = "You can add only 1 Today’s Offer item.";
    } else if (!isSelected) {
      instruction = "Only 1 Today’s Offer item allowed per order.";
    }
    card.innerHTML = `
      ${hasImage ? `<div class="offer-media"><img src="${imagePath}" alt="${item.name}" loading="lazy" /></div>` : ""}
      <div class="offer-details">
        <h3>${item.name}</h3>
        ${item.desc ? `<p>${item.desc}</p>` : ""}
      </div>
      <div class="offer-actions">
        <div class="offer-price">
          <span class="offer-original">${formatCurrency(item.originalPrice)}</span>
          <span class="offer-final">${formatCurrency(item.price)}</span>
        </div>
        <div class="offer-cta">
          ${
            isSelected
              ? `
                <div class="offer-qty">
                  <button class="offer-qty-btn" data-offer-remove="${selectedOffer?.key || ""}" aria-label="Remove offer">−</button>
                  <span class="offer-qty-num">1</span>
                </div>
                <span class="offer-selected-label">Selected</span>
              `
              : `
                <button class="btn btn-primary offer-add-btn" data-offer-id="${item.id}" ${disabled ? "disabled" : ""}>${buttonLabel}</button>
                ${instruction ? `<span class="offer-unlock">${instruction}</span>` : ""}
              `
          }
        </div>
      </div>
    `;
    if (hasImage) {
      const img = card.querySelector(".offer-media img");
      if (img) {
        img.addEventListener("error", () => {
          const media = img.closest(".offer-media");
          if (media) media.remove();
        });
      }
    }
    offerGrid.appendChild(card);
  });

  if (offerNote) {
    offerNote.textContent = "Add one regular menu item to unlock Today’s Offer.";
    offerNote.style.display = eligible ? "none" : "block";
  }

  offerGrid.querySelectorAll("[data-offer-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const offerId = button.getAttribute("data-offer-id");
      if (!offerId) return;
      addOfferToCart(offerId);
    });
  });

  offerGrid.querySelectorAll("[data-offer-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-offer-remove");
      if (!key) return;
      removeItem(key);
    });
  });
}

function addOfferToCart(offerId) {
  loadMenuData().then((data) => {
    if (!data || !hasRegularItems() || hasOfferItem()) return;
    const offerItem = (data.todayOffer || []).find((entry) => entry.id === offerId);
    if (!offerItem || offerItem.available === false) return;
    addToCart(offerId, [], {
      isOffer: true,
      originalPrice: offerItem.originalPrice
    });
  });
}

// Menu Data
function renderMenu() {
  const menuGrid = document.getElementById("menuGrid");
  if (!menuGrid) return;

  loadMenuData().then((data) => {
    if (!data) return;

    menuGrid.innerHTML = "";

    data.categories.forEach((category) => {
      const section = renderCategorySection(category);
      if (section) menuGrid.appendChild(section);
    });

    renderTodayOffer(data);
    setupMenuGridActions();
    setupMenuNavigator();
    updateMenuButtonsFromCart();
  });
}

// Product Card
function renderCategorySection(category) {
  if (!category) return null;
  const section = document.createElement("section");
  section.className = "menu-category-block";
  section.id = category.id;

  const title = document.createElement("h2");
  title.className = "menu-category-title";
  title.textContent = category.title;

  const grid = document.createElement("div");
  grid.className = "menu-grid";

  category.items.forEach((item) => {
    const card = buildMenuCard(item);
    if (card) grid.appendChild(card);
  });

  section.appendChild(title);
  section.appendChild(grid);
  return section;
}

function buildMenuCard(item) {
  if (!item) return null;
  const card = document.createElement("article");
  card.className = "menu-item";
  card.dataset.id = item.id;
  const imagePath = item.image || "";
  const hasImage = Boolean(imagePath);
  const hasDesc = Boolean(item.desc);
  const hasAddons = Array.isArray(item.addonGroupIds) && item.addonGroupIds.length > 0;
  card.innerHTML = `
      ${hasImage ? `<button class="menu-image" data-image="${imagePath}" aria-label="Preview ${item.name}"><img src="${imagePath}" alt="${item.name}" /></button>` : ""}
      <div>
        <h3>${item.name}</h3>
        ${hasDesc ? `<p>${item.desc}</p>` : ""}
      </div>
      <div class="actions">
        <span class="badge ${item.veg ? "veg" : "nonveg"}">${item.veg ? "Veg" : "Non-Veg"}</span>
        <span class="price">${formatCurrency(item.price)}</span>
      </div>
      <div class="actions menu-controls" data-id="${item.id}" data-available="${item.available}">
        ${item.available ? `<button class="btn btn-primary" data-action="add" data-id="${item.id}">Add</button>` : `<span class="badge sold">Sold Out</span>`}
        ${hasAddons ? `<span class="customisable-label">customisable</span>` : ""}
      </div>
    `;
  if (!hasImage) {
    card.classList.add("no-image");
  }
  if (hasImage) {
    const img = card.querySelector("img");
    if (img) {
      img.addEventListener("error", () => {
        const imageButton = img.closest(".menu-image");
        if (imageButton) imageButton.style.display = "none";
        card.classList.add("no-image");
      });
    }
  }
  return card;
}

function setupMenuGridActions() {
  const menuGrid = document.getElementById("menuGrid");
  if (!menuGrid || menuGrid.dataset.actionsReady === "true") return;
  menuGrid.dataset.actionsReady = "true";

  menuGrid.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest("[data-action][data-id]");
    if (!control) return;
    const action = control.getAttribute("data-action");
    const id = control.getAttribute("data-id");
    const key = control.getAttribute("data-key");
    if (!action || !id) return;
    if (action === "add") {
      handleAddAction(id);
    } else if (action === "inc") {
      updateQty(key || id, 1);
    } else if (action === "dec") {
      updateQty(key || id, -1);
    }
  });
}

function handleAddAction(itemId) {
  loadMenuData().then((data) => {
    if (!data) return;
    const item = state.itemMap[itemId];
    if (!item) return;
    if (Array.isArray(item.addonGroupIds) && item.addonGroupIds.length > 0) {
      openAddonModal(item);
      return;
    }
    addToCart(itemId);
  });
}

// Addon Groups
function serializeAddons(addons) {
  if (!addons || addons.length === 0) return "noaddons";
  return addons
    .map((addon) => `${addon.groupId}:${addon.id}`)
    .sort()
    .join("|");
}

function buildCartItem(item, addons, overrides = {}) {
  const addonsPrice = addons.reduce((sum, addon) => sum + addon.price, 0);
  const unitPrice = Number(item.price || 0) + addonsPrice;
  const addonKey = serializeAddons(addons);
  const keyPrefix = overrides.isOffer ? "offer" : "item";
  return {
    key: `${keyPrefix}-${item.id}-${addonKey}`,
    id: item.id,
    name: item.name,
    qty: 1,
    basePrice: Number(item.price || 0),
    unitPrice,
    addons,
    veg: item.veg,
    isOffer: Boolean(overrides.isOffer),
    originalPrice: overrides.originalPrice || item.originalPrice || null
  };
}

function addToCart(itemId, addons = [], overrides = {}) {
  loadMenuData().then((data) => {
    if (!data) return;
    const allItems = data.categories.flatMap((cat) => cat.items);
    const offerItems = data.todayOffer || [];
    const item = allItems.find((entry) => entry.id === itemId) || offerItems.find((entry) => entry.id === itemId);
    if (!item) return;

    const newItem = buildCartItem(item, addons, overrides);
    if (newItem.isOffer && hasOfferItem()) return;

    const existing = state.cart[newItem.key];
    if (existing) {
      if (newItem.isOffer) {
        existing.qty = 1;
      } else {
        existing.qty += 1;
      }
    } else {
      state.cart[newItem.key] = newItem;
    }

    persistCart();
    renderCart();
    updateMenuButtonsFromCart();
  });
}

function updateQty(itemKey, delta) {
  let entry = state.cart[itemKey];
  if (!entry) {
    entry = getCartItems().find(
      (item) => item.id === itemKey && (!item.addons || item.addons.length === 0) && !item.isOffer
    );
  }
  if (!entry) return;
  if (entry.isOffer && delta > 0) return;
  entry.qty += delta;
  if (entry.isOffer && entry.qty > 1) {
    entry.qty = 1;
  }
  if (entry.qty <= 0) {
    delete state.cart[entry.key];
  }
  enforceOfferRules();
  persistCart();
  renderCart();
  updateMenuButtonsFromCart();
}

function removeItem(itemKey) {
  if (!state.cart[itemKey]) return;
  delete state.cart[itemKey];
  enforceOfferRules();
  persistCart();
  renderCart();
  updateMenuButtonsFromCart();
}

function clearCart() {
  state.cart = {};
  persistCart();
  renderCart();
  updateMenuButtonsFromCart();
}

function getItemCountById(itemId) {
  return getCartItems()
    .filter((item) => item.id === itemId)
    .reduce((sum, item) => sum + item.qty, 0);
}

// Discount Logic
function calculateTotals() {
  let regularSubtotal = 0;
  let offerSubtotal = 0;

  getCartItems().forEach((item) => {
    const lineTotal = item.unitPrice * item.qty;
    if (item.isOffer) {
      offerSubtotal += lineTotal;
    } else {
      regularSubtotal += lineTotal;
    }
  });

  const subtotal = regularSubtotal + offerSubtotal;
  let discountRate = 0;
  if (regularSubtotal >= 10000) {
    discountRate = 0.2;
  } else if (regularSubtotal >= 300) {
    discountRate = 0.15;
  }
  const discount = Math.round(regularSubtotal * discountRate);
  const taxableAmount = Math.max(subtotal - discount, 0);
  const gst = Math.round(taxableAmount * 0.05);

  // Delivery Fee Logic
  const deliveryFee = subtotal >= 500 ? 0 : 50;
  const total = taxableAmount + gst + deliveryFee;

  return {
    regularSubtotal,
    offerSubtotal,
    subtotal,
    discountRate,
    discount,
    gst,
    deliveryFee,
    total
  };
}

function renderCartSummary() {
  const summarySubtotal = document.getElementById("summarySubtotal");
  const summaryDiscount = document.getElementById("summaryDiscount");
  const summaryGst = document.getElementById("summaryGst");
  const summaryDelivery = document.getElementById("summaryDelivery");
  const summaryTotal = document.getElementById("summaryTotal");
  const discountMessage = document.getElementById("discountMessage");
  const deliveryMessage = document.getElementById("deliveryMessage");

  const totals = calculateTotals();

  if (summarySubtotal) summarySubtotal.textContent = formatCurrency(totals.subtotal);
  if (summaryDiscount) summaryDiscount.textContent = `- ${formatCurrency(totals.discount)}`;
  if (summaryGst) summaryGst.textContent = formatCurrency(totals.gst);
  if (summaryDelivery) summaryDelivery.textContent = totals.deliveryFee === 0 ? "Free" : formatCurrency(totals.deliveryFee);
  if (summaryTotal) summaryTotal.textContent = formatCurrency(totals.total);

  if (discountMessage) {
    if (totals.regularSubtotal >= 10000) {
      discountMessage.textContent = "20% Flat Off unlocked.";
    } else if (totals.regularSubtotal >= 300) {
      discountMessage.textContent = "15% Flat Off unlocked.";
    } else {
      const diff = 300 - totals.regularSubtotal;
      discountMessage.textContent = `Add ${formatCurrency(diff)} more to unlock 15% Flat Off.`;
    }
  }

  if (deliveryMessage) {
    if (totals.subtotal >= 500) {
      deliveryMessage.textContent = "Free delivery unlocked.";
    } else {
      const diff = 500 - totals.subtotal;
      deliveryMessage.textContent = `Add ${formatCurrency(diff)} more to get free delivery.`;
    }
  }

  return totals;
}

// Slide Cart
function renderCart() {
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  const cartBarTotal = document.getElementById("cartBarTotal");
  if (!cartItems || !cartTotal) {
    updateCartCount();
    return;
  }

  const offerRemoved = enforceOfferRules();
  if (offerRemoved) {
    persistCart();
  }
  cartItems.innerHTML = "";

  getCartItems().forEach((item) => {
    const lineTotal = item.unitPrice * item.qty;
    const row = document.createElement("div");
    row.className = "cart-item";

    const addonLines = (item.addons || [])
      .map((addon) => `<div class="ci-addon">+ ${addon.name}</div>`)
      .join("");

    row.innerHTML = `
      <div class="ci-left">
        <div class="ci-name">${item.name}${item.isOffer ? " <span class=\"offer-tag\">Today's Offer</span>" : ""}</div>
        ${addonLines}
        <div class="ci-each">${formatCurrency(item.unitPrice)} each</div>
      </div>
      <div class="ci-right">
        <div class="ci-qty">
          <button data-qty="-" aria-label="Decrease">-</button>
          <span class="qty-num">${item.qty}</span>
          ${item.isOffer ? "" : `<button data-qty="+" aria-label="Increase">+</button>`}
        </div>
        <div class="ci-total">${formatCurrency(lineTotal)}</div>
        <button class="ci-remove" data-remove="${item.key}" aria-label="Remove item">Remove</button>
      </div>
    `;

    row.querySelector("[data-qty='-']").addEventListener("click", () => updateQty(item.key, -1));
    row.querySelector("[data-qty='+']")?.addEventListener("click", () => updateQty(item.key, 1));
    row.querySelector("[data-remove]").addEventListener("click", () => removeItem(item.key));
    cartItems.appendChild(row);
  });

  const totals = renderCartSummary();
  cartTotal.textContent = formatCurrency(totals.total);
  if (cartBarTotal) {
    cartBarTotal.textContent = formatCurrency(totals.total);
  }

  updateCartCount();
  loadMenuData().then((data) => {
    if (data) renderTodayOffer(data);
  });
}

function updateMenuButtonsFromCart() {
  const controlsList = document.querySelectorAll(".menu-controls[data-id]");
  if (!controlsList.length) return;

  controlsList.forEach((controls) => {
    const itemId = controls.getAttribute("data-id");
    if (!itemId) return;
    const item = state.itemMap[itemId];
    const isSoldOut = controls.dataset.available === "false";
    if (isSoldOut) {
      controls.innerHTML = `<span class="badge sold">Sold Out</span>`;
      return;
    }

    const totalQty = getItemCountById(itemId);
    const hasAddons = Array.isArray(item?.addonGroupIds) && item.addonGroupIds.length > 0;

    if (hasAddons) {
      if (totalQty <= 0) {
        controls.innerHTML = `
          <button class="btn btn-primary" data-action="add" data-id="${itemId}">Add</button>
          <span class="customisable-label">customisable</span>
        `;
        return;
      }
      const addonEntry = getCartItems().find((entry) => entry.id === itemId && !entry.isOffer);
      const addonKey = addonEntry?.key || "";
      controls.innerHTML = `
        <button class="qty-btn" data-action="dec" data-id="${itemId}" data-key="${addonKey}" aria-label="Decrease">-</button>
        <span class="qty-num">${totalQty}</span>
        <button class="qty-btn" data-action="inc" data-id="${itemId}" data-key="${addonKey}" aria-label="Increase">+</button>
        <span class="customisable-label">customisable</span>
      `;
      return;
    }

    if (totalQty <= 0) {
      controls.innerHTML = `<button class="btn btn-primary" data-action="add" data-id="${itemId}">Add</button>`;
      return;
    }

    controls.innerHTML = `
      <button class="qty-btn" data-action="dec" data-id="${itemId}" aria-label="Decrease">-</button>
      <span class="qty-num">${totalQty}</span>
      <button class="qty-btn" data-action="inc" data-id="${itemId}" aria-label="Increase">+</button>
    `;
  });
}

function setupMenuNavigator() {
  const btn = document.getElementById("menuNavigatorBtn");
  const panel = document.getElementById("categoryNavigator");
  if (!btn || !panel) return;

  const closePanel = () => {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };

  const togglePanel = () => {
    if (panel.hidden) {
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    } else {
      closePanel();
    }
  };

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePanel();
  });

  panel.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-target]");
    if (!target) return;
    const id = target.getAttribute("data-target");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    closePanel();
  });

  document.addEventListener("click", (event) => {
    if (panel.hidden) return;
    if (event.target === btn || panel.contains(event.target)) return;
    closePanel();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePanel();
    }
  });
}

// Image Modal
function setupImageModal() {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("imageModalImg");
  const modalClose = document.getElementById("imageModalClose");
  if (!modal || !modalImg) return;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest("[data-image]");
    if (!trigger) return;
    const src = trigger.getAttribute("data-image");
    if (!src) return;
    modalImg.src = src;
    modal.hidden = false;
    document.body.classList.add("modal-open");
  });

  const closeModal = () => {
    modal.hidden = true;
    modalImg.src = "";
    document.body.classList.remove("modal-open");
  };

  modalClose?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
}

// Addon Modal
function closeAddonModal() {
  const modal = document.getElementById("addonModal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  state.addonModalOpen = false;
  if (["#addonModal", "#customize", "#addons"].includes(window.location.hash)) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

function setupAddonModal() {
  const modal = document.getElementById("addonModal");
  const closeBtn = document.getElementById("addonModalClose");
  if (!modal) return;

  closeAddonModal();

  if (closeBtn) {
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      closeAddonModal();
    });
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeAddonModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.addonModalOpen) {
      closeAddonModal();
    }
  });
}

function openAddonModal(item) {
  const modal = document.getElementById("addonModal");
  const modalContent = document.getElementById("addonModalContent");
  const modalTitle = document.getElementById("addonModalTitle");
  const modalError = document.getElementById("addonModalError");
  if (!modal || !modalContent || !modalTitle) return;
  if (!Array.isArray(item?.addonGroupIds) || item.addonGroupIds.length === 0) return;

  modalTitle.textContent = item.name;
  modalContent.innerHTML = "";
  if (modalError) modalError.textContent = "";

  const groups = (item.addonGroupIds || []).map((id) => state.addonGroups[id]).filter(Boolean);

  groups.forEach((group) => {
    const groupEl = document.createElement("div");
    groupEl.className = "addon-group";
    groupEl.dataset.groupId = group.id;
    groupEl.dataset.max = group.max;
    groupEl.dataset.min = group.min;
    groupEl.innerHTML = `
      <div class="addon-head">
        <h4>${group.title}</h4>
        ${group.note ? `<span>${group.note}</span>` : ""}
      </div>
      <div class="addon-options"></div>
    `;

    const optionsWrap = groupEl.querySelector(".addon-options");
    const isSingle = group.max === 1;

    group.options.forEach((option) => {
      const optionId = `${group.id}-${option.id}`;
      const inputType = isSingle ? "radio" : "checkbox";
      const priceLabel = option.price ? `+ ${formatCurrency(option.price)}` : "Included";
      const optionEl = document.createElement("label");
      optionEl.className = "addon-option";
      optionEl.innerHTML = `
        <input type="${inputType}" name="${group.id}" value="${option.id}" data-group="${group.id}" data-price="${option.price}" data-label="${option.name}" />
        <span>${option.name}</span>
        <strong>${priceLabel}</strong>
      `;
      optionsWrap?.appendChild(optionEl);
    });

    modalContent.appendChild(groupEl);
  });

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  state.addonModalOpen = true;

  modalContent.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const groupId = target.dataset.group;
      const groupEl = modalContent.querySelector(`[data-group-id='${groupId}']`);
      const max = Number(groupEl?.dataset.max || 0);
      if (!groupId || !groupEl || !max) return;
      const checked = groupEl.querySelectorAll("input[type='checkbox']:checked");
      if (checked.length > max) {
        target.checked = false;
      }
    });
  });

  const confirmBtn = document.getElementById("addonModalConfirm");

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const selections = [];
      let hasError = false;
      groups.forEach((group) => {
        const groupEl = modalContent.querySelector(`[data-group-id='${group.id}']`);
        if (!groupEl) return;
        const chosen = Array.from(groupEl.querySelectorAll("input:checked")).map((input) => {
          const price = Number(input.getAttribute("data-price")) || 0;
          return {
            groupId: group.id,
            groupTitle: group.title,
            id: input.value,
            name: input.getAttribute("data-label") || "",
            price
          };
        });
        if (group.min > 0 && chosen.length < group.min) {
          hasError = true;
        }
        selections.push(...chosen);
      });

      if (hasError) {
        if (modalError) {
          modalError.textContent = "Please complete required selections before adding.";
        }
        return;
      }

      addToCart(item.id, selections);
      closeAddonModal();
    };
  }
}

// WhatsApp Order
function buildWhatsAppMessage() {
  const name = document.getElementById("customerName")?.value || "";
  const phone = document.getElementById("customerPhone")?.value || "";
  const address = document.getElementById("customerAddress")?.value || "";
  const notes = document.getElementById("customerNotes")?.value || "";
  const payment = document.querySelector("input[name='paymentMethod']:checked")?.value || "Cash";

  const lines = ["Hello Greg's Cafe, I would like to order:"];

  getCartItems().forEach((item) => {
    const lineTotal = item.unitPrice * item.qty;
    lines.push(`${item.qty}x ${item.name} - ${formatCurrency(lineTotal)}`);
    (item.addons || []).forEach((addon) => {
      lines.push(`  + ${addon.name} (${formatCurrency(addon.price)})`);
    });
  });

  const totals = calculateTotals();

  lines.push(`Subtotal: ${formatCurrency(totals.subtotal)}`);
  lines.push(`Discount: -${formatCurrency(totals.discount)}`);
  lines.push(`GST (5%): ${formatCurrency(totals.gst)}`);
  lines.push(`Delivery Fee: ${totals.deliveryFee === 0 ? "Free" : formatCurrency(totals.deliveryFee)}`);
  lines.push(`Total: ${formatCurrency(totals.total)}`);
  lines.push(`Payment: ${payment}`);
  lines.push(`Name: ${name}`);
  lines.push(`Phone: ${phone}`);
  lines.push(`Address: ${address}`);
  if (notes) lines.push(`Notes: ${notes}`);

  return lines.join("\n");
}

function openWhatsAppOrder() {
  loadMenuData().then((data) => {
    if (!data) return;
    if (getCartItems().length === 0) return;
    const message = encodeURIComponent(buildWhatsAppMessage());
    const url = `https://wa.me/${data.whatsappNumber}?text=${message}`;
    window.open(url, "_blank");
  });
}

function setupNav() {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("siteNav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("open");
    });
    nav.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      if (nav.classList.contains("open")) {
        nav.classList.remove("open");
      }
    });
  }
}

function injectMobileViewCartBar() {
  if (!window.location.pathname.includes("menu.html")) return;
  if (document.getElementById("cartBar")) return;
  if (document.getElementById("mViewCart")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="m-viewcart" id="mViewCart" hidden>
      <a class="m-viewcart__link" id="mViewCartLink" href="menu.html" aria-label="View cart">
        <span class="m-viewcart__text">
          <span>Cart Total:</span>
          <strong class="m-viewcart__amount">${state.currency} <span id="mCartAmount">0</span></strong>
          <span class="m-viewcart__items"><span id="mCartItems">0</span> items</span>
        </span>
        <span class="btn btn-primary m-viewcart__cta">View Cart</span>
      </a>
    </div>
  `.trim();
  document.body.appendChild(wrapper.firstElementChild);

  const link = document.getElementById("mViewCartLink");
  if (link && window.location.pathname.endsWith("menu.html")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openCart();
    });
  }
}

function refreshMobileViewCartBar() {
  if (!window.location.pathname.includes("menu.html")) return;
  const bar = document.getElementById("mViewCart");
  if (!bar) return;

  let cart = {};
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      cart = normalizeCart(JSON.parse(saved));
    } catch {
      cart = {};
    }
  }

  let itemCount = 0;
  let amount = 0;

  Object.values(cart).forEach((item) => {
    const qty = Number(item?.qty ?? item?.quantity ?? 0) || 0;
    const price = Number(item?.unitPrice ?? item?.price ?? item?.unitPrice ?? 0) || 0;
    itemCount += qty;
    amount += qty * price;
  });

  const countEl = document.getElementById("mCartItems");
  const amountEl = document.getElementById("mCartAmount");
  if (countEl) {
    countEl.textContent = itemCount;
  }
  if (amountEl) {
    amountEl.textContent = amount;
  }

  if (itemCount > 0) {
    bar.hidden = false;
  } else {
    bar.hidden = true;
  }
}

// Explore floating button (index only)
function setupExploreFab() {
  const fab = document.getElementById("exploreFab");
  if (!fab) return;
  const toggle = fab.querySelector(".explore-toggle");
  const actions = fab.querySelector(".explore-actions");
  if (!toggle || !actions) return;

  const close = () => {
    fab.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    fab.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (fab.classList.contains("open")) {
      close();
      return;
    }
    open();
  });

  actions.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (link) {
      close();
    }
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    if (!fab.contains(event.target)) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });
}

function openCart() {
  const drawer = document.getElementById("cartDrawer");
  drawer?.classList.add("open");
  document.body.classList.add("cart-open");
  if (drawer) {
    drawer.setAttribute("tabindex", "-1");
    drawer.focus({ preventScroll: true });
  }
}

function closeCart() {
  document.getElementById("cartDrawer")?.classList.remove("open");
  document.body.classList.remove("cart-open");
}

function setupCartDrawer() {
  const cartToggle = document.getElementById("cartToggle");
  const cartClose = document.getElementById("cartClose");
  const cartBarOpen = document.getElementById("cartBarOpen");
  const clearBtn = document.getElementById("clearCartBtn");

  document.body.classList.remove("cart-open");

  if (cartToggle) {
    cartToggle.addEventListener("click", openCart);
  }
  if (cartBarOpen) {
    cartBarOpen.addEventListener("click", openCart);
  }
  if (cartClose) {
    cartClose.addEventListener("click", closeCart);
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", clearCart);
  }
}

function setupWhatsApp() {
  const button = document.getElementById("waOrderBtn");
  if (button) {
    button.addEventListener("click", openWhatsAppOrder);
  }
}

function setupDemoForm() {
  const demoButton = document.getElementById("demoForm");
  const note = document.getElementById("demoFormNote");
  if (demoButton && note) {
    demoButton.addEventListener("click", () => {
      note.textContent = "This is a demo form. No data is sent.";
    });
  }
}

function setupReservationForm() {
  const form = document.getElementById("reservationForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadMenuData().then((data) => {
      if (!data) return;
      const name = document.getElementById("reserveName")?.value || "";
      const phone = document.getElementById("reservePhone")?.value || "";
      const date = document.getElementById("reserveDate")?.value || "";
      const time = document.getElementById("reserveTime")?.value || "";
      const guests = document.getElementById("reserveGuests")?.value || "";
      const seating = document.getElementById("reserveSeating")?.value || "No preference";
      const notes = document.getElementById("reserveNotes")?.value || "";

      const lines = [
        "Hello Greg's Cafe, I'd like to reserve a table.",
        "Offer: 10% off for dine-in reservations made through the website.",
        `Name: ${name}`,
        `Phone: ${phone}`,
        `Date: ${date}`,
        `Time: ${time}`,
        `Guests: ${guests}`,
        `Preference: ${seating}`,
        `Notes: ${notes}`
      ];

      const message = encodeURIComponent(lines.join("\n"));
      const url = `https://wa.me/${data.whatsappNumber}?text=${message}`;
      window.open(url, "_blank");
    });
  });
}

restoreCart();
setupNav();
injectMobileViewCartBar();
refreshMobileViewCartBar();
window.addEventListener("DOMContentLoaded", refreshMobileViewCartBar);
window.addEventListener("focus", refreshMobileViewCartBar);
window.addEventListener("storage", refreshMobileViewCartBar);
setupExploreFab();
setupCartDrawer();
setupWhatsApp();
setupDemoForm();
setupReservationForm();
setupImageModal();
setupAddonModal();
window.addEventListener("pageshow", closeAddonModal);
renderMenu();
renderCart();
updateCartCount();
updateMenuButtonsFromCart();
