# Gmail AutoSorter - User Guide

## 📧 Overview

Gmail AutoSorter is a powerful browser extension that automatically categorizes and organizes your Gmail inbox using Google's Gemini AI. Say goodbye to manual email sorting and hello to a clutter-free, organized inbox!

### ✨ Key Features

- **AI-Powered Categorization**: Uses Google Gemini AI to intelligently sort emails
- **Custom Categories**: Create and manage your own email categories
- **Auto-Generation**: Automatically generate categories based on your email patterns
- **Smart Notifications**: Get notified about important emails in specific categories
- **Easy Setup**: Simple configuration with your Gemini API key

### !NOTE!: As an unpublished Chrome Extension, this project also currently requires you to input your own Google Client ID in the manifest.json file and enable Gmail API for your cloud project

- Create a new project and generate a Client ID for a Chrome Extension in the credentials tab. Input the extension ID from the "Manage Extensions" page and copy the Client ID. Finally, paste the ID in manifest.json, replacing the current ID.

---

## 🚀 Installation

### Prerequisites

Before installing Gmail AutoSorter, you'll need:

- Google Chrome Browser
- A Google Gemini API key (free tier available)

### Step 1: Get Your Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key (you'll need this later)

### Step 2: Install the Extension

1. Download the extension files to your computer
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the folder containing the extension files
6. The Gmail AutoSorter icon should appear in your browser toolbar

---

## ⚙️ Initial Setup

### Step 1: Configure Your API Key

1. Click the Gmail AutoSorter icon in your browser toolbar
2. In the popup window, paste your Gemini API key in the "Gemini API Key" field
3. Click "Save"
4. You should see a confirmation message

### Step 2: Choose Your Gemini Model

Select the AI model that best suits your needs:

- **gemini-2.5-pro**: Most capable, best for complex categorization
- **gemini-2.5-flash**: Fast and efficient, most requests per day
- **gemini-2.5-flash-lite**: Lightweight, most requests per minute
- **gemini-2.0-pro**: Previous generation, still powerful
- **gemini-2.0-flash**: Previous generation, fast
- **gemini-2.0-flash-lite**: Previous generation, lightweight
- **gemini-1.5-flash**: Legacy model

**Recommendation**: Start with `gemini-2.5-flash` for the best balance of volume and accuracy.

### Step 3: Enable AutoSorter

1. Toggle the "Enable AutoSorter" switch to ON
2. This activates the automatic email categorization

---

## 📂 Managing Categories

### Creating Custom Categories

1. In the extension popup, scroll to the "Categories" section
2. Type a category name in the "Add new category" field
3. Click "Add"
4. Your new category will appear in the category list

**Examples of useful categories:**

- Work
- Personal
- Bills & Finance
- Shopping
- Travel
- Family
- Newsletters
- Promotions

### Setting Up Notifications

For each category, you can enable notifications:

1. Find your category in the list
2. Check the checkbox next to it
3. You'll receive notifications for emails in that category

### Deleting Categories

1. Find the category you want to remove
2. Click the red "Delete" button next to it
3. The category will be removed immediately
4. All emails with the deleted label need to be manually moved

---

## 🤖 Auto-Categorization Features

### Automatic Category Generation

Enable this feature to let AI create categories based on your emails:

1. Check "Auto-categorize emails"
2. Set the maximum number of auto-categories (1-20)
3. The AI will analyze your emails and create relevant categories

### How Auto-Categorization Works

The extension uses Gemini AI to:

1. Analyze email content, subject lines, and senders
2. Identify patterns and themes
3. Group similar emails together
4. Suggest category names based on content

---

## 📧 Using Gmail AutoSorter

### Daily Usage

Once set up, Gmail AutoSorter works automatically:

1. Open Gmail in your browser
2. The extension will process incoming emails
3. Emails will be automatically categorized
4. Check your category folders to find organized emails

---

### Notice: Storage Management

The extension stores your settings and categories locally:

- Categories are saved in your browser
- Settings persist across browser sessions
- Data is not shared with third parties

---
