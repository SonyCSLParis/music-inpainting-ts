# interactive score interface
DeepBach Electron application.

## Usage
Install the [OpenSheetMusicDisplay fork](https://github.com/SonyCSLParis/opensheetmusicdisplay) which allows to have access to internal private variables such as the displayed elements.
```
$ yarn link (in the opensheetmusicdisplay fork directory)
$ yarn link opensheetmusicdisplay (in interactive-score-interface directory)
$ yarn dev
```

It requires that the Flask server from [interactive-deep-bach](https://github.com/FlowMachinesStudio/interactive-deep-bach) is running.
