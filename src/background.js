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
    const allCookiesPromises = cookieStores.map(store => chrome.cookies.getAll({ storeId: store.id }));
    const cookies = (await Promise.all(allCookiesPromises)).flat();

    console.log(`Total cookies found across all stores: ${cookies.length}`);

    // --- FINAL DIAGNOSTIC LOG ---
    // This will check each cookie store individually to see if the API can find the cookies there.
    for (const store of cookieStores) {
        const diagnosticCookies = await chrome.cookies.getAll({ domain: "youtube.com", storeId: store.id });
        console.log(`[DIAGNOSTIC for store ${store.id}] Found ${diagnosticCookies.length} cookies for "youtube.com":`, diagnosticCookies);
    }

    if (!cookies || cookies.length === 0) {
        console.log("No cookies to process.");
        return;
    }

    const removalPromises = [];
    for (const cookie of cookies) {
        const isPartitioned = !!cookie.partitionKey;

        const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
        let isWhitelisted = false;
        let isBlacklisted = false;

        // Always log the cookie when it's found for better debugging visibility.
        const topLevelSite = isPartitioned && cookie.partitionKey.topLevelSite ? `on ${cookie.partitionKey.topLevelSite}` : '';
        // More detailed log to inspect the raw cookie object
        console.log(`Found cookie: ${cookie.name} from ${cookieDomain} ${topLevelSite}`, {
            isPartitioned: isPartitioned,
            rawCookie: cookie
        });
        
        // Now, check if we should skip processing based on user settings.
        if ((isPartitioned && !clearPartitioned) || (!isPartitioned && !clearStandard)) {
            console.log(` -> Skipping: Clearing for this cookie type is disabled in settings.`);
            continue;
        }

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
            console.log(` -> Action: Deleting. (Whitelisted: ${isWhitelisted}, Blacklisted: ${isBlacklisted})`);
        } else {
            console.log(` -> Action: Keeping. (Whitelisted: ${isWhitelisted}, Blacklisted: ${isBlacklisted})`);
        }
    }

    await Promise.all(removalPromises);
    console.log("Cookie clearing process completed based on wildcard rules.");
}

/**
 * Clears other browsing data (non-cookie) by calling individual removal functions.
 * @param {Object} dataTypes - An object of data types to clear.
 * @param {string[]} whitelist - The original whitelist with potential wildcards.
 */
async function clearOtherData(dataTypes, whitelist) {
    // The browsingData API requires origins (e.g., "https://example.com"), not just hostnames.
    // We'll convert each valid hostname from the whitelist into http and https origins.
    const excludedOrigins = whitelist.reduce((acc, domain) => {
        let hostname = domain;
        // If it starts with '*.', remove it for the API call.
        if (hostname.startsWith('*.')) {
            hostname = hostname.substring(2);
        }

        // The API does not support wildcards in origins, so we only process valid hostnames.
        if (!hostname.includes('*')) {
            acc.push(`http://${hostname}`);
            acc.push(`https://${hostname}`);
        } else {
            // Log the rejected domain because it's not a valid hostname for this API.
            console.log(`Rejected invalid whitelist entry for non-cookie data (contains '*'): "${domain}"`);
        }
        return acc;
    }, []);

    // The correct property is `excludeOrigins`. The API does not support `excludeHostnames`.
    const options = { "excludeOrigins": excludedOrigins };

    console.log("Clearing other site data, excluding origins:", excludedOrigins);

    // Create a list of promises for all the data removal tasks.
    const removalPromises = [];
    if (dataTypes.cache) removalPromises.push(chrome.browsingData.removeCache(options).then(() => console.log("Cache cleared.")));
    if (dataTypes.localStorage) removalPromises.push(chrome.browsingData.removeLocalStorage(options).then(() => console.log("Local Storage cleared.")));
    if (dataTypes.indexedDB) removalPromises.push(chrome.browsingData.removeIndexedDB(options).then(() => console.log("IndexedDB cleared.")));
    if (dataTypes.fileSystems) removalPromises.push(chrome.browsingData.removeFileSystems(options).then(() => console.log("File Systems cleared.")));
    if (dataTypes.webSQL) removalPromises.push(chrome.browsingData.removeWebSQL(options).then(() => console.log("WebSQL cleared.")));
    if (dataTypes.history) removalPromises.push(chrome.browsingData.removeHistory({}).then(() => console.log("History cleared.")));
    if (dataTypes.downloads) removalPromises.push(chrome.browsingData.removeDownloads({}).then(() => console.log("Downloads cleared.")));
    if (dataTypes.formData) removalPromises.push(chrome.browsingData.removeFormData({}).then(() => console.log("Form Data cleared.")));
    if (dataTypes.passwords) removalPromises.push(chrome.browsingData.removePasswords({}).then(() => console.log("Passwords cleared.")));

    await Promise.all(removalPromises);
    console.log("Non-cookie data clearing process completed.");
}


/**
 * Main function to orchestrate the clearing process.
 */
async function clearAllData() {
    const items = await chrome.storage.sync.get({
        whitelist: [],
        blacklist: [],
        dataTypes: { "cookies": true, "partitionedCookies": false }
    });

    const { whitelist, blacklist, dataTypes } = items;
    console.log('newBroom Whitelist:', whitelist);
    console.log('newBroom Blacklist:', blacklist);
    console.log('newBroom Data to remove:', dataTypes);

    const clearingPromises = [];
    // Handle cookies if either standard or partitioned clearing is enabled.
    if (dataTypes.cookies || dataTypes.partitionedCookies) {
        clearingPromises.push(clearCookiesWithRules(whitelist, blacklist, dataTypes.cookies, dataTypes.partitionedCookies));
    }

    // Handle other data types with the standard API
    clearingPromises.push(clearOtherData(dataTypes, whitelist));

    await Promise.all(clearingPromises);
    console.log("All clearing tasks have been completed.");
}


/**
 * Listens for a window to be closed. If it's the last window,
 * it triggers the data clearing process.
 */
chrome.windows.onRemoved.addListener(async () => {
    const windows = await chrome.windows.getAll({});
    if (windows.length === 0) {
        console.log("Last browser window closed. Clearing site data with newBroom...");
        await clearAllData();
    }
});

/**
 * Listens for messages from other parts of the extension, like the popup.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "cleanNow") {
        console.log("'Clean Now' requested from popup.");
        // Trigger the cleaning process but don't wait for it to finish to send a response.
        // This gives the user immediate feedback.
        clearAllData(); 
        sendResponse({ message: "Cleaning initiated!" });
    }
    return false; // We are not sending a response asynchronously.
});

console.log("newBroom extension loaded with wildcard support.");
