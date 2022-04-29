import { AnnotationBox } from './annotationBox'
import $ from 'jquery'
import deepEqual from 'deep-equal'
import {
  Chord,
  ChordType,
  Accidental,
  NoteOrSlur,
  Note,
  SlurSymbol,
} from './chord'

import './dependencies/wheelnav/raphael'
import 'wheelnav'

declare let wheelnav: any
declare let slicePath: any

export class ChordSelector extends AnnotationBox {
  protected readonly slurSymbol = SlurSymbol.slur
  private useSlurSymbol: boolean
  protected notes: NoteOrSlur[]
  protected accidentals: Accidental[]

  constructor(
    timestampContainer: HTMLElement,
    onChordChange: () => void,
    wheelSize_px = 250,
    useSlurSymbol = false
  ) {
    super(timestampContainer, 'ChordSelector')
    this.onChordChange = onChordChange
    this.container.classList.add('noselect')
    this.wheelSize_px = wheelSize_px

    this.useSlurSymbol = useSlurSymbol
    this.notes = this.makeNotes()
    this.accidentals = this.makeAccidentals()

    this.draw()
    this.previousChord = this.currentChord
  }

  protected validateTimestampContainer(timestampContainer: HTMLElement): void {
    super.validateTimestampContainer(timestampContainer)
    if (!timestampContainer.classList.contains('2_quarterNote_duration')) {
      throw new EvalError(
        'Chord selector should be associated to a half-note box'
      )
    }
  }

  private makeNotes(): NoteOrSlur[] {
    const mainNotes: Note[] = [
      Note.C,
      Note.D,
      Note.E,
      Note.F,
      Note.G,
      Note.A,
      Note.B,
    ]

    const notes: NoteOrSlur[] = mainNotes
    if (this.useSlurSymbol) {
      notes.push(this.slurSymbol)
    }

    return notes
  }

  private makeAccidentals(): Accidental[] {
    const accidentals: Accidental[] = []
    const numNotes: number = this.notes.length
    for (let i = 0; i < numNotes; i++) {
      accidentals.push(Accidental.flat)
      accidentals.push(Accidental.sharp)
    }
    return accidentals
  }

  private chordTypes = [
    ChordType.major,
    ChordType.minor,
    ChordType.minorSeventh,
    ChordType.majorSeventh,
    ChordType.seventh,
  ]

  private noteWheel: any
  private accidentalWheel: any
  private chordTypeWheel: any

  private wheelSize_px: number

  // keep track of the previously selected index to detect re-clicks
  // on the same note and don't display accidental selector in that case
  private previouslySelectedNoteIndex: number = null

  private onChordChange: () => void

  private get currentNote(): NoteOrSlur {
    return this.notes[this.noteWheel.selectedNavItemIndex]
  }

  private set currentNote(note: NoteOrSlur) {
    const noteIndex = this.notes.indexOf(note)
    this.noteWheel.navigateWheel(noteIndex)
  }

  protected get currentAccidental(): null | Accidental {
    const selectedAccidentalIndex = this.accidentalWheel.selectedNavItemIndex
    if (selectedAccidentalIndex != null && selectedAccidentalIndex > 0) {
      return this.accidentals[selectedAccidentalIndex]
    } else {
      return null
    }
  }

  protected set currentAccidental(accidental: Accidental | null) {
    const accidentalIndex = this.accidentals.indexOf(accidental)
    if (accidentalIndex >= 0) {
      const fullIndex =
        2 * this.noteWheel.selectedNavItemIndex + accidentalIndex
      // this.accidentalWheel.navItems[fullIndex].selected = true;
      // this.accidentalWheel.navItems[fullIndex].refreshNavItem();
      // this.accidentalWheel.selectedNavItemIndex = fullIndex;
      this.accidentalWheel.navigateWheel(fullIndex)
    } else {
      if (
        this.accidentalWheel.selectedNavItemIndex !== null &&
        this.accidentalWheel.selectedNavItemIndex >= 0
      ) {
        this.accidentalWheel.navItems[
          this.accidentalWheel.selectedNavItemIndex
        ].selected = false
        this.accidentalWheel.navItems[
          this.accidentalWheel.selectedNavItemIndex
        ].refreshNavItem()
      }
      this.accidentalWheel.selectedNavItemIndex = null
    }
  }

  private get currentChordType() {
    return this.chordTypes[this.chordTypeWheel.selectedNavItemIndex]
  }

  private set currentChordType(chordType: ChordType) {
    const chordType_index = this.chordTypes.indexOf(chordType)
    this.chordTypeWheel.navigateWheel(chordType_index)
  }

