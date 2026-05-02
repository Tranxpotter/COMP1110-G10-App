# How to run on mobile

## Using Android to run directly with APK(Easiest Suggested way)
[Click this link to directly install the apk and run the application](https://expo.dev/artifacts/eas/3Hdvc7b1QJw5FHcuxBdYwe.apk)

If this link failed, go to folder named Android APL and directly download the APK file inside, note it is the same apk file on the link.

If you don't have an Android, consider using emulators. You can do so by installing Android studio and using the default emulators. Here is the [link](https://developer.android.com/studio/run/emulator) to the guide. If you don't have android studio, go to [Get started with Android studio](https://developer.android.com/studio/install) to install first.

#### Note this is the easiest way to test our app, after downloading you can directly use the app, and the following steps can be ignored.


## Download App from github(not recommended)
    First download the whole project file from github

### Install Required Packages
To Install the required packages, we need to have npm installed which require the installation of node.js, you can do so by following the guide in the link below

[Guide link](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

Go to terminal or cmd, go to the project file directly

```bash
cd <path to project file>
```

Then run npm force install, as we already have a package.json, this will directly install all the required packages. Note we need to use force because we used some older versions of libraries.

```bash
npm install --f
```

### Download Expo go
Please download the required APP to run our app.
#### Android
[Android download link](https://play.google.com/store/apps/details?id=host.exp.exponent)
#### IOS
[IOS download link](https://apps.apple.com/app/id982107779)

### Run the code
In the project file directory, run this command
```bash
npx expo start
```
This should produce a QR code for you to scan in the terminal


Use normal camera to scan the QR code, it will prompt you to go to the expo go app, and this will load the app and 

When you want to stop, just quite the app and press ctrl+c in terminal.

## Inspecting our source code

Note the main code is in the app, components and hooks folders.