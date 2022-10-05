[![Pianoto-logo](assets/music-inpainting-ts.png)](https://SonyCSLParis.github.io/music-inpainting-ts/)

### :warning: WARNING: History clean-up :fire: :ambulance:

On September 30, 2022, we rewrote the repository's history to remove useless binary blobs, greatly reducing the repository's download size.
If you cloned the repository before then, your clone will have an incompatible history, so please erase this clone and clone it again to get the updated, clean history!

# [Interactive Music Inpainting for the Web](https://SonyCSLParis.github.io/music-inpainting-ts/)


| PIANOTO | NOTONO | NONOTO |
| :-----: | :----: | :----: |
| <img width="700" alt="A screenshot of the PIANOTO interface" src="https://user-images.githubusercontent.com/9104039/193407898-fa4fe8e7-4b4f-4389-83f8-e1f69892cdf6.png"> | <img width="700" alt="A screenshot of the NOTONO interface" src="https://user-images.githubusercontent.com/9104039/193407225-9aad0d6a-ad73-42f5-a339-85a381575a48.png"> | <img width="700" alt="A screenshot of the NONOTO interface" src="https://user-images.githubusercontent.com/9104039/193407575-3e906ebc-03b9-4ad6-9aac-1ed95a1b65e6.png"> |
|**Expressive piano performances** creation|Time-frequency inpainting of **instrument spectrograms**|Inpainting of **music sheet** (*with Ableton-Link support*)|

This repository holds the source code for the web-based, AI-assisted interactive music creation apps developed by Théis Bazin at Sony CSL Paris.
These apps are all based on *inpainting*, that is, the use of AI-models to transform images, sounds or sheets in a *local* fashion: just tell the model which zones of the media you'd like to transform (because you don't like it or because you'd like to see a variation of it!) and it will regenerate it for you. Thanks to the intuitive interactions offered by inpainting, these apps remove the need for cumbersome micro-level edits and work nicely on mobile as well!

#### :warning: BYOB (Bring Your Own Backend)
Note that the `music-inpainting.ts` interfaces each require connection to an AI model for inference!
Don't panic though:
- :tada: We provide compatible models as [Docker images](#running-the-models-locally) (GPU recommended).
- :alembic: The apps are **model-agnostic**: try to use them in conjunction with their own models!

### PIANOTO

**PIANOTO** helps you be the piano maestro that you deserve to be!

It is an A.I.-powered interactive MIDI piano roll, for mobile and desktop. Swipe on the musical representation to regenerate zones, always staying coherent with the context.

https://user-images.githubusercontent.com/9104039/193406815-5adf940a-de74-4bb0-a151-6f3e32ea9b6a.mp4

### NOTONO

**NOTONO** lets you use your visual brain to create instrument sounds.

Your guitar sample is lacking some depth? Paint some subs from an organ into it! Generate new sounds from scratch or drag-and-drop sounds of your choice into NOTONO to edit them.

https://user-images.githubusercontent.com/9104039/193407123-0c03942c-be44-435f-b9c1-633d1a6d5473.mp4

### NONOTO

**NONOTO** is an interactive interface for symbolic sheet music generation and transformation by inpainting.
Along with the DeepBach model by Gaëtan Hadjeres, NONOTO lets you generate 4-part chorale-like music in the style of J.S. Bach. Synchronize the app with Ableton Live via the included Ableton Link support and route the output via MIDI to get a smart, melodic and harmonic 4-channel sequencer. Get creative with the chorales by routing the different voices to custom synthesizers!

Here is a demo video of using NONOTO in sync with Ableton Live via Ableton-Link:

https://user-images.githubusercontent.com/9104039/193407027-44cf7734-8df3-454f-9ac3-ae1cc95d180c.mp4

These apps can be used either as standard web applications or as a packaged [Electron](https://electronjs.org/) app (which brings a few perks such as native drag-out or the support for Ableton-Link).
They all share the same audio engine, based on the Web Audio API through Yotam Mann's [Tone.js](https://github.com/Tonejs/Tone.js/).
They all support MIDI In and Out for interoperability with external software or hardware, via Jean-Philippe Côté's [webmidi.js](https://github.com/djipco/webmidi/) helper library over the Web MIDI API.

## Usage

You can [access the interfaces here](https://SonyCSLParis.github.io/music-inpainting-ts/)!

### Packaged Electron applications (Desktop)

You can download MacOS and Linux standalone applications
[here](https://github.com/SonyCSLParis/NONOTO/releases).

### Manual installation

We recommended using the `nvm` installation manager for Node.js, available
[here](https://github.com/nvm-sh/nvm#installing-and-updating).
The music-inpainting.ts apps are currently developed with `node v18.5.0` and `npm v8.15.0`.

We use the standard `npm` package manager.

The apps can be installed as follows:

```shell
git clone https://github.com/SonyCSLParis/music-inpainting-ts.git
cd music-inpainting-ts
npm install
```

Once this is done, the `music-inpainting.ts` Electron app (with live-reloading enabled for hacking) can be started with:

```shell
npm start
```

## Running the models locally

We **strongly** recommend running these images on a machine equipped with an NVIDIA CUDA-compatible GPU.

|Application|Model|Docker image|
|-----------|----|-----|
|**PIANOTO**|[PIAv3](https://ghadjeres.github.io/piano-inpainting-application/)|`public.ecr.aws/csl-music-team/piano_inpainting_app:v3`|
|**NOTONO**|[NOTONO](https://github.com/SonyCSLParis/interactive-spectrogram-inpainting/)|`public.ecr.aws/csl-music-team/notono:pytorch-1.11.0-cuda11.3-cudnn8-runtime`
|**NONOTO**|[DeepBach](https://github.com/Ghadjeres/DeepBach)|`public.ecr.aws/csl-music-team/deepbach:latest`

### Sample commands (with recommended arguments and parameters)

##### Reminders

* The `docker run` `-p` parameter takes a pair of ports of the form `CONTAINER_PORT:LOCALHOST_PORT`.
* You might need to run the following commands as root depending on your installation of Docker.


The following commands start an inference server with access to the GPU with index `0` and listening on port `5005` (adapt to your own convenience).

Choose the appropriate model, run the command and leave the server running in the background. Then launch the `music-inpainting.ts` interface as described above, set the **Inpainting API address** input field to `http://localhost:5005` and select the appropriate mode, that's it!

#### PIAv3

```shell
docker run -p 5000:5005 --rm --gpus 0 public.ecr.aws/csl-music-team/piano_inpainting_app:v3 serve
```

⚠️ Note the (required) additional `serve` command!

#### NOTONO (the model)

```shell
docker run -p 8000:5005 --rm --gpus 0 public.ecr.aws/csl-music-team/notono:pytorch-1.11.0-cuda11.3-cudnn8-runtime
```

#### DeepBach

```shell
docker run -p 5000:5005 --rm --gpus 0 public.ecr.aws/csl-music-team/deepbach:latest --num_iterations_per_quarter=25 --num_iterations_per_quarter_initial_generate=10
```

## Credits

Some icons used were made by [Freepik](https://www.flaticon.com/authors/freepik) from [www.flaticon.com].

## Acknowledgements

We thank EPITECH students [Martin Leblancs](https://github.com/MartinLeblancs/), [Matthieu Queru](https://github.com/Matthieu33197) and [Sandro Sgro](https://github.com/Aspoing) for their
help on a preliminary version of PIANOTO during a development project at Sony CSL Paris.

This work was supported by the French ANRT through the CIFRE Industrial PhD grant Nr.
2019/0472.
