# newBroom <img src="public/images/icon128.png" width="36" alt="newBroom icon" valign="middle" />

A powerful, configurable Chrome extension for automatically clearing browsing data with precision and control. Sweep away unwanted cookies and site data based on your own rules.

## Key Features

-   **Automatic Cleanup**: Runs automatically to clear data when the last browser window is closed.
-   **Manual Cleanup**: Includes a "Clean Now" button in the popup for on-demand cleaning.
-   **Selective Data Removal**: Choose exactly which types of data to clear, including:
    -   Cookies (Standard & Partitioned)
    -   Local Storage & Cache
    -   IndexedDB, WebSQL, & File Systems
    -   Browsing & Download History
    -   Form Data & Passwords
-   **Powerful Domain Filtering**:
    -   **Whitelist**: Protect data from your favorite and essential sites.
    -   **Blacklist**: Force-delete data from specific domains, which overrides any whitelist rules.
    -   **Wildcard Support**: Easily manage subdomains with patterns like `*.example.com`.
-   **Advanced Cookie Control**:
    -   Independently manage standard and partitioned (CHIPS) cookies.
    -   Applies sophisticated rules to partitioned cookies, considering both the cookie's origin and the top-level site it was created on.
    -   Scans all available cookie stores, ensuring cleanup across all user profiles and containers.
-   **User-Friendly Configuration**: A clean and simple options page to manage all your settings.

## How It Works

The core of newBroom is its rule-based engine that runs when you close your last browser window or click "Clean Now".

1.  **Blacklist First**: The extension first checks if a cookie or data item belongs to a domain on your blacklist. If it does, it's marked for deletion, no matter what.
2.  **Whitelist Check**: If the item is not on the blacklist, the extension checks if it belongs to a domain on your whitelist. If it's **not** on the whitelist, it's marked for deletion.

In short: **Everything is deleted unless it is on the whitelist, but the blacklist always wins.**

This allows you to put *.example.com on the whitelist but still remove cookies in ads.example.com by placing it on the blacklist.

> #### A Note on API Limitations
>
> Due to the design of Chrome's `browsingData` API, the advanced filtering logic (wildcards, blacklist overriding whitelist) applies with the highest precision to **cookies**. For other data types like Local Storage and Cache, the whitelist protects the entire origin (e.g., `https://example.com`), but the more complex rules cannot be applied.

## Installation & Development

To run this extension locally:
Find the repo here: https://github.com/mike-heckman/newBroom
1.  **Clone the repository:**
    ```sh
    git clone https://github.com/mike-heckman/newBroom.git
    cd newBroom
    ```

2.  **Install dependencies:**
    This project uses `vite` and `tailwindcss` for the options page UI.
    ```sh
    npm install
    ```

3.  **Build the extension:**
    This command will compile the necessary files into a `dist` directory.
    ```sh
    npm run build
    ```

4.  **Load the extension in Chrome:**
    -   Open Google Chrome and navigate to `chrome://extensions`.
    -   Enable "Developer mode" using the toggle in the top-right corner.
    -   Click the "Load unpacked" button.
    -   Select the `dist` directory that was created in the previous step.

## Configuration

After installing, you can configure the extension by right-clicking the newBroom icon in your Chrome toolbar and selecting "Options".

**Important:** By default, newBroom is disabled to prevent accidental data loss. You must first enable it from the options page using the "Enable newBroom" toggle.

On the options page, you can:
-   **Manage Whitelisted/Blacklisted Domains**: Add or remove domains, one per line.
-   **Select Data to Clear**: Check the boxes for each type of data you want to be removed during cleanup.

All settings are saved automatically as you make changes.

## Data Types Explained

You can choose to clear the following types of data:

*   **Cookies**: Small files websites use to remember your login status, preferences, and tracking information.
*   **Partitioned Cookies**: A special type of cookie (CHIPS) used by embedded services that is isolated to each top-level site to enhance privacy.
*   **Local Storage**: A storage space websites use to save application state and user data without an expiration date.
*   **Cache**: Temporary storage for images, scripts, and other parts of websites to make them load faster on your next visit.
*   **IndexedDB**: A modern database within your browser for storing large amounts of structured data for web applications.
*   **File Systems**: Allows web apps to manage files in a sandboxed part of your computer's file system.
*   **WebSQL**: A deprecated database technology that might still be used by some older websites.
*   **Browsing History**: The list of web pages you have visited.
*   **Download History**: The list of files you have downloaded.
*   **Form Data**: Information you've typed into forms, which is often used for autofill.
*   **Passwords**: Your saved usernames and passwords for various websites.

## Permissions Explained

This extension requests the following permissions to function correctly:

*   **`browsingData`**: The core permission required to clear browsing data like cache, local storage, and history using Chrome's `browsingData` API.
*   **`storage`**: Used to save your whitelist, blacklist, and data type preferences using `chrome.storage.sync`, so your settings are saved across your devices.
*   **`tabs`**: Allows the popup to identify the domain of the currently active tab, so you can easily add it to your whitelist or blacklist.
*   **`cookies`**: Provides access to the `chrome.cookies` API, which is essential for the advanced, rule-based cookie cleaning. This allows the extension to inspect individual cookies and apply your wildcard and blacklist/whitelist rules with precision.
*   **`<all_urls>` (Access to data on all websites)**: This is required for the `chrome.cookies` API to read and remove cookies from any website, as dictated by your settings. The extension needs to be able to scan all cookies to determine which ones to keep or delete based on your rules.

## Privacy Guarantee

newBroom is designed with your privacy as the top priority. **This extension does not collect, store, or transmit any of your personal data or browsing activity to any external servers.**

All data processing happens locally within your browser. Your settings (whitelist, blacklist, and preferences) are saved using `chrome.storage.sync`, which only synchronizes them across your own devices where you are logged into your browser's account. Your information never leaves your control.

## License

This project is licensed under the GNU General Public License v3.0. See the `LICENSE.md` file for full details.
