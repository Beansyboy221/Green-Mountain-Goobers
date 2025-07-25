
const GMAIL_API = 'https://www.googleapis.com/gmail/v1/users/me';
const ALARM_NAME = 'gmailSorterAlarm';

// Authenticate with Gmail API
async function authenticate() {
    console.log('DEBUG: Attempting to authenticate with Gmail API.');
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                const errorMessage = chrome.runtime.lastError?.message || 'Could not retrieve auth token.';
                console.error('DEBUG: Authentication failed.', errorMessage);
                return reject(new Error(errorMessage));
            }
            console.log('DEBUG: Authentication successful. Token retrieved.');
            resolve(token);
        });
    });
}

// Run setup when the extension is first installed
chrome.runtime.onInstalled.addListener(setupAlarm);
// Run setup when the browser first starts
chrome.runtime.onStartup.addListener(setupAlarm);

function setupAlarm() {
    console.log('DEBUG: Running setupAlarm.');
    chrome.alarms.get(ALARM_NAME, (alarm) => {
        if (alarm) {
            console.log('DEBUG: Alarm already exists.', alarm);
        } else {
            // Create an alarm to fire every 2 minutes.
            chrome.alarms.create(ALARM_NAME, {
                delayInMinutes: 1, // Check 1 minute after startup
                periodInMinutes: 2  // Then check every 2 minutes
            });
            console.log('DEBUG: Gmail Sorter alarm created.');
        }
    });
}

// This listener waits for the alarm to fire and then runs the processing function.
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('DEBUG: chrome.alarms.onAlarm listener triggered for alarm:', alarm.name);
    if (alarm.name === ALARM_NAME) {
        processNewEmails();
    }
});

// This function is called by the alarm.
async function processNewEmails() {
    console.log('DEBUG: Alarm fired. Starting processNewEmails.');
    try {
        const token = await authenticate();
        const storageData = await new Promise(resolve => chrome.storage.sync.get(['categories'], r => resolve(r)));
        const categories = storageData.categories || [];
        console.log('DEBUG: Fetched categories from storage:', categories);

        if (!categories || categories.length === 0) {
            console.log('DEBUG: No categories defined in storage. Stopping.');
            return 'No categories defined. Stopping.';
        }

        const fetchUrl = `${GMAIL_API}/messages?q=in:inbox`;
        console.log(`DEBUG: Fetching unread emails with URL: ${fetchUrl}`);
        const response = await fetch(fetchUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`DEBUG: Error fetching emails from Gmail API. Status: ${response.status}. Response: ${errorText}`);
            throw new Error(`Gmail API error: ${response.statusText}`);
        }

        const data = await response.json();
        const emails = data.messages || [];

        if (emails.length === 0) {
            console.log('DEBUG: No new unread emails found.');
            return 'No new unread emails found.';
        }

        console.log(`DEBUG: Found ${emails.length} new unread email(s).`);
        for (const email of emails) {
            console.log(`DEBUG: Processing email with ID: ${email.id}`);
            const emailDataUrl = `${GMAIL_API}/messages/${email.id}?format=minimal`;
            console.log(`DEBUG: Fetching email data from URL: ${emailDataUrl}`);
            const emailDataResponse = await fetch(emailDataUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const emailData = await emailDataResponse.json();

            if (!emailDataResponse.ok) {
                console.error(`DEBUG: Failed to fetch email data for ID ${email.id}. Status: ${emailDataResponse.status}. Response:`, emailData);
                continue; // Skip to the next email
            }

            const emailContent = emailData.snippet;
            console.log(`DEBUG: Email snippet for ${email.id}: "${emailContent}"`);
            try {
                const category = await categorizeEmail(emailContent, categories);
                console.log(`DEBUG: Email ${email.id} classified as "${category}" by Gemini.`);
                await applyLabel(token, email.id, category);

                const catObj = categories.find(c => c.name === category);
                if (catObj?.notify) {
                    console.log(`DEBUG: Notification enabled for category "${category}". Sending notification.`);
                    sendNotification(category, emailContent);
                } else {
                    console.log(`DEBUG: Notification disabled for category "${category}".`);
                }
            } catch (error) {
                console.error(`DEBUG: Error processing email ${email.id}.`, error.message, error.stack);
            }
        }
        console.log(`DEBUG: Finished processing ${emails.length} email(s).`);
        return `Successfully processed ${emails.length} new email(s).`;
    } catch (error) {
        console.error('DEBUG: A critical error occurred in processNewEmails.', error.message, error.stack);
        throw error;
    }
}

