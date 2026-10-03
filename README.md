# Nearby BLE

A simple Vite + React app to select, connect to, and disconnect from Bluetooth Low Energy devices.

## Run

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite in a browser supporting Web Bluetooth (for example Chrome on macOS, Windows, or Android).

```sh
npm run build
npm run preview
```

## Bluetooth behavior

- **Find a device** opens the browser's nearby-device picker. Select a device to add it to the list, then press **Connect**.
- The website cannot silently enumerate all nearby devices. Only selected or previously permitted devices appear in the app.
- Previously permitted devices are restored if the browser supports `getDevices()`. They are not necessarily currently nearby.
- Requires a secure context: localhost for development, HTTPS for deployment. HTTP over a LAN IP is insufficient.
- Grant browser and operating-system Bluetooth permissions, and make sure the peripheral is advertising and available for a connection.
- This connects to BLE GATT servers and writes to characteristics. Bluetooth Classic audio devices are not supported.

Bluetooth reference: https://developer.chrome.com/docs/capabilities/bluetooth

## Send data

1. Enter the target service UUID above the device list before selecting the device. For an existing device, select it again to grant access to that service.
2. Connect, then enter the service and writable characteristic UUIDs in its Send data panel. Get these UUIDs from your device’s firmware or documentation.
3. Choose UTF-8 text or hex byte pairs, and a write mode supported by the characteristic.
4. Press **Send data**. With-response writes report the device acknowledgement; without-response writes only report submission, not receipt or application processing.

Text is sent exactly as entered, with no automatic newline. Hex accepts whitespace-separated byte pairs or contiguous pairs. Each write is limited to 512 bytes; devices may require smaller payloads. Messages are not automatically split, to avoid changing the device protocol.

Run `npm test` for UUID validation, payload encoding, and mocked GATT write checks. Hardware writes require manual testing on a compatible BLE device.

## Alarm clock preset

The UI defaults to Nathaniel’s Alarm Clock service `4fafc201-1fb5-459e-8fcc-c5c9c331914b` and characteristic `beb5483e-36e1-4688-b7f5-ea07361b26a8`, using writes with a response. Both UUIDs remain editable.

The supplied Arduino sketch exposes a writable characteristic but does not register an `onWrite` callback, so writes do not trigger the buzzer or LED. Its loop also overwrites the characteristic with a four-byte counter every 500 ms while connected. Firmware command handling is needed to act on received messages.

## Deploy to GitHub Pages

Repository: https://github.com/TrackerJo/alarm

Website: https://trackerjo.github.io/alarm/

GitHub Pages is already configured to publish from `deploy` for this repository. For future website updates, run `npm run deploy`. Push source changes to `main` separately when you want to save them on GitHub.

The project must be a Git repository with an `origin` remote pointing to your GitHub repository. Authenticate Git pushes with SSH or your GitHub credential helper.

For a new repository, initialize it and add your own repository URL:

```sh
git init
git add .
git commit -m "Create BLE website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Publish the website:

```sh
npm run deploy
```

This automatically builds the app and pushes only the built `dist` contents to the **deploy** branch. It does not switch your working branch. Relative asset URLs support both repository Pages sites and root Pages sites. The branch is reserved for generated website files; subsequent deployments replace its published contents.

After the first deployment, open the repository’s **Settings → Pages** and select:

- Source: **Deploy from a branch**
- Branch: **deploy**
- Folder: **/ (root)**

Save once. Future `npm run deploy` pushes trigger GitHub Pages publication automatically. The usual project URL is `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`; GitHub displays the actual URL in Pages settings. GitHub Pages HTTPS supports Web Bluetooth in compatible browsers.

Reference: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
