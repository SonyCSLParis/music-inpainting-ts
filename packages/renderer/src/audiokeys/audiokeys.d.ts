import AudioKeys from 'audiokeys';
export default class FocusedAudioKeys extends AudioKeys {
    readonly focusElement: Document | HTMLElement;
    constructor(options: {
        focusElement?: HTMLElement;
    } & Partial<AudioKeysOptions>);
    get isInFocus(): boolean;
    protected _bind(): void;
}