  public get currentChord(): Chord {
    return {
      root: this.currentNote,
      accidental: this.currentAccidental,
      type: this.currentChordType,
    }
  }

  public set currentChord(chord: Chord) {
    // FIXME add proper parsing and checks
    this.currentNote = chord.root
    if (this.currentNote !== this.slurSymbol) {
      this.currentAccidental = chord.accidental
      this.currentChordType = chord.type
    } else {
      this.currentAccidental = null
      this.currentChordType = ChordType.major
    }
    this.closeSelector()
  }

  private previousChord: Chord

  private updateSpreader(): void {
    const currentNote = this.currentNote
    let spreaderText = currentNote + this.currentAccidental
    if (this.currentChordType !== 'M') {
      spreaderText = spreaderText + this.currentChordType
    }
    this.noteWheel.spreader.inTitle.title = spreaderText
    this.noteWheel.spreader.outTitle.title = spreaderText

    this.noteWheel.refreshWheel()
  }

  private hideCurrentAccidentalNavItems(): void {
    this.accidentalWheel.navItems[
      2 * this.noteWheel.selectedNavItemIndex
    ].navItem.hide()
    this.accidentalWheel.navItems[
      2 * this.noteWheel.selectedNavItemIndex + 1
    ].navItem.hide()
  }

  private hidePreviouslySelectedAccidentalNavItems(): void {
    if (this.previouslySelectedNoteIndex !== null) {
      this.accidentalWheel.navItems[
        2 * this.previouslySelectedNoteIndex
      ].navItem.hide()
      this.accidentalWheel.navItems[
        2 * this.previouslySelectedNoteIndex + 1
      ].navItem.hide()
    }
  }

  private closeNoteWheel(): void {
    if (this.noteWheel.currentPercent === this.noteWheel.maxPercent) {
      this.noteWheel.spreadWheel()
    }
  }

  private closeChordTypeWheel() {
    if (this.chordTypeWheel.currentPercent === this.chordTypeWheel.maxPercent) {
      this.chordTypeWheel.spreadWheel()
    }
  }

  // trigger this when a note+accidental is selected to hide wnote wheels
  // and display chord type wheel
  private closeNoteWheelAndCleanAfterNoteAndAccidentalSelectionDone() {
    this.updateSpreader()
    this.hideCurrentAccidentalNavItems()
    this.previouslySelectedNoteIndex = null
    this.closeNoteWheel()
  }

  private toggleActiveContainer(force = undefined) {
    const isActive = this.container.classList.toggle('active', force)
    // if (!isActive) this.removeClickListener();
  }

  protected closeSelector(): void {
    this.updateSpreader()
    this.closeNoteWheelAndCleanAfterNoteAndAccidentalSelectionDone()
    this.closeChordTypeWheel()
    this.toggleActiveContainer(false)
    this.removeClickListener()
    // TODO(@tbazin, 2022/04/08): remove usage of deepEqual
    // ... then remove this dependency
    if (!deepEqual(this.currentChord, this.previousChord)) {
      // trigger update if the contained chord changed
      this.onChordChange()
      this.previousChord = this.currentChord
    }
  }

  private outsideClickListener = (event: MouseEvent) => {
    const target = event.target
    if (!$(target).closest(this.container).length) {
      this.closeSelector()
    }
  }

  private initHideOnClickOutside() {
    // Attach an event listener to the whole document that detects clicks
    // out of the containing div and closes the selector in that case
    // Bind this callback when the selector is activated and unbind it when
    // it is closed
    document.addEventListener('click', (e) => this.outsideClickListener(e))
  }

  private removeClickListener() {
    document.removeEventListener('click', (e) => this.outsideClickListener(e))
  }

  protected createWheelNav(): any {
    const accidentalContainer = document.createElement('div')
    accidentalContainer.id = this.container.id + '-accidental'
    this.container.appendChild(accidentalContainer)

    const chordTypeContainer = document.createElement('div')
    chordTypeContainer.id = this.container.id + '-chordType'
    this.container.appendChild(chordTypeContainer)

    wheelnav.cssMode = true

    //Use advanced constructor for more wheelnav on same div
    this.noteWheel = new wheelnav(
      this.container.id,
      null,
      this.wheelSize_px,
      this.wheelSize_px
    )
    this.accidentalWheel = new wheelnav(
      accidentalContainer.id,
      this.noteWheel.raphael
    )
    this.chordTypeWheel = new wheelnav(
      chordTypeContainer.id,
      this.noteWheel.raphael
    )

    this.noteWheel.spreaderEnable = true
    // wheel.spreaderPathInAttr = { fill: '#FFF', 'stroke-width': 3, stroke: '#555' };
    // wheel.spreaderPathOutAttr = { fill: '#FFF', 'stroke-width': 3, stroke: '#FFF' };
    this.noteWheel.spreaderRadius = 22
    // wheel1.spreadWheel();
    this.noteWheel.animatetime = 150
    this.noteWheel.animateeffect = 'easeInOut'
    this.noteWheel.spreaderTitleFont =
      '100 20px Ubuntu-Regular, Boogaloo, sans-serif'
    this.noteWheel.spreaderFillColor = 'white'

    this.chordTypeWheel.spreaderEnable = false
    this.chordTypeWheel.spreaderRadius = 22
    // wheel1.spreadWheel();
    this.chordTypeWheel.animatetime = 105
    this.chordTypeWheel.animateeffect = 'easeInOut'
    this.noteWheel.spreaderPathInAttr = {
      fill: '#FFE9EC',
      'fill-opacity': 1,
      'stroke-width': 3,
      stroke: '#FFD3D9',
      cursor: 'pointer',
    }
    // this.noteWheel.spreaderPathInAttr = {
    //     fill: '#FFF', 'fill-opacity': 0.5,
    //     'stroke-width': 3, stroke: '#FFF' };
    // this.noteWheel.spreaderPathOutAttr = { fill: '#FFF', 'stroke-width': 3, stroke: '#FFF' };
    this.noteWheel.spreaderTitleInAttr = { fill: '#555' }
    this.noteWheel.spreaderTitleOutAttr = { fill: '#555' }

    this.noteWheel.colors = new Array('#009CEB')
    this.accidentalWheel.colors = new Array('#FFB6C1')
    this.chordTypeWheel.colors = new Array('#FFD0B6')

    //Customize slicePaths for proper size
    this.noteWheel.slicePathFunction = slicePath().DonutSlice
    this.noteWheel.slicePathCustom = slicePath().DonutSliceCustomization()
    this.noteWheel.slicePathCustom.minRadiusPercent = 0.15
    this.noteWheel.slicePathCustom.maxRadiusPercent = 0.6
    this.noteWheel.sliceSelectedPathCustom = this.noteWheel.slicePathCustom
    this.noteWheel.sliceInitPathCustom = this.noteWheel.slicePathCustom
    this.accidentalWheel.slicePathFunction = slicePath().DonutSlice
    this.accidentalWheel.slicePathCustom = slicePath().DonutSliceCustomization()
    this.accidentalWheel.slicePathCustom.minRadiusPercent = 0.6
    this.accidentalWheel.slicePathCustom.maxRadiusPercent = 0.9
    this.accidentalWheel.sliceSelectedPathCustom = this.accidentalWheel.slicePathCustom
    this.accidentalWheel.sliceInitPathCustom = this.accidentalWheel.slicePathCustom

    this.chordTypeWheel.slicePathFunction = slicePath().DonutSlice
    this.chordTypeWheel.slicePathCustom = slicePath().DonutSliceCustomization()
    this.chordTypeWheel.slicePathCustom.minRadiusPercent = 0.16
    this.chordTypeWheel.slicePathCustom.maxRadiusPercent = 0.6
    this.chordTypeWheel.sliceSelectedPathCustom = this.chordTypeWheel.slicePathCustom
    this.chordTypeWheel.sliceInitPathCustom = this.chordTypeWheel.slicePathCustom

    //Disable rotation, set navAngle and create the menus
    this.noteWheel.clickModeRotate = false
    this.accidentalWheel.clickModeRotate = false
    this.chordTypeWheel.clickModeRotate = false
    this.noteWheel.navAngle = -90
    this.accidentalWheel.navAngle = -103
    this.chordTypeWheel.navAngle = -135

    // start wheels in closed state
    this.noteWheel.currentPercent = 0
    this.chordTypeWheel.currentPercent = 0

    // init wheels
    this.accidentalWheel.createWheel(this.accidentals)
    this.chordTypeWheel.createWheel(this.chordTypes)
    this.noteWheel.createWheel(this.notes)

    // offset the svg to have the wheelnav spreader positionned correctly
    const spreaderRadius = this.noteWheel.spreaderRadius
    const offset_px = this.wheelSize_px / 2 - spreaderRadius
    const svgElem = $(this.container).children('svg')[0]
    svgElem.style.setProperty('position', 'absolute')
    svgElem.style.setProperty('left', `-${offset_px}px`)
    svgElem.style.setProperty('top', `-${offset_px}px`)

    for (const item of this.accidentalWheel.navItems) {
      item.navItem.hide()
    }

    const self = this
    for (const navItem of this.noteWheel.navItems) {
      navItem.navigateFunction = function () {
        if (this.itemIndex === self.notes.indexOf(self.slurSymbol)) {
          // selected the 'chord continuation' symbol, close selector
          self.hidePreviouslySelectedAccidentalNavItems()
          self.currentAccidental = null
          self.currentChordType = self.chordTypes[0] // WARNING could break if change to chordTypes list
          self.closeSelector()
          return
        }
        if (self.previouslySelectedNoteIndex == this.itemIndex) {
          // double click: select underlying note without accidentals
          self.currentAccidental = null
          self.accidentalWheel.navItems[2 * this.itemIndex].navItem.hide()
          self.accidentalWheel.navItems[2 * this.itemIndex + 1].navItem.hide()
          // hide the wheel
          self.closeNoteWheelAndCleanAfterNoteAndAccidentalSelectionDone()
          self.chordTypeWheel.spreadWheel()
        } else {
          if (
            self.accidentalWheel.selectedNavItemIndex !== null &&
            Math.floor(self.accidentalWheel.selectedNavItemIndex / 2) !==
              this.itemIndex
          ) {
            // deselect previously selected accidental, since it applies to
            // a note different from the currently selected one
            self.currentAccidental = null
          }
          // first click on this navSlice: display accidental selectors
          self.hidePreviouslySelectedAccidentalNavItems()
          for (const accidentalItemIndexOffset of [0, 1]) {
            self.accidentalWheel.navItems[
              2 * this.itemIndex + accidentalItemIndexOffset
            ].navItem.show()
          }
          self.updateSpreader()
        }
        self.previouslySelectedNoteIndex = this.itemIndex
      }
    }

    for (const navItem of this.accidentalWheel.navItems) {
      navItem.navigateFunction = function () {
        for (const accidentalItemIndexOffset of [-1, 0, 1]) {
          // hide both surrounding accidental navItems to be sure everything
          // is hidden afterwards
          let accidentalItemIndex = this.itemIndex + accidentalItemIndexOffset
          // ensure the index is valid
          accidentalItemIndex = Math.min(
            Math.max(accidentalItemIndex, 0),
            self.accidentalWheel.navItems.length - 1
          )
          self.accidentalWheel.navItems[accidentalItemIndex].navItem.hide()
        }

        self.closeNoteWheelAndCleanAfterNoteAndAccidentalSelectionDone()
        self.chordTypeWheel.spreadWheel()
      }
    }

    for (const navItem of this.chordTypeWheel.navItems) {
      navItem.navigateFunction = function () {
        self.closeSelector()
      }
    }

    this.noteWheel.spreader.spreaderPath.click(() => {
      this.hideCurrentAccidentalNavItems()
    })
    this.noteWheel.spreader.spreaderTitle.click(() => {
      this.hideCurrentAccidentalNavItems()
    })

    this.noteWheel.spreader.spreaderPath.click(() => {
      this.container.classList.toggle('active')
    })
    this.noteWheel.spreader.spreaderTitle.click(() => {
      this.container.classList.toggle('active')
    })

    function onOpenSelector() {
      // this callback is called after spreading/unspreading the
      // selector, so the wheel is at maxPercent if it was closed before the click
      if (this.currentPercent === this.maxPercent) {
        self.initHideOnClickOutside()
      }
    }
    this.noteWheel.spreader.spreaderPath.click(
      onOpenSelector.bind(this.noteWheel)
    )
    this.noteWheel.spreader.spreaderTitle.click(
      onOpenSelector.bind(this.noteWheel)
    )

    function onClickSpreadWithOpenWheels() {
      // Should call this when the spreader is clicked with either
      // the noteWheel or the chordTypeWheel open
      if (
        self.noteWheel.currentPercent !== self.noteWheel.maxPercent ||
        self.chordTypeWheel.currentPercent === self.chordTypeWheel.maxPercent
      ) {
        self.closeSelector()
      }
    }
    this.noteWheel.spreader.spreaderPath.click(
      onClickSpreadWithOpenWheels.bind(self)
    )
    this.noteWheel.spreader.spreaderTitle.click(
      onClickSpreadWithOpenWheels.bind(self)
    )

    this.noteWheel.refreshWheel()
    this.updateSpreader()
  }

  public draw(): void {
    this.createWheelNav()
    this.updateSpreader()
  }
}
