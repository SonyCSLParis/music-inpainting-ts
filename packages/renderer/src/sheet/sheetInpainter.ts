import { Midi } from '@tonejs/midi'
import { UndoableInpainter } from '../inpainter/inpainter'

export interface SheetData {
  sheet: XMLDocument
  midi: Midi
}

export class SheetInpainter extends UndoableInpainter<
  SheetData,
  'copy' | 'musicxml-to-midi'
> {
  protected readonly serializer = new XMLSerializer()
  protected readonly parser = new DOMParser()

  protected removeMusicXMLHeaderNodes(xmlDocument: XMLDocument): XMLDocument {
    // Strip MusicXML document of title/composer tags
    const titleNode = xmlDocument.getElementsByTagName('work-title')[0]
    const movementTitleNode = xmlDocument.getElementsByTagName(
      'movement-title'
    )[0]
    const composerNode = xmlDocument.getElementsByTagName('creator')[0]

    titleNode.textContent = movementTitleNode.textContent = composerNode.textContent =
      ''
    return xmlDocument
  }

  protected async apiRequest(
    httpMethod: 'GET' | 'POST',
    href: string,
    timeout = 0,
    requestBody?: { data: BodyInit; dataType: string }
  ): Promise<SheetData> {
    return this.loadMusicXMLandMidi(httpMethod, href, timeout, requestBody)
  }

  get currentXML(): XMLDocument {
    return this.value.sheet
  }
  get currentXML_string(): string {
    return this.serializer.serializeToString(this.currentXML)
  }

  protected get valueAsJSONData(): Record<string, any> {
    return {
      sheet: this.currentXML_string,
    }
  }

  // FIXME(theis): critical bug in MIDI scheduling
  // timing becomes completely wrong at high tempos
  // should implement a MusicXML to Tone.js formatter instead, using
  // musical rhythm notation rather than concrete seconds-based timing
  protected async sheetToMidi(
    musicXML: XMLDocument = this.value.sheet,
    inpaintingApiUrl = this.defaultApiAddress
  ): Promise<Midi> {
    const sheetString = this.serializer.serializeToString(musicXML)
    const url = new URL('musicxml-to-midi', inpaintingApiUrl).href
    const response = await fetch(url, {
      method: 'POST',
      body: sheetString,
    })
    return new Midi(await response.arrayBuffer())
  }

  /**
   * Load a MusicXml file via xhttp request, and display its contents.
   */
  async loadMusicXMLandMidi(
    httpMethod: 'GET' | 'POST',
    href: string,
    timeout = 0,
    requestBody?: { data: BodyInit; dataType: string }
  ): Promise<SheetData> {
    const abortController = new AbortController()
    const abortTimeout =
      timeout > 0 ? setTimeout(() => abortController.abort(), timeout) : null

    const maybeBody = requestBody != null ? requestBody.data : null
    const maybeHeaders =
      requestBody != null ? { 'Content-Type': requestBody.dataType } : {}
    const response = await this.fetch(href, {
      method: httpMethod,
      body: maybeBody,
      headers: maybeHeaders,
      signal: abortController.signal,
    })
    clearTimeout(abortTimeout)
    const jsonContent = await response.json()
    // TODO(@tbazin, 2022/04/23): retrieve updated metadata (e.g. new Fermatas)
    // and update the view accordingly

    // load the received MusicXML
    const sheetString: string = jsonContent['sheet']
    let sheetXML = this.parser.parseFromString(sheetString, 'text/xml')
    sheetXML = this.removeMusicXMLHeaderNodes(sheetXML)
    return this.updateSheet(sheetXML)
  }

  protected async updateSheet(newSheet: XMLDocument): Promise<SheetData> {
    const midi = await this.sheetToMidi(newSheet)
    const newData = { sheet: newSheet, midi: midi }
    this.setValueInteractive(newData)
    return newData
  }

  async loadFile(xmlSheetFile: File): Promise<this> {
    const xmlSheetString = await xmlSheetFile.text()
    const newSheet = this.parser.parseFromString(xmlSheetString, 'text/xml')
    this.removeMusicXMLHeaderNodes(newSheet)
    await this.updateSheet(newSheet)
    return this
  }
}
