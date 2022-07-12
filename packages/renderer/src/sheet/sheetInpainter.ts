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
    const movementTitleNode =
      xmlDocument.getElementsByTagName('movement-title')[0]
    const composerNode = xmlDocument.getElementsByTagName('creator')[0]

    titleNode.textContent =
      movementTitleNode.textContent =
      composerNode.textContent =
        ''
    return xmlDocument
  }

  protected async apiRequest(
    httpMethod: 'GET' | 'POST',
    href: string,
    timeout?: number,
    requestBody?: { data: BodyInit; dataType: string }
  ): Promise<SheetData> {
    return this.loadMusicXMLandMidi(httpMethod, href, timeout, requestBody)
  }

  protected defaultTimeout: number = 10000
  protected defaultExponentialBackoffDelay: number = 256

  async generate(
    queryParameters: string[] = [],
    jsonData?: Record<string, any>,
    timeout: number = 25000,
    apiAddress?: URL
  ): Promise<this> {
    return super.generate(queryParameters, jsonData, timeout, apiAddress)
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
    timeout?: number,
    requestBody?: { data: BodyInit; dataType: string }
  ): Promise<SheetData> {
    const maybeBody = requestBody != null ? requestBody.data : null
    const maybeHeaders =
      requestBody != null ? { 'Content-Type': requestBody.dataType } : undefined
    const response = await this.fetch(
      href,
      {
        method: httpMethod,
        body: maybeBody,
        headers: maybeHeaders,
      },
      timeout
    )

    if (response == undefined) {
      return this.value
    }

    const jsonContent = await response.json()
    // TODO(@tbazin, 2022/04/23): retrieve updated metadata (e.g. new Fermatas)
    // and update the view accordingly

    // load the received MusicXML
    const sheetString: string = jsonContent['sheet']
    let sheetXML = this.parser.parseFromString(sheetString, 'text/xml')
    sheetXML = this.removeMusicXMLHeaderNodes(sheetXML)
    return this.updateSheet(sheetXML)
  }

  protected async updateSheet(
    newSheet: XMLDocument,
    silent: boolean = true
  ): Promise<SheetData> {
    const midi = await this.sheetToMidi(newSheet)
    const newData = { sheet: newSheet, midi: midi }
    this.setValueInteractive(newData, silent)
    return newData
  }

  async loadFile(xmlSheetFile: File, silent: boolean = true): Promise<this> {
    this.emit('busy')
    const xmlSheetString = await xmlSheetFile.text()
    const newSheet = this.parser.parseFromString(xmlSheetString, 'text/xml')
    this.removeMusicXMLHeaderNodes(newSheet)
    await this.updateSheet(newSheet, silent)
    this.emit('ready')
    return this
  }

  protected readonly dummySheet: XMLDocument = this.parser.parseFromString(
    sheetExample,
    'text/xml'
  )
  async dummyGenerate(
    queryParameters: string[] = [],
    silent: boolean = false
  ): Promise<this> {
    this.emit('busy')
    await this.updateSheet(this.dummySheet, silent)
    this.emit('ready')
    return this
  }
}

