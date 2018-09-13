'use strict';
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;

const findFiles = (dir, files = [], re = /.*/) => {
  if (fs.exists(dir)) {
    fs.readdirSync(dir).forEach(fn => {
      const f = path.join(dir, fn);
      //console.log(fn);
      if (fs.statSync(f).isDirectory() && fn !== 'node_modules' && fn !== 'dependencies') {
        findFiles(f, files, re);
      } else {
        if (re.test(f)) {
          files.push(f);
        }
      }
    });
  }
  return files;
};

// exclude filename patterns that aren't useful when running inside lambda environment
const excludePatterns = new RegExp('(' + [
  '\.bin\/',
  '\.idea\/',
  '\.github\/',
  'changelog',
  'readme',
  'examples',
  'test',
  'license',
  'licence', // mispelled... lol
  '\.patch$',
  '\.ts$',
  '\.jsx$',
  '\.sh$',
  '\.md$',
  '\.html$',
  '\.txt$',
  '\.min\.js$', // browser based minified js
  '_browser\.js$',
  'package-lock\.json$',
  'yarn\.lock$',
  'tsconfig\.json$',
  'babelrc',
  'typings\.json$',
  'travis\.yml$',
  'editorconfig',
  'circleci',
  '\.npmignore$',
  'Makefile$',
  'bower\.json$',
  'webpack\.config\.js$',
].join('|') + ')', 'i');


// clean files function
const cleanFiles = dir => findFiles(dir, [], excludePatterns).forEach(fn => fs.unlinkSync(fn));

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'before:webpack:package:packageModules': this.package.bind(this)
    };
  }

  async package() {
    const dir = path.join(process.cwd(), '.webpack');
    const files = findFiles(dir, [], /package\.json$/);
    await Promise.all(files.map(fn => {
      return new Promise((resolve, reject) => {
        const pkg = JSON.parse(fs.readFileSync(fn));
        delete pkg.dependencies['aws-sdk'];
        fs.writeFileSync(fn, JSON.stringify(pkg, null, 2));
        const p = exec('npm install', {
          cwd: path.dirname(fn),
        });
        p.on('exit', () => {
          const ldir = path.dirname(fn);
          cleanFiles(path.join(ldir, 'node_modules'));
          fs.unlinkSync(path.join(ldir, 'package-lock.json'));
          resolve();
        });
        p.on('error', reject);
      });
    }))
  }
}

module.exports = ServerlessPlugin;
