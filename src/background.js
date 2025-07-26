const GMAIL_API = 'https://www.googleapis.com/gmail/v1/users/me';
const ALARM_NAME = 'gmailSorterAlarm';
const HISTORY_BYTE_LIMIT = 8000; // chrome.storage.sync.QUOTA_BYTES_PER_ITEM is 8,192
const API_BATCH_SIZE = 20; // Process 20 requests at a time
const API_BATCH_DELAY = 1000; // 1-second delay between batches

// --- State Lock ---
let isProcessingEmails = false;

// --- Main Event Listeners ---

// Listen for a request from the popup to reset to inbox
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'resetToInbox') {
        console.log('DEBUG: Received request to reset all categories to inbox.');
        resetToInbox()
            .then(responseMessage => sendResponse({ success: true, message: responseMessage }))
            .catch(error => {
                console.error('DEBUG: Error during reset to inbox.', error.message, error.stack);
                sendResponse({ success: false, message: error.message });
            });
        return true; // Indicates that the response is sent asynchronously
    }
});

// Run setup when the extension is first installed or the browser starts
chrome.runtime.onInstalled.addListener(setupAlarm);
chrome.runtime.onStartup.addListener(setupAlarm);

// Listen for the alarm and trigger email processing
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('DEBUG: chrome.alarms.onAlarm listener triggered for alarm:', alarm.name);
    if (alarm.name === ALARM_NAME) {
        processNewEmails();
    }
});

// --- Core Logic Functions ---

// Moves all emails from managed labels back to the inbox, then deletes the labels
// and clears all categories from local storage.
async function resetToInbox() {
    // LOCK CHECK: Prevent reset if processing is in progress.
    if (isProcessingEmails) {
        throw new Error('Cannot reset while email processing is in progress. Please try again in a moment.');
    }
    
    console.log('DEBUG: Starting resetToInbox function.');
    const token = await authenticate();
    const { categories } = await chrome.storage.sync.get(['categories']);

    if (!categories || categories.length === 0) {
        return 'No configured categories found to reset.';
    }

    const categoryNames = new Set(categories.map(c => c.name));
    const allGmailLabels = await _fetchAllGmailLabels(token);
    const labelsToProcess = allGmailLabels.filter(label => categoryNames.has(label.name));

    if (labelsToProcess.length === 0) {
        console.log('DEBUG: No matching Gmail labels found. Clearing local categories.');
        await chrome.storage.sync.set({ categories: [], categorizationHistory: [] });
        return 'No matching labels found in Gmail, but local categories were cleared.';
    }

    console.log(`DEBUG: Found ${labelsToProcess.length} labels to process.`);
    let totalMessagesMoved = 0;
    let totalLabelsDeleted = 0;

    for (const label of labelsToProcess) {
        console.log(`DEBUG: Processing label "${label.name}" (ID: ${label.id})`);
        const messages = await _fetchAllMessagesForLabel(token, label.id);

        if (messages.length > 0) {
            const movedCount = await _moveMessagesToInbox(token, messages, label.id);
            totalMessagesMoved += movedCount;
        }

        const deleted = await _deleteGmailLabel(token, label);
        if (deleted) totalLabelsDeleted++;
    }

    console.log('DEBUG: All labels processed. Clearing categories and history from storage.');
    await chrome.storage.sync.set({ categories: [], categorizationHistory: [] });

    return `${totalMessagesMoved} email(s) moved to inbox. ${totalLabelsDeleted} labels deleted. All local categories cleared.`;
}

