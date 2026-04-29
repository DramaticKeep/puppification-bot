import { dirname, resolve } from 'path';
import { writeFileSync, readFileSync } from 'fs';

import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../util/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE_PATH = resolve(__dirname, 'state.json');

const stores: { [key: string]: any } = {};

export async function saveStore(store: string, data: unknown) {
    stores[store] = data;
    saveState(stores);
    logger.debug("Saved: ", JSON.stringify(stores, null, 2));
}

export async function loadStore(store: string) {
    let loaded = await loadState();
    if (store in loaded) {
        logger.debug("Loaded: ", loaded, loaded[store]);
        return loaded[store];
    }
    return {};
}

async function saveState(data: unknown) {
  writeFileSync(STATE_FILE_PATH, JSON.stringify(data, null, 2));
}

async function loadState() {
    try{
        const data = await readFileSync(STATE_FILE_PATH, {"encoding": 'utf8', "flag": "r+"});
        if (!data) {
            logger.warn("Save state was null! This should only happen once!");
            return {};
        }
        return JSON.parse(data);
    } catch (e: any) {
        if (e?.code === 'ENOENT') {
            writeFileSync(STATE_FILE_PATH, JSON.stringify({}, null, 2));
            return {};
        } else {
            logger.error(e);
        }
    }
}