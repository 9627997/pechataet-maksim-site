import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source = await readFile('integrations/google-apps-script/Code.gs', 'utf8');
const folders = new Map();
const sheetRows = [];
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'),Buffer.from('PM-TEST-PNG')]).toString('base64');

class FakeFolder {
  constructor(name) {
    this.name = name;
    this.files = new Map();
    this.subfolders = new Map();
  }
  getFoldersByName(name) {
    const file = this.subfolders.get(name);
    return {hasNext: () => !!file, next: () => file};
  }
  createFolder(name) {
    const file = new FakeFolder(name);
    this.subfolders.set(name, file);
    return file;
  }
  getFilesByName(name) {
    const file = this.files.get(name);
    return {hasNext: () => !!file, next: () => ({
      getSize: () => file.bytes.length,
    })};
  }
  createFile(first, content, mime) {
    const name = typeof first === 'object' ? first.name : first;
    const bytes = typeof first === 'object'
      ? Buffer.from(first.bytes) : Buffer.from(content);
    this.files.set(name, {bytes, mime: mime || first.mime});
    return {getName: () => name};
  }
  getUrl() {return 'https://drive.google.com/mock/' + this.name;}
}
const root = new FakeFolder('root');
const context = {
  console,
  PropertiesService: {getScriptProperties: () => ({
    getProperty: (key) => ({
      PM_SHARED_SECRET: 'ci-secret',
      PM_DRIVE_FOLDER_ID: 'ci-folder',
      PM_SPREADSHEET_ID: 'ci-sheet',
    })[key],
  })},
  ContentService: {
    MimeType: {JSON:'application/json'},
    createTextOutput: (content) => ({
      content,
      setMimeType() {return this;},
    }),
  },
  LockService: {getScriptLock: () => ({
    tryLock: () => true,
    releaseLock: () => {},
  })},
  DriveApp: {getFolderById: () => root},
  SpreadsheetApp: {openById: () => ({
    getSheets: () => [{
      getLastRow: () => sheetRows.length,
      getRange: () => ({
        getDisplayValues: () => sheetRows.length
          ? sheetRows.map((row) => [row[0]]) : [['']],
      }),
      appendRow: (row) => sheetRows.push(row),
    }],
  })},
  MimeType: {PLAIN_TEXT:'text/plain'},
  Utilities: {
    base64Decode: (value) => [...Buffer.from(value, 'base64')].map(
      (byte) => byte >= 128 ? byte - 256 : byte,
    ),
    newBlob: (bytes, mime, name) => ({
      bytes: Buffer.from(bytes.map((byte) => byte & 255)),
      mime, name,
    }),
  },
};
runInNewContext(source, context);
const send = (order, secret = 'ci-secret') =>
  JSON.parse(context.doPost({postData:{contents:JSON.stringify({secret,order})}}).content);
const item = (i) => ({
  itemId: i <= 3 ? 'ribbon-' + i : 'sticker-' + (i - 3),
  productType: i <= 3 ? 'ribbon' : 'sticker',
});
const orderItems = Array.from({length:6},(_,i)=>item(i+1));
const line = (entry, index) => ({
  itemId: entry.itemId,
  previewSvg: 'line-' + String(index+1).padStart(2,'0')+'-preview.svg',
  printSvg: 'line-' + String(index+1).padStart(2,'0')+'-print.svg',
  previewPng: 'line-' + String(index+1).padStart(2,'0')+'-preview.png',
});
const art = (entry) => ({
  previewSvg:'<svg xmlns="http://www.w3.org/2000/svg">preview-'+entry.itemId+'</svg>',
  printSvg:'<svg xmlns="http://www.w3.org/2000/svg">print-'+entry.itemId+'</svg>',
  previewPng:png,
});
const makeOrder = (orderId, chosen = orderItems) => ({
  orderId,
  customer:{name:'CI NO PRODUCTION',telegram:'@ci_no_real_user'},
  products:{ribbon:{enabled:true,widthMm:15,meters:25,repeatMm:100},
    sticker:{enabled:true,diameterMm:25,quantity:250}},
  linkedBasket:{orderItems},
  lineArtworkManifest:chosen.map(line),
  artifactsByItemId:Object.fromEntries(chosen.map((entry)=>[entry.itemId,art(entry)])),
  artifacts:{ribbonSvg:'<svg>legacy ribbon</svg>',stickerSvg:'<svg>legacy sticker</svg>'},
});
const full = makeOrder('CI-3X3');
const first = send(full);
assert.equal(first.ok,true,JSON.stringify(first));
const folder = root.subfolders.get(full.orderId);
assert.ok(folder);
assert.equal(folder.files.size,22);
for (const [i,entry] of orderItems.entries()) {
  const prefix='line-'+String(i+1).padStart(2,'0');
  assert.match(folder.files.get(prefix+'-print.svg').bytes.toString(), new RegExp(entry.itemId));
  assert.match(folder.files.get(prefix+'-preview.svg').bytes.toString(), new RegExp(entry.itemId));
  assert.equal(folder.files.get(prefix+'-preview.png').bytes.readUInt32BE(0),0x89504e47);
}
assert.equal(sheetRows.length,1);
assert.equal(send(full).ok,true);
assert.equal(folder.files.size,22);
assert.equal(sheetRows.length,1);
folder.files.delete('line-04-preview.png');
assert.equal(send(full).ok,true);
assert.ok(folder.files.has('line-04-preview.png'));
assert.equal(sheetRows.length,1);

const missing = structuredClone(makeOrder('CI-INCOMPLETE'));
delete missing.artifactsByItemId['ribbon-2'];
assert.equal(send(missing).ok,false);
assert.equal(root.subfolders.get('CI-INCOMPLETE').files.size,0);
assert.equal(sheetRows.length,1);

const wrong = structuredClone(makeOrder('CI-WRONG'));
wrong.lineArtworkManifest[0].printSvg='../secret.svg';
assert.equal(send(wrong).ok,false);
assert.equal(root.subfolders.get('CI-WRONG').files.size,0);

const partial = makeOrder('CI-PARTIAL',[orderItems[3]]);
assert.equal(send(partial).ok,true);
assert.ok(root.subfolders.get('CI-PARTIAL').files.has('line-01-print.svg'));
assert.equal(root.subfolders.get('CI-PARTIAL').files.size,7);

const legacy = makeOrder('CI-LEGACY');
delete legacy.lineArtworkManifest;
delete legacy.artifactsByItemId;
delete legacy.linkedBasket;
assert.equal(send(legacy).ok,true);
assert.equal(root.subfolders.get('CI-LEGACY').files.size,4);
assert.equal(send(makeOrder('CI-REJECT'),'bad-secret').ok,false);
assert.equal(root.subfolders.has('CI-REJECT'),false);
console.log('PASS: Google Apps Script saves all 18 3+3 line files, repairs partial backup, preserves legacy and rejects invalid manifests');
