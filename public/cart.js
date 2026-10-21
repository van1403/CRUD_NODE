const CART_KEY = 'crud-node-store-cart';
const MAX_ITEM_QUANTITY = 99;
let editingProductId = null;

function readCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(cart)
      ? cart.filter((item) =>
        item &&
        Number.isSafeInteger(item.id_producto) &&
        item.id_producto > 0 &&
        Number.isSafeInteger(item.cantidad) &&
        item.cantidad > 0 &&
        Number.isSafeInteger(item.stock) &&
        item.stock >= 0 &&
        Number.isFinite(item.precio) &&
        typeof item.nombre === 'string'
      )
      : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('store-cart-updated'));
}

function formatPrice(price) {
  return `S/ ${Number(price).toFixed(2)}`;
}

function updateCartCount() {
  const totalItems = readCart().reduce((sum, item) => sum + item.cantidad, 0);
  document.querySelectorAll('[data-cart-count]').forEach((count) => {
    count.textContent = String(totalItems);
  });
}

function renderCart() {
  const container = document.querySelector('[data-cart-items]');
  if (!container) {
    updateCartCount();
    return;
  }

  const cart = readCart();
  container.replaceChildren();
  const emptyMessage = document.querySelector('[data-cart-empty]');
  const totalElement = document.querySelector('[data-cart-total]');
  const checkoutButton = document.querySelector('[data-checkout-button]');
  const totalItems = cart.reduce((sum, item) => sum + item.cantidad, 0);
  const total = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

  if (emptyMessage) {
    emptyMessage.hidden = cart.length !== 0;
  }
  if (totalElement) {
    totalElement.textContent = formatPrice(total);
  }
  if (checkoutButton) {
    checkoutButton.disabled = cart.length === 0;
  }

  cart.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'cart-item';

    const details = document.createElement('div');
    details.className = 'cart-item-details';
    const name = document.createElement('h3');
    name.textContent = item.nombre;
    const price = document.createElement('span');
    price.textContent = `${formatPrice(item.precio)} c/u`;
    const subtotal = document.createElement('span');
    subtotal.textContent = `Subtotal: ${formatPrice(item.precio * item.cantidad)}`;
    details.append(name, price, subtotal);

    const controls = document.createElement('div');
    controls.className = 'cart-item-controls';
    const maxQuantity = Math.min(item.stock, MAX_ITEM_QUANTITY);
    if (editingProductId === item.id_producto) {
      const quantityInput = document.createElement('input');
      quantityInput.className = 'cart-quantity-input';
      quantityInput.type = 'number';
      quantityInput.min = '1';
      quantityInput.max = String(maxQuantity);
      quantityInput.step = '1';
      quantityInput.required = true;
      quantityInput.value = String(item.cantidad);
      quantityInput.disabled = maxQuantity < 1;
      quantityInput.setAttribute('aria-label', `Cantidad de ${item.nombre}`);

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'cart-action-button cart-save-button';
      saveButton.textContent = 'Guardar';
      saveButton.addEventListener('click', () => {
        if (!quantityInput.reportValidity()) {
          return;
        }
        const updatedQuantity = Number(quantityInput.value);
        if (!Number.isSafeInteger(updatedQuantity)) {
          quantityInput.focus();
          return;
        }
        editingProductId = null;
        setQuantity(item.id_producto, updatedQuantity);
      });

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'cart-action-button cart-cancel-button';
      cancelButton.textContent = 'Cancelar';
      cancelButton.addEventListener('click', () => {
        editingProductId = null;
        renderCart();
      });

      quantityInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveButton.click();
        } else if (event.key === 'Escape') {
          cancelButton.click();
        }
      });

      controls.append(quantityInput, saveButton, cancelButton);
      queueMicrotask(() => quantityInput.focus());
    } else {
      const minusButton = document.createElement('button');
      minusButton.type = 'button';
      minusButton.className = 'cart-quantity-button';
      minusButton.textContent = '−';
      minusButton.setAttribute('aria-label', `Reducir cantidad de ${item.nombre}`);
      minusButton.disabled = item.cantidad <= 1;
      minusButton.addEventListener('click', () => changeQuantity(item.id_producto, -1));

      const quantity = document.createElement('span');
      quantity.className = 'cart-quantity';
      quantity.textContent = String(item.cantidad);

      const plusButton = document.createElement('button');
      plusButton.type = 'button';
      plusButton.className = 'cart-quantity-button';
      plusButton.textContent = '+';
      plusButton.setAttribute('aria-label', `Aumentar cantidad de ${item.nombre}`);
      plusButton.disabled = item.cantidad >= maxQuantity;
      plusButton.addEventListener('click', () => changeQuantity(item.id_producto, 1));

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'cart-action-button cart-edit-button';
      editButton.textContent = 'Editar';
      editButton.setAttribute('aria-label', `Editar cantidad de ${item.nombre}`);
      editButton.addEventListener('click', () => {
        editingProductId = item.id_producto;
        renderCart();
      });

      controls.append(minusButton, quantity, plusButton, editButton);
    }

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'cart-remove-button';
    removeButton.textContent = 'Quitar';
    removeButton.addEventListener('click', () => {
      editingProductId = null;
      removeFromCart(item.id_producto);
    });

    controls.append(removeButton);
    row.append(details, controls);
    container.append(row);
  });

  updateCartCount();
}

