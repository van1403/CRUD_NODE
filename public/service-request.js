const serviceForm = document.querySelector('[data-service-form]');

if (serviceForm) {
  serviceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.querySelector('[data-service-message]');
    const button = document.querySelector('[data-service-button]');
    const formData = new FormData(serviceForm);

    button.disabled = true;
    message.className = 'form-message';
    message.textContent = 'Enviando solicitud…';

    try {
      const response = await fetch('/api/store/servicio-tecnico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo enviar la solicitud.');
      }

      serviceForm.reset();
      message.className = 'form-message form-message-success';
      message.textContent =
        `Recibimos tu solicitud #${result.id_solicitud}. Nos pondremos en contacto contigo para coordinar el diagnóstico.`;
    } catch (error) {
      message.className = 'form-message form-message-error';
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
