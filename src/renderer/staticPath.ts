const isDevelopment = process.env.NODE_ENV !== 'production'

// variable gets created by electron-webpack
// points to the `static` resources directory
declare var __static;
// HACK(theis): fix __static pointing to the absolute path of the directory
// on the webpack-dev-server
export let static_correct;
if (isDevelopment) {
    static_correct = '';  // static/ directory is being served on the WDS port
}
else {
    static_correct = __static;
}
