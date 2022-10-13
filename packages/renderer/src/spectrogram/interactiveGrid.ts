import Nexus from '../nexusColored'
import { SequencerOptions } from 'nexusui/dist/types/interfaces/sequencer'
import { BaseInterfaceOptions } from 'nexusui/dist/types/core/interface'
import type { MatrixCell } from 'nexusui'

class CSSClassBasedSequencer extends Nexus.Sequencer {
  buildInterface(): void {
    super.buildInterface()
    this.cells.forEach((cell) => {
      cell.render = function () {
        this.element.classList.toggle('selected', this.state)
      }
    })
  }
}

type GridPosition = {
  row: number
  column: number
}

// monkey-patch Nexus.Sequencer to emit 'toggle' events
// these are triggered only on actual changes of the pattern,
// as opposed to the 'change' events which can be emitted even though the actual
// content of the matrix does not change (e.g. when touching the same cell twice
// in a single Touch action)
export declare interface InteractiveGrid {
  on(
    event: 'toggle',
    listener: (
      cellValue: {
        row: number
        column: number
        state: boolean
      },
      ...args: any[]
    ) => void
  ): this
  on(
    event: 'change',
    listener: (
      cellValue: { row: number; column: number; state: boolean },
      ...args: any[]
    ) => void
  ): this
  on(
    event: 'step',
    listener: (columnValues: number[], ...args: any[]) => void
  ): this
}

export class InteractiveGrid extends CSSClassBasedSequencer {
  inRectangularSelection = false
  firstCell?: GridPosition
  previousCell?: GridPosition
  rectangularSelections = true

  readonly columnsOverlay: HTMLElement
  static readonly nowPlayingCSSClass = 'sequencer-playing'

  constructor(
    container: string | HTMLElement,
    options: Partial<
      BaseInterfaceOptions &
        SequencerOptions & {
          fill: string
          accent: string
        }
    >
  ) {
    super(container, options)
    // remove inline styling set up by Nexus-ui
    this.element.style.removeProperty('position')
    this.element.style.removeProperty('display')
    this.element.style.removeProperty('cursor')

    if (options.fill != null) {
      this.colorize('fill', options.fill)
    }
    if (options.accent != null) {
      this.colorize('accent', options.accent)
    }

    if (this.rectangularSelections) {
      this.cells.forEach((cell) => {
        cell.pad.addEventListener('pointerdown', this.onInteractionStart)
        cell.element.addEventListener(
          'mousemove',
          (e) => {
            // disable unused `bend` event listener attached by Nexus
            e.preventDefault()
            e.stopImmediatePropagation()
          },
          true
        )
      })
    }

    this.columnsOverlay = this.createColumnsOverlay()

    this.createVisualElements()
  }

  clearSelection(): void {
    this.cells.forEach((cell) => (cell.state = false))
    this.render()
  }

  private createColumnsOverlay() {
    const columnsOverlay = document.createElement('div')
    columnsOverlay.classList.add('sequencer-grid-overlay')
    this.element.appendChild(columnsOverlay)
    // create a span element for each column/time-step in the sequencer
    Array.from(Array(this.columns)).forEach(() => {
      columnsOverlay.appendChild(document.createElement('span'))
    })
    return columnsOverlay
  }

  protected createVisualElements(): void {
    this.cells.forEach((cell) => {
      const visualNode = <typeof cell.pad>cell.pad.cloneNode()
      visualNode.classList.add('sequencer-toggle-visual')
      cell.element.appendChild(visualNode)
      cell.pad.style.opacity = '0'
    })
  }

  protected getVisualElement(cell: MatrixCell): SVGElement {
    return <typeof cell.pad>(
      cell.element.getElementsByClassName('sequencer-toggle-visual').item(0)
    )
  }

  protected resizeCells(): void {
    this.cells.forEach((cell) => {
      const visualElement = this.getVisualElement(cell)
      // copy original size of visual pad
      const displayHeight = cell.pad.getAttribute('height')
      const displayWidth = cell.pad.getAttribute('width')
      visualElement.setAttribute('height', displayHeight)
      visualElement.setAttribute('width', displayWidth)
      visualElement.setAttribute('x', '0')
      visualElement.setAttribute('y', '0')
      // enlarge interactive pad to fill the whole cell
      const elementHeight = cell.element.getAttribute('height')
      const elementWidth = cell.element.getAttribute('width')
      cell.pad.setAttribute('height', elementHeight)
      cell.pad.setAttribute('width', elementWidth)
      cell.pad.setAttribute('x', '0')
      cell.pad.setAttribute('y', '0')

      // HACK(@tbazin, 2022/02/24): hardcode stroke-dasharray pattern to disable grid-cell outline for
      // edge sides of the whole interface
      // tried to do this using responsive SVG, setting up the <svg> elements with a proper viewBox
      // and referring to these dimensions in the underlying <rect> elements, but the auto-scaling of
      // the elements apparently breaks the stroke. In order to have fixed width stroke, one
      // should use vector-effect="non-scaling-stroke", but this is turn breaks using responsive
      // units in the <rect> elements definition.
      //
      // Rationale: should try and replace this hand-crafted grid of <svg> elements with a
      // simple CSS-grid.
      //
      // default Top-edge plus Left-edge pattern
      const isAtTop = (<HTMLElement>cell.parent).style.top.startsWith('0')
      const isAtLeft = (<HTMLElement>cell.parent).style.left.startsWith('0')
      let dasharrayPattern = `${elementWidth},${elementHeight},0,${elementWidth},${elementHeight}`
      if (isAtTop && isAtLeft) {
        // disable stroke for top-left corner
        dasharrayPattern = `0,1`
      } else if (isAtLeft) {
        // disable left-edge stroke for cells on the left-side of the grid
        dasharrayPattern = `${elementWidth},${elementHeight},0,${elementWidth},0,${elementHeight}`
      } else if (isAtTop) {
        // disable top-edge stroke for cells on the top-side of the grid
        dasharrayPattern = `0,${elementWidth},0,${elementHeight},0,${elementWidth},${elementHeight}`
      }
      visualElement.setAttribute('stroke-dasharray', dasharrayPattern)
    })
  }

