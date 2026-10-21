const menuToggle = document.querySelector('.store-menu-toggle');
const menu = document.querySelector('.store-menu');

if (menuToggle && menu) {
  menuToggle.addEventListener('click', () => {
    const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isExpanded));
    menu.classList.toggle('is-open', !isExpanded);
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('is-open');
    });
  });
}

const filterButtons = document.querySelectorAll('[data-filter]');
const productCards = document.querySelectorAll('[data-product-grid] [data-category]');
const searchInput = document.querySelector('[data-search]');
const emptyMessage = document.querySelector('[data-empty]');
const MAX_ORDER_ITEMS = 50;
const MAX_ITEM_QUANTITY = 99;

function filterProducts() {
  const activeFilter = document.querySelector('[data-filter].is-active')?.dataset.filter || 'all';
  const searchTerm = searchInput?.value.trim().toLocaleLowerCase('es') || '';
  let visibleCount = 0;

  productCards.forEach((card) => {
    const matchesFilter = activeFilter === 'all' || card.dataset.category === activeFilter;
    const matchesSearch = card.dataset.searchText.toLocaleLowerCase('es').includes(searchTerm);
    const isVisible = matchesFilter && matchesSearch;

    card.hidden = !isVisible;
    if (isVisible) {
      visibleCount += 1;
    }
  });

  if (emptyMessage) {
    emptyMessage.hidden = visibleCount !== 0;
  }
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle('is-active', isActive);
      filterButton.setAttribute('aria-pressed', String(isActive));
    });
    filterProducts();
  });
});

document.querySelectorAll('[data-filter-link]').forEach((link) => {
  link.addEventListener('click', () => {
    const filterButton = document.querySelector(
      `[data-filter="${link.dataset.filterLink}"]`
    );
    filterButton?.click();
  });
});

searchInput?.addEventListener('input', filterProducts);

function updateCartCount() {
  let cart = [];
  try {
    const storedCart = JSON.parse(localStorage.getItem('crud-node-store-cart') || '[]');
    cart = Array.isArray(storedCart) ? storedCart : [];
  } catch {
    cart = [];
  }

  const count = cart.reduce((total, item) =>
    total + (item && Number.isSafeInteger(item.cantidad) ? item.cantidad : 0), 0);
  document.querySelectorAll('[data-cart-count]').forEach((element) => {
    element.textContent = String(count);
  });
}

document.querySelectorAll('[data-add-to-cart]').forEach((button) => {
  button.addEventListener('click', () => {
    let cart = [];
    try {
      const storedCart = JSON.parse(localStorage.getItem('crud-node-store-cart') || '[]');
      cart = Array.isArray(storedCart)
        ? storedCart.filter((item) =>
          item &&
          Number.isSafeInteger(item.id_producto) &&
          Number.isSafeInteger(item.cantidad) &&
          item.cantidad > 0 &&
          Number.isSafeInteger(item.stock) &&
          Number.isFinite(item.precio)
        )
        : [];
    } catch {
      cart = [];
    }

    const product = {
      id_producto: Number(button.dataset.productId),
      nombre: button.dataset.productName,
      precio: Number(button.dataset.productPrice),
      stock: Number(button.dataset.productStock)
    };
    const existing = cart.find((item) => item.id_producto === product.id_producto);

    if (existing) {
      if (existing.cantidad >= Math.min(product.stock, MAX_ITEM_QUANTITY)) {
        button.textContent = 'Stock máximo en carrito';
        return;
      }
      existing.nombre = product.nombre;
      existing.precio = product.precio;
      existing.stock = product.stock;
      existing.cantidad += 1;
    } else {
      if (cart.length >= MAX_ORDER_ITEMS) {
        button.textContent = 'Carrito completo';
        return;
      }
      cart.push({ ...product, cantidad: 1 });
    }

    localStorage.setItem('crud-node-store-cart', JSON.stringify(cart));
    updateCartCount();
    button.textContent = 'Agregado ✓';
    window.setTimeout(() => {
      if (button.isConnected && !button.disabled) {
        button.textContent = 'Agregar al carrito';
      }
    }, 1400);
  });
});

window.addEventListener('storage', updateCartCount);
const year = document.querySelector('[data-year]');
if (year) {
  year.textContent = String(new Date().getFullYear());
}

updateCartCount();