// Main function to process new emails, called by the alarm.
async function processNewEmails() {
    // LOCK CHECK: Prevent concurrent processing runs.
    if (isProcessingEmails) {
        console.log('DEBUG: Email processing is already in progress. Skipping this run.');
        return 'Processing already in progress.';
    }

    console.log('DEBUG: Alarm fired. Starting processNewEmails.');
    
    // ACQUIRE LOCK
    isProcessingEmails = true;

    try {
        const { masterToggleEnabled, categories } = await chrome.storage.sync.get(['masterToggleEnabled', 'categories']);
        
        if (masterToggleEnabled === false) {
            console.log('DEBUG: Master toggle is disabled. Skipping inbox check.');
            return 'Inbox checking is disabled.';
        }

        const token = await authenticate();
        const emailMetas = await fetchInboxMessages(token);

        if (!emailMetas.length) {
            console.log('DEBUG: No new emails found.');
            return 'No new emails found.';
        }

        console.log(`DEBUG: Found ${emailMetas.length} new email(s).`);
        const emailDetails = await _fetchEmailDetails(token, emailMetas);
        
        if (emailDetails.length === 0) {
            console.log('DEBUG: Could not fetch content for any of the new emails.');
            return 'Could not fetch email content.';
        }

        console.log(`DEBUG: Fetched content for ${emailDetails.length} email(s). Starting batch categorization.`);
        const { categorizedResults, updatedCategories } = await categorizeEmailBatch(emailDetails, categories || []);

        for (const result of categorizedResults) {
            await applyLabel(token, result.id, result.category);
            
            const categoryObject = updatedCategories.find(c => c.name === result.category);
            if (categoryObject?.notify) {
                sendNotification(result.category, result.snippet);
            }
        }
        
        // Overwrite the old history with the results from this batch.
        await saveBatchToHistory(categorizedResults);

        console.log(`DEBUG: Finished processing ${categorizedResults.length} email(s).`);
        return `Successfully processed ${categorizedResults.length} new email(s).`;

    } catch (error) {
        console.error('DEBUG: A critical error occurred in processNewEmails.', error.message, error.stack);
        throw error;
    } finally {
        // RELEASE LOCK: Ensure the lock is always released.
        console.log('DEBUG: Releasing email processing lock.');
        isProcessingEmails = false;
    }
}

