![alt text](nonoto_logo.png)

NOTONO is an A.I.-powered sound editor. It allows users to edit sound in a graphical, Paint-like approach.

NONOTO is distributed as an [Electron](https://electronjs.org/) app and as a web application.

## Installation

### Manual installation

We recommended using the `nvm` installation manager for Node.js, available
[here](https://github.com/nvm-sh/nvm#installing-and-updating).
NOTONO is currently developed with Node.js version `14.5.0`.

We use the `yarn` package manager, you can install it [here](https://classic.yarnpkg.com/fr/docs/install/).

NOTONO can then be installed as follows:

```
git clone https://github.com/SonyCSLParis/NONOTO.git
cd NONOTO
git checkout spectrogram
yarn install
```

Once, this is done, the NOTONO dev server (an Electron app with live-reloading) can be started with
```
yarn dev
```

Alternatively, a web server can be created to serve the application over http:
```
yarn build:notono_web
yarn serve:web
```
By default, NOTONO uses the port 8080.
We recommend to use Chrome, but Firefox has been tested to work as well.

### Electron application
*Not up-to-date*

You can download MacOS and Linux standalone applications
[here](https://github.com/SonyCSLParis/NONOTO/releases).

## Configuration

Some configuration options can be set in the `config.json` file at the root of the project.
In particular, you can change the default parameters for the computation back-end, by setting values
for the `'server_ip'` and `'server_port'` keys.

## Issues
An up-to-date version of libstdc++6 may be needed to run the linux AppImage.
```
sudo add-apt-repository ppa:ubuntu-toolchain-r/test
sudo apt-get update
sudo apt-get upgrade libstdc++6
```

## Credits

Icons made by [Freepik](https://www.flaticon.com/authors/freepik) from [www.flaticon.com].
