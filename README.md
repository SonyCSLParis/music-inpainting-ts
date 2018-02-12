# interactive score interface
Node.js server to display xml files and interact with them.
It is a fork from [webpack-usage-example](https://github.com/opensheetmusicdisplay/webpack-usage-example)
An example how to use OpenSheetMusicDisplay within a Webpack build. Uses TypeScript.

## Usage
```
$ npm install
$ npm start
```

Now you can browse to http://127.0.0.1:8080 and see your running instance of
the interactive score interface.

If you decided to play around and make changes, you can trigger a rebuild anytime using
```
$ npm run webpack
```

## Project structure
* `index.ts` - the application's entry point, contains all sources
* `webpack.config.js` - Webpack configuration
* `tsconfig.json` - TypeScript compiler configuration

### Build artifacts
* `dist/` - directory containing all build artifacts, will be served on `npm start`