// Classify email with Gemini
async function categorizeEmail(emailContent, categories) {
    console.log('DEBUG: Starting categorizeEmail.');
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['geminiApiKey'], async (result) => {
            const GEMINI_API_KEY = result.geminiApiKey;
            if (!GEMINI_API_KEY) {
                console.error('DEBUG: Gemini API key not found in storage.');
                return reject(new Error('Gemini API key not set. Please configure it in the extension popup.'));
            }
            console.log('DEBUG: Gemini API key found.');

            const categoryNames = categories.map(c => c.name).join(', ');
            const prompt = `Try to classify the following email into one of these categories: ${categoryNames}. Return only the category name. If none of the categories fit logically to this email, return nothing.\n\nEmail: ${emailContent}`;
            console.log('DEBUG: Prompt for Gemini API:', prompt);

            chrome.storage.sync.get(['geminiModel'], async (modelResult) => {
                const geminiModel = modelResult.geminiModel || 'gemini-2.0-flash-lite';
                console.log(`DEBUG: Using Gemini model: ${geminiModel}`);

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;
                console.log(`DEBUG: Sending request to Gemini API: ${geminiUrl}`);

                try {
                    const response = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                        }),
                    });

                    const data = await response.json();
                    console.log('DEBUG: Raw response from Gemini API:', JSON.stringify(data, null, 2));

                    if (response.ok && data.candidates && data.candidates[0].content.parts[0].text) {
                        const category = data.candidates[0].content.parts[0].text.trim();
                        console.log(`DEBUG: Gemini API returned category: "${category}"`);
                        resolve(category);
                    } else {
                        const errorDetail = data.error ? JSON.stringify(data.error) : 'No candidate or text part in response.';
                        console.error('DEBUG: Invalid response from Gemini API.', errorDetail);
                        reject(new Error(`Invalid response from Gemini API: ${errorDetail}`));
                    }
                } catch (error) {
                    console.error('DEBUG: Error during fetch to Gemini API.', error.message, error.stack);
                    reject(error);
                }
            });
        });
    });
}

// Apply label to email
async function applyLabel(token, messageId, category) {
    console.log(`DEBUG: Starting applyLabel for message ${messageId} with category "${category}".`);
    try {
        // First, get the ID for the category label, creating it if it doesn't exist.
        const labelsUrl = `${GMAIL_API}/labels`;
        console.log(`DEBUG: Fetching existing labels from ${labelsUrl}`);
        const labelResponse = await fetch(labelsUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const labelsData = await labelResponse.json();
        if (!labelResponse.ok) {
            console.error('DEBUG: Failed to fetch labels.', labelsData);
            return;
        }
        console.log('DEBUG: Fetched labels successfully.');

        let label = labelsData.labels.find(l => l.name === category);
        let labelId;

        if (label) {
            labelId = label.id;
            console.log(`DEBUG: Found existing label "${category}" with ID: ${labelId}`);
        } else {
            console.log(`DEBUG: Label "${category}" not found. Attempting to create it.`);
            const createLabelResponse = await fetch(`${GMAIL_API}/labels`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: category, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
            });
            const newLabel = await createLabelResponse.json();
            if (createLabelResponse.ok && newLabel.id) {
                labelId = newLabel.id;
                console.log(`DEBUG: Label "${category}" created successfully with ID: ${labelId}`);
            } else {
                console.error(`DEBUG: Failed to create label "${category}". Response:`, newLabel);
                return; // Stop if we can't get a valid label
            }
        }

        const modifyUrl = `${GMAIL_API}/messages/${messageId}/modify`;
        const modifyPayload = {
            addLabelIds: [labelId],   // Apply the new category label
            removeLabelIds: ['INBOX'] // Remove from Inbox
        };
        console.log(`DEBUG: Modifying email ${messageId} at ${modifyUrl} with payload:`, JSON.stringify(modifyPayload));
        const modifyResponse = await fetch(modifyUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(modifyPayload),
        });

        if (modifyResponse.ok) {
            console.log(`DEBUG: Successfully modified email ${messageId}. Moved to label "${category}".`);
        } else {
            const errorData = await modifyResponse.json();
            console.error(`DEBUG: Failed to modify email ${messageId}. Status: ${modifyResponse.status}. Response:`, errorData);
        }
    } catch (error) {
        console.error(`DEBUG: An error occurred in applyLabel for message ${messageId}.`, error.message, error.stack);
    }
}

// Send notification
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