// Fetches the list of messages from the inbox.
async function fetchInboxMessages(token) {
    const response = await fetch(`${GMAIL_API}/messages?q=in:inbox`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        console.error(`DEBUG: Error fetching emails. Status: ${response.status}.`);
        throw new Error(`Gmail API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.messages || [];
}

// Categorizes a batch of emails using the Gemini API.
async function categorizeEmailBatch(emailDetails, categories) {
    console.log('DEBUG: Starting categorizeEmailBatch.');
    const settings = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel', 'autoCategoryToggle', 'autoCategoryLimit', 'categorizationHistory']);

    const prompt = await _buildCategorizationPrompt(emailDetails, categories, settings);
    const responseText = await _fetchGeminiCategorization(prompt, settings);
    const categorizationResults = _parseGeminiResponse(responseText);
    
    if (!Array.isArray(categorizationResults)) {
        throw new Error('Categorization result from AI is not a JSON array.');
    }

    const { updatedCategories, finalResults } = await _handleNewCategories(categorizationResults, categories, settings);
    
    const finalCategorizedResults = finalResults.map(result => ({
        ...result,
        snippet: emailDetails.find(e => e.id === result.id)?.snippet || ''
    }));

    console.log(`DEBUG: Final categorization decisions:`, finalCategorizedResults);
    return { categorizedResults: finalCategorizedResults, updatedCategories };
}


// --- Helper Functions ---

// General purpose delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Authenticates with Google and retrieves an OAuth token.
async function authenticate() {
    console.log('DEBUG: Attempting to authenticate.');
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                const errorMsg = chrome.runtime.lastError?.message || 'Could not retrieve auth token.';
                console.error('DEBUG: Authentication failed.', errorMsg);
                reject(new Error(errorMsg));
            } else {
                console.log('DEBUG: Authentication successful.');
                resolve(token);
            }
        });
    });
}

// Creates a recurring alarm if one does not already exist.
function setupAlarm() {
    console.log('DEBUG: Running setupAlarm.');
    chrome.alarms.get(ALARM_NAME, (alarm) => {
        if (!alarm) {
            chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 1 });
            console.log('DEBUG: Gmail Sorter alarm created.');
        } else {
            console.log('DEBUG: Alarm already exists.');
        }
    });
}

// Fetches all labels from the user's Gmail account.
async function _fetchAllGmailLabels(token) {
    const response = await fetch(`${GMAIL_API}/labels`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Failed to fetch Gmail labels.');
    const data = await response.json();
    return data.labels || [];
}

// Fetches all message IDs for a given label, handling pagination and rate-limiting.
async function _fetchAllMessagesForLabel(token, labelId) {
    let messages = [];
    let nextPageToken = null;
    console.log(`DEBUG: Fetching all messages for label ID ${labelId}.`);
    do {
        const url = `${GMAIL_API}/messages?labelIds=${labelId}&maxResults=100` + (nextPageToken ? `&pageToken=${nextPageToken}` : '');
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) {
            console.error(`DEBUG: Failed to fetch messages page for label ID ${labelId}.`);
            break;
        }
        const data = await response.json();
        if (data.messages) {
            messages.push(...data.messages);
        }
        nextPageToken = data.nextPageToken;

        // Add a small delay between page fetches to avoid hitting rate limits.
        if (nextPageToken) {
            await delay(300); 
        }
    } while (nextPageToken);
    console.log(`DEBUG: Found ${messages.length} total messages for label ID ${labelId}.`);
    return messages;
}

// Moves a batch of messages to the Inbox by processing them in throttled chunks.
async function _moveMessagesToInbox(token, messages, labelIdToRemove) {
    console.log(`DEBUG: Moving ${messages.length} messages to inbox.`);
    let totalMovedCount = 0;

    for (let i = 0; i < messages.length; i += API_BATCH_SIZE) {
        const batch = messages.slice(i, i + API_BATCH_SIZE);
        console.log(`DEBUG: Moving batch ${i / API_BATCH_SIZE + 1}...`);
        
        const promises = batch.map(message => {
            const url = `${GMAIL_API}/messages/${message.id}/modify`;
            const payload = { addLabelIds: ['INBOX'], removeLabelIds: [labelIdToRemove] };
            return fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }).then(res => {
                if (res.ok) {
                    return 1;
                }
                console.error(`DEBUG: Failed to move message ${message.id}. Status: ${res.statusText}`);
                return 0;
            }).catch(err => {
                console.error(`DEBUG: Error moving message ${message.id}.`, err);
                return 0;
            });
        });

        const results = await Promise.all(promises);
        const batchMovedCount = results.reduce((sum, count) => sum + count, 0);
        totalMovedCount += batchMovedCount;
        
        // Wait before processing the next batch, if there is one.
        if (i + API_BATCH_SIZE < messages.length) {
            await delay(API_BATCH_DELAY);
        }
    }
    
    console.log(`DEBUG: Successfully moved ${totalMovedCount} out of ${messages.length} messages.`);
    return totalMovedCount;
}

// Deletes a single Gmail label.
async function _deleteGmailLabel(token, label) {
    console.log(`DEBUG: Deleting label "${label.name}".`);
    const response = await fetch(`${GMAIL_API}/labels/${label.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
        console.log(`DEBUG: Successfully deleted label "${label.name}".`);
        return true;
    }
    console.error(`DEBUG: Failed to delete label "${label.name}".`);
    return false;
}

// Fetches email details in throttled batches to avoid rate-limiting.
async function _fetchEmailDetails(token, emailMetas) {
    let detailedEmails = [];
    console.log(`DEBUG: Fetching details for ${emailMetas.length} emails in batches.`);

    for (let i = 0; i < emailMetas.length; i += API_BATCH_SIZE) {
        const batch = emailMetas.slice(i, i + API_BATCH_SIZE);
        console.log(`DEBUG: Fetching details for batch ${i / API_BATCH_SIZE + 1}...`);
        
        const promises = batch.map(meta =>
            fetch(`${GMAIL_API}/messages/${meta.id}?format=minimal`, { headers: { Authorization: `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : Promise.reject(`Failed status: ${res.status}`))
                .then(data => ({ id: meta.id, snippet: data.snippet }))
                .catch(error => {
                    console.error(`DEBUG: Failed to fetch email content for ID ${meta.id}.`, error);
                    return null;
                })
        );
        const results = await Promise.all(promises);
        detailedEmails.push(...results.filter(Boolean)); // Filter out any nulls

        // Wait before processing the next batch, if there is one.
        if (i + API_BATCH_SIZE < emailMetas.length) {
            await delay(API_BATCH_DELAY);
        }
    }
    
    console.log(`DEBUG: Successfully fetched details for ${detailedEmails.length} emails.`);
    return detailedEmails;
}

// Constructs the prompt for the Gemini API.
async function _buildCategorizationPrompt(emailDetails, categories, settings) {
    const { categorizationHistory } = settings;
    const promptTemplateUrl = chrome.runtime.getURL('prompt.txt');
    const response = await fetch(promptTemplateUrl);
    if (!response.ok) throw new Error('Failed to fetch prompt.txt.');
    let promptTemplate = await response.text();

    const categoryNames = categories.map(c => c.name).join(', ') || 'None';
    const historyText = (categorizationHistory && categorizationHistory.length > 0)
        ? categorizationHistory.map(item => `Email: "${item.snippet}"\nCategory: ${item.category}`).join('\n\n')
        : "No history available.";
    
    const emailBatch = JSON.stringify(emailDetails.map(e => ({ id: e.id, snippet: e.snippet })), null, 2);

    return promptTemplate
        .replace('{{categoryNames}}', categoryNames)
        .replace('{{history}}', historyText)
        .replace('{{emailBatch}}', emailBatch);
}

// Calls the Gemini API to get categorization results.
async function _fetchGeminiCategorization(prompt, settings) {
    const { geminiApiKey, geminiModel = 'gemini-2.0-flash-lite' } = settings;
    if (!geminiApiKey) throw new Error('Gemini API key not configured.');
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const data = await response.json();
    console.log('DEBUG: Raw response from Gemini API:', JSON.stringify(data, null, 2));

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
        const errorDetail = data.error ? JSON.stringify(data.error) : 'No candidate or text part in response.';
        throw new Error(`Invalid response from Gemini API: ${errorDetail}`);
    }
    return responseText;
}

// Parses the text response from Gemini, removing markdown fences.
function _parseGeminiResponse(responseText) {
    let cleanText = responseText.trim();
    if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7, cleanText.length - 3).trim();
    } else if (cleanText.startsWith('`')) {
        cleanText = cleanText.substring(1, cleanText.length - 1).trim();
    }

    try {
        return JSON.parse(cleanText);
    } catch (e) {
        console.error('DEBUG: Failed to parse JSON response from Gemini.', cleanText);
        throw new Error('Failed to parse categorization results from AI.');
    }
}

// Handles the creation of new categories based on AI results and user settings.
async function _handleNewCategories(categorizationResults, currentCategories, settings) {
    const { autoCategoryToggle = false, autoCategoryLimit = 5 } = settings;
    let updatedCategories = [...currentCategories];
    let finalResults = [...categorizationResults];

    const existingCategoryNames = new Set(updatedCategories.map(c => c.name));
    const newCategoryNames = new Set(finalResults.map(r => r.category).filter(cat => !existingCategoryNames.has(cat)));

    if (newCategoryNames.size === 0) {
        return { updatedCategories, finalResults };
    }

    if (!autoCategoryToggle) {
        console.log(`DEBUG: Auto-create is disabled. Re-assigning new categories to "Uncategorized".`);
        finalResults.filter(r => newCategoryNames.has(r.category)).forEach(r => r.category = "Uncategorized");
        return { updatedCategories, finalResults };
    }

    console.log(`DEBUG: Gemini proposed new categories: ${[...newCategoryNames].join(', ')}`);
    let autoGeneratedCount = updatedCategories.filter(c => c.auto_generated).length;

    for (const newName of newCategoryNames) {
        if (autoGeneratedCount < autoCategoryLimit) {
            console.log(`DEBUG: Auto-creating new category "${newName}".`);
            updatedCategories.push({ name: newName, notify: false, auto_generated: true });
            autoGeneratedCount++;
        } else {
            console.log(`DEBUG: Auto-create limit reached. Re-assigning emails from "${newName}" to "Uncategorized".`);
            finalResults.filter(r => r.category === newName).forEach(r => r.category = "Uncategorized");
        }
    }
    await chrome.storage.sync.set({ categories: updatedCategories });

    return { updatedCategories, finalResults };
}

// Stores the results of the last categorized batch, ensuring it fits within storage quotas.
async function saveBatchToHistory(categorizedResults) {
    console.log('DEBUG: Overwriting categorization history with the latest batch.');
    try {
        // Create the full history object first.
        let newHistory = categorizedResults.map(result => ({
            snippet: result.snippet,
            category: result.category
        }));

        // Ensure the history object does not exceed the quota by truncating it if necessary.
        // The TextEncoder provides the most accurate byte-size of the final string.
        let historyString = JSON.stringify(newHistory);
        while (new TextEncoder().encode(historyString).length > HISTORY_BYTE_LIMIT && newHistory.length > 0) {
            newHistory.pop(); // Remove the last item from the array.
            historyString = JSON.stringify(newHistory);
        }

        // Log if the history had to be cut down.
        if (newHistory.length < categorizedResults.length) {
            console.log(`DEBUG: History was truncated from ${categorizedResults.length} to ${newHistory.length} items to fit storage quota.`);
        }
        
        // Overwrite the old history with the new, size-safe one.
        await chrome.storage.sync.set({ categorizationHistory: newHistory });
        console.log(`DEBUG: Categorization history updated. New size: ${newHistory.length}`);
    } catch (error) {
        console.error('DEBUG: Could not update categorization history.', error.message, error.stack);
    }
}


// Finds a label by name or creates it if it doesn't exist.
async function findOrCreateLabel(token, categoryName) {
    const allLabels = await _fetchAllGmailLabels(token);
    const existingLabel = allLabels.find(label => label.name === categoryName);
    if (existingLabel) {
        return existingLabel.id;
    }

    console.log(`DEBUG: Label "${categoryName}" not found. Creating it.`);
    const response = await fetch(`${GMAIL_API}/labels`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
    });
    const newLabel = await response.json();
    if (response.ok && newLabel.id) {
        return newLabel.id;
    }
    throw new Error(`Failed to create label "${categoryName}".`);
}

// Applies a label to an email and removes it from the inbox.
async function applyLabel(token, messageId, categoryName) {
    console.log(`DEBUG: Applying label "${categoryName}" to message ${messageId}.`);
    try {
        const labelId = await findOrCreateLabel(token, categoryName);
        const response = await fetch(`${GMAIL_API}/messages/${messageId}/modify`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ addLabelIds: [labelId], removeLabelIds: ['INBOX'] }),
        });
        if (response.ok) {
            console.log(`DEBUG: Successfully moved email ${messageId} to label "${categoryName}".`);
        } else {
            console.error(`DEBUG: Failed to modify email ${messageId}. Status: ${response.status}.`);
        }
    } catch (error) {
        console.error(`DEBUG: An error occurred in applyLabel for message ${messageId}.`, error.message, error.stack);
    }
}

// Sends a desktop notification.
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