const sheetExample =
  '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE score-partwise  PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise version="3.1">\n  <work>\n    <work-title>DeepBach</work-title>\n  </work>\n  <movement-title>DeepBach</movement-title>\n  <identification>\n    <creator type="composer">DeepBach</creator>\n    <encoding>\n      <encoding-date>2022-06-02</encoding-date>\n      <software>music21 v.7.3.1</software>\n    </encoding>\n  </identification>\n  <defaults>\n    <scaling>\n      <millimeters>7</millimeters>\n      <tenths>40</tenths>\n    </scaling>\n  </defaults>\n  <part-list>\n    <score-part id="P8fe8c20b6e8b5ed30c52a5780cb0c5aa">\n      <part-name>soprano</part-name>\n    </score-part>\n    <score-part id="P1c505b9641cd59eb3e7983e6f6e16ce7">\n      <part-name>alto</part-name>\n    </score-part>\n    <score-part id="P9e1b44c9394218a41f14f199e02fad5c">\n      <part-name>tenor</part-name>\n    </score-part>\n    <score-part id="Peb6fa6d3d69fd3e4fe4ea1de3fca413d">\n      <part-name>bass</part-name>\n    </score-part>\n  </part-list>\n  <!--=========================== Part 1 ===========================-->\n  <part id="P8fe8c20b6e8b5ed30c52a5780cb0c5aa">\n    <!--========================= Measure 1 ==========================-->\n    <measure number="1">\n      <attributes>\n        <divisions>10080</divisions>\n        <time>\n          <beats>4</beats>\n          <beat-type>4</beat-type>\n        </time>\n        <clef>\n          <sign>G</sign>\n          <line>2</line>\n        </clef>\n      </attributes>\n      <note>\n        <pitch>\n          <step>G</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>G</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>G</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>A</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n    </measure>\n    <!--========================= Measure 2 ==========================-->\n    <measure number="2">\n      <note>\n        <pitch>\n          <step>B</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>C</step>\n          <alter>1</alter>\n          <octave>5</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n        <accidental>sharp</accidental>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <octave>5</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>C</step>\n          <alter>0</alter>\n          <octave>5</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n        <accidental>natural</accidental>\n      </note>\n    </measure>\n    <!--========================= Measure 3 ==========================-->\n    <measure number="3">\n      <note>\n        <pitch>\n          <step>B</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>A</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>B</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>20160</duration>\n        <type>half</type>\n        <notations>\n          <fermata type="inverted" />\n        </notations>\n      </note>\n    </measure>\n    <!--========================= Measure 4 ==========================-->\n    <measure number="4">\n      <note>\n        <pitch>\n          <step>F</step>\n          <alter>1</alter>\n          <octave>4</octave>\n        </pitch>\n        <duration>20160</duration>\n        <type>half</type>\n        <accidental>sharp</accidental>\n      </note>\n      <note>\n        <pitch>\n          <step>B</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>20160</duration>\n        <type>half</type>\n      </note>\n      <barline location="right">\n        <bar-style>light-heavy</bar-style>\n      </barline>\n    </measure>\n  </part>\n  <!--=========================== Part 2 ===========================-->\n  <part id="P1c505b9641cd59eb3e7983e6f6e16ce7">\n    <!--========================= Measure 1 ==========================-->\n    <measure number="1">\n      <attributes>\n        <divisions>10080</divisions>\n        <time>\n          <beats>4</beats>\n          <beat-type>4</beat-type>\n        </time>\n        <clef>\n          <sign>G</sign>\n          <line>2</line>\n        </clef>\n      </attributes>\n      <note>\n        <pitch>\n          <step>D</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>C</step>\n          <alter>1</alter>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n        <accidental>sharp</accidental>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n    </measure>\n    <!--========================= Measure 2 ==========================-->\n    <measure number="2">\n      <note>\n        <pitch>\n          <step>D</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>20160</duration>\n        <type>half</type>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>E</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n    </measure>\n    <!--========================= Measure 3 ==========================-->\n    <measure number="3">\n      <note>\n        <pitch>\n          <step>E</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>E</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>up</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>C</step>\n          <alter>1</alter>\n          <octave>4</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>sharp</accidental>\n        <stem>up</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <alter>1</alter>\n          <octave>4</octave>\n        </pitch>\n        <duration>20160</duration>\n        <type>half</type>\n        <accidental>sharp</accidental>\n      </note>\n    </measure>\n    <!--========================= Measure 4 ==========================-->\n    <measure number="4">\n      <note>\n        <pitch>\n          <step>C</step>\n          <alter>1</alter>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n        <accidental>sharp</accidental>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <alter>0</alter>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n        <accidental>natural</accidental>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>C</step>\n          <alter>1</alter>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n        <accidental>sharp</accidental>\n      </note>\n      <barline location="right">\n        <bar-style>light-heavy</bar-style>\n      </barline>\n    </measure>\n  </part>\n  <!--=========================== Part 3 ===========================-->\n  <part id="P9e1b44c9394218a41f14f199e02fad5c">\n    <!--========================= Measure 1 ==========================-->\n    <measure number="1">\n      <attributes>\n        <divisions>10080</divisions>\n        <time>\n          <beats>4</beats>\n          <beat-type>4</beat-type>\n        </time>\n        <clef>\n          <sign>G</sign>\n          <line>2</line>\n          <clef-octave-change>-1</clef-octave-change>\n        </clef>\n      </attributes>\n      <note>\n        <pitch>\n          <step>D</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>down</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>C</step>\n          <octave>4</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>down</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>B</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>up</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>A</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>up</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>G</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>F</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n        <accidental>sharp</accidental>\n      </note>\n    </measure>\n    <!--========================= Measure 2 ==========================-->\n    <measure number="2">\n      <note>\n        <pitch>\n          <step>G</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>20160</duration>\n        <type>half</type>\n      </note>\n      <note>\n        <pitch>\n          <step>A</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>up</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>G</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>sharp</accidental>\n        <stem>up</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>A</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n    </measure>\n    <!--========================= Measure 3 ==========================-->\n    <measure number="3">\n      <note>\n        <pitch>\n          <step>A</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>up</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>G</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>sharp</accidental>\n        <stem>up</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>F</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>sharp</accidental>\n        <stem>up</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>E</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>up</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>F</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>20160</duration>\n        <type>half</type>\n        <accidental>sharp</accidental>\n      </note>\n    </measure>\n    <!--========================= Measure 4 ==========================-->\n    <measure number="4">\n      <note>\n        <pitch>\n          <step>A</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>sharp</accidental>\n        <stem>up</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>G</step>\n          <alter>0</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>natural</accidental>\n        <stem>up</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>F</step>\n          <alter>0</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>20160</duration>\n        <type>half</type>\n        <accidental>natural</accidental>\n      </note>\n      <note>\n        <pitch>\n          <step>E</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <barline location="right">\n        <bar-style>light-heavy</bar-style>\n      </barline>\n    </measure>\n  </part>\n  <!--=========================== Part 4 ===========================-->\n  <part id="Peb6fa6d3d69fd3e4fe4ea1de3fca413d">\n    <!--========================= Measure 1 ==========================-->\n    <measure number="1">\n      <attributes>\n        <divisions>10080</divisions>\n        <time>\n          <beats>4</beats>\n          <beat-type>4</beat-type>\n        </time>\n        <clef>\n          <sign>F</sign>\n          <line>4</line>\n        </clef>\n      </attributes>\n      <note>\n        <pitch>\n          <step>B</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>down</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>A</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>down</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>G</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>down</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>F</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>sharp</accidental>\n        <stem>down</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>E</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n    </measure>\n    <!--========================= Measure 2 ==========================-->\n    <measure number="2">\n      <note>\n        <pitch>\n          <step>G</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>down</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>F</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>sharp</accidental>\n        <stem>down</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>E</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n        <accidental>sharp</accidental>\n      </note>\n      <note>\n        <pitch>\n          <step>F</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n        <accidental>sharp</accidental>\n      </note>\n      <note>\n        <pitch>\n          <step>E</step>\n          <alter>0</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>natural</accidental>\n        <stem>down</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>sharp</accidental>\n        <stem>down</stem>\n        <beam number="1">end</beam>\n      </note>\n    </measure>\n    <!--========================= Measure 3 ==========================-->\n    <measure number="3">\n      <note>\n        <pitch>\n          <step>E</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>down</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <alter>0</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>natural</accidental>\n        <stem>down</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>C</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>B</step>\n          <octave>2</octave>\n        </pitch>\n        <duration>20160</duration>\n        <type>half</type>\n      </note>\n    </measure>\n    <!--========================= Measure 4 ==========================-->\n    <measure number="4">\n      <note>\n        <pitch>\n          <step>F</step>\n          <alter>1</alter>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <accidental>sharp</accidental>\n        <stem>down</stem>\n        <beam number="1">begin</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>E</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>5040</duration>\n        <type>eighth</type>\n        <stem>down</stem>\n        <beam number="1">end</beam>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <note>\n        <pitch>\n          <step>D</step>\n          <alter>1</alter>\n          <octave>4</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n        <accidental>sharp</accidental>\n      </note>\n      <note>\n        <pitch>\n          <step>A</step>\n          <octave>3</octave>\n        </pitch>\n        <duration>10080</duration>\n        <type>quarter</type>\n      </note>\n      <barline location="right">\n        <bar-style>light-heavy</bar-style>\n      </barline>\n    </measure>\n  </part>\n</score-partwise>'
