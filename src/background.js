/**
 * Helper function to match a domain against a pattern (with wildcard support).
 * @param {string} domain The domain of the cookie (e.g., "www.google.com").
 * @param {string} pattern The pattern from the list (e.g., "*.google.com").
 * @returns {boolean} True if the domain matches the pattern.
 */
function domainMatches(domain, pattern) {
    if (pattern.startsWith('*.')) {
        const basePattern = pattern.substring(2);
        return domain === basePattern || domain.endsWith('.' + basePattern);
    }
    return domain === pattern;
}

/**
 * Converts a list of whitelisted hostnames to a list of origins for the browsingData API.
 * @param {string[]} whitelist - An array of domains to protect.
 * @returns {string[]} An array of origins (e.g., "https://example.com").
 */
function getExcludedOrigins(whitelist) {
    return whitelist.reduce((acc, domain) => {
        let hostname = domain;
        if (hostname.startsWith('*.')) {
            hostname = hostname.substring(2);
        }
        // The API does not support wildcards in origins, so we only process valid hostnames.
        if (!hostname.includes('*')) {
            acc.push(`http://${hostname}`);
            acc.push(`https://${hostname}`);
        } else {
            // Log the rejected domain because it's not a valid hostname for this API.
            console.log(`Rejected invalid whitelist entry for browsingData API (contains '*'): "${domain}"`);
        }
        return acc;
    }, []);
}

/**
 * Clears cookies based on complex whitelist/blacklist rules with wildcard support.
 * @param {string[]} whitelist - An array of domains to protect.
 * @param {string[]} blacklist - An array of domains to force-delete.
 * @param {boolean} clearStandard - Whether to clear standard, unpartitioned cookies.
 * @param {boolean} clearPartitioned - Whether to clear partitioned cookies (ignores whitelist).
 */
async function clearCookiesWithRules(whitelist, blacklist, clearStandard, clearPartitioned) {
    // Get all cookie stores (e.g., for different profiles/containers).
    const cookieStores = await chrome.cookies.getAllCookieStores();
    
    // Create a promise for each store's cookies and fetch them in parallel.
    const allCookiesPromises = cookieStores.map(store => chrome.cookies.getAll({ storeId: store.id, partitionKey: {} }));
    const cookies = (await Promise.all(allCookiesPromises)).flat();

    console.log(`Total cookies found by cookies API: ${cookies.length}`);

    if (!cookies || cookies.length === 0) {
        console.log("No cookies to process.");
    } else {
        const removalPromises = [];
        for (const cookie of cookies) {
            const isPartitioned = !!cookie.partitionKey;

            // Skip this cookie if its type is not selected for clearing.
            if ((isPartitioned && !clearPartitioned) || (!isPartitioned && !clearStandard)) {
                continue;
            }

            const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
            let isWhitelisted = false;
            let isBlacklisted = false;

            if (isPartitioned && cookie.partitionKey.topLevelSite) {
                const topLevelSite = cookie.partitionKey.topLevelSite;
                // Stricter logic for partitioned cookies:
                // Whitelisted only if BOTH the cookie's domain AND the top-level site are whitelisted.
                isWhitelisted = whitelist.some(p => domainMatches(cookieDomain, p)) &&
                                whitelist.some(p => domainMatches(topLevelSite, p));
                // Blacklisted if EITHER the cookie's domain OR the top-level site is blacklisted.
                isBlacklisted = blacklist.some(p => domainMatches(cookieDomain, p)) ||
                                blacklist.some(p => domainMatches(topLevelSite, p));
            } else {
                // Standard logic for non-partitioned cookies.
                isWhitelisted = whitelist.some(p => domainMatches(cookieDomain, p));
                isBlacklisted = blacklist.some(p => domainMatches(cookieDomain, p));
            }

            // A cookie is deleted if it's on the blacklist OR if it's not on the whitelist.
            const shouldDelete = isBlacklisted || !isWhitelisted;

            if (shouldDelete) {
                const url = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain + cookie.path;
                const removalOptions = { url: url, name: cookie.name };
                if (isPartitioned) {
                    removalOptions.partitionKey = cookie.partitionKey;
                }
                removalPromises.push(chrome.cookies.remove(removalOptions));
            }
        }

        await Promise.all(removalPromises);
        console.log("Precise cookie clearing process completed.");
    }

}

/**
 * Clears other browsing data (non-cookie) by calling individual removal functions.
 * @param {Object} dataTypes - An object of data types to clear.
 * @param {Object} dataTypeOverrides - An object indicating which data types should ignore the whitelist.
 * @param {string[]} whitelist - The original whitelist with potential wildcards.
 */
