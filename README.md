# webpack-usage-example
An example how to use OpenSheetMusicDisplay within a Webpack build. Uses TypeScript.

## Usage
```
$ npm install
$ npm start
```

Now you can browse to http://127.0.0.1:8080 and see your running instance of
OpenSheetMusicDisplay.

If you decided to play around and make changes, you can trigger a rebuild anytime using
```
$ npm run webpack
```

## Project structure
* `index.ts` - the application's entry point, contains all sources
* `webpack.config.js` - Webpack configuration
* `tsconfig.json` - TypeScript compiler configuration
* `MuzioClementi_SonatinaOpus36No1_Part1.xml` - the MusicXML file to be displayed

### Build artifacts
* `dist/` - directory containing all build artifacts, will be served on `npm start`
