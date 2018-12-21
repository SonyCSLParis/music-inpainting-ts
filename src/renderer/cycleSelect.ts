// Create select element with a list of icons

import * as path from 'path';

import '../common/styles/cycleSelect.scss';

export class CycleSelect {
    static containerCssClass: string = 'CycleSelect-container';
    static innerContainerCssClass: string = 'CycleSelect-inner-container';
    static visibleCssClass: string = 'CycleSelect-visible';

    readonly containerElement: HTMLElement;
    readonly innerContainerElement: HTMLDivElement;
    readonly onchangeCallback: EventListenerObject;
    readonly basePath: string;
    readonly icons: Map<string, string>;
    readonly options: string[];

    private _selectElem: HTMLSelectElement;

    constructor(containerElement: HTMLElement,
        selectElemID: string,
        onchangeCallback: EventListenerObject,
        icons: Map<string,string>, basePath: string='') {
            if (!(icons.size > 0)) {
                // TODO define specific error object
                throw Error("Must provide a non-empty list of options");
            }
            if (containerElement.id === '') {
                // TODO define specific error object
                throw Error("Must set an id for the provided container element");
            }

            let self = this;
            // the icons are a key-value map where the key is the option name and
            // the value is the path to the icon
            this.containerElement = containerElement;
            this.containerElement.classList.add(CycleSelect.containerCssClass);
            this.innerContainerElement = document.createElement('div');
            this.innerContainerElement.classList.add(
                CycleSelect.innerContainerCssClass);
            this.containerElement.appendChild(this.innerContainerElement);

            this._selectElem = document.createElement('select');
            this._selectElem.style.visibility = 'hidden';
            this._selectElem.id = selectElemID;
            this.innerContainerElement.appendChild(this._selectElem);

            let copyCallback = onchangeCallback;
            copyCallback.handleEvent = copyCallback.handleEvent.bind(this);
            this.onchangeCallback = copyCallback;

            this.icons = icons;
            this.basePath = basePath;
            this.options = Array.from(this.icons.keys());

            this.populateSelect();
            this.populateContainer();

            this._selectElem.addEventListener('change', (e) => {
                self.updateVisuals();
                self.onchangeCallback.handleEvent.bind(self._selectElem)(e);
            });
            this.innerContainerElement.addEventListener('click',
                (e: MouseEvent) => {
                    self.selectNextOption.bind(self)();
                }
            )

            this.value = this.options[0];
        };

    private makeOptionId(key: string): string {
        // create an id for an <option> element
        return this.containerElement.id + '--' + key;
    }

    public get value(): string {
        // return the name of the currently selected option
        return this.options[parseInt(this._selectElem.value)];
    }

    public set value(newValue: string) {
        // set the value of the <select> element and update the visuals
        if (!(this.options.includes(newValue))) {
            throw EvalError('Unauthorized value ' + newValue + ' for CycleSelector');
        };
        this._selectElem.value = this.options.indexOf(newValue).toString();
        this._selectElem.dispatchEvent(new Event('change'));
    }

    private updateVisuals() {
        // display icon for the current option and hide all others
        $(`#${this.containerElement.id} img`).removeClass(CycleSelect.visibleCssClass);

        this.getCurrentElement().classList.toggle(CycleSelect.visibleCssClass,
            true);
    };

    private getCurrentElement(): HTMLElement {
        // return the currently selected element
        return <HTMLElement>document.getElementById(this.makeOptionId(this.value));
    }

    private populateContainer(): void {
        // append all images as <img> to the container
        let self = this;
        this.icons.forEach((iconPath, iconName) => {
            let imageElem = document.createElement('img');
            imageElem.id = this.makeOptionId(iconName);
            imageElem.src = path.join(this.basePath, iconPath);
            self.innerContainerElement.appendChild(imageElem);
        })
    };

    private populateSelect(): void {
        // append all options to the inner <select> element
        let self = this;
        this.options.forEach((optionName, optionIndex) => {
            let newOption = document.createElement('option');
            newOption.value = optionIndex.toString();
            newOption.textContent = optionName;
            self._selectElem.appendChild(newOption);
        })
    }

    private selectNextOption(): void {
        // select the next option in the list, cycle to the beginning if needed
        const currentOptionIndex: number = this.options.indexOf(this.value);
        const newIndex: number = (currentOptionIndex+1) % this.options.length;
        this.value = this.options[newIndex];
    }
}
