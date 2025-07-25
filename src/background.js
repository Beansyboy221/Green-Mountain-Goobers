const GMAIL_API = 'https://www.googleapis.com/gmail/v1/users/me';
const ALARM_NAME = 'gmailSorterAlarm';

// Authenticate with Gmail API
async function authenticate() {
    return new Promise((resolve, reject) => {
        // 1. First, get the Client ID that the user saved in the popup.
        chrome.storage.sync.get(['googleClientId'], (result) => {
            const clientId = result.googleClientId;
            if (!clientId) {
                // If it's not in storage, we can't proceed.
                return reject(new Error('Google Client ID not set. Please configure it in the extension popup.'));
            }

            const scopes = [
                "https://www.googleapis.com/auth/gmail.modify",
                "https://www.googleapis.com/auth/gmail.labels"
            ].join(' ');

            // This gets the special redirect URL for our extension.
            const redirectUri = chrome.identity.getRedirectURL();
            
            // 2. Manually construct the authentication URL, inserting the user's Client ID.
            let authUrl = `https://accounts.google.com/o/oauth2/v2/auth`;
            authUrl += `?client_id=${clientId}`; // <-- DYNAMICALLY INSERTED
            authUrl += `&response_type=token`;
            authUrl += `&redirect_uri=${encodeURIComponent(redirectUri)}`;
            authUrl += `&scope=${encodeURIComponent(scopes)}`;
            authUrl += `&prompt=consent`; // Prompting ensures they see the consent screen.

            // 3. Launch the authentication flow.
            chrome.identity.launchWebAuthFlow({
                url: authUrl,
                interactive: true
            }, (redirect_url) => {
                if (chrome.runtime.lastError || !redirect_url) {
                    return reject(new Error(chrome.runtime.lastError?.message || 'Authentication failed. The user may have closed the window.'));
                }

                // 4. Parse the token from the response URL.
                const url = new URL(redirect_url);
                const params = new URLSearchParams(url.hash.substring(1));
                const accessToken = params.get('access_token');

                if (accessToken) {
                    resolve(accessToken);
                } else {
                    reject(new Error('Authentication failed: Could not extract access token from redirect URL.'));
                }
            });
        });
    });
}

// Run setup when the extension is first installed
chrome.runtime.onInstalled.addListener(setupAlarm);
// Run setup when the browser first starts
chrome.runtime.onStartup.addListener(setupAlarm);

function setupAlarm() {
    chrome.alarms.get(ALARM_NAME, (alarm) => {
        if (!alarm) {
            // Create an alarm to fire every 2 minutes.
            chrome.alarms.create(ALARM_NAME, {
                delayInMinutes: 1, // Check 1 minute after startup
                periodInMinutes: 2  // Then check every 2 minutes
            });
            console.log('Gmail Sorter alarm created.');
        }
    });
}

// This listener waits for the alarm to fire and then runs the processing function.
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        processNewEmails();
    }
});

// This function is called by the alarm.
async function processNewEmails() {
    console.log('Alarm fired. Checking for new emails...');
    try {
        const token = await authenticate();
        const categories = (await new Promise(resolve => chrome.storage.sync.get(['categories'], r => resolve(r.categories || [])))) || [];

        if (categories.length === 0) {
            return 'No categories defined. Stopping.';
        }

        const response = await fetch(`${GMAIL_API}/messages?q=in:inbox is:unread`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        const emails = data.messages || [];

        if (emails.length === 0) {
            return 'No new unread emails found.';
        }

        console.log(`Processing ${emails.length} new email(s).`);
        for (const email of emails) {
            const emailData = await fetch(`${GMAIL_API}/messages/${email.id}?format=minimal`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => res.json());

            const emailContent = emailData.snippet;
            try {
                const category = await categorizeEmail(emailContent, categories);
                await applyLabel(token, email.id, category);

                const catObj = categories.find(c => c.name === category);
                if (catObj?.notify) {
                    sendNotification(category, emailContent);
                }
            } catch (error) {
                console.error(`Error classifying email ${email.id}:`, error);
            }
        }
        return `Successfully processed ${emails.length} new email(s).`;
    } catch (error) {
        console.error('Error during new email processing:', error);
        throw error;
    }
}

// Classify email with Gemini
async function categorizeEmail(emailContent, categories) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['geminiApiKey'], async (result) => {
            const GEMINI_API_KEY = result.geminiApiKey;
            if (!GEMINI_API_KEY) {
                return reject(new Error('Gemini API key not set. Please configure it in the extension popup.'));
            }
            const prompt = `Classify the following email into one of these categories: ${categories.map(c => c.name).join(', ')}. Return only the category name.\n\nEmail: ${emailContent}`;
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                    }),
                });
                const data = await response.json();
                if (data.candidates && data.candidates[0].content.parts[0].text) {
                    resolve(data.candidates[0].content.parts[0].text.trim());
                } else {
                    reject(new Error('Invalid response from Gemini API'));
                }
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Apply label to email
async function applyLabel(token, messageId, category) {
    const labelResponse = await fetch(`${GMAIL_API}/labels`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const labels = await labelResponse.json();
    let labelId = labels.labels.find(l => l.name === category)?.id;

    if (!labelId) {
        const createLabel = await fetch(`${GMAIL_API}/labels`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: category, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
        });
        labelId = (await createLabel.json()).id;
    }

    await fetch(`${GMAIL_API}/messages/${messageId}/modify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds: [labelId] }),
    });
}

// Send notification
function sendNotification(category, emailSnippet) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: `New Email in ${category}`,
        message: emailSnippet,
    });
}