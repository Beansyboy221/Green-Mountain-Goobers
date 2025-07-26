const GMAIL_API = 'https://www.googleapis.com/gmail/v1/users/me';
const ALARM_NAME = 'gmailSorterAlarm';
const MEMORY_SIZE = 50; // Max number of past categorizations to remember

// Authenticate with Gmail API
async function authenticate() {
    console.log('DEBUG: Attempting to authenticate.');
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                const errorMessage = chrome.runtime.lastError?.message || 'Could not retrieve auth token.';
                console.error('DEBUG: Authentication failed.', errorMessage);
                reject(new Error(errorMessage));
                return;
            }
            console.log('DEBUG: Authentication successful.');
            resolve(token);
        });
    });
}

// Run setup when the extension is first installed or the browser starts
chrome.runtime.onInstalled.addListener(setupAlarm);
chrome.runtime.onStartup.addListener(setupAlarm);

function setupAlarm() {
    console.log('DEBUG: Running setupAlarm.');
    chrome.alarms.get(ALARM_NAME, (alarm) => {
        if (!alarm) {
            chrome.alarms.create(ALARM_NAME, {
                delayInMinutes: 1,
                periodInMinutes: 2
            });
            console.log('DEBUG: Gmail Sorter alarm created.');
        } else {
            console.log('DEBUG: Alarm already exists.', alarm);
        }
    });
}

// Listen for the alarm and trigger email processing
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('DEBUG: chrome.alarms.onAlarm listener triggered for alarm:', alarm.name);
    if (alarm.name === ALARM_NAME) {
        processNewEmails();
    }
});

// Main function to process new emails, called by the alarm
async function processNewEmails() {
    console.log('DEBUG: Alarm fired. Starting processNewEmails.');
    try {
        const result = await chrome.storage.sync.get(['masterToggleEnabled', 'categories']);
        
        if (result.masterToggleEnabled === false) {
            console.log('DEBUG: Master toggle is disabled. Skipping inbox check.');
            return 'Inbox checking is disabled.';
        }

        let categories = result.categories || [];

        const token = await authenticate();
        const emails = await fetchInboxMessages(token);
        if (!emails.length) {
            console.log('DEBUG: No new emails found.');
            return 'No new emails found.';
        }

        console.log(`DEBUG: Found ${emails.length} new email(s).`);
        for (const email of emails) {
            categories = await processSingleEmail(email, token, categories);
        }

        console.log(`DEBUG: Finished processing ${emails.length} email(s).`);
        return `Successfully processed ${emails.length} new email(s).`;
    } catch (error) {
        console.error('DEBUG: A critical error occurred in processNewEmails.', error.message, error.stack);
        throw error;
    }
}