async function clearOtherData(dataTypes, dataTypeOverrides, whitelist) {
    const excludedOrigins = getExcludedOrigins(whitelist);
    const baseOptions = { "excludeOrigins": excludedOrigins };

    console.log("Clearing other site data. Whitelist will be ignored for types marked with override. Excluded origins for others:", excludedOrigins.length > 0 ? excludedOrigins : "None");

    // Create a list of promises for all the data removal tasks.
    const removalPromises = [];
    const logError = (type) => (err) => console.error(`Failed to clear ${type}:`, err.message || err);

    // Helper to decide which options to use for a given data type.
    // If override is true, use {} to clear all. Otherwise, use the options with exclusions.
    const getOptionsFor = (type) => (dataTypeOverrides[type] ? {} : baseOptions);

    if (dataTypes.cache) removalPromises.push(chrome.browsingData.removeCache(getOptionsFor('cache')).then(() => console.log("Cache cleared.")).catch(logError('Cache')));
    if (dataTypes.localStorage) removalPromises.push(chrome.browsingData.removeLocalStorage(getOptionsFor('localStorage')).then(() => console.log("Local Storage cleared.")).catch(logError('Local Storage')));
    if (dataTypes.indexedDB) removalPromises.push(chrome.browsingData.removeIndexedDB(getOptionsFor('indexedDB')).then(() => console.log("IndexedDB cleared.")).catch(logError('IndexedDB')));
    if (dataTypes.fileSystems) removalPromises.push(chrome.browsingData.removeFileSystems(getOptionsFor('fileSystems')).then(() => console.log("File Systems cleared.")).catch(logError('File Systems')));
    if (dataTypes.webSQL) removalPromises.push(chrome.browsingData.removeWebSQL(getOptionsFor('webSQL')).then(() => console.log("WebSQL cleared.")).catch(logError('WebSQL')));

    // History and Downloads do not respect origin-based exclusion.
    if (dataTypes.history) removalPromises.push(chrome.browsingData.removeHistory({}).then(() => console.log("History cleared.")).catch(logError('History')));
    if (dataTypes.downloads) removalPromises.push(chrome.browsingData.removeDownloads({}).then(() => console.log("Downloads cleared.")).catch(logError('Downloads')));
    if (dataTypes.formData) removalPromises.push(chrome.browsingData.removeFormData({}).then(() => console.log("Form Data cleared.")).catch(logError('Form Data')));
    if (dataTypes.passwords) removalPromises.push(chrome.browsingData.removePasswords({}).then(() => console.log("Passwords cleared.")).catch(logError('Passwords')));

    await Promise.all(removalPromises);
    console.log("Non-cookie data clearing process completed.");
}

/**
 * The core cleaning logic. Fetches settings and clears data.
 */
async function performCleaning() {
    const items = await chrome.storage.sync.get({
        whitelist: [],
        blacklist: [],
        dataTypes: { "cookies": true, "partitionedCookies": false },
        dataTypeOverrides: {},
    });

    const { whitelist, blacklist, dataTypes, dataTypeOverrides } = items;
    console.log('newBroom Whitelist:', whitelist, 'Overrides:', dataTypeOverrides);
    console.log('newBroom Blacklist:', blacklist);
    console.log('newBroom Data to remove:', dataTypes);

    const clearingPromises = [];
    // Handle cookies if either standard or partitioned clearing is enabled.
    if (dataTypes.cookies || dataTypes.partitionedCookies) {
        clearingPromises.push(clearCookiesWithRules(whitelist, blacklist, dataTypes.cookies, dataTypes.partitionedCookies));
    }

    // Handle other data types with the standard API
    clearingPromises.push(clearOtherData(dataTypes, dataTypeOverrides, whitelist));

    await Promise.all(clearingPromises);
    console.log("All clearing tasks have been completed.");
}

/**
 * Gatekeeper function for automatic clearing. Checks if the extension is enabled.
 */
async function clearAllDataIfEnabled() {
    const { extensionEnabled } = await chrome.storage.sync.get({
        extensionEnabled: false
    });

    // If the extension is disabled, do nothing.
    if (!extensionEnabled) {
        console.log("newBroom automatic cleaning is disabled. No data will be cleared.");
        return;
    }
    
    console.log("Last browser window closed. Clearing site data with newBroom...");
    await performCleaning();
}

/**
 * Listens for a window to be closed. If it's the last window,
 * it triggers the data clearing process.
 */
chrome.windows.onRemoved.addListener(async () => {
    const allWindows = await chrome.windows.getAll({});
    if (allWindows.length === 0) await clearAllDataIfEnabled();
});

/**
 * Listens for messages from other parts of the extension, like the popup.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "cleanNow") {
        console.log("'Clean Now' requested from popup.");
        // Trigger the cleaning process. We add a .catch() to handle potential errors
        // since this is a "fire-and-forget" async call.
        performCleaning().catch(err => console.error("Error during 'Clean Now' process:", err));

        sendResponse({ message: "Cleaning initiated!" });
    }
    // Return false because we are sending the response synchronously (or not at all for other messages).
    // This tells Chrome it can close the message channel.
    return false;
});

console.log("newBroom extension loaded with wildcard support.");
