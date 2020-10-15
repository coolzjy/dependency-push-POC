const fs = require("fs");
const { parse } = require("es-module-lexer");
const isRelativeURL = require('is-relative-url');

exports.isFileAccessible = (path) => {
  return new Promise((resolve) => {
    fs.access(path, fs.constants.F_OK | fs.constants.R_OK, (error) => {
      if (error) return resolve(false);
      resolve(fs.lstatSync(path).isFile())
    });
  });
};

exports.readFile = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  });
};

exports.parseImports = async (code) => {
  let [imports] = await parse(code);
  const staticImports = imports.filter((i) => i.d <= -1);
  return staticImports.map((i) => code.substring(i.s, i.e)).filter(i => isRelativeURL(i)); 
};
