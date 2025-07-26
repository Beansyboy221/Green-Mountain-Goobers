# Gmail AutoSorter - User Guide

## 📧 Overview

Gmail AutoSorter is a powerful browser extension that automatically categorizes and organizes your Gmail inbox using Google's Gemini AI. Say goodbye to manual email sorting and hello to a clutter-free, organized inbox!

### ✨ Key Features

- **AI-Powered Categorization**: Uses Google Gemini AI to intelligently sort emails
- **Custom Categories**: Create and manage your own email categories
- **Auto-Generation**: Automatically generate categories based on your email patterns
- **Smart Notifications**: Get notified about important emails in specific categories
- **Easy Setup**: Simple configuration with your Gemini API key

---

## 🚀 Installation

### Prerequisites

Before installing Gmail AutoSorter, you'll need:
- A Google Chrome browser
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
- **gemini-2.5-flash**: Fast and efficient, good balance
- **gemini-2.5-flash-lite**: Lightweight, fastest processing
- **gemini-2.0-pro**: Previous generation, still powerful
- **gemini-2.0-flash**: Previous generation, fast
- **gemini-2.0-flash-lite**: Previous generation, lightweight
- **gemini-1.5-flash**: Legacy model

**Recommendation**: Start with `gemini-2.5-flash` for the best balance of speed and accuracy.

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

### Manual Categorization

You can also manually categorize emails:
1. Select an email in Gmail
2. Use the extension's categorization tools
3. Assign emails to specific categories

---

## 🔧 Advanced Settings

### Performance Optimization

- **Model Selection**: Choose faster models for quicker processing
- **Category Limits**: Limit auto-generated categories to reduce complexity
- **Notification Settings**: Customize which categories trigger notifications

### Storage Management

The extension stores your settings and categories locally:
- Categories are saved in your browser
- Settings persist across browser sessions
- Data is not shared with third parties

---

## 🛠️ Troubleshooting

### Common Issues

#### Extension Not Working
1. **Check if enabled**: Ensure the "Enable AutoSorter" toggle is ON
2. **Verify API key**: Make sure your Gemini API key is valid and saved
3. **Reload extension**: Go to `chrome://extensions/` and reload the extension
4. **Check permissions**: Ensure the extension has access to Gmail

#### API Key Errors
1. **Invalid key**: Double-check your API key from Google AI Studio
2. **Quota exceeded**: Check your Gemini API usage limits
3. **Network issues**: Ensure you have a stable internet connection

#### Categories Not Appearing
1. **Refresh Gmail**: Reload the Gmail page
2. **Check category list**: Verify categories are added in the extension popup
3. **Clear cache**: Clear browser cache and reload

#### Slow Performance
1. **Switch models**: Try a faster Gemini model
2. **Reduce categories**: Limit the number of auto-generated categories
3. **Check internet**: Ensure stable internet connection

### Getting Help

If you continue to experience issues:
1. Check the browser console for error messages
2. Restart your browser
3. Reinstall the extension

---

## 🔒 Privacy & Security

### Data Protection

- **Local Storage**: All settings and categories are stored locally in your browser
- **No Data Sharing**: Your email content is not shared with third parties
- **API Usage**: Only email metadata is sent to Gemini API for categorization
- **Secure Communication**: All API calls use HTTPS encryption

### Permissions

The extension requires these permissions:
- **Gmail Access**: To read and categorize your emails
- **Storage**: To save your settings and categories
- **Network**: To communicate with Gemini API

---

## 📱 Browser Compatibility

### Supported Browsers

- **Google Chrome**: Full support (recommended)
- **Other Chromium-based browsers**: May work with limitations

### System Requirements

- Modern web browser with JavaScript enabled
- Stable internet connection
- Google account with Gmail access
- Valid Gemini API key

---

## 🔄 Updates & Maintenance

### Keeping Updated

- The extension will automatically update when new versions are available
- Check `chrome://extensions/` for update notifications
- Reload the extension after updates

### Backup Your Settings

To backup your categories and settings:
1. Go to `chrome://extensions/`
2. Find Gmail AutoSorter
3. Click "Details"
4. Export your data if available

---

## 💡 Tips & Best Practices

### Optimizing Performance

1. **Start Small**: Begin with a few categories and expand gradually
2. **Use Descriptive Names**: Clear category names help with accurate sorting
3. **Regular Review**: Periodically review and clean up categories
4. **Monitor Usage**: Keep track of your Gemini API usage

### Effective Categorization

1. **Be Specific**: Create specific categories rather than broad ones
2. **Use Keywords**: Include relevant keywords in category names
3. **Regular Maintenance**: Remove unused categories
4. **Test Categories**: Add a few emails to test category accuracy

### Productivity Tips

1. **Priority Categories**: Enable notifications for important categories
2. **Batch Processing**: Process emails in batches for better organization
3. **Regular Cleanup**: Archive or delete old categorized emails
4. **Use Filters**: Combine with Gmail's built-in filters for better organization

---

## 📞 Support & Feedback

### Getting Help

If you need assistance:
1. Check this user guide first
2. Review the troubleshooting section
3. Check for known issues in the documentation
4. Contact support with detailed information about your issue

### Providing Feedback

We welcome your feedback to improve Gmail AutoSorter:
- Report bugs with detailed steps to reproduce
- Suggest new features
- Share your experience and use cases
- Rate and review the extension

---

## 📋 Quick Reference

### Keyboard Shortcuts

- **Extension Popup**: Click extension icon in toolbar
- **Gmail Navigation**: Use standard Gmail shortcuts
- **Category Management**: Use the popup interface

### Common Actions

| Action | Steps |
|--------|-------|
| Add Category | Type name → Click "Add" |
| Enable Notifications | Check category checkbox |
| Delete Category | Click red "Delete" button |
| Change Model | Select from dropdown → Save |
| Toggle AutoSorter | Use master toggle switch |

### Settings Summary

- **API Key**: Required for AI functionality
- **Model**: Affects speed and accuracy
- **Auto-categorization**: Optional automatic category generation
- **Category Limit**: Controls number of auto-generated categories
- **Notifications**: Per-category notification settings

---

*Thank you for using Gmail AutoSorter! We hope this tool helps you achieve a more organized and productive email experience.*
