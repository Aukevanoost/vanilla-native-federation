import type { Remote, SharedInfo } from "./remote-info.contract";
import type { NfCache, StorageEntry } from "../storage/storage.contract";
import type { StorageHandler } from "../storage/storage.handler";
import * as _path from "../utils/path";

const toExternalKey = (shared: SharedInfo): string => {
    return `${shared.packageName}@${shared.version}`;
}

type SharedInfoHandler = {
    mapSharedDeps: (remoteInfo: Remote) => Record<string, string>,
    addSharedDepsToCache: (remoteInfo: Remote) => Remote
}

const sharedInfoHandlerFactory = (
    storage: StorageHandler<{"externals": StorageEntry<Record<string, string>>}>
): SharedInfoHandler => {
    const getCachedSharedDepRef = (dep: SharedInfo): string|undefined => {
        return storage.fetch("externals")[toExternalKey(dep)];
    }

    const mapSharedDeps = (remoteInfo: Remote) => {
        return remoteInfo.shared
            .reduce((dependencies, moduleDep) => ({
                ...dependencies,
                [moduleDep.packageName]: getCachedSharedDepRef(moduleDep) || _path.join(remoteInfo.baseUrl, moduleDep.outFileName)
            }), {});
    }

    const mapModuleDepsIntoSharedDepsList = (remoteInfo: Remote) => (sharedList: NfCache["externals"]) => {
        return remoteInfo.shared.reduce((existing, dep) => {
            if(!existing[toExternalKey(dep)]) {
                existing[toExternalKey(dep)] = _path.join(remoteInfo.baseUrl, dep.outFileName);
            }
            return existing;
        }, sharedList)
    }

    const addSharedDepsToCache = (remoteInfo: Remote) => {
        storage.mutate("externals", mapModuleDepsIntoSharedDepsList(remoteInfo))
        return remoteInfo;
    }

    return {mapSharedDeps, addSharedDepsToCache};
}

export {toExternalKey, sharedInfoHandlerFactory, SharedInfoHandler};