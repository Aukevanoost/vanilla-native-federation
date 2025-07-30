import type { ImportMap } from 'lib/1.domain/import-map/import-map.contract';
import type { RemoteEntry, SharedInfoActions } from 'lib/1.domain';
import type { LoggingConfig } from '../../config/log.contract';
import * as _path from 'lib/utils/path';
import type { ForConvertingToImportMap } from 'lib/2.app/driver-ports/dynamic-init/for-converting-to-import-map';

export function createConvertToImportMap({ log }: LoggingConfig): ForConvertingToImportMap {
  return ({ entry, actions }) => {
    const importMap: ImportMap = { imports: {} };
    try {
      addExternals(entry, actions, importMap);
      addRemoteInfos(entry, importMap);
      log.debug(9, `[${entry.name}] Processed actions:`, actions);
      return Promise.resolve(importMap);
    } catch (e) {
      return Promise.reject(e);
    }
  };

  function addExternals(
    remoteEntry: RemoteEntry,
    actions: SharedInfoActions,
    importMap: ImportMap
  ): void {
    if (!remoteEntry.shared) {
      return;
    }

    const remoteEntryScope = _path.getScope(remoteEntry.url);
    remoteEntry.shared.forEach(external => {
      // Scoped externals
      if (!external.singleton) {
        addToScopes(
          remoteEntryScope,
          external.packageName,
          _path.join(remoteEntryScope, external.outFileName),
          importMap
        );
        return;
      }

      if (!actions[external.packageName]) {
        log.warn(
          9,
          `[${remoteEntry.name}] No action defined for shared external '${external.packageName}'.`
        );
        return;
      }

      // Skipped shared externals
      if (actions[external.packageName]!.action === 'skip') {
        if (!external.shareScope) return;

        if (actions[external.packageName]!.override) {
          addToScopes(
            remoteEntryScope,
            external.packageName,
            actions[external.packageName]!.override!,
            importMap
          );
          return;
        }
      }

      //  Scoped shared externals
      if (actions[external.packageName]!.action === 'scope') {
        addToScopes(
          remoteEntryScope,
          external.packageName,
          _path.join(remoteEntryScope, external.outFileName),
          importMap
        );
        return;
      }

      // Shared externals with shareScope
      if (external.shareScope) {
        addToScopes(
          remoteEntryScope,
          external.packageName,
          _path.join(remoteEntryScope, external.outFileName),
          importMap
        );
        return;
      }

      // Default case: shared globally
      importMap.imports[external.packageName] = _path.join(remoteEntryScope, external.outFileName);
    });
  }

  function addToScopes(
    scope: string,
    packageName: string,
    url: string,
    importMap: ImportMap
  ): void {
    if (!importMap.scopes) importMap.scopes = {};
    if (!importMap.scopes[scope]) importMap.scopes[scope] = {};
    importMap.scopes[scope][packageName] = url;
  }

  function addRemoteInfos(remoteEntry: RemoteEntry, importMap: ImportMap): void {
    if (!remoteEntry.exposes) return;
    const scope = _path.getScope(remoteEntry.url);

    remoteEntry.exposes.forEach(exposed => {
      const moduleName = _path.join(remoteEntry.name, exposed.key);
      const moduleUrl = _path.join(scope, exposed.outFileName);
      importMap.imports[moduleName] = moduleUrl;
    });
  }
}
