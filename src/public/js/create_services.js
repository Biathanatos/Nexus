/**
 * Initialise l'éditeur et la page de création de service.
 * Vue associée: ../views/pages/services/create.ejs
 * Route associée: ../routes/services.routes.js (GET /services/create/:is_ai)
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('create-service-form');

    const serviceName = document.getElementById('service_name');
    const serviceDescription = document.getElementById('service_description');
    const serviceTags = document.getElementById('service_tags');
    const serviceIsAI = document.getElementById('service_is_ai');

    const iframe = document.getElementById('detail-page-integration');
    const existingServices = JSON.parse(document.getElementById("existingServicesData").textContent);
    const refreshButton = document.getElementById('refresh-preview-button');

    // TODO: add ace completion to the web ide integration

    // Initialise l'éditeur ACE pour la saisie du script.
    ace.config.set("basePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.6/");
    var editor = ace.edit("editor");
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/javascript");
    const code = JSON.parse(document.getElementById("tpl").textContent);
    editor.setValue(code, -1);
    editor.setOptions({
        fontSize: "14px",
        showPrintMargin: false,
        wrap: true,
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true
    });
    editor.session.setUseWorker(true);

    /**
     * Recharge la prévisualisation de code dans l'iframe.
     * @param {MouseEvent} e
     * @returns {void}
     */
    refreshButton.addEventListener("click", (e) => {
        e.preventDefault();
        const ideCode = editor.getValue();

        iframe.onload = () => {
            const doc = iframe.contentDocument;

            doc.getElementById("current-user-script-in-ide")?.remove();

            const wrapper = doc.createElement("script");
            wrapper.id = "current-user-script-in-ide";
            wrapper.type = "module";

            const encoded = encodeURIComponent(ideCode);
            wrapper.textContent = `
                try {
                await import("data:text/javascript;charset=utf-8,${encoded}");
                globalThis.DOMContentLoadedHandler?.();
                } catch (e) {
                console.error("Erreur module injecté:", e);
                }
            `;

            doc.head.appendChild(wrapper);
       };

       iframe.src = iframe.src;
    });

    // Prévisualisation initiale.
    refreshButton.click();

    /**
     * Met à jour le nom de fichier et valide l'unicité du service.
     * @returns {void}
     */
    serviceName.addEventListener('input', function() {
        const ideFilenameDisplay = document.getElementById('ide-filename');
        ideFilenameDisplay.textContent = serviceName.value || 'untitled.js';
        if (existingServices.includes(serviceName.value)) {
            serviceName.setCustomValidity('A service with this name already exists.');
        } else {
            serviceName.setCustomValidity('');
        }
        serviceName.reportValidity();
    });

    // Initialize the filename display on page load
    serviceName.dispatchEvent(new Event('input'));

    /**
     * Soumet le formulaire de création avec le code de l'éditeur.
     * @param {SubmitEvent} e
     * @returns {void}
     */
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const codeContent = editor.getValue();
        
        if (!serviceName.value) {
            serviceName.reportValidity();
            return;
        } else if (existingServices.includes(serviceName.value)) {
            serviceName.reportValidity();
            return;
        }

        const data = {
            serviceName: serviceName.value,
            serviceDescription: serviceDescription.value,
            serviceTags: serviceTags.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
            serviceIsAI: serviceIsAI.checked,
            serviceScript: codeContent
        };

        fetch('/services/create', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        window.location.href = '/services';
    })
});