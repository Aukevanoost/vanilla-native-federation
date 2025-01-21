import type { RemoteModuleHandler, RemoteModuleOptions } from "./remote-module.contract";
import { NFError } from "../../native-federation.error";
import * as _path from "../../utils/path";
import type { LogHandler } from "../logging";
import type { Remote } from "../remote-info/remote-info.contract";
import type { RemoteInfoHandler } from "../remote-info/remote-info.handler";
import type { SharedInfoHandler } from "../shared-info";

const remoteModuleHandlerFactory = (
    logger: LogHandler,
    remoteInfoHandler: RemoteInfoHandler,
    sharedInfoHandler: SharedInfoHandler
): RemoteModuleHandler => {

    const mapTo = (
        optionsOrRemoteName: RemoteModuleOptions | string,
        exposedModule?: string
    ): RemoteModuleOptions =>  {
        if (typeof optionsOrRemoteName === 'string' && exposedModule) {
            return {
                remoteName: optionsOrRemoteName,
                exposedModule,
            };
        } else if (typeof optionsOrRemoteName === 'object' && !exposedModule) {
            return optionsOrRemoteName;
        }
        logger.error(`Failed to load remote module: exposedModule and/or remoteName not provided`)
        throw new NFError('Failed to load remote module');
    }

    const getExposedModuleUrl = (remoteInfo: Remote, exposedModule: string): string => {    
        const exposed = remoteInfo.exposes.find(m => m.key === exposedModule);
        if (!exposed) {
            logger.error(`Module '${exposedModule}'is not exposed in remote '${remoteInfo.name}'`)
            throw new NFError('Failed to load remote module');
        }
    
        return _path.join(remoteInfo.baseUrl, exposed.outFileName);
    }

    const load = (
        remoteNameOrModule: RemoteModuleOptions | string,
        exposedModule?: string
    ): Promise<void> => {
        const remoteModule = mapTo(remoteNameOrModule, exposedModule);
        logger.debug(`Loading module ${JSON.stringify(remoteModule)}`)

        if(!remoteModule.remoteName || remoteModule.remoteName === "") throw new NFError('remoteName cannot be empty');
        return remoteInfoHandler
            .get(remoteModule.remoteEntry, remoteModule.remoteName)
            .then(remoteInfoHandler.addToCache)
            .then(sharedInfoHandler.addToCache)
            .then(info => getExposedModuleUrl(info, remoteModule.exposedModule))
            .then(url => {logger.debug("Importing module: " + url); return url})
            .then(m => (globalThis as any).importShim(m))
    }

    return { load }
}

export { remoteModuleHandlerFactory, RemoteModuleHandler, RemoteModuleOptions };