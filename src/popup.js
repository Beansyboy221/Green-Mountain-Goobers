document.addEventListener('DOMContentLoaded', () => {
    const categoryList = document.getElementById('category-list');
    const newCategoryInput = document.getElementById('new-category');
    const addButton = document.getElementById('add-category');
    const geminiModelInput = document.getElementById('gemini-model');
    const apiKeyInput = document.getElementById('api-key');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const clientIdInput = document.getElementById('client-id');
    const saveClientIdButton = document.getElementById('save-client-id');
    const autoCategoryToggle = document.getElementById('auto-category-toggle');
    const autoCategoryLimit = document.getElementById('auto-category-limit');
    const masterToggle = document.getElementById('master-toggle');
    const projectIdInput = document.getElementById('project-id');
    const saveProjectIdButton = document.getElementById('save-project-id');
    const checkUsageButton = document.getElementById('check-usage');
    const accountTierSpan = document.getElementById('account-tier');
    const selectedModelNameSpan = document.getElementById('selected-model-name');
    const requestsPerMinuteSpan = document.getElementById('requests-per-minute');
    const requestsPerDaySpan = document.getElementById('requests-per-day');

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
        if (result.googleProjectId) {
            projectIdInput.value = result.googleProjectId;
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


    // Save Google Client ID
    saveClientIdButton.addEventListener('click', () => {
        const clientId = clientIdInput.value.trim();
        if (clientId && clientId.endsWith('.apps.googleusercontent.com')) {
            chrome.storage.sync.set({ googleClientId: clientId }, () => {
                alert('Google Client ID saved!');
            });
        } else {
            alert('Please enter a valid Google Client ID.');
        }
    });

    // Save Project ID
    saveProjectIdButton.addEventListener('click', () => {
        const projectId = projectIdInput.value.trim();
        if (projectId) {
            chrome.storage.sync.set({ googleProjectId: projectId }, () => {
                alert('Google Cloud Project ID saved!');
            });
        } else {
            alert('Please enter a valid Google Cloud Project ID.');
        }
    });

    // Check Usage by sending a message to the background script
    checkUsageButton.addEventListener('click', async () => {
        const { googleProjectId } = await chrome.storage.sync.get('googleProjectId');
        const selectedModel = geminiModelInput.value;

        if (!googleProjectId) {
            alert('Please save a Google Cloud Project ID first.');
            return;
        }

        selectedModelNameSpan.textContent = selectedModel;
        requestsPerMinuteSpan.textContent = "Checking...";
        requestsPerDaySpan.textContent = "Checking...";
        accountTierSpan.textContent = "Checking...";

        chrome.runtime.sendMessage({
            action: "checkUsage",
            details: {
                projectId: googleProjectId,
                model: selectedModel
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                alert(`Error: ${chrome.runtime.lastError.message}`);
                accountTierSpan.textContent = "Error";
                requestsPerMinuteSpan.textContent = "Error";
                requestsPerDaySpan.textContent = "Error";
                return;
            }

            if (response.error) {
                alert(`Error checking usage: ${response.error}`);
                accountTierSpan.textContent = "Error";
                requestsPerMinuteSpan.textContent = "Error";
                requestsPerDaySpan.textContent = "Error";
            } else {
                accountTierSpan.textContent = response.accountTier;

                if (response.rpmQuota) {
                    const remaining = parseInt(response.rpmQuota.limit) - parseInt(response.rpmQuota.usage);
                    requestsPerMinuteSpan.textContent = `${remaining} / ${response.rpmQuota.limit}`;
                } else {
                    requestsPerMinuteSpan.textContent = 'N/A';
                }

                if (response.rpdQuota) {
                    const remaining = parseInt(response.rpdQuota.limit) - parseInt(response.rpdQuota.usage);
                    requestsPerDaySpan.textContent = `${remaining} / ${response.rpdQuota.limit}`;
                } else {
                    requestsPerDaySpan.textContent = 'N/A';
                }
            }
        });
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