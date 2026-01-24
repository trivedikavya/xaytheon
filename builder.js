/**
 * Workflow Builder Logic
 */
const elements = {
    canvas: document.getElementById('workflow-canvas'),
    placeholder: document.getElementById('canvas-placeholder'),
    yamlPreview: document.querySelector('#yaml-preview code'),
    workflowName: document.getElementById('workflow-name'),
    triggerSelect: document.getElementById('trigger-select'),
    validationPill: document.getElementById('validation-pill'),
    exportBtn: document.getElementById('export-yaml-btn'),
    copyBtn: document.getElementById('copy-yaml'),
    
    // Modals
    editModal: document.getElementById('edit-modal'),
    editName: document.getElementById('edit-step-name'),
    editUses: document.getElementById('edit-step-uses'),
    editRun: document.getElementById('edit-step-run'),
    saveEditBtn: document.getElementById('save-edit'),
    cancelEditBtn: document.getElementById('cancel-edit'),
};

    let workflowSteps = [];
    let editingStepId = null;
    let draggedStepId = null;

    /* -------------------- Utilities -------------------- */
    function generateStepId() {
        return 'step-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function getStepDataFromElement(el) {
        return {
            name: el.getAttribute('data-name'),
            type: el.getAttribute('data-type'),
            uses: el.getAttribute('data-uses') || null,
            run: el.getAttribute('data-run') || null,
        };
    }

    /* -------------------- Library Drag -------------------- */

    function initializeDraggableSteps() {
        document.querySelectorAll('.draggable-step').forEach(step => {
            // Accessibility
            step.setAttribute('tabindex', '0');
            step.setAttribute('role', 'button');
            step.setAttribute('aria-label', `Add step: ${step.getAttribute('data-name')}`);

            // Drag
            step.addEventListener('dragstart', e => {
                const data = getStepDataFromElement(step);
                e.dataTransfer.setData('application/json', JSON.stringify(data));
            });

            // Keyboard activation
            step.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    addStep(getStepDataFromElement(step));
                }
            });
        });
    }

    /* -------------------- Canvas Drag -------------------- */

    function setupCanvasDropZone() 
    {
    elements.canvas.addEventListener('dragover', e => {
        e.preventDefault();
        elements.canvas.classList.add('drag-over');
    });

    elements.canvas.addEventListener('dragleave', () => {
        elements.canvas.classList.remove('drag-over');
    });

    elements.canvas.addEventListener('drop', e => {
        e.preventDefault();
        elements.canvas.classList.remove('drag-over');

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            addStep(data);
        } catch (err) 
        {
            console.error('Invalid drop data', err);
        }
    });

        // Accessibility - make canvas focusable
        elements.canvas.setAttribute('tabindex', '-1');
    }

    /* -------------------- Workflow Management -------------------- */

    function addStep(stepData) {
        const step = {
            id: generateStepId(),
            ...stepData,
        };
        workflowSteps.push(step);
        renderSteps();
        updatePreviewAndValidation();
    }

    function removeStep(stepId) {
        workflowSteps = workflowSteps.filter(s => s.id !== stepId);
        renderSteps();
        updatePreviewAndValidation();
    }

    function updateStep(stepId, updates) {
        const step = workflowSteps.find(s => s.id === stepId);
        if (step) {
            Object.assign(step, updates);
            renderSteps();
            updatePreviewAndValidation();
        }
    }

    function renderSteps() {
        // Clear previous step blocks
        elements.canvas.querySelectorAll('.step-block').forEach(el => el.remove());

        if (workflowSteps.length === 0) {
            elements.placeholder.style.display = 'flex';
            return;
        }

        elements.placeholder.style.display = 'none';

        workflowSteps.forEach(step => {
            const block = document.createElement('div');
            block.className = 'step-block';
            block.dataset.stepId = step.id;

            block.innerHTML = `
                <div class="step-info">
                    <h5>${step.name}</h5>
                    <p class="step-detail">${step.uses ? step.uses : step.run}</p>
                </div>
                <div class="step-actions">
                    <button type="button" class="icon-btn edit" aria-label="Edit step">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button type="button" class="icon-btn delete" aria-label="Delete step">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            `;

            elements.canvas.appendChild(block);
        });
    }

    /* -------------------- Edit Modals -------------------- */
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    function trapModalFocus(e) {
        const focusable = elements.editModal.querySelectorAll(focusableSelector);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        if (e.key === 'Escape') {
            closeEditModal();
        }
    }

    function openEditModal(stepId) {
        editingStepId = stepId;
        const step = workflowSteps.find(s => s.id === stepId);
        if (!step) return;

        elements.editName.value = step.name;
        const usesField = document.getElementById('uses-field');
        const runField = document.getElementById('run-field');

        if (step.uses) {
            usesField.style.display = 'block';
            runField.style.display = 'none';
            elements.editUses.value = step.uses;
        } else {
            usesField.style.display = 'none';
            runField.style.display = 'block';
            elements.editRun.value = step.run || '';
        }

        previousFocusedElement = document.activeElement;
        elements.editModal.classList.remove('hidden');
        elements.editName.focus();
        elements.editModal.addEventListener('keydown', trapModalFocus);
    }
    function closeEditModal() {
        elements.editModal.classList.add('hidden');
        elements.editModal.removeEventListener('keydown', trapModalFocus);
        if (previousFocusedElement && document.body.contains(previousFocusedElement)) {
            previousFocusedElement.focus();
        }
        previousFocusedElement = null;
        editingStepId = null;
    }

    /* -------------------- YAML Preview -------------------- */

    async function updateYamlPreview() {
        const workflowData = {
            name: workflowNameInput.value,
            on: triggerSelect.value,
            jobs: {
                build: {
                    runsOn: 'ubuntu-latest',
                    steps: workflowSteps.map(({ name, uses, run }) =>
                        uses ? { name, uses } : { name, run }
                    )
                }
            }
        };

        try {
            const res = await fetch('/api/workflow/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflowData })
            });

            const data = await res.json();
            yamlPreview.textContent = data.yaml;

            if (data.validation === 'Workflow is valid.') {
                validationPill.className = 'pill valid';
                validationPill.textContent = 'Valid';
                validationPill.title = '';
            } else {
                validationPill.className = 'pill error';
                validationPill.textContent = 'Warning';
                validationPill.title = data.validation;
            }
        } catch (err) {
            console.error('Preview error:', err);
        }
    }

    /* -------------------- Modal Logic -------------------- */

    window.builder = {
        remove: removeStep,
        openEdit: (id) => {
            editingStepId = id;
            const step = workflowSteps.find(s => s.id === id);
            if (!step) return;

            document.getElementById('edit-step-name').value = step.name;

            const usesField = document.getElementById('uses-field');
            const runField = document.getElementById('run-field');

            if (step.uses) {
                usesField.style.display = 'block';
                runField.style.display = 'none';
                document.getElementById('edit-step-uses').value = step.uses;
            } else {
                usesField.style.display = 'none';
                runField.style.display = 'block';
                document.getElementById('edit-step-run').value = step.run;
            }

            editModal.classList.remove('hidden');
        }
    };

    saveEditBtn.addEventListener('click', () => {
        const idx = workflowSteps.findIndex(s => s.id === editingStepId);
        if (idx === -1) return;

        workflowSteps[idx].name = document.getElementById('edit-step-name').value;

        if (workflowSteps[idx].uses) {
            workflowSteps[idx].uses = document.getElementById('edit-step-uses').value;
        } else {
            workflowSteps[idx].run = document.getElementById('edit-step-run').value;
        }

        editModal.classList.add('hidden');
        renderCanvas();
        debouncedYamlUpdate();
    });

    cancelEditBtn.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

    /* -------------------- Actions -------------------- */

    exportBtn.addEventListener('click', () => {
        const blob = new Blob([yamlPreview.textContent], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = workflowNameInput.value || 'main.yml';
        a.click();
        URL.revokeObjectURL(url);
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(yamlPreview.textContent);
        copyBtn.innerHTML = '<i class="ri-check-line"></i>';
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="ri-file-copy-line"></i>';
        }, 2000);
    });

    workflowNameInput.addEventListener('change', debouncedYamlUpdate);
    triggerSelect.addEventListener('change', debouncedYamlUpdate);