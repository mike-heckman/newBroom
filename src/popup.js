import './style.css';

/**
 * Adds the current domain to the specified list (whitelist or blacklist).
 * @param {('whitelist'|'blacklist')} listType - The list to modify.
 */
function addDomainToList(listType) {
    const domainElement = document.getElementById('currentDomain');
    const domain = domainElement.textContent;
    const status = document.getElementById('status');

    if (!domain || domain === 'Loading...' || domain === 'Cannot get domain') {
        status.textContent = 'Invalid domain.';
        status.className = 'text-sm font-medium mt-3 h-4 text-red-600';
        return;
    }

    // Fetch the existing lists.
    chrome.storage.sync.get({ whitelist: [], blacklist: [] }, (items) => {
        const list = items[listType];
        
        if (!list.includes(domain)) {
            list.push(domain);
            // Save the updated list.
            chrome.storage.sync.set({ [listType]: list }, () => {
                status.textContent = `"${domain}" ${listType}ed!`;
                status.className = 'text-sm font-medium mt-3 h-4 text-green-700';
                updateButtonStates(); // Refresh buttons
            });
        } else {
            status.textContent = `"${domain}" is already ${listType}ed.`;
            status.className = 'text-sm font-medium mt-3 h-4 text-yellow-700';
        }
    });
}

/**
 * Sends a message to the background script to start the cleaning process.
 */
function triggerCleaning() {
    const status = document.getElementById('status');
    const cleanNowBtn = document.getElementById('cleanNow');

    cleanNowBtn.disabled = true;
    status.textContent = 'Cleaning...';
    status.className = 'text-sm font-medium mt-3 h-4 text-blue-600';

    chrome.runtime.sendMessage({ action: "cleanNow" }, (response) => {
        if (chrome.runtime.lastError) {
            status.textContent = 'Error starting clean.';
            status.className = 'text-sm font-medium mt-3 h-4 text-red-600';
            console.error(chrome.runtime.lastError.message);
        } else if (response && response.message) {
            status.textContent = response.message;
            status.className = 'text-sm font-medium mt-3 h-4 text-green-700';
        }

        // Re-enable the button and clear the message after a delay.
        setTimeout(() => {
            status.textContent = '';
            cleanNowBtn.disabled = false;
        }, 3000);
    });
}

/**
 * Opens the options page in a new tab.
 */
function openOptionsPage() {
    chrome.runtime.openOptionsPage();
}

/**
 * Checks the domain's status and disables buttons if it's already listed.
 */
function updateButtonStates() {
    const domainElement = document.getElementById('currentDomain');
    const domain = domainElement.textContent;
    const whitelistBtn = document.getElementById('whitelistSite');
    const blacklistBtn = document.getElementById('blacklistSite');

    if (!domain || domain.includes('...')) {
        whitelistBtn.disabled = true;
        blacklistBtn.disabled = true;
        return;
    }

    chrome.storage.sync.get({ whitelist: [], blacklist: [] }, (items) => {
        if (items.whitelist.includes(domain)) {
            whitelistBtn.disabled = true;
            whitelistBtn.textContent = 'Site is Whitelisted';
        } else {
            whitelistBtn.disabled = false;
            whitelistBtn.textContent = 'Whitelist this Site';
        }

        if (items.blacklist.includes(domain)) {
            blacklistBtn.disabled = true;
            blacklistBtn.textContent = 'Site is Blacklisted';
        } else {
            blacklistBtn.disabled = false;
            blacklistBtn.textContent = 'Blacklist this Site';
        }
    });
}


/**
 * Initializes the popup when it's opened.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Add click listeners to the buttons.
    document.getElementById('cleanNow').addEventListener('click', triggerCleaning);
    document.getElementById('whitelistSite').addEventListener('click', () => addDomainToList('whitelist'));
    document.getElementById('blacklistSite').addEventListener('click', () => addDomainToList('blacklist'));
    document.getElementById('manageSettings').addEventListener('click', openOptionsPage);

    // Get the current active tab to find its domain.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const domainElement = document.getElementById('currentDomain');
        if (tabs[0] && tabs[0].url) {
            try {
                const url = new URL(tabs[0].url);
                // We only care about http/https protocols for whitelisting.
                if (!['http:', 'https:', 'ftp:'].includes(url.protocol)) {
                    throw new Error('Unsupported protocol');
                }
                const domain = url.hostname;
                domainElement.textContent = domain;
                updateButtonStates();

            } catch (e) {
                domainElement.textContent = 'Cannot get domain';
                updateButtonStates();
            }
        } else {
            domainElement.textContent = 'Cannot get domain';
            updateButtonStates();
        }
    });
});
