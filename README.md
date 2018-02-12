# interactive score interface
Node.js server to display xml files and interact with them.
It is a fork from [webpack-usage-example](https://github.com/opensheetmusicdisplay/webpack-usage-example).
It's an example how to use the [OpenSheetMusicDisplay fork](https://github.com/FlowMachinesStudio/opensheetmusicdisplay-fork) within a Webpack build. Uses TypeScript. 

## Usage
Install the [OpenSheetMusicDisplay fork](https://github.com/FlowMachinesStudio/opensheetmusicdisplay-fork) which allows to have access to internal private variables such as the displayed elements.
```
$ npm link (in the opensheetmusicdisplay-fork directory)
$ npm link opensheetmusicdisplay (in interactive-score-interface directory)
$ npm run webpack
$ npm start
```

Now you can browse to http://127.0.0.1:8080 and see your running instance of
the interactive score interface. It requires that the Flask server from [interactive-deep-bach](https://github.com/FlowMachinesStudio/interactive-deep-bach) is running.

If you decide to play around and make changes, you can trigger a rebuild anytime using
```
$ npm run webpack
```

## Project structure
* `index.ts` - the application's entry point, contains all sources
* `webpack.config.js` - Webpack configuration
* `tsconfig.json` - TypeScript compiler configuration

### Build artifacts
* `dist/` - directory containing all build artifacts, will be served on `npm start`