// Fetches the list of messages from the inbox
async function fetchInboxMessages(token) {
    const fetchUrl = `${GMAIL_API}/messages?q=in:inbox`;
    console.log(`DEBUG: Fetching inbox emails with URL: ${fetchUrl}`);
    const response = await fetch(fetchUrl, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`DEBUG: Error fetching emails from Gmail API. Status: ${response.status}. Response: ${errorText}`);
        throw new Error(`Gmail API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.messages || [];
}

// Processes an individual email
async function processSingleEmail(email, token, categories) {
    console.log(`DEBUG: Processing email with ID: ${email.id}`);
    try {
        const emailDataUrl = `${GMAIL_API}/messages/${email.id}?format=minimal`;
        const emailDataResponse = await fetch(emailDataUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!emailDataResponse.ok) {
            console.error(`DEBUG: Failed to fetch email data for ID ${email.id}. Status: ${emailDataResponse.status}.`);
            return categories;
        }

        const emailData = await emailDataResponse.json();
        const emailContent = emailData.snippet;
        console.log(`DEBUG: Email snippet for ${email.id}: "${emailContent}"`);

        const { categoryName, updatedCategories } = await categorizeEmail(emailContent, categories);
        console.log(`DEBUG: Email ${email.id} classified as "${categoryName}" by Gemini.`);
        await applyLabel(token, email.id, categoryName);
        await updateCategorizationHistory(emailContent, categoryName);

        const categoryObject = updatedCategories.find(c => c.name === categoryName);
        if (categoryObject?.notify) {
            console.log(`DEBUG: Notification enabled for category "${categoryName}". Sending notification.`);
            sendNotification(categoryName, emailContent);
        }
        
        return updatedCategories;
    } catch (error) {
        console.error(`DEBUG: Error processing email ${email.id}.`, error.message, error.stack);
        return categories;
    }
}

// Stores the result of a categorization to build a memory for the agent
async function updateCategorizationHistory(snippet, category) {
    console.log('DEBUG: Updating categorization history.');
    try {
        const result = await chrome.storage.sync.get(['categorizationHistory']);
        const history = result.categorizationHistory || [];

        const newHistory = [{ snippet, category }, ...history.filter(item => item.snippet !== snippet)];
        const trimmedHistory = newHistory.slice(0, MEMORY_SIZE);

        await chrome.storage.sync.set({ categorizationHistory: trimmedHistory });
        console.log(`DEBUG: Categorization history updated. New size: ${trimmedHistory.length}`);
    } catch (error) {
        console.error('DEBUG: Could not update categorization history.', error.message, error.stack);
    }
}

// Classifies email content into a category using Gemini
async function categorizeEmail(emailContent, categories) {
    console.log('DEBUG: Starting categorizeEmail.');
    const settings = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel', 'autoCategoryToggle', 'autoCategoryLimit', 'categorizationHistory']);
    const {
        geminiApiKey,
        geminiModel = 'gemini-2.0-flash-lite',
        autoCategoryToggle = false,
        autoCategoryLimit = 5,
        categorizationHistory
    } = settings;

    if (!geminiApiKey) {
        throw new Error('Gemini API key not found. Please configure it in the extension popup.');
    }
    
    let currentCategories = [...categories];

    const promptTemplateUrl = chrome.runtime.getURL('prompt.txt');
    const promptResponse = await fetch(promptTemplateUrl);
    if (!promptResponse.ok) {
        throw new Error('Failed to fetch the prompt.txt file.');
    }
    let promptTemplate = await promptResponse.text();

    const categoryNames = currentCategories.map(c => c.name).join(', ');
    
    const formattedHistory = (categorizationHistory && categorizationHistory.length > 0)
        ? categorizationHistory.map(item => `Email: "${item.snippet}"\nCategory: ${item.category}`).join('\n\n')
        : "No history available. You will be the first to categorize an email.";

    const prompt = promptTemplate
        .replace('{{categoryNames}}', categoryNames)
        .replace('{{history}}', formattedHistory)
        .replace('{{emailContent}}', emailContent);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

    try {
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        const data = await response.json();
        console.log('DEBUG: Raw response from Gemini API:', JSON.stringify(data, null, 2));

        let categoryName = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!categoryName) {
            const errorDetail = data.error ? JSON.stringify(data.error) : 'No candidate or text part in response.';
            throw new Error(`Invalid response from Gemini API: ${errorDetail}`);
        }
        console.log(`DEBUG: Gemini API suggested category: "${categoryName}"`);

        const isExistingCategory = currentCategories.some(c => c.name === categoryName);
        const autoGeneratedCount = currentCategories.filter(c => c.auto_generated).length;
        const canAutoCreate = autoCategoryToggle && autoGeneratedCount < autoCategoryLimit;

        if (!isExistingCategory) {
            if (canAutoCreate) {
                console.log(`DEBUG: New category "${categoryName}" will be auto-created.`);
                const newCategory = { name: categoryName, notify: false, auto_generated: true };
                currentCategories.push(newCategory);
                await chrome.storage.sync.set({ categories: currentCategories });
            } else {
                console.log(`DEBUG: Auto-create for new category "${categoryName}" is disabled or limit is reached. Falling back to "Uncategorized".`);
                categoryName = "Uncategorized";
            }
        }

        console.log(`DEBUG: Auto-generated categories count: ${autoGeneratedCount}`);
        console.log(`DEBUG: Final category: "${categoryName}"`);
        return { categoryName, updatedCategories: currentCategories };

    } catch (error) {
        console.error('DEBUG: Error during fetch to Gemini API.', error.message, error.stack);
        throw error;
    }
}

// Finds an existing label by name or creates it if it doesn't exist
async function findOrCreateLabel(token, categoryName) {
    const labelsUrl = `${GMAIL_API}/labels`;
    const response = await fetch(labelsUrl, { headers: { Authorization: `Bearer ${token}` } });
    const labelsData = await response.json();

    if (!response.ok) {
        console.error('DEBUG: Failed to fetch labels.', labelsData);
        throw new Error('Failed to fetch Gmail labels.');
    }

    const existingLabel = labelsData.labels.find(label => label.name === categoryName);
    if (existingLabel) {
        console.log(`DEBUG: Found existing label "${categoryName}" with ID: ${existingLabel.id}`);
        return existingLabel.id;
    }

    console.log(`DEBUG: Label "${categoryName}" not found. Creating it.`);
    const createResponse = await fetch(`${GMAIL_API}/labels`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
    });
    const newLabel = await createResponse.json();

    if (createResponse.ok && newLabel.id) {
        console.log(`DEBUG: Label "${categoryName}" created successfully with ID: ${newLabel.id}`);
        return newLabel.id;
    }

    console.error(`DEBUG: Failed to create label "${categoryName}". Response:`, newLabel);
    throw new Error(`Failed to create label "${categoryName}".`);
}

// Applies a label to an email and removes it from the inbox
async function applyLabel(token, messageId, categoryName) {
    console.log(`DEBUG: Starting applyLabel for message ${messageId} with category "${categoryName}".`);
    try {
        const labelId = await findOrCreateLabel(token, categoryName);
        const modifyUrl = `${GMAIL_API}/messages/${messageId}/modify`;
        const modifyPayload = {
            addLabelIds: [labelId],
            removeLabelIds: ['INBOX']
        };

        console.log(`DEBUG: Modifying email ${messageId} at ${modifyUrl} with payload:`, JSON.stringify(modifyPayload));
        const modifyResponse = await fetch(modifyUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(modifyPayload),
        });

        if (modifyResponse.ok) {
            console.log(`DEBUG: Successfully moved email ${messageId} to label "${categoryName}".`);
        } else {
            const errorData = await modifyResponse.json();
            console.error(`DEBUG: Failed to modify email ${messageId}. Status: ${modifyResponse.status}. Response:`, errorData);
        }
    } catch (error) {
        console.error(`DEBUG: An error occurred in applyLabel for message ${messageId}.`, error.message, error.stack);
    }
}

// Sends a desktop notification
function sendNotification(category, emailSnippet) {
    const notificationId = `gmail-sorter-${category}-${Date.now()}`;
    console.log(`DEBUG: Creating notification with ID: ${notificationId}`);
    chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icon.png',
        title: `New Email in ${category}`,
        message: emailSnippet,
    });
}