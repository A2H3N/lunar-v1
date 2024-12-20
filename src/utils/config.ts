const DBNAME = 'SettingsDB';
const LunarSettings = 'Lunar-Settings';
let db: IDBDatabase | undefined;
let dbReady: Promise<void>;

interface Setting {
  id?: number;
  [key: string]: any;
}

const Settings = (function () {
  dbReady = new Promise((resolve, reject) => {
    const request: IDBOpenDBRequest = window.indexedDB.open(DBNAME, 1);

    request.onupgradeneeded = function () {
      const dbInstance = request.result;
      if (!dbInstance.objectStoreNames.contains(LunarSettings)) {
        dbInstance.createObjectStore(LunarSettings, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = function () {
      db = request.result;
      resolve();
    };

    request.onerror = function () {
      reject(request.error);
    };
  });

  async function ensureDefaultSettings(): Promise<void> {
    await dbReady;
    const defaultSettings: Setting[] = [
      { cloak: 'on' },
      { backend: 'uv' }, // UV: uv | SJ: scramjet
      { 'search-engine': 'https://www.google.com/search?q=' },
      { transport: 'ep' }, // Epoxy: ep | libcurl: lb
    ];
    const transaction = db!.transaction([LunarSettings], 'readwrite');
    const store = transaction.objectStore(LunarSettings);
    const existingSettings: Setting[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const setting of defaultSettings) {
      const key = Object.keys(setting)[0];
      if (!existingSettings.some((s) => key in s)) {
        store.add(setting);
      }
    }
  }

  async function add(settingName: string, value: any): Promise<void> {
    await dbReady;
    const transaction = db!.transaction([LunarSettings], 'readwrite');
    const store = transaction.objectStore(LunarSettings);
    const existingSettings: Setting[] = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const existingSetting = existingSettings.find((s) => settingName in s);
    if (existingSetting) {
      existingSetting[settingName] = value;
      store.put(existingSetting);
    } else {
      const newEntry: Setting = { [settingName]: value };
      store.add(newEntry);
    }
  }

  async function get(settingName: string): Promise<any> {
    await dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db!.transaction([LunarSettings], 'readonly');
      const store = transaction.objectStore(LunarSettings);
      const cursorRequest: IDBRequest = store.openCursor();
      cursorRequest.onsuccess = function () {
        const cursor: IDBCursorWithValue = cursorRequest.result;
        if (cursor) {
          if (cursor.value[settingName] !== undefined) {
            resolve(cursor.value[settingName]);
            return;
          }
          cursor.continue();
        } else {
          resolve(undefined);
        }
      };
      cursorRequest.onerror = function () {
        reject(new Error('Error retrieving setting by name.'));
      };
    });
  }

  dbReady.then(() => ensureDefaultSettings());

  return { add, get };
})();

export { Settings };
