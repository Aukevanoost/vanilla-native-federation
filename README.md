# vanilla-native-federation

Check the full description of native-federation on [@softarc/native-federation](https://www.npmjs.com/package/@softarc/native-federation). This library is specifically made for applications that require a small library to (lazy) load micro frontends or webcomponents on HTML pages using native-federation (e.g. PHP, Ruby or Java applications) without the need for a JavaScript framework. 

This library is under [MIT License](./LICENSE.md) and is inspired on [@softarc/native-federation-runtime](https://www.npmjs.com/package/@softarc/native-federation-runtime). If you want to know more about Native federation, check out these sources: 

- [Talk by Manfred Steyer](https://www.youtube.com/watch?v=cofoI5_S3lE)
- [The official native federation package](https://www.npmjs.com/package/@angular-architects/native-federation)
- [Angular-architects blogpost](https://www.angulararchitects.io/blog/announcing-native-federation-1-0/)
- [Some examples](https://github.com/manfredsteyer/native-federation-core-example)

## Table of Contents

1. Dependencies
2. Usage
3. Bundling your loader.js
4. Examples
    1. Communication through 'custom events'
    2. Custom Logging
    3. Generic loader.js
5. Plugins
    1. Custom storage (caching)

## 1 &nbsp; Dependencies:

Right now, it is recommended to use the [es-module-shims](https://www.npmjs.com/package/es-module-shims) library to provide fallback functionality for old browsers regarding import maps. The shim can be added in the HTML page: 

```
<script async src="https://ga.jspm.io/npm:es-module-shims@2.0.9/dist/es-module-shims.js"></script>
```

**Important:** The examples assume that the fetched remote modules bootstrap a [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements). The `loadRemoteModule()` method in this vanilla-native-federation library returns a promise of the contents of the remote JavaScript module returned. It is also possible to write a different (custom) handler for the returned module. 

## 2 &nbsp; Usage:

Below you can find some examples of how to use the native-federation loader. The simplest implmentation is to use the initFederation function to load all remote entries. Where `team-mfe1` is your custom micro frontend ESM. 

```
<html>
    <head>
        <title>Shell</title>
        <script type="application/json" id="manifest">
            {
                "team/mfe1": "http://localhost:3000/remoteEntry.json",
            }
        </script>
        <script>
            <!-- event will be fired if native-federation initialization is done -->
            window.addEventListener('mfe-loader-available', (e) => {
                window.loadRemoteModule("team/mfe1", "./comp");
            }, {once: true});
        </script>
        <script src="https://unpkg.com/vanilla-native-federation@0.8.4/fesm2022/vanilla-native-federation-quickstart.mjs"></script>
    </head>
    <body>
        <!-- Name of your custom element -->
        <team-mfe1></team-mfe1>
    </body>
</html>
```

However, the recommended way is to create your own customized variant of the orchestrator. This allows you to override certain steps or append plugins like custom loggers. This example will make use of ESBuild:

```
import 'es-module-shims';

import { initFederation } from 'vanilla-native-federation';
import { consoleLogger } from 'vanilla-native-federation/plugins/logging';
import { sessionStorageEntry } from 'vanilla-native-federation/plugins/storage';
import { useImportMapShim } from 'vanilla-native-federation/plugins/module-loader';

(async () => {
  const manifest = {
    "remote1": "http://localhost:3001/remoteEntry.json",
    "remote2": "http://localhost:3002/remoteEntry.json",
  }
  initFederation(manifest, {
    logger: consoleLogger,                          // Optional: custom logger
    logLevel: "debug",                              // Optional: custom logLevel
    hostRemoteEntry: {url: "./remoteEntry.json"}    // Optional: host remoteEntry
    toStorageEntry: sessionStorageEntry,            // Optional: custom storage handler
    ...useImportMapShim("default"),                 // Optional: custom import handler (for legacy) 
  })
    .then(({loadRemoteModule, manifest}) => Promise.all([
      loadRemoteModule('remote1', './comp'),
      loadRemoteModule('remote2', './comp'),
    ]))
    .catch(console.error);
  })();
```

The `initFederation` will return the importMap object that was appended to the HTML page together with a `loadRemoteModule(<remote>, <exposed-comp>)` callback, this function can load remote modules using the imported dependencies from the importMap. The `loadRemoteModule` callback returns a `Promise<unknown>` that represents the remote module that was retrieved. The load fn cannot be used before initialization, hence it is provided after the init Promise is resolved. It is however entirely possible to link this callback to the global Window object.

Below are the types of the exposed functions: 

```
type InitFederation = (
    remotesOrManifestUrl: string | Record<string, string> = {},
    override: Partial<Config> & {steps?: Partial<StepFactories>} = {}
) => Promise<{loadRemoteModule: LoadRemoteModule, importMap: ImportMap}>


type LoadRemoteModule = (remoteName: string, exposedModule: string) => Promise<unknown>
```


## 3 &nbsp; Bundling your loader.js

You can use a simple ESBuild config to build your loader into a reusable script, the builder will assume a directory structure like shown below: 

**File structure:**
```
/
├── src/
│   ├── index.html
│   └── loader.js
│
├── dist/
│   ├── index.html
│   └── loader.js
│
├── build.js
├── package.json
└── node_modules/
```

The builder will bundle the `loader.js` into a ESM module so that it can be imported into the HTML file. 

**build.js**
```
import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));

fs.rmSync('dist', { force: true, recursive: true });
fs.mkdirSync('dist', { recursive: true });
fs.copyFileSync('src/index.html', 'dist/index.html');

esbuild.build({
  entryPoints: ['src/loader.js'],
  outdir: 'dist',
  bundle: true,
  platform: "browser",
  format: "esm",
  resolveExtensions: [".js", ".mjs"],
  splitting: false,
  minify: true,        
  sourcemap: false,      
  metafile: true,        
  target: ['es2022'],    
  treeShaking: true,
}).then(async (result) => {
  const text = await esbuild.analyzeMetafile(result.metafile);
  console.log(text);
}).catch(() => process.exit(1));
```

## 4 &nbsp; Examples

Below are some examples of how to use the library in different scenario's.

### 4.1 &nbsp; Communication through 'custom events': 
<hr>

Custom events can help streamline the import process, this way you can have a general initiation process and load modules on the fly. 

**loader.js**
```
import { initFederation } from 'vanilla-native-federation';
import { useImportMapShim } from 'vanilla-native-federation/plugins/module-loader';

(async () => {
    const jsonScript = document.getElementById('manifest');
    
    await initFederation(
      JSON.parse(jsonScript.textContent), 
      { ...useImportMapShim() }
    ).then(({loadRemoteModule}) => {
        window.dispatchEvent(new CustomEvent("mfe-loader-available", {detail: {loadRemoteModule}}));
    });
})();
```

Modules can be loaded by awaiting the `mfe-loader-available` event that will expose the `load` callback. 

**your-shell.html**
```
  <body>
    <!-- webcomponent exposed by remote1 -->
    <app-mfe-one></app-mfe-one>

    <script async src="https://ga.jspm.io/npm:es-module-shims@2.0.9/dist/es-module-shims.js"></script>


    <script>
      window.addEventListener('mfe-loader-available', (e) => {
        Promise.all([
          e.detail.loadRemoteModule('remote1', './Component'), 
        ]).catch(console.error);
      }, {once: true});
    </script>  
    <!-- your-orchestrator-implementation -->
    <script src="./loader.js"></script> 
  </body>
```

### 4.2 &nbsp; Custom logging: 

For debugging, the library contains a simple logger that can give a more detailed insight in the loading process

**loader.js**

```
import { initFederation, noopLogger } from 'vanilla-native-federation';
import { consoleLogger } from 'vanilla-native-federation/plugins/logging';

(() => {
  initFederation("http://localhost:3000", {
    logLevel: 'debug',     // 'debug'|'warn'|'error' -> default: 'error'
    logger: consoleLogger  // default: noopLogger
  })
    .then(({loadRemoteModule, manifest}) => {
      console.log("manifest: ", manifest);
      window.dispatchEvent(new CustomEvent("mfe-loader-available", {detail: {loadRemoteModule}}));
    })
})();
```

### 4.3 &nbsp; Generic loader.js: 
<hr>

It is possible to make the loader.js even more generic. This allows you to reduce the amount of config you have to provide to the loader.js.

**loader.js**
```
import { initFederation } from 'vanilla-native-federation';

const initMicroFrontends = (urlOrManifest, remotes) => {
  return initFederation(urlOrManifest)
    .then(({loadRemoteModule, importMap}) => Promise.all(
      remotes.map(r => loadRemoteModule(r, "./Component"))
    ))
}

export { initMicroFrontends };
```

Remotes can now be defined in the new method and the loading is abstracted away by the loader.js file. 

**your-shell.html**
```
  <body>
    <app-mfe-one></app-mfe-one>
    <app-mfe-two></app-mfe-two>

    <script src="https://ga.jspm.io/npm:es-module-shims@2.10.1/dist/es-module-shims.js"></script>

    <script type="module-shim">
      import { initMicroFrontends } from "./loader.js";

      (async () => {
        await initMicroFrontends(
          "http://localhost:3000", 
          ["remote1", "remote2"]
        )
      })()
    </script> 
  </body>
```


## 5 &nbsp; Plugins

There are a few plugins baked into the library to customize the initialization even further. 

## 5.2 &nbsp; Custom storage (caching): 

By default, native federation will use the window object as storage for all metadata and configuration, you can change this using a custom provided storage types like sessionStorage and localStorage: 

**loader.ts**
```
import { initFederation } from 'vanilla-native-federation';
import { sessionStorageEntry } from 'vanilla-native-federation/plugins/storage';

(() => {
  const manifest = {
    "remote1": "http://localhost:3001/remoteEntry.json"
  }
  initFederation(manifest, {toStorageEntry: sessionStorageEntry})
    .then(({loadRemoteModule, manifest}) => {
      console.log("manifest: ", manifest);
      window.dispatchEvent(new CustomEvent("mfe-loader-available", {detail: {loadRemoteModule}}));
    })
})();
```

## 5.2 &nbsp; Custom module loaders:

It is also possible to use custom module loaders like the es-module-shims package used in previous examples or the SystemJS module loader. 

```
import { initFederation } from 'vanilla-native-federation';
import { useSystemJS } from 'vanilla-native-federation/plugins/module-loader';

(() => {
  const manifest = {
    "remote1": "http://localhost:3001/remoteEntry.json"
  }
  initFederation(manifest, { ...useSystemJS() })
    .then(({loadRemoteModule, importMap}) => {
      console.log("manifest: ", manifest);
      window.dispatchEvent(new CustomEvent("mfe-loader-available", {detail: {loadRemoteModule}}));
    })
})();
```
