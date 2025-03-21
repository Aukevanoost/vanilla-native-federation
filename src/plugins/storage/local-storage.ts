import { type StorageEntryCreator, type NfCache, type StorageEntry } from "./../../lib/handlers/storage/storage.contract";
import {NF_STORAGE_ENTRY} from "../../lib/config/namespace.contract";

const localStorageEntry: StorageEntryCreator = <TCache extends NfCache, K extends keyof TCache>(key: K, initialValue: TCache[K]) => {

    const entry: StorageEntry<TCache[K]> = {
        get(): TCache[K] {
            const fromCache = localStorage.getItem(`${NF_STORAGE_ENTRY}.${String(key)}`);
            if (!fromCache) { 
                entry.set(initialValue);
                return initialValue;
            }
            return JSON.parse(fromCache);
        },
        set(value: TCache[K]): StorageEntry<TCache[K]> {
            localStorage.setItem(`${NF_STORAGE_ENTRY}.${String(key)}`, JSON.stringify(value));
            return entry;
        },
    };

    return entry;
}

export {localStorageEntry};
