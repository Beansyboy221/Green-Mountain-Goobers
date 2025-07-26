# Technical Explanation

## 1. Agent Workflow

The agent is a Chrome Extension that runs in the background to automatically sort new emails in a user's Gmail account. Its workflow is straightforward and repeats every minute.

1. **Trigger**: A recurring alarm, created when the extension starts, fires to begin the process. A state lock (`isProcessingEmails`) ensures that only one instance of the workflow runs at a time.

2. **Configuration & Memory Retrieval**: The agent loads its settings from Chrome's storage. This is its "memory" and includes:

    * The user's Gemini API key and chosen model.
    * The user's list of email categories (labels).
    * **A `categorizationHistory` consisting of the results from the *single most recent batch* of processed emails.**
    * Other settings like the master on/off switch.

3. **Plan & Execute Loop**: For each new email found in the inbox, the agent executes a series of steps:

    * **Fetch Email Content (Tool Call)**: It calls the Gmail API to get a short summary (`snippet`) for a batch of new emails.
    * **Categorize with LLM (Tool Call)**: This is the core "thinking" step. The agent builds a detailed prompt for the Gemini API. This prompt includes the new email batch, the list of all possible categories, and, most importantly, the **categorization history**. This history provides the AI with immediate context on its most recent decisions, helping it maintain consistency.
    * **Decide and Adapt**: The agent takes the category name returned by Gemini for each email.
        * If the category is new and the user has enabled auto-creation, the agent adds it to the list of categories in its memory.
        * If auto-creation is disabled, it assigns the email to "Uncategorized".
    * **Apply Label (Tool Call)**: It uses the Gmail API to apply the chosen category's label to the email and remove it from the inbox.
    * **Update Memory**: After successfully categorizing the entire batch, the agent **completely replaces** the `categorizationHistory` in its memory with the results of the batch it just processed. This keeps its examples highly relevant and contextual.
    * **Notify (Optional)**: If notifications are enabled for that category, it sends a desktop alert.

4. **Final Output**: The agent's work results in a cleanly sorted Gmail inbox and optional notifications, not a direct text response. It then releases its processing lock and waits for the next alarm to run again.

## 2. Key Modules

* **Planner / "Brain"** (`categorizeEmailBatch` in `background.js`): The core of the agent. It integrates the agent's memory (both the list of categories and the history of the last batch) with new email content to form a prompt for the Gemini LLM, which then makes sorting decisions for the entire batch.

* **Executor** (various functions in `background.js`): A set of functions that carry out the planner's decisions by calling external APIs, such as fetching emails, applying labels (`Gmail API`), and sending notifications (`Chrome Notifications API`). This also includes the `resetToInbox` function, which is blocked by the state lock if the planner is active.

* **Memory Store** (`chrome.storage.sync`): The agent's memory, which persists across browser sessions. The key data stored includes:
* `categories`: The user-defined list of labels. This list grows as the agent auto-creates new ones.
* `categorizationHistory`: A snapshot of the last processed batch, including `(email snippet, category)` pairs. This serves as a highly contextual, short-term memory that guides the LLM's immediate future decisions. It is overwritten after every successful run.
* User settings like the API key and other toggles.

## 3. Tool Integration

The agent relies on several APIs to function:

* **Gmail API**: Used for all interactions with the user's inbox, including reading messages, listing labels, creating new labels, and applying them to messages.
* **Gemini API**: The AI service used to determine the category for each email based on the prompt constructed by the agent.
* **Chrome Extension APIs**: A set of browser-native APIs used for core extension functionality, including `chrome.storage` (memory), `chrome.alarms` (scheduling), `chrome.notifications` (alerts), and `chrome.identity` (authentication).

## 4. Observability & Testing

* **Logging**: All major actions, decisions, API calls, and state changes (like acquiring/releasing locks) are logged to the service worker's developer console with a "DEBUG:" prefix. This allows for clear tracing of the agent's behavior, including history truncation events.
* **Testing**: Manual testing is required. A user must load the extension, configure it via the popup (API key, categories), and send emails to their account to verify that they are sorted correctly. Testing the "Reset" feature while emails are being processed should result in a user-facing error message.

## 5. Known Limitations & Solutions

* **Storage Quota**: `chrome.storage.sync` imposes an 8KB per-item size limit. A large batch of emails could create a `categorizationHistory` object that exceeds this limit, causing a crash.
* **Solution**: The agent calculates the byte size of the history object before saving. If it exceeds the limit, it truncates the history by removing items until it fits, ensuring the save operation never fails.

* **Concurrency**: A user could trigger the "Reset to Inbox" function while a batch of emails is being processed, leading to data corruption.
* **Solution**: A state lock (`isProcessingEmails`) is implemented. The reset function is blocked if this lock is active, and the user is notified that the action cannot be performed at that moment.

* **API Rate Limiting**: A large volume of incoming emails could potentially hit Gmail or Gemini API rate limits.

* **Shallow Content Analysis**: The agent only analyzes the email `snippet` (a short summary), not the full body, which can sometimes lead to miscategorization.

* **Browser Requirements**: The extension only authenticates properly on Google Chrome Browser. It also only supports Gmail.

* **Categorization Brittleness**: The agent's performance depends heavily on the quality of the LLM and the prompt. While the memory feature helps, unusual emails can still be miscategorized.

* **Unpublished Extension** This extension isn't currently published on the Chrome Web Store and thus, you must create a project and input your own Client ID. You must also activate Gmail API for your project.