function changeQuantity(productId, change) {
  const cart = readCart();
  const item = cart.find((entry) => entry.id_producto === productId);
  if (!item) {
    return;
  }

  setQuantity(productId, item.cantidad + change);
}

function setQuantity(productId, quantity) {
  const cart = readCart();
  const item = cart.find((entry) => entry.id_producto === productId);
  if (!item) {
    return;
  }
  if (quantity < 1 || quantity > Math.min(item.stock, MAX_ITEM_QUANTITY)) {
    renderCart();
    return;
  }
  item.cantidad = quantity;
  editingProductId = null;
  writeCart(cart);
  renderCart();
}

function removeFromCart(productId) {
  writeCart(readCart().filter((item) => item.id_producto !== productId));
  renderCart();
}

document.querySelectorAll('[data-add-to-cart]').forEach((button) => {
  button.addEventListener('click', () => {
    const product = {
      id_producto: Number(button.dataset.productId),
      nombre: button.dataset.productName,
      precio: Number(button.dataset.productPrice),
      stock: Number(button.dataset.productStock)
    };
    const cart = readCart();
    const existing = cart.find((item) => item.id_producto === product.id_producto);

    if (existing) {
      existing.stock = product.stock;
      existing.precio = product.precio;
      existing.nombre = product.nombre;
      if (existing.cantidad >= product.stock) {
        button.textContent = 'Stock máximo en carrito';
        return;
      }
      existing.cantidad += 1;
    } else {
      cart.push({ ...product, cantidad: 1 });
    }

    writeCart(cart);
    button.textContent = 'Agregado ✓';
    window.setTimeout(() => {
      if (button.isConnected && !button.disabled) {
        button.textContent = 'Agregar al carrito';
      }
    }, 1400);
  });
});

const checkoutForm = document.querySelector('[data-checkout-form]');
if (checkoutForm) {
  checkoutForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.querySelector('[data-checkout-message]');
    const button = document.querySelector('[data-checkout-button]');
    const cart = readCart();
    if (cart.length === 0) {
      return;
    }

    button.disabled = true;
    message.className = 'form-message';
    message.textContent = 'Registrando pedido y verificando existencias…';

    try {
      const formData = new FormData(checkoutForm);
      const response = await fetch('/api/store/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.get('nombre'),
          telefono: formData.get('telefono'),
          correo: formData.get('correo'),
          productos: cart.map((item) => ({
            id_producto: item.id_producto,
            cantidad: item.cantidad
          }))
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo registrar el pedido.');
      }

      localStorage.removeItem(CART_KEY);
      renderCart();
      checkoutForm.reset();
      message.className = 'form-message form-message-success';
      message.textContent =
        `Pedido #${result.id_pedido} registrado por ${formatPrice(result.total)}. ` +
        'Quedó pendiente de confirmación. La tienda se comunicará contigo para coordinar el pago y la entrega.';
    } catch (error) {
      message.className = 'form-message form-message-error';
      message.textContent = error.message;
      button.disabled = false;
    }
  });
}

window.addEventListener('storage', renderCart);
window.addEventListener('store-cart-updated', renderCart);
document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

renderCart();
