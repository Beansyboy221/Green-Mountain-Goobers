document.addEventListener('DOMContentLoaded', () => {
    const categoryList = document.getElementById('category-list');
    const newCategoryInput = document.getElementById('new-category');
    const addButton = document.getElementById('add-category');
    const geminiModelInput = document.getElementById('gemini-model');
    const apiKeyInput = document.getElementById('api-key');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const clientIdInput = document.getElementById('client-id');
    const saveClientIdButton = document.getElementById('save-client-id');

    // Load existing categories, API key, and Client ID
    chrome.storage.sync.get(['categories', 'geminiApiKey', 'geminiModel', 'googleClientId'], (result) => {
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
    function saveGeminiModel() {
        const model = geminiModelInput.value.trim();
        if (model) {
            chrome.storage.sync.set({ geminiModel: model }, () => {
                alert('Gemini model saved!');
            });
        } else {
            alert('Please enter a valid Gemini model.');
        }
    }

    // Save Google Client ID
    saveClientIdButton.addEventListener('click', () => {
        const clientId = clientIdInput.value.trim();
        if (clientId && clientId.endsWith('.apps.googleusercontent.com')) {
            chrome.storage.sync.set({ googleClientId: clientId }, () => {
                alert('Google Client ID saved!');
            });
        } else {
            alert('Please enter a valid Google Client ID (must end with .apps.googleusercontent.com).');
        }
    });

    // Add new category
    addButton.addEventListener('click', () => {
        const name = newCategoryInput.value.trim();
        if (name) {
            const category = { name, notify: false };
            addCategoryToUI(name, false);
            saveCategory(category);
            newCategoryInput.value = '';
        }
    });

    function addCategoryToUI(name, notify) {
        const div = document.createElement('div');
        div.className = 'category-item';
        div.innerHTML = `
            <span>${name}</span>
            <input type="checkbox" ${notify ? 'checked' : ''} data-name="${name}">
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
});