  resize(width: number, height: number): void {
    super.resize(width, height)
    this.resizeCells()
  }

  protected get columnsOverlayColumns(): HTMLElement[] {
    return Array.from(this.columnsOverlay.getElementsByTagName('span'))
  }

  setPlayingColumn(columnIndex: number): void {
    this.columnsOverlayColumns.forEach((elem, index) =>
      elem.classList.toggle(
        InteractiveGrid.nowPlayingCSSClass,
        index == columnIndex
      )
    )
  }

  clearNowPlayingDisplay(): void {
    this.columnsOverlayColumns.forEach((elem) =>
      elem.classList.remove(InteractiveGrid.nowPlayingCSSClass)
    )
  }

  protected registerEventListeners(): void {
    document.addEventListener('pointerup', this.onInteractionEnd)
    document.addEventListener('pointercancel', this.onInteractionEnd)
  }

  protected removeEventListeners(): void {
    document.removeEventListener('pointerup', this.onInteractionEnd)
    document.removeEventListener('pointercancel', this.onInteractionEnd)
  }

  protected onInteractionEnd: () => void = () => {
    this.inRectangularSelection = false
    this.firstCell = null
    this.previousCell = null
    this.removeEventListeners()
    return
  }

  protected onInteractionStart: () => void = () => {
    this.registerEventListeners()
    this.inRectangularSelection = true
    return
  }

  protected getCell(cell: GridPosition): MatrixCell {
    return this.cells[this.getIndex(cell)]
  }

  protected getIndex(cell: GridPosition): number {
    return this.matrix.indexOf(cell.row, cell.column)
  }

  protected turnOn(cell: GridPosition, emitting: boolean): void {
    const matrixCell = this.getCell(cell)
    matrixCell.turnOn(emitting)
    if (!emitting) {
      // manually update the model
      this.matrix.pattern[cell.row][cell.column] = 1
    }
  }

  protected turnOff(cell: GridPosition, emitting: boolean): void {
    const matrixCell = this.cells[this.matrix.indexOf(cell.row, cell.column)]
    matrixCell.turnOff(emitting)
    if (!emitting) {
      // manually update the model
      this.matrix.pattern[cell.row][cell.column] = 0
    }
  }

  keyChange(note, on: boolean): void {
    const cell = this.matrix.locate(note)
    const previousState: boolean =
      this.matrix.pattern[cell.row][cell.column] == 1
    if (!this.rectangularSelections) {
      if (previousState !== on) {
        const data = {
          row: cell.row,
          column: cell.column,
          state: on,
        }
        this.emit('toggle', data)
      }
    }
    if (this.rectangularSelections && this.inRectangularSelection) {
      if (this.firstCell == null) {
        this.firstCell = cell
        this.previousCell = cell
        const data = {
          row: cell.row,
          column: cell.column,
          state: on,
        }
        this.emit('toggle', data)
      } else {
        // TODO(theis, 2021/05/21): could maybe be more efficient by just computing
        // the delta of cells to turn on and cells to turn off by using the
        // previous position of the pointer.
        //  This brute-force version probably has the advantage of being more robust
        // to very fast mouse movements though, which could lead to `this.previousCell`'s
        // value not being accurate, resulting in a mismatched update.

        // turn all cells off
        const numActiveBefore = this.matrix.pattern
          .map((row) => row.reduce((acc, value) => acc + value))
          .reduce((acc, columnValue) => acc + columnValue)
        for (let index = 0; index < this.matrix.length; index++) {
          const cell = this.matrix.locate(index)
          this.turnOff(cell, false)
        }

        // activate all cells in the rectangle between the first cell
        // of the interaction and the current cell
        const rectangleStart = {
          row: Math.min(this.firstCell.row, cell.row),
          column: Math.min(this.firstCell.column, cell.column),
        }
        const rectangleEnd = {
          row: Math.max(this.firstCell.row, cell.row),
          column: Math.max(this.firstCell.column, cell.column),
        }
        for (let row = rectangleStart.row; row <= rectangleEnd.row; row++) {
          for (
            let column = rectangleStart.column;
            column <= rectangleEnd.column;
            column++
          ) {
            const cell = { row: row, column: column }
            this.turnOn(cell, false)
          }
        }
        const numActiveAfter = this.matrix.pattern
          .map((row) => row.reduce((acc, value) => acc + value))
          .reduce((acc, columnValue) => acc + columnValue)

        // TODO(@tbazin, 2021/10/22): might make this more efficient
        if (numActiveAfter != numActiveBefore) {
          // the pattern changed, emit a `toggle` event
          const data = {
            row: cell.row,
            column: cell.column,
            state: on,
          }
          this.emit('toggle', data)
        }
      }
      this.previousCell = cell
    }
    super.keyChange(note, on)
  }
}
