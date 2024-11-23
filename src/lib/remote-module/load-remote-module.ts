
import type { DomHandler } from "../dom/dom.handler";
import { NFError } from "../native-federation.error";
import type { RemoteModuleOptions } from "./remote-module.contract";
import type { RemoteInfo } from "../remote-entry/remote-info.contract";
import type { RemoteInfoHandler } from "../remote-entry/remote-info.handler";
import { defaultConfig, resolver, type Config } from "../resolver";
import * as _path from "../utils/path";


type LoadRemoteModule = (optionsOrRemoteName: RemoteModuleOptions | string, exposedModule?: string ) => Promise<void>

type TRemoteModuleLoader = {
    load: LoadRemoteModule
}

const remoteModuleLoaderFactory = (
    remoteInfoHandler: RemoteInfoHandler,
    domHandler: DomHandler
): TRemoteModuleLoader => {

    const mapToRemoteModule = (
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
        
        throw new NFError('unexpected arguments: please pass options or a remoteName/exposedModule-pair');
    }

    const getExposedModuleUrl = (remoteInfo: RemoteInfo, exposedModule: string): string => {    
        const exposed = remoteInfo.exposes.find(e => e.key === exposedModule);
        if (!exposed) throw new NFError(`Unknown exposed module ${exposedModule} in remote ${remoteInfo.name}`);
    
        return _path.join(remoteInfo.baseUrl, exposed.outFileName);
    }

    const load = (
        remoteNameOrModule: RemoteModuleOptions | string,
        exposedModule?: string
    ): Promise<void> => {
        const remoteModule = mapToRemoteModule(remoteNameOrModule, exposedModule);
        if(!remoteModule.remoteName || remoteModule.remoteName === "") throw new NFError('remoteName cannot be empty');
        return remoteInfoHandler
            .loadRemoteInfo(remoteModule.remoteEntry, remoteModule.remoteName)
            .then(info => getExposedModuleUrl(info, remoteModule.exposedModule))
            .then(domHandler.importModule)
    }

    return { load }
}

const loadRemoteModule: LoadRemoteModule = (
    remoteNameOrModule: RemoteModuleOptions | string,exposedModule?: string,
    options: Partial<Config> = {}
) => {
    const {
        remoteInfoHandler, 
        domHandler
    } = resolver(defaultConfig(options));

    const moduleLoader = remoteModuleLoaderFactory(remoteInfoHandler, domHandler);
    return moduleLoader.load(remoteNameOrModule, exposedModule);
}

export { loadRemoteModule, remoteModuleLoaderFactory, LoadRemoteModule, RemoteModuleOptions, TRemoteModuleLoader };