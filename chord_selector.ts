import { AnnotationBox } from './annotationBox';
import * as $ from 'jquery';

// let raphaelimport: HTMLScriptElement = document.createElement('script')
// raphaelimport.type = 'text/javascript'
// raphaelimport.src = "https://cdn.jsdelivr.net/npm/wheelnav@1.7.1/js/dist/raphael.min.js"
// document.head.appendChild(raphaelimport)
//
// let wheelimport: HTMLScriptElement = document.createElement('script')
// wheelimport.type = 'text/javascript'
// wheelimport.src = "https://cdn.jsdelivr.net/npm/wheelnav@1.7.1/js/dist/wheelnav.min.js"
// document.head.appendChild(wheelimport)

// need to declare these variables which are pouplated by loading wheelnav
// in a <script> tag in the app's html's head
declare var wheelnav : any;
declare var slicePath: any;

export class ChordSelector extends AnnotationBox {
    constructor(timestampContainer: string|HTMLElement, wheelSize_px: number=250) {
        super(timestampContainer);
        this.container.classList.add('noselect')
        this.wheelSize_px = wheelSize_px;
        this.draw();
    }

    protected validateTimestampContainer(): void {
        if (!this.timestampContainer.classList.contains('half-note')) {
            throw new EvalError("Chord selector should be associated to a half-note box");
        };
    }


    private slur_symbol: string = '-'
    private notes: string[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B',
        this.slur_symbol];
    private accidentals: string[] = (() => {
        let accidentals = [];
        for (let i in this.notes) {
            accidentals.push('b');
            accidentals.push('#');
        };
        return accidentals;
    })();
    private chordTypes = ['M', '-', '-7', 'M7', '7'];

    private noteWheel: any;
    private accidentalWheel: any;
    private chordTypeWheel: any;

    private wheelSize_px: number;

    // keep track the previously selected index to detect re-clicks
    // on the same note and don't disaply accidental selector in that case
    private previouslySelectedNoteIndex: number = null;

    private get currentNote() {
        return this.notes[this.noteWheel.selectedNavItemIndex];
    }

    private set currentNote(note: string) {
        let note_index = this.notes.indexOf(note)
        this.noteWheel.navigateWheel(note_index);
    }

    private get currentAccidental() {
        let selectedAccidentalIndex = this.accidentalWheel.selectedNavItemIndex
        if (selectedAccidentalIndex !== null && selectedAccidentalIndex >0) {
            return this.accidentals[selectedAccidentalIndex]
        } else {return ''}
    }

    private set currentAccidental(accidental: string) {
        let accidentalIndex = this.accidentals.indexOf(accidental)
        if (accidentalIndex >= 0) {
            let fullIndex = 2*this.noteWheel.selectedNavItemIndex + accidentalIndex;
            // this.accidentalWheel.navItems[fullIndex].selected = true;
            // this.accidentalWheel.navItems[fullIndex].refreshNavItem();
            // this.accidentalWheel.selectedNavItemIndex = fullIndex;
            this.accidentalWheel.navigateWheel(fullIndex);
        }
        else {
            if (this.accidentalWheel.selectedNavItemIndex !== null && this.accidentalWheel.selectedNavItemIndex >= 0) {
                this.accidentalWheel.navItems[this.accidentalWheel.selectedNavItemIndex].selected = false;
                this.accidentalWheel.navItems[this.accidentalWheel.selectedNavItemIndex].refreshNavItem();
            }
            this.accidentalWheel.selectedNavItemIndex = null;
        }
    }

    private get currentChordType() {
        return this.chordTypes[this.chordTypeWheel.selectedNavItemIndex];
    }

    private set currentChordType(chordType: string) {
        let chordType_index = this.chordTypes.indexOf(chordType)
        this.chordTypeWheel.navigateWheel(chordType_index);
    }

    public get currentChord() {
        return {note: this.currentNote, accidental: this.currentAccidental,
            chordType: this.currentChordType}
    };

