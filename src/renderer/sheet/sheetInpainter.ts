import { UndoableInpainter } from '../inpainter/inpainter'

export interface SheetData {
  sheet: XMLDocument
}

export class SheetInpainter extends UndoableInpainter<SheetData, 'copy'> {
  protected readonly serializer = new XMLSerializer()
  protected readonly parser = new DOMParser()

  protected removeMusicXMLHeaderNodes(xmlDocument: XMLDocument): void {
    // Strip MusicXML document of title/composer tags
    const titleNode = xmlDocument.getElementsByTagName('work-title')[0]
    const movementTitleNode = xmlDocument.getElementsByTagName(
      'movement-title'
    )[0]
    const composerNode = xmlDocument.getElementsByTagName('creator')[0]

    titleNode.textContent = movementTitleNode.textContent = composerNode.textContent =
      ''
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
    const xml_sheet_string = jsonContent['sheet']
    const xmldata = this.parser.parseFromString(xml_sheet_string, 'text/xml')
    this.removeMusicXMLHeaderNodes(xmldata)
    return { sheet: xmldata }

    // TODO (@tbazin, 2022/04/22): Fix DownloadButton for MIDI + MusicXML
    // this.downloadButton.revokeBlobURL()
    // this.downloadButton.targetURL = midiBlobURL
  }

  async loadFile(xmlSheetFile: File): Promise<this> {
    const xmlSheetString = await xmlSheetFile.text()
    const newSheet = this.parser.parseFromString(xmlSheetString, 'text/xml')
    this.removeMusicXMLHeaderNodes(newSheet)
    this.setValueInteractive({ sheet: newSheet })
    return this
  }
}
