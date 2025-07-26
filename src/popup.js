document.addEventListener('DOMContentLoaded', () => {
    const categoryList = document.getElementById('category-list');
    const newCategoryInput = document.getElementById('new-category');
    const addButton = document.getElementById('add-category');
    const geminiModelInput = document.getElementById('gemini-model');
    const apiKeyInput = document.getElementById('api-key');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const clientIdInput = document.getElementById('client-id');
    const autoCategoryToggle = document.getElementById('auto-category-toggle');
    const autoCategoryLimit = document.getElementById('auto-category-limit');
    const masterToggle = document.getElementById('master-toggle');

    // Load all existing settings from storage
    chrome.storage.sync.get(['categories', 'geminiApiKey', 'geminiModel', 'googleClientId', 'autoCategoryToggle', 'autoCategoryLimit', 'masterToggleEnabled', 'googleProjectId'], (result) => {
        const categories = result.categories || [];
        categories.forEach(category => addCategoryToUI(category.name, category.notify));

        if (result.geminiModel) {
            geminiModelInput.value = result.geminiModel;
        }
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
        if (result.googleClientId) {
            clientIdInput.value = result.googleClientId;
        }
        if (result.autoCategoryToggle) {
            autoCategoryToggle.checked = result.autoCategoryToggle;
        }
        if (result.autoCategoryLimit) {
            autoCategoryLimit.value = result.autoCategoryLimit;
        }
        masterToggle.checked = result.masterToggleEnabled !== false;
    });

    // Save Master Toggle state
    masterToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ masterToggleEnabled: masterToggle.checked });
    });

    // Save Gemini API key
    saveApiKeyButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
                alert('Gemini API key saved!');
            });
        } else {
            alert('Please enter a valid Gemini API key.');
        }
    });

    // Save Gemini model
    geminiModelInput.addEventListener('change', () => {
        const model = geminiModelInput.value.trim();
        if (model) {
            chrome.storage.sync.set({ geminiModel: model }, () => {
                alert('Gemini model saved!');
            });
        }
    });

    // Add new category
    addButton.addEventListener('click', () => {
        const name = newCategoryInput.value.trim();
        if (name) {
            const category = { name, notify: false, auto_generated: false };
            addCategoryToUI(name, false);
            saveCategory(category);
            newCategoryInput.value = '';
        }
    });
    
    // Setup event listeners for auto-category settings
    autoCategoryToggle.addEventListener('change', saveAutoCategorySettings);
    autoCategoryLimit.addEventListener('change', saveAutoCategorySettings);

    function addCategoryToUI(name, notify) {
        const div = document.createElement('div');
        div.className = 'category-item';
        div.innerHTML = `
            <span>${name}</span>
            <input type="checkbox" ${notify ? 'checked' : ''} data-name="${name}">
            <button class="delete-category">Delete</button>
        `;
        categoryList.appendChild(div);
        div.querySelector('input').addEventListener('change', (e) => {
            updateCategoryNotify(name, e.target.checked);
        });
    }

    function saveCategory(category) {
        chrome.storage.sync.get(['categories'], (result) => {
            const categories = result.categories || [];
            categories.push(category);
            chrome.storage.sync.set({ categories });
        });
    }

    function updateCategoryNotify(name, notify) {
        chrome.storage.sync.get(['categories'], (result) => {
            const categories = result.categories || [];
            const category = categories.find(c => c.name === name);
            if (category) {
                category.notify = notify;
                chrome.storage.sync.set({ categories });
            }
        });
    }

    // Delete category
    categoryList.addEventListener('click', (element) => {
        if (element.target.classList.contains('delete-category')) {
            const categoryItem = element.target.parentElement;
            const name = categoryItem.querySelector('span').textContent;
            categoryItem.remove();
            chrome.storage.sync.get(['categories'], (result) => {
                let categories = result.categories || [];
                categories = categories.filter(c => c.name !== name);
                chrome.storage.sync.set({ categories: categories });
            });
        }
    });

    // Save automatic category generation settings
    function saveAutoCategorySettings() {
        const isEnabled = document.getElementById('auto-category-toggle').checked;
        const limit = document.getElementById('auto-category-limit').value;
        chrome.storage.sync.set({
            autoCategoryToggle: isEnabled,
            autoCategoryLimit: parseInt(limit, 10) || 0
        }, () => {
            alert('Auto-category settings saved!');
        });
    }
});