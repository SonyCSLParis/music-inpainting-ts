import 'common/styles/overlays.scss';

export class AnnotationBox {
    readonly containedQuarterNotes: number[];

    constructor(timestampContainer: string|HTMLElement, cssClass: string) {
        // Store container element
        if (typeof timestampContainer === "string") {
            // ID passed
            this.timestampContainer = document.getElementById(<string>timestampContainer);
        } else if (timestampContainer && "appendChild" in <any>timestampContainer) {
            // Element passed
            this.timestampContainer = <HTMLElement>timestampContainer;
        }
        if (!this.timestampContainer || this.timestampContainer.getAttribute('containedquarternotes') === undefined) {
            throw new Error("Please pass a valid timestamp container for the annotation box");
        }
        this.validateTimestampContainer()

        this.containedQuarterNotes = (() => {
            let containedQuarters_str = (
                this.timestampContainer.getAttribute('containedquarternotes'));
                let containedQuarters_strlist: string[] = containedQuarters_str.split(' ');
                let containedQuarterNotes = containedQuarters_strlist.map(parseInt);
                return containedQuarterNotes;
            })();

        this.cssClass = cssClass;
        this.createContainer();
    }

    protected timestampContainer: HTMLElement;
    protected validateTimestampContainer(): void {};

    public container: HTMLDivElement;
    readonly cssClass: string;

    // create containing div,
    private createContainer(): void {
        const containerId = this.timestampContainer.id + '-' + this.cssClass
        let containerByID = <HTMLDivElement>document.getElementById(containerId)
        let containerExistsInitially = containerByID !== null
        this.container = (containerByID || document.createElement("div"));
        this.container.id = containerId
        this.container.classList.add(this.cssClass);

        // let containedQuarters_str: string = this.timestampContainer.getAttribute('containedquarternotes')
        // this.container.setAttribute('containedquarternotes', containedQuarters_str);

        if (!containerExistsInitially) {
            this.timestampContainer.appendChild(this.container);
        }
    };

    public draw(): void {
        throw new EvalError("Not implemented, please subclass the draw function");
    };
}
