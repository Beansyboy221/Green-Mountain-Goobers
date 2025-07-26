# Technical Explanation

## 1. Agent Workflow

The agent is a Chrome Extension that runs in the background to automatically sort new emails in a user's Gmail account. Its workflow is straightforward and repeats every two minutes.

1. **Trigger**: A recurring alarm, created when the extension starts, fires to begin the process.

2. **Configuration & Memory Retrieval**: The agent loads its settings from Chrome's storage. This is its "memory" and includes:

    * The user's Gemini API key and chosen model.
    * The user's list of email categories (labels).
    * **A `categorizationHistory` of recently processed emails and the labels they were assigned to.**
    * Other settings like the master on/off switch.

3. **Plan & Execute Loop**: For each new email found in the inbox, the agent executes a series of steps:

    * **Fetch Email Content (Tool Call)**: It calls the Gmail API to get a short summary (`snippet`) of the new email.
    * **Categorize with LLM (Tool Call)**: This is the core "thinking" step. The agent builds a detailed prompt for the Gemini API. This prompt includes the new email's content, the list of all possible categories, and, most importantly, the **categorization history**. This history gives the AI examples of past decisions, helping it learn the user's preferences and improve its accuracy over time.
    * **Decide and Adapt**: The agent takes the category name returned by Gemini.
        * If the category is new and the user has enabled auto-creation, the agent adds it to the list of categories in its memory.
          If auto-creation is disabled, it assigns the email to "Uncategorized".
    * **Apply Label (Tool Call)**: It uses the Gmail API to apply the chosen category's label to the email and remove it from the inbox.
    * **Update Memory**: After successfully categorizing the email, the agent saves the email snippet and its assigned category to the `categorizationHistory` in its memory. This keeps its examples fresh for future decisions.
    * **Notify (Optional)**: If notifications are enabled for that category, it sends a desktop alert.

4. **Final Output**: The agent's work results in a cleanly sorted Gmail inbox and optional notifications, not a direct text response. It then waits for the next alarm to run again.

## 2. Key Modules

* **Planner / "Brain"** (`categorizeEmail` in `background.js`): The core of the agent. It integrates the agent's memory (both the list of categories and the history of past categorizations) with new email content to form a prompt for the Gemini LLM, which then makes the sorting decision.

* **Executor** (various functions in `background.js`): A set of functions that carry out the planner's decisions by calling external APIs, such as fetching emails, applying labels (`Gmail API`), and sending notifications (`Chrome Notifications API`).

* **Memory Store** (`chrome.storage.sync`): The agent's memory, which persists across browser sessions. The key data stored includes:
* `categories`: The user-defined list of labels. This list grows as the agent auto-creates new ones.
* `categorizationHistory`: An array of recent `(email snippet, category)` pairs. This serves as a short-term, evolving memory of examples that guides the LLM's future decisions.
* User settings like the API key and other toggles.

## 3. Tool Integration

The agent relies on several APIs to function:

* **Gmail API**: Used for all interactions with the user's inbox, including reading messages, listing labels, creating new labels, and applying them to messages.
* **Gemini API**: The AI service used to determine the category for each email based on the prompt constructed by the agent.
* **Chrome Extension APIs**: A set of browser-native APIs used for core extension functionality, including `chrome.storage` (memory), `chrome.alarms` (scheduling), `chrome.notifications` (alerts), and `chrome.identity` (authentication).

## 4. Observability & Testing

* **Logging**: All major actions, decisions, and API calls are logged to the service worker's developer console with a "DEBUG:" prefix. This allows for clear tracing of the agent's behavior.
* **Testing**: Manual testing is required. A user must load the extension, configure it via the popup (API key, categories), and send emails to their account to verify that they are sorted and labeled correctly.

## 5. Known Limitations

* **API Rate Limiting**: A large volume of incoming emails could potentially hit API rate limits.
* **Shallow Content Analysis**: The agent only analyzes the email `snippet` (a short summary), not the full body, which can sometimes lead to miscategorization.
* **Browser Requirements** The extension only authenticates properly on Google Chrome Browser. It also only supports Gmail.
* **Categorization Brittleness**: The agent's performance depends heavily on the quality of the LLM and the prompt. While the memory feature helps, unusual emails can still be miscategorized.
