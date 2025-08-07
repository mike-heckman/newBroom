import './style.css';

// Define all possible data types that can be cleared.
const ALL_DATA_TYPES = [
    { id: 'cookies', name: 'Cookies' },
    { id: 'partitionedCookies', name: 'Partitioned Cookies' },
    { id: 'localStorage', name: 'Local Storage' },
    { id: 'cache', name: 'Cache' },
    { id: 'indexedDB', name: 'IndexedDB' },
    { id: 'fileSystems', name: 'File Systems' },
    { id: 'webSQL', name: 'WebSQL' },
    { id: 'history', name: 'Browsing History' },
    { id: 'downloads', name: 'Download History' },
    { id: 'formData', name: 'Form Data' },
    { id: 'passwords', name: 'Passwords' },
];

// Generate a default dataTypes object from the master list.
const DEFAULT_DATA_TYPES = ALL_DATA_TYPES.reduce((acc, type) => {
    // Default 'cookies' to true, others to false.
    acc[type.id] = type.id === 'cookies';
    return acc;
}, {});

/**
 * Saves options to chrome.storage.sync.
 */
function saveOptions() {
    // Get domains from textareas, split by new lines, trim whitespace, and filter out empty lines.
    const whitelist = document.getElementById('whitelist').value.split('\n').map(s => s.trim()).filter(Boolean);
    const blacklist = document.getElementById('blacklist').value.split('\n').map(s => s.trim()).filter(Boolean);

    // Get the selected data types from the checkboxes.
    const dataTypes = {};
    ALL_DATA_TYPES.forEach(type => {
        const checkbox = document.getElementById(type.id);
        if (checkbox) {
            dataTypes[type.id] = checkbox.checked;
        }
    });

    // Save to synchronized storage.
    chrome.storage.sync.set({ whitelist, blacklist, dataTypes }, () => {
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.textContent = 'Settings saved!';
        status.classList.remove('opacity-0');
        setTimeout(() => {
            status.classList.add('opacity-0');
        }, 2000);
    });
}

/**
 * Builds the dynamic UI elements for the options page.
 */
function buildUI() {
    const dataTypesContainer = document.getElementById('dataTypes');

    // Dynamically create checkboxes for each data type.
    ALL_DATA_TYPES.forEach(type => {
        const itemContainer = document.createElement('div');

        const label = document.createElement('label');
        label.className = 'flex items-center space-x-3 p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition cursor-pointer';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = type.id;
        checkbox.className = 'h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500';

        const span = document.createElement('span');
        span.className = 'text-gray-700 font-medium';
        span.textContent = type.name;

        label.appendChild(checkbox);
        label.appendChild(span);
        itemContainer.appendChild(label);

        // Add a special note for partitioned cookies as requested.
        if (type.id === 'partitionedCookies') {
            const note = document.createElement('p');
            note.className = 'text-xs text-gray-500 ml-4 mt-1 px-2';
            note.innerHTML = 'Note: Due to Chrome API limitations, whitelisting a site protects its partitioned cookies, but complex cross-site rules do not apply. <a href="https://privacysandbox.google.com/cookies/chips" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">Learn more about CHIPS</a>.';
            itemContainer.appendChild(note);
        }

        dataTypesContainer.appendChild(itemContainer);
    });
}

/**
 * Restores options from chrome.storage.sync and populates the UI.
 */
function restoreOptions() {
    // Fetch saved settings from storage.
    chrome.storage.sync.get({
        whitelist: [],
        blacklist: [],
        dataTypes: DEFAULT_DATA_TYPES
    }, (items) => {
        // Populate the textareas.
        document.getElementById('whitelist').value = items.whitelist.join('\n');
        document.getElementById('blacklist').value = items.blacklist.join('\n');
        
        // Check the boxes for the saved data types.
        for (const typeId in items.dataTypes) {
            const checkbox = document.getElementById(typeId);
            if (checkbox) {
                checkbox.checked = items.dataTypes[typeId];
            }
        }
    });
}

// Add event listeners once the DOM is loaded.
document.addEventListener('DOMContentLoaded', () => {
    buildUI();
    restoreOptions();
});
document.getElementById('save').addEventListener('click', saveOptions);
