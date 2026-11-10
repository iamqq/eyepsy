document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.querySelector('input[type="file"][name="image"]');
  const preview = document.getElementById("certificate-preview");

  if (fileInput && preview) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) {
        preview.hidden = true;
        preview.removeAttribute("src");
        return;
      }

      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.hidden = false;
      preview.onload = () => URL.revokeObjectURL(url);
    });
  }

  const textarea = document.querySelector('textarea[name="json"]');
  const formatButton = document.getElementById("format-json");
  const status = document.getElementById("json-status");

  function setStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message;
    status.className = isError ? "status status-error" : "status status-ok";
  }

  if (formatButton && textarea) {
    formatButton.addEventListener("click", () => {
      try {
        const parsed = JSON.parse(textarea.value);
        textarea.value = `${JSON.stringify(parsed, null, 2)}\n`;
        setStatus("JSON отформатирован.");
      } catch (error) {
        setStatus(`Ошибка JSON: ${error.message}`, true);
      }
    });
  }

  if (textarea) {
    textarea.addEventListener("input", () => {
      if (status) {
        status.textContent = "";
        status.className = "status";
      }
    });
  }

  for (const form of document.querySelectorAll("form[data-save-form]")) {
    form.addEventListener("submit", () => {
      const button = form.querySelector('button[type="submit"]');
      if (!button) return;
      button.dataset.originalText = button.textContent;
      button.textContent = "Сохранение…";
      button.disabled = true;
    });
  }

  window.addEventListener("pageshow", () => {
    for (const button of document.querySelectorAll("button[data-original-text]")) {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
      delete button.dataset.originalText;
    }
  });
});
