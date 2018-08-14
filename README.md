# interactive score interface
DeepBach Electron and web application.

## Usage
Install the [OpenSheetMusicDisplay fork](https://github.com/SonyCSLParis/opensheetmusicdisplay) which allows to have access to internal private variables such as the displayed elements.

It requires that the Flask server from
[interactive-deep-bach](https://github.com/FlowMachinesStudio/interactive-deep-bach)
is running.
You should edit the configuration file at `src/common/config.json` and set
the `server_ip` and `*_port` values to the appropriate values for your Flask
server (e.g. `serverip = "localhost", chorale_port=5001`).

### Developing / interactive development server

To launch the Electron application:

```bash
$ yarn link (in the opensheetmusicdisplay fork directory)
$ yarn link opensheetmusicdisplay (in interactive-score-interface directory)
$ yarn dev
```

This uses `electron-webpack`, which provides default configurations for using
Webpack to develop Electron applications.

### Building

You can either compile and build the whole application as a packaged Electron
app or bundle the client side code for usage as a standard web application
(this is the way to go for mobile usage).
The different build targets are provided as yarn scripts in the `package.json`
file.

#### Build and package Electron application

This uses the `electron-builder` npm package which pre-configures most of the
things.

```bash
$ yarn compile && yarn dist
```

*Gotcha*: Do not forget to `yarn compile` before calling `yarn dist`, otherwise
`electron-builder` might just use the development bundle created by `yarn dev`,
which would result in bugs (because `yarn dist` expects code bundled with the
webpack option `mode: "PRODUCTION"`, which disables various development tools).

#### Build as web bundle

```bash
$ yarn build:web  # builds the client into the `web/dist` directory
```
