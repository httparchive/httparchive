/**
 * Generates custom-metrics/third-parties.js using the tests from the 
 * Library Detector project: https://github.com/johnmichel/Library-Detector-for-Chrome
 */
const fetch = require('node-fetch');
const fsp = require('fs-promise');

const LIBRARY_DETECTOR_URL = 'https://raw.githubusercontent.com/johnmichel/Library-Detector-for-Chrome/master/';
const LIBRARY_DETECTOR_MAIN_URL = `${LIBRARY_DETECTOR_URL}/library/libraries.js`;
const LIBRARY_DETECTOR_MANIFEST_URL = `${LIBRARY_DETECTOR_URL}/manifest.json`;
const LIBRARY_DETECTOR_VAR_PATTERN = /([a-f0-9]*_LibraryDetectorTests)/;
const TMP_FILE = 'tmp/libraryDetector.js';
const VERSION_METRIC_FILE = 'custom_metrics/lib-detector-version.js';
const OUTPUT_FILE = 'custom_metrics/third-parties.js';
const OUTPUT_HEAD = `/**
 * IMPORTANT: Do not modify this file directly! It is generated by
 *   bin/genthirdpartymetrics.js
 *
 * Detects the presence of third party libraries.
 *
 * Look for common library aliases on the global scope.
 * If available, detect libraries' versions.
 * Built on https://github.com/johnmichel/Library-Detector-for-Chrome.
 *
 * Outputs JSON-serialized list of library-version pairs.
 *     e.g.: \`["a@1.0","b","c@2.2"]\`
 */
var thirdParties = [];

function addThirdParty(name, version) {
	if (!name) {
		return;
	}

	if (version) {
		name += '@' + (version || 'null');
	}

	thirdParties.push(name);
}

`;
const OUTPUT_FOOT = `
Object.entries(\${LIBRARY_DETECTOR_VAR}).forEach(([name, lib]) => {
  const result = lib.test(window);
  if (result) {
    addThirdParty(name, result.version);
  }
});

return JSON.stringify(thirdParties);
`;


function getLibraryDetectorMain() {
  return fetch(LIBRARY_DETECTOR_MAIN_URL).then(res => res.text());
}

function getLibraryDetectorManifest() {
  return fetch(LIBRARY_DETECTOR_MANIFEST_URL).then(res => res.json());
}

function getLibraryDetectorVersion() {
  return getLibraryDetectorManifest().then(manifest => manifest.version);
}

function extractVarName(main) {
  const match = LIBRARY_DETECTOR_VAR_PATTERN.exec(main);
  return match && match[0];
}

getLibraryDetectorVersion().then(version => {
  fsp.writeFile(VERSION_METRIC_FILE, `/**
 * IMPORTANT: Do not modify this file directly! It is generated by
 *   bin/genthirdpartymetrics.js
 */
return '${version}';\n`).then(_ => {
    console.log(`Wrote version ${version} to ${VERSION_METRIC_FILE}.`);
  });
});

getLibraryDetectorMain().then(main => {
  const varName = extractVarName(main);

  fsp.writeFile(TMP_FILE, main).then(_ => {
    console.log(`Library Detector source code written to ${TMP_FILE}.`);
  });

  // Update references to the library detector variable.
  const head = OUTPUT_HEAD.replace('${LIBRARY_DETECTOR_VAR}', varName);
  const foot = OUTPUT_FOOT.replace('${LIBRARY_DETECTOR_VAR}', varName);

  fsp.writeFile(OUTPUT_FILE, head)
      .then(_ => fsp.appendFile(OUTPUT_FILE, main))
      .then(_ => fsp.appendFile(OUTPUT_FILE, foot))
      .then(_ => console.log(`Third party JS custom metric source code written to ${OUTPUT_FILE}.`))
      .catch(err => console.error(err));
});