    public set currentChord(chord_obj) {
        // FIXME add proper parsing and checks
        this.currentNote = chord_obj['note'];
        if (this.currentNote !== this.slur_symbol) {
            this.currentAccidental = chord_obj['accidental'];
            this.currentChordType = chord_obj['chordType'];
        } else {
            this.currentAccidental = '';
            this.currentChordType = this.chordTypes[0];  // WARNING could break if change to chordTypes list
        };
        this.closeSelector();
    }

    private updateSpreader() {
      let currentNote = this.currentNote;
      var spreaderText = currentNote + this.currentAccidental;
      if (this.currentChordType !== 'M') {
        spreaderText = spreaderText + this.currentChordType;
      }
      this.noteWheel.spreader.inTitle.title = spreaderText;
      this.noteWheel.spreader.outTitle.title = spreaderText;

      this.noteWheel.refreshWheel();
    };

    private hideCurrentAccidentalNavItems() {
      this.accidentalWheel.navItems[2 * this.noteWheel.selectedNavItemIndex].navItem.hide();
      this.accidentalWheel.navItems[2 * this.noteWheel.selectedNavItemIndex+1].navItem.hide();
      // if (self.chordTypeWheel.currentPercent === self.chordTypeWheel.maxPercent) {
      //   self.chordTypeWheel.spreadWheel();
      // };
    };

    private closeNoteWheel() {
        if (this.noteWheel.currentPercent === this.noteWheel.maxPercent) {
            this.noteWheel.spreadWheel();
        }
    }

    private closeChordTypeWheel() {
        if (this.chordTypeWheel.currentPercent === this.chordTypeWheel.maxPercent) {
            this.chordTypeWheel.spreadWheel();
        }
    }

    // trigger this when a note+accidental is selected to hide wnote wheels
    // and display chord type wheel
    private closeNoteWheelAndCleanAfterNoteAndAccidentalSelectionDone() {
      this.updateSpreader();
      this.hideCurrentAccidentalNavItems();
      this.previouslySelectedNoteIndex = null;
      this.closeNoteWheel();
    }

    private toggleActiveContainer(force=undefined) {
        let isActive = this.container.classList.toggle('active', force);
        // if (!isActive) this.removeClickListener();
    }

    protected closeSelector() {
        this.closeNoteWheelAndCleanAfterNoteAndAccidentalSelectionDone();
        this.closeChordTypeWheel();
        this.toggleActiveContainer(false);
        // this.removeClickListener();
    }

    // private outsideClickListener = (event) => {
    //     // HACK!!!! wheelnav creates a <tspan style="-webkit-tap-highlight-color">
    //     // when the title of the spreader is clicked, which immeditaley disappears,
    //     // thus being considered as a click outside the spreader because this elemen,t then has no parents
    //     let target: HTMLElement = event.target
    //     target.ta
    //     if (!$(target).closest(this.container).length || (
    //         target.tagName == 'tspan' && target.style.getPropertyValue()) {
    //       console.log("Wow, clicked outside")
    //       console.log(target)
    //       console.log(target.parentElement)
    //       this.closeSelector()
    //     }
    // };
    //
    //  private initHideOnClickOutside() {
    //     // detects clicks out of the containing div and closes the selector
    //     // bind this callback when the selector is activated and unbind it when
    //     // it is closed
    //     let self = this;
    //     console.log("Binding click outside callback!!")
    //     document.body.addEventListener('click', self.outsideClickListener);
    //  };
    //
    //  private removeClickListener() {
    //      let self = this;
    //      document.body.removeEventListener('click', self.outsideClickListener)
    //  };

