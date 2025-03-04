import type { ExposesInfo, FederationInfo, RemoteEntry, RemoteInfo, RemoteInfoHandler } from "./remote-info.contract";
import { NFError } from "../../native-federation.error";
import * as _path from "../../utils/path";
import type { NfCache, StorageHandler } from "../storage/storage.contract";
import type { RemoteEntryConfig } from "../../config/config.contract";
import {NF_REMOTE_ENTRY_FILENAME} from "../../config/namespace.contract";

const remoteInfoHandlerFactory = (
    { hostRemoteEntry }: RemoteEntryConfig,
    storageHandler: StorageHandler<NfCache> 
): RemoteInfoHandler => {

    const fetchRemoteEntryJson = async (entryUrl: RemoteEntry)
        : Promise<FederationInfo> => {
            return fetch(entryUrl)
                .then(r => {
                    if (!r.ok) return Promise.reject(new NFError(`${r.status} - ${r.statusText}`));
                    return r.json() as Promise<FederationInfo>;
                })
                .then(federationInfo => {
                    if(!federationInfo.exposes) federationInfo.exposes = [];
                    if(!federationInfo.shared) federationInfo.shared = [];
                    return federationInfo;
                })

                .catch(e => {
                    return Promise.reject(new NFError(`Fetching remote from '${entryUrl}' failed: ${e.message}`));
                })
        }

    const fetchRemoteEntry = (remoteEntryUrl: RemoteEntry)
        : Promise<FederationInfo> => {
            if(!remoteEntryUrl || typeof remoteEntryUrl !== "string") 
                return Promise.reject(new NFError(`Module not registered, provide a valid remoteEntryUrl.`));

            return fetchRemoteEntryJson(remoteEntryUrl);
        }


    function getHostRemoteEntryUrl(): string|undefined {
        if(!hostRemoteEntry) return undefined;

        let url = hostRemoteEntry?.url ?? `./${NF_REMOTE_ENTRY_FILENAME}`;
        if(!!hostRemoteEntry?.cacheTag) url += `?t=${hostRemoteEntry.cacheTag}`;

        return url;
    } 

    function toScope(baseUrl: string): string {
        if (baseUrl === "global") return baseUrl;
        return baseUrl.endsWith(NF_REMOTE_ENTRY_FILENAME) 
            ? baseUrl.slice(0, -16) 
            : baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    }

    function fromStorage(remoteName: string): RemoteInfo {
        const storage = storageHandler.fetch("remotes");
        if(!storage[remoteName]) throw new NFError(`Remote '${remoteName}' not found in storage.`);

        return storage[remoteName];
    }

    function inStorage(remoteName: string): boolean {
        return !!storageHandler.fetch("remotes")?.[remoteName]
    }

    function toStorage(remote: {name: string; exposes: ExposesInfo[]}, remoteEntry: string): RemoteInfo {


        const remoteInfo: RemoteInfo = {
            remoteName: remote.name,
            scopeUrl: toScope(remoteEntry),
            exposes: Object.values(remote.exposes ?? [])
                        .map(m => ({
                            moduleName: m.key,
                            url: _path.join(toScope(remoteEntry), m.outFileName) 
                        }))    
        };

        storageHandler.update("remotes", v => ({ ...v, [remote.name]: remoteInfo }));
        
        return remoteInfo;
    }

    return {toStorage, getHostRemoteEntryUrl, inStorage, fromStorage, fetchRemoteEntry, toScope};
}

export {remoteInfoHandlerFactory, RemoteInfoHandler};