     protected createWheelNav(): any {
        let self = this;
        let accidentalContainer = document.createElement('div')
        accidentalContainer.id = this.container.id + '-accidental'
        this.container.appendChild(accidentalContainer)

        let chordTypeContainer = document.createElement('div')
        chordTypeContainer.id = this.container.id + '-chordType'
        this.container.appendChild(chordTypeContainer)

        wheelnav.cssMode = true;

        //Use advanced constructor for more wheelnav on same div
        this.noteWheel = new wheelnav(this.container.id, null,
            this.wheelSize_px, this.wheelSize_px);
        // offset containing <svg> tag for proper positioning
        // let svgElem = $(this.container).children('svg')[0]  //offset({
        //     left: this.wheelSize_px / 2,
        //     top: this.wheelSize_px / 2
        // });
        this.accidentalWheel = new wheelnav(accidentalContainer.id, this.noteWheel.raphael);
        this.chordTypeWheel = new wheelnav(chordTypeContainer.id, this.noteWheel.raphael);

        this.noteWheel.spreaderEnable = true;
        // wheel.spreaderPathInAttr = { fill: '#FFF', 'stroke-width': 3, stroke: '#555' };
        // wheel.spreaderPathOutAttr = { fill: '#FFF', 'stroke-width': 3, stroke: '#FFF' };
        this.noteWheel.spreaderRadius = 28;
        // wheel1.spreadWheel();
        this.noteWheel.animatetime = 150;
        this.noteWheel.animateeffect = 'easeInOut';
        this.noteWheel.spreaderTitleFont = "100 20px Helvetica";
        this.noteWheel.spreaderFillColor = 'white';

        this.chordTypeWheel.spreaderEnable = false;
        this.chordTypeWheel.spreaderRadius = 28;
        // wheel1.spreadWheel();
        this.chordTypeWheel.animatetime = 105;
        this.chordTypeWheel.animateeffect = 'easeInOut';

        this.noteWheel.colors = new Array(
          '#009CEB')
        this.accidentalWheel.colors = new Array('#FFB6C1')
        this.chordTypeWheel.colors = new Array('#FFD0B6')

        //Customize slicePaths for proper size
        this.noteWheel.slicePathFunction = slicePath().DonutSlice;
        this.noteWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this.noteWheel.slicePathCustom.minRadiusPercent = 0.18;
        this.noteWheel.slicePathCustom.maxRadiusPercent = 0.6;
        this.noteWheel.sliceSelectedPathCustom = this.noteWheel.slicePathCustom;
        this.noteWheel.sliceInitPathCustom = this.noteWheel.slicePathCustom;
        this.accidentalWheel.slicePathFunction = slicePath().DonutSlice;
        this.accidentalWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this.accidentalWheel.slicePathCustom.minRadiusPercent = 0.6;
        this.accidentalWheel.slicePathCustom.maxRadiusPercent = 0.9;
        this.accidentalWheel.sliceSelectedPathCustom = this.accidentalWheel.slicePathCustom;
        this.accidentalWheel.sliceInitPathCustom = this.accidentalWheel.slicePathCustom;


        this.chordTypeWheel.slicePathFunction = slicePath().DonutSlice;
        this.chordTypeWheel.slicePathCustom = slicePath().DonutSliceCustomization();
        this.chordTypeWheel.slicePathCustom.minRadiusPercent = 0.21;
        this.chordTypeWheel.slicePathCustom.maxRadiusPercent = 0.6;
        this.chordTypeWheel.sliceSelectedPathCustom = this.chordTypeWheel.slicePathCustom;
        this.chordTypeWheel.sliceInitPathCustom = this.chordTypeWheel.slicePathCustom;

        //Disable rotation, set navAngle and create the menus
        this.noteWheel.clickModeRotate = false;
        this.accidentalWheel.clickModeRotate = false;
        this.chordTypeWheel.clickModeRotate = false;
        this.noteWheel.navAngle = -90;
        this.accidentalWheel.navAngle = -103;
        this.chordTypeWheel.navAngle = -135;

        // start wheels in closed state
        this.noteWheel.currentPercent = 0;
        this.chordTypeWheel.currentPercent = 0;

        // init wheels
        this.noteWheel.createWheel(this.notes);
        this.accidentalWheel.createWheel(this.accidentals);
        this.chordTypeWheel.createWheel(this.chordTypes);

        // offset the svg to have the wheelnav spreader positionned correctly
        let spreaderRadius = this.noteWheel.spreaderRadius
        let offset_px = this.wheelSize_px/2 - spreaderRadius
        let svgElem = $(this.container).children('svg')[0]
        svgElem.style.setProperty('position', 'absolute')
        svgElem.style.setProperty('left', `-${offset_px}px`);
        svgElem.style.setProperty('top', `-${offset_px}px`);

        for (let item of this.accidentalWheel.navItems) {
          item.navItem.hide();
        }

        this.noteWheel.spreaderTitleFont = this.noteWheel.navItems[0].titleFont
        this.updateSpreader();

        for (let navItem of this.noteWheel.navItems) {
          navItem.navigateFunction = function () {
            if (this.itemIndex === self.notes.indexOf(self.slur_symbol)) {
                // selected the 'chord continuation' symbol, close selector
                self.currentAccidental = '';
                self.currentChordType = self.chordTypes[0];  // WARNING could break if change to chordTypes list
                self.closeSelector();
                return;
            }
            if (self.previouslySelectedNoteIndex == this.itemIndex) {
              // double click: select underlying note without accidentals
              self.currentAccidental = '';
              self.accidentalWheel.navItems[2*this.itemIndex].navItem.hide();
              self.accidentalWheel.navItems[2*this.itemIndex+1].navItem.hide();
              // hide the wheel
              self.closeNoteWheelAndCleanAfterNoteAndAccidentalSelectionDone();
              self.chordTypeWheel.spreadWheel();
            }
            else {
              if (self.accidentalWheel.selectedNavItemIndex !== null &&
                  self.accidentalWheel.selectedNavItemIndex !== this.itemIndex) {
                // deselect previously selected accidental
                self.currentAccidental = '';
              }
              // first click on this navSlice: display accidental selectors
              if (self.previouslySelectedNoteIndex) {
                self.accidentalWheel.navItems[2*self.previouslySelectedNoteIndex].navItem.hide();
                self.accidentalWheel.navItems[2*self.previouslySelectedNoteIndex+1].navItem.hide();
              }
              self.accidentalWheel.navItems[2*this.itemIndex].navItem.show();
              self.accidentalWheel.navItems[2*this.itemIndex+1].navItem.show();
              self.updateSpreader();
            }
            self.previouslySelectedNoteIndex = this.itemIndex;
          };
        }

        for (let navItem of this.accidentalWheel.navItems) {
          navItem.navigateFunction = function () {
            self.accidentalWheel.navItems[Math.max(this.itemIndex-1, 0)].navItem.hide();
            self.accidentalWheel.navItems[this.itemIndex].navItem.hide();
            self.accidentalWheel.navItems[Math.min(this.itemIndex+1, self.accidentalWheel.navItems.length-1)].navItem.hide();

            self.closeNoteWheelAndCleanAfterNoteAndAccidentalSelectionDone();
            self.chordTypeWheel.spreadWheel();
          };
        }

        for (let navItem of this.chordTypeWheel.navItems) {
          navItem.navigateFunction = function () {
            self.chordTypeWheel.animatetime = 0;
            self.chordTypeWheel.spreadWheel();
            self.chordTypeWheel.animatetime = 150;

            self.previouslySelectedNoteIndex = null;
            self.updateSpreader();
            self.toggleActiveContainer(false);
          };
        }

        this.noteWheel.spreader.spreaderPath.click(self.hideCurrentAccidentalNavItems.bind(self));
        this.noteWheel.spreader.spreaderTitle.click(self.hideCurrentAccidentalNavItems.bind(self));

        this.noteWheel.spreader.spreaderPath.click(self.closeChordTypeWheel.bind(self));
        this.noteWheel.spreader.spreaderTitle.click(self.closeChordTypeWheel.bind(self));

        this.noteWheel.spreader.spreaderPath.click(
            () => {this.container.classList.toggle('active')});
        this.noteWheel.spreader.spreaderTitle.click(
            () => {this.container.classList.toggle('active')});

        // focus selector div on opening to allow closing it on unfocus (= blur event)
        // function onOpenSelector() {
        //     self.initHideOnClickOutside()
        // };
        // this.noteWheel.spreader.spreaderPath.click(onOpenSelector.bind(self));
        // this.noteWheel.spreader.spreaderTitle.click(onOpenSelector.bind(self));

        this.noteWheel.refreshWheel();
        }

    public draw(): void {
        this.createWheelNav()
        // this.container.addEventListener('click', () => {
        //     this.container.classList.toggle('active')
        // });
    }